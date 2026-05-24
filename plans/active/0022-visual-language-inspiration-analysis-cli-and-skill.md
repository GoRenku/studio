# 0022 Visual Language Inspiration Analysis CLI And Skill

Date: 2026-05-23

Status: implemented

## Goal

Design the Renku Studio CLI commands and Studio Skills workflow that let an
agent analyze a Visual Language Inspiration folder made from the user's stored
images.

This replaces the standalone FilmGrab-centered prototype workflow with a
project-native workflow:

- the user creates an Inspiration folder in Renku Studio;
- the user drops or uploads reference images into that folder;
- an agent reads the folder name and folder path through the CLI;
- the agent uses the folder name as a creative and research hint when it looks
  like a known movie, director, cinematographer, photographer, painter,
  movement, period, place, or other visual reference;
- the agent uses normal filesystem commands such as `cd`, `ls`, and `find` to
  inspect the files inside the folder;
- the agent analyzes every available image as a coherent visual system;
- the agent writes a schema-validated Inspiration Analysis JSON document through
  the CLI;
- Studio renders the persisted analysis in the Inspiration Analysis tab.

The CLI should be reliable enough for skills and agents. Agents must not edit
SQLite directly, infer project paths, or write analysis into ad hoc files as the
source of truth.

Renku should not register individual Inspiration images as assets in SQLite and
does not need a CLI command that lists each image. Inspiration images are plain
filesystem content owned by the Inspiration folder.

## References

- `plans/active/0020-visual-language-inspiration-lookbook-data-model.md`
- `plans/active/0021-visual-language-inspiration-lookbook-ui.md`
- `plans/active/0016-screenplay-json-cli-commands.md`
- `plans/active/0017-screenplay-json-cli-gap-plan.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/project-relative-paths.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/json-storage-validation.md`
- `docs/architecture/naming-guidelines.md`
- `/Users/keremk/Projects/cinema-analyze/skills/renku-cinema-analyze/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/README.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/references/screenplay-json-workflow.md`

## Current Baseline

The first Visual Language implementation already includes:

- `packages/cli/src/commands/visual-language-command.ts`
- `packages/core/src/server/commands/inspiration-commands.ts`
- `packages/core/src/server/resources/inspiration.ts`
- `packages/core/src/server/visual-language-json/validator.ts`
- `packages/core/src/client/visual-language.ts`
- `packages/core/src/client/visual-language-json-schemas.ts`

The earlier nested Inspiration command surface is the surface this plan
replaces. Inspiration should become a first-class top-level CLI command because
it is a real agent workflow, not a sub-mode that benefits from an extra
namespace.

Useful existing behavior:

- Inspiration folders have durable IDs and human-readable names.
- Folder contents are filesystem-owned.
- Analysis JSON is stored in SQLite by section.
- Analysis image references are validated against filenames that actually exist
  in the folder.
- Commands can target either `--project <project-name>` or the current
  authoring project.

Gaps for agent and skill use:

- There is no explicit `validate` command for analysis JSON.
- `read` is a programmer word; the agent-facing command should be `show`.
- `read-analysis` returns only the analysis and omits the folder context that
  helps the agent recover from null or missing state.
- Command outputs are raw resources, not consistent command reports with
  `valid`, `warnings`, `project`, `resourceKeys`, and `changes`.
- The CLI does not return the folder path that an agent needs in order to inspect
  the user's image files with filesystem commands.
- The top-level Inspiration Analysis document shape is not represented as a
  stable schema. The validator currently validates the section object directly.

Because Renku Studio is pre-customer software, update these commands directly.
Remove the older nested CLI prefix instead of keeping it as an agent-facing
namespace. Do not keep compatibility aliases for the replaced Inspiration
command names once the new surface lands.

## Command Design

Use a direct top-level `inspiration` command. The extra
`visual-language` prefix is unnecessary for agent workflows and makes every
skill command noisier.

Use `analysis` as a nested sub-area when the operation is specifically about
the analysis document.

### Project Preflight

Inspiration commands should follow the current-project behavior used by the
screenplay CLI:

```bash
renku project open <project-name> --json
renku project current --json
```

Every command may also accept `--project <project-name>` for one-off targeting,
matching the existing Visual Language implementation.

If neither `--project` nor a current authoring project exists, fail with the
same structured current-project diagnostic used by screenplay commands. The
suggestion should tell the agent to run:

```text
renku project open <project-name> --json
```

### Folder Commands

```bash
renku inspiration list --json
renku inspiration create --name <name> --json
renku inspiration show --folder <folder-id> --json
renku inspiration rename --folder <folder-id> --name <name> --json
renku inspiration reorder --file <folder-order-json> --json
renku inspiration delete --folder <folder-id> --json
```

`show` should return the complete folder resource:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica",
    "projectFolder": "/Users/example/Renku/urban-basilica"
  },
  "folder": {
    "id": "inspiration_folder_abc",
    "name": "Blade Runner 2049",
    "projectRelativePath": "visual-language/inspiration/blade-runner-2049",
    "absolutePath": "/Users/example/Renku/urban-basilica/visual-language/inspiration/blade-runner-2049"
  },
  "analysis": null,
  "resourceKeys": [
    "surface:visual-language:inspiration",
    "surface:visual-language:inspiration:inspiration_folder_abc"
  ]
}
```

The folder absolute path is command output only. It must not be stored in
SQLite. SQLite continues to store the project-relative folder path.

Agents should inspect files inside the folder with normal shell commands, for
example:

```bash
cd "/Users/example/Renku/urban-basilica/visual-language/inspiration/blade-runner-2049"
find . -maxdepth 1 -type f
```

Do not add an `inspiration images` command. Per-image listing is not a Renku CLI
responsibility.

### Analysis Commands

```bash
renku inspiration analysis show --folder <folder-id> --json
renku inspiration analysis validate --folder <folder-id> --file <analysis-json> --json
renku inspiration analysis write --folder <folder-id> --file <analysis-json> --json
```

`analysis show` should include folder context and the existing analysis:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica",
    "projectFolder": "/Users/example/Renku/urban-basilica"
  },
  "folder": {
    "id": "inspiration_folder_abc",
    "name": "Blade Runner 2049",
    "projectRelativePath": "visual-language/inspiration/blade-runner-2049",
    "absolutePath": "/Users/example/Renku/urban-basilica/visual-language/inspiration/blade-runner-2049"
  },
  "analysis": {
    "folderId": "inspiration_folder_abc",
    "thesis": {
      "statement": "Reference images use hard practical contrast...",
      "principles": ["Let practical sources define shadow direction."]
    },
    "palette": {
      "description": "Muted cyan and sodium amber...",
      "colors": [
        {
          "hex": "#4F6B72",
          "name": "Industrial cyan",
          "meaning": "Distance, metal, institutional coolness."
        }
      ],
      "observations": []
    },
    "toneMood": {
      "tone": "weathered neon restraint",
      "moodTags": ["lonely", "humid", "procedural"],
      "description": "..."
    },
    "composition": {
      "description": "...",
      "patterns": []
    },
    "lighting": {
      "description": "...",
      "patterns": []
    },
    "texture": {
      "description": "...",
      "observations": []
    },
    "inspiredBy": {
      "description": "...",
      "items": []
    }
  },
  "resourceKeys": [
    "surface:visual-language:inspiration",
    "surface:visual-language:inspiration:inspiration_folder_abc"
  ]
}
```

`analysis validate` should run the same parse, schema, semantic, and image
reference validation that `analysis write` uses, but must not mutate the
database.

`analysis write` should upsert the persisted analysis and return a mutation
report:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica",
    "projectFolder": "/Users/example/Renku/urban-basilica"
  },
  "changes": [
    {
      "type": "inspirationAnalysis.upserted",
      "folderId": "inspiration_folder_abc"
    }
  ],
  "folder": {
    "id": "inspiration_folder_abc",
    "name": "Blade Runner 2049",
    "projectRelativePath": "visual-language/inspiration/blade-runner-2049",
    "absolutePath": "/Users/example/Renku/urban-basilica/visual-language/inspiration/blade-runner-2049"
  },
  "analysis": {
    "folderId": "inspiration_folder_abc",
    "thesis": {
      "statement": "...",
      "principles": ["..."]
    }
  },
  "resourceKeys": [
    "surface:visual-language:inspiration",
    "surface:visual-language:inspiration:inspiration_folder_abc"
  ]
}
```

After successful mutation, append Studio resource-changed coordination events
for the returned `resourceKeys`.

## Inspiration Analysis JSON Document

Move the agent-authored file shape from "bare sections object" to a tagged
document, matching the screenplay CLI's explicit document style.

```json
{
  "kind": "inspirationAnalysis",
  "analysis": {
    "thesis": {
      "statement": "3-5 sentence thesis of the folder's visual language.",
      "principles": [
        "Imperative cinematography principle another DP could test."
      ],
      "imageFiles": ["frame-001.jpg"]
    },
    "palette": {
      "description": "How color operates as a strategy.",
      "colors": [
        {
          "hex": "#4F6B72",
          "name": "Industrial cyan",
          "meaning": "What this color does visually or narratively."
        }
      ],
      "observations": [
        {
          "text": "Specific color observation.",
          "imageFiles": ["frame-001.jpg"]
        }
      ]
    },
    "toneMood": {
      "tone": "short tonal phrase",
      "moodTags": ["lonely", "humid", "procedural"],
      "description": "How shadows, midtones, highlights, contrast, saturation, and day/night behavior work.",
      "imageFiles": ["frame-001.jpg"]
    },
    "composition": {
      "description": "Overall compositional strategy.",
      "patterns": [
        {
          "name": "Memorable pattern name",
          "description": "How it works.",
          "imageFiles": ["frame-001.jpg"]
        }
      ]
    },
    "lighting": {
      "description": "Overall lighting approach.",
      "patterns": [
        {
          "name": "Memorable technique name",
          "description": "How it is used.",
          "imageFiles": ["frame-001.jpg"]
        }
      ]
    },
    "texture": {
      "description": "Surface, grain, tactility, lens/filter feel, production texture.",
      "observations": [
        {
          "text": "Specific texture observation.",
          "imageFiles": ["frame-001.jpg"]
        }
      ]
    },
    "inspiredBy": {
      "description": "Visual-lineage note. Explain that these are potential affinities, not confirmed influences unless sourced.",
      "items": [
        {
          "category": "movie",
          "name": "Reference name",
          "confidence": "medium",
          "why": "What specific visual strategy this folder shares with the reference.",
          "imageFiles": ["frame-001.jpg"]
        }
      ]
    }
  }
}
```

Rules:

- The folder ID comes from `--folder`, not the JSON file.
- The folder name is command context, not persisted inside the analysis JSON.
  The skill should still use it while authoring the analysis because it often
  contains the movie, director, cinematographer, or other reference that makes
  the image folder intelligible.
- `imageFiles` values are folder-local filenames only, not project-relative or
  absolute paths.
- Unknown fields are rejected for this agent-authored format. This is different
  from YAML import, where unknown fields are warnings by project rule.
- Missing required fields are errors.
- Empty strings are errors.
- `imageFiles` references that do not exist in the folder are errors.
- The document should be read, validated, and normalized in core before any
  write happens.

## Schema And Validation Implementation

Add top-level document schemas to:

```text
packages/core/src/client/visual-language-json-schemas.ts
```

Expected exports:

```ts
export const inspirationAnalysisDocumentSchema = { ... } as const;
export const inspirationAnalysisSectionsSchema = { ... } as const;
```

Keep the existing section schemas as reusable building blocks:

- `thesisSectionSchema`
- `paletteSectionSchema`
- `toneMoodSectionSchema`
- `patternSectionSchema`
- `textureSectionSchema`
- `inspiredBySectionSchema`

Update:

```text
packages/core/src/server/visual-language-json/validator.ts
```

Expected core functions:

```ts
export interface InspirationAnalysisDocument {
  kind: 'inspirationAnalysis';
  analysis: InspirationAnalysisSections;
}

export function parseInspirationAnalysisDocument(input: {
  contents: string;
  filePath?: string;
}): InspirationAnalysisDocument;

export function validateInspirationAnalysisDocument(input: {
  document: InspirationAnalysisDocument;
  folderImageFiles: Set<string>;
  filePath?: string;
}): DiagnosticResult;
```

Implementation notes:

- Use AJV 2020, matching the existing validator.
- Continue collecting all actionable validation issues before failing.
- Continue using `PROJECT_DATA230` as the wrapper code for Visual Language JSON
  validation failures unless a clearer existing code applies.
- Keep specific issue codes such as `PROJECT_DATA206` for required fields and
  `PROJECT_DATA233` for invalid image references.
- Add tests proving validation and write use the same pipeline.

## Core Service Implementation

Add command report types in:

```text
packages/core/src/client/visual-language.ts
```

Suggested names:

```ts
export interface VisualLanguageCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: VisualLanguageProjectReport;
  changes: VisualLanguageChange[];
  resourceKeys: string[];
}

export interface InspirationFolderReport extends VisualLanguageCommandReport {
  folder: InspirationFolderWithResolvedPath;
  analysis: InspirationAnalysis | null;
}

export interface InspirationAnalysisWriteReport extends VisualLanguageCommandReport {
  folder: InspirationFolderWithResolvedPath;
  analysis: InspirationAnalysis;
}
```

Keep naming specific. Avoid generic `data`, `item`, `detail`, or `manager`
types.

Add service contracts in:

```text
packages/core/src/server/project-data-service-contracts.ts
```

Expected additions:

```ts
validateInspirationAnalysis(input: ValidateInspirationAnalysisInput): Promise<InspirationAnalysisValidationReport>;
writeInspirationAnalysis(input: WriteInspirationAnalysisInput): Promise<InspirationAnalysisWriteReport>;
readInspirationAnalysis(input: ReadInspirationAnalysisInput): Promise<InspirationFolderReport>;
```

The public service method should be named `writeInspirationAnalysis`. Lower
level database access can still use storage-oriented naming when it is not part
of the package boundary.

Update implementation in:

```text
packages/core/src/server/commands/inspiration-commands.ts
packages/core/src/server/resources/inspiration.ts
```

Expected responsibilities:

- Resolve the current project or explicit project.
- Read folder metadata from SQLite.
- Resolve the folder path for CLI output only.
- Read folder filenames from disk internally when validating `imageFiles`
  references.
- Validate analysis document against the folder image filenames.
- Upsert analysis section JSON atomically.
- Return consistent command reports.
- Append Studio resource refresh events after successful writes.

Do not register Inspiration images as assets, store per-image rows in SQLite, or
return per-image CLI resources. The filesystem is the source of truth for files
inside the folder.

## CLI Implementation

Update:

```text
packages/cli/src/commands/inspiration-command.ts
packages/cli/src/cli.ts
packages/cli/src/cli.test.ts
docs/cli/commands.md
```

Delete or split the existing Visual Language CLI adapter:

```text
packages/cli/src/commands/visual-language-command.ts
```

Do not keep a stub file that forwards the replaced nested Inspiration command
path to the new command. That would preserve an obsolete command path and
violate the project rule against compatibility layers.

Add flags:

```text
--folder
--name
--file
--project
--json
```

The existing global flags mostly cover this plan. The CLI dispatcher should
route the top-level `inspiration` command directly instead of routing through
`visual-language`. The CLI help text should list `inspiration` directly and
remove the old `visual-language` command entry when Lookbook has also moved.

Add direct Inspiration command parsing:

```ts
const [action, nested] = options.input;
```

Examples:

```bash
renku inspiration show --folder inspiration_folder_abc --json
renku inspiration analysis show --folder inspiration_folder_abc --json
renku inspiration analysis validate --folder inspiration_folder_abc --file analysis.json --json
renku inspiration analysis write --folder inspiration_folder_abc --file analysis.json --json
```

When `--file -` is used, read JSON from stdin.

Readable-file errors should use a structured CLI diagnostic, matching
`screenplay-command.ts`:

- `CLI082` for unreadable JSON input files.
- `CLI083` for stdin read failure.
- `PROJECT_DATA201` for invalid JSON.

## Studio Skills Project

Add a new skill to:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/inspiration-analyzer/
```

Recommended structure:

```text
skills/inspiration-analyzer/
  SKILL.md
  agents/
    openai.yaml
  references/
    cinematography-analysis-guidelines.md
    inspiration-analysis-json-contract.md
    inspiration-analysis-cli-workflow.md
  samples/
    analysis.json
```

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/README.md
```

### Skill Description

Use a direct description:

```yaml
name: inspiration-analyzer
description: Analyze a Renku Studio Visual Language Inspiration folder from its stored image files, then validate and write a project-native Inspiration Analysis JSON document through the Renku CLI.
```

### Progressive Disclosure Instructions

`SKILL.md` should be short and operational. It should not paste the full JSON
schema into the main file.

Main file sections:

- Start Here
- Project Preflight
- Analyze A Folder
- Write And Validate
- Reference Files
- Non-Negotiables
- Quality Bar

Reference files:

- `inspiration-analysis-cli-workflow.md`: command order, current project,
  folder discovery, validate/write/show commands, report handling.
- `inspiration-analysis-json-contract.md`: exact `kind:
  "inspirationAnalysis"` JSON shape and field rules.
- `cinematography-analysis-guidelines.md`: the craft guidance adapted from the
  FilmGrab prototype, including how to use the folder name as a reference hint
  and how to separate visual evidence from contextual knowledge.

### Skill Workflow

The skill should follow this command order.

1. Resolve project context:

```bash
renku project open <project-name> --json
```

2. List folders if the user did not give a folder ID:

```bash
renku inspiration list --json
```

3. Inspect the chosen folder:

```bash
renku inspiration show --folder <folder-id> --json
```

4. Interpret the returned folder name as a reference hint. If it appears to name
   a known movie, director, cinematographer, photographer, visual artist,
   movement, period, or location, use that context to sharpen the analysis.

5. Use the returned folder path to inspect the folder with filesystem commands:

```bash
cd "<folder.absolutePath>"
find . -maxdepth 1 -type f
```

6. Analyze every supported image file in that folder.

7. Write `inspirationAnalysis` JSON.

8. Validate:

```bash
renku inspiration analysis validate --folder <folder-id> --file <analysis-json> --json
```

9. Write:

```bash
renku inspiration analysis write --folder <folder-id> --file <analysis-json> --json
```

10. Read back:

```bash
renku inspiration analysis show --folder <folder-id> --json
```

### Cinematography Analysis Guidance

Carry forward the useful analysis rules from the prototype:

- Write for working cinematographers: concrete, visual, and repeatable.
- Use the folder name as an important creative and research hint. It is often a
  movie title, director, cinematographer, photographer, painter, period,
  movement, location, or production phrase chosen specifically to improve the
  analysis.
- If the folder name points to a known reference, use whatever reliable context
  is available to improve the analysis: known collaborators, era, format, genre,
  visual movement, cinematographer signatures, director signatures, production
  context, or recurring visual strategies.
- Let that context guide what to look for in the images, but keep the analysis
  grounded in the actual folder files. For example, if the folder is named
  `Blade Runner 2049`, it is useful to bring knowledge of Roger Deakins,
  large-scale haze, controlled color fields, and monumental negative space, but
  each claim in the persisted analysis should still be supported by images in
  the folder.
- Separate what is visibly observed from what is contextual knowledge or a
  plausible affinity. Do not present uncertain credits, influence, or production
  history as fact.
- Inspect every supported image file in the Inspiration folder. Do not analyze
  only a few favorite frames.
- Study the complete folder as a system, not isolated pretty images.
- Ground every claim in actual images from the folder.
- Cite image filenames only when they visibly demonstrate the exact point.
- Prefer 2-4 supporting images per observation when available. One strong image
  is better than four weak ones.
- Avoid generic film-school labels unless the analysis explains what the
  strategy does in this folder.
- Treat "Inspired By" as visual lineage, not verified production history.
- Use cautious language such as "potentially echoes", "shares a strategy with",
  or "sits near" unless the user supplied a source.

### Non-Negotiables

The skill must say:

- Do not write directly to `.renku/project.sqlite`.
- Do not register Inspiration images as assets or create per-image database
  records.
- Do not store absolute paths in the JSON document.
- Do not use project-relative paths in `imageFiles`; use folder-local filenames.
- Do not write analysis until `validate` passes.
- Do not omit images that are present unless the file is unreadable or not a
  supported image.
- Do not invent director, cinematographer, year, or production history from the
  folder name. Use known information when it is reliable; otherwise qualify it
  as an inference or leave it out.

## Tests

Add CLI tests covering:

- `inspiration show` returns folder context, the folder path, existing analysis,
  and resource keys.
- `inspiration analysis validate` succeeds without writing.
- `inspiration analysis validate` fails when `imageFiles` references a missing
  filename.
- `inspiration analysis write` writes after successful validation and returns a
  command report.
- `inspiration analysis write --file -` reads stdin.
- unreadable files produce structured CLI errors.
- old command names are not accepted after the new command surface replaces
  them.

Add core tests covering:

- top-level `kind: "inspirationAnalysis"` schema validation;
- missing required sections;
- unknown fields rejected;
- empty strings rejected;
- all image-reference errors collected before failure;
- no database mutation on validation failure;
- Studio resource keys are returned after mutation.

## Implementation Checklist

- [x] Add top-level Inspiration Analysis document schema.
- [x] Add parse and validation functions for `kind: "inspirationAnalysis"`.
- [x] Add a resolved-folder-path report type for Inspiration folders.
- [x] Replace public `upsertInspirationAnalysis` service naming with
      `writeInspirationAnalysis`.
- [x] Add `validateInspirationAnalysis`.
- [x] Add `readInspirationAnalysis`.
- [x] Ensure no `inspiration images` command or per-image CLI report is added.
- [x] Ensure Inspiration images are not registered as assets or tracked as
      per-image SQLite rows.
- [x] Add direct top-level `inspiration` CLI parsing.
- [x] Remove the `visual-language inspiration ...` CLI surface instead of
      keeping aliases.
- [x] Replace old `read`, `write-analysis`, and `read-analysis` commands with
      `show`, `analysis write`, and `analysis show`.
- [x] Return consistent command reports.
- [x] Append Studio refresh events after successful analysis writes.
- [x] Document the new commands in `docs/cli/commands.md`.
- [x] Add the `inspiration-analyzer` skill to `studio-skills`.
- [x] Add progressive disclosure reference files for the skill.
- [x] Update `studio-skills/README.md`.

## Open Questions

- Should `inspiration list` include a compact `imageCount` and `hasAnalysis`?
  This would help agent selection and UI lists. It is useful but not required
  for the analyzer skill if `show` remains cheap. If `imageCount` is added, it
  should be computed from the filesystem on read and not backed by per-image
  SQLite records.
