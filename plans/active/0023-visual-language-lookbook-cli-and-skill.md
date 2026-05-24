# 0023 Visual Language Lookbook CLI And Skill

Date: 2026-05-23

Status: active draft

## Goal

Design the Renku Studio CLI commands and Studio Skills workflow that let agents
create and revise multiple Visual Language Lookbooks.

The Lookbook workflow is agent-assisted but project-native:

- the user can ask for a new lookbook idea;
- the user can ask to revise an existing lookbook;
- the user can base a lookbook on one or more Inspiration folders and their
  analysis;
- the agent reads existing Inspiration analyses, folder paths, current lookbooks,
  screenplay/project context when useful, and user preferences;
- when the agent needs to inspect source images, it uses normal filesystem
  commands inside the Inspiration folder;
- the agent writes a schema-validated Lookbook JSON document through the CLI;
- Renku persists the Lookbook as durable project state;
- Studio renders the Lookbook list, active Lookbook, and Lookbook detail view.

The CLI should make the mechanical parts simple enough for skills:

- discover existing Lookbooks;
- read a specific Lookbook;
- validate candidate Lookbook JSON;
- create a new Lookbook;
- update an existing Lookbook;
- set or clear the active Lookbook;
- read source Inspiration folders and analyses;
- attach generated example images to Lookbook sections.

Agents must not write SQLite directly, preserve obsolete command aliases, or use
Lookbook JSON as an image placement mechanism.

## References

- `plans/active/0020-visual-language-inspiration-lookbook-data-model.md`
- `plans/active/0021-visual-language-inspiration-lookbook-ui.md`
- `plans/active/0022-visual-language-inspiration-analysis-cli-and-skill.md`
- `plans/active/0016-screenplay-json-cli-commands.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/project-relative-paths.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/json-storage-validation.md`
- `docs/architecture/naming-guidelines.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/README.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/SKILL.md`

## Current Baseline

The first Visual Language implementation already includes Lookbook storage and
commands:

```bash
renku visual-language lookbook list --json
renku visual-language lookbook read --lookbook <lookbook-id> --json
renku visual-language lookbook create --name <name> --file <lookbook-json> --json
renku visual-language lookbook update --lookbook <lookbook-id> --file <lookbook-json> --json
renku visual-language lookbook delete --lookbook <lookbook-id> --json
renku visual-language lookbook set-active --lookbook <lookbook-id> --json
renku visual-language lookbook clear-active --json
renku visual-language lookbook import-image --lookbook <lookbook-id> --file <project-relative-path> --sections <sections> --json
renku visual-language lookbook set-card-image --lookbook <lookbook-id> --file <image-id> --json
```

That nested `visual-language` command is the surface this plan replaces.
Lookbook should become a first-class top-level CLI command because it is a core
agent workflow, and the extra namespace makes skill commands harder to read.

Useful existing behavior:

- Multiple Lookbooks are supported.
- Zero or one active Lookbook is supported.
- Lookbook sections are validated with the current Visual Language section
  schemas.
- Lookbook JSON rejects `imageFiles`.
- Lookbook images are registered as project assets and related to sections
  through `lookbook_image_section` rows.
- Lookbook card images are explicit relationships.

Gaps for agent and skill use:

- There is no `validate` command for Lookbook JSON.
- `read` should become `show` for consistency with user-facing CLI language.
- Mutation commands return raw objects or `{ ok: true }` instead of consistent
  command reports.
- `set-card-image` currently uses `--file` for an image ID, which is confusing.
- There is no CLI command for changing a Lookbook image's section placement,
  even though core already has `setLookbookImageSections`.
- There is no durable way to record which Inspiration folders a Lookbook was
  based on.
- The top-level Lookbook JSON document shape is not represented as a stable
  schema. The validator currently validates the sections object directly.
- Commands do not yet append Studio refresh events after successful mutations.

Because Renku Studio is pre-customer software, update the command names
directly. Remove the `visual-language` CLI prefix instead of keeping it as an
agent-facing namespace. Do not keep compatibility aliases for the old
`visual-language lookbook ...`, `read`, `set-card-image --file`, or direct
bare-section JSON input.

## Command Design

Use a direct top-level `lookbook` command. The extra `visual-language` prefix is
unnecessary for agent workflows and makes every skill command noisier.

Use `image` for image placement mechanics, `card-image` for card image
mechanics, and `inspiration` for Lookbook source Inspiration relationships.

### Project Preflight

Lookbook commands should follow the same current-project behavior as screenplay
and Inspiration analysis commands:

```bash
renku project open <project-name> --json
renku project current --json
```

Every command may also accept `--project <project-name>` for one-off targeting.

If neither `--project` nor a current authoring project exists, fail with the
structured current-project diagnostic and tell the agent to open a project.

## Lookbook Commands

```bash
renku lookbook list --json
renku lookbook show --lookbook <lookbook-id> --json
renku lookbook validate --file <lookbook-json> --json
renku lookbook create --name <name> --file <lookbook-json> --json
renku lookbook update --lookbook <lookbook-id> --file <lookbook-json> --json
renku lookbook rename --lookbook <lookbook-id> --name <name> --json
renku lookbook delete --lookbook <lookbook-id> --json
renku lookbook set-active --lookbook <lookbook-id> --json
renku lookbook clear-active --json
```

`list` should return a report:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica",
    "projectFolder": "/Users/example/Renku/urban-basilica"
  },
  "activeLookbookId": "lookbook_abc",
  "lookbooks": [
    {
      "lookbook": {
        "id": "lookbook_abc",
        "name": "Ivory Siege",
        "thesis": {
          "statement": "...",
          "principles": ["..."]
        }
      },
      "cardImage": null,
      "isActive": true,
      "sourceInspirationFolders": [
        {
          "id": "inspiration_folder_blade_runner",
          "name": "Blade Runner 2049",
          "projectRelativePath": "visual-language/inspiration/blade-runner-2049",
          "absolutePath": "/Users/example/Renku/urban-basilica/visual-language/inspiration/blade-runner-2049"
        }
      ]
    }
  ],
  "resourceKeys": ["surface:visual-language:lookbooks"]
}
```

`show` should return the full Lookbook resource:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica",
    "projectFolder": "/Users/example/Renku/urban-basilica"
  },
  "lookbook": {
    "id": "lookbook_abc",
    "name": "Ivory Siege",
    "thesis": {
      "statement": "...",
      "principles": ["..."]
    },
    "palette": {
      "description": "...",
      "colors": [],
      "observations": []
    },
    "toneMood": {
      "tone": "...",
      "moodTags": ["..."],
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
    "camera": {
      "description": "...",
      "movement": [],
      "motion": [],
      "framing": []
    }
  },
  "sourceInspirationFolders": [],
  "cardImage": null,
  "isActive": true,
  "images": [],
  "imagesBySection": {
    "thesis": [],
    "palette": [],
    "tone_mood": [],
    "composition": [],
    "lighting": [],
    "texture": [],
    "camera": []
  },
  "resourceKeys": [
    "surface:visual-language:lookbooks",
    "surface:visual-language:lookbook:lookbook_abc"
  ]
}
```

`validate` should parse and validate the top-level Lookbook document but never
write.

`create`, `update`, `rename`, `delete`, `set-active`, and `clear-active` should
return mutation reports with:

- `valid: true`;
- `warnings`;
- `project`;
- `changes`;
- affected Lookbook data when available;
- `resourceKeys` for Studio refresh.

Examples of `changes`:

```json
[
  {
    "type": "lookbook.created",
    "lookbookId": "lookbook_abc"
  },
  {
    "type": "lookbook.activeSet",
    "lookbookId": "lookbook_abc"
  }
]
```

After successful mutation, append Studio resource-changed coordination events
for returned `resourceKeys`.

## Lookbook Image Commands

```bash
renku lookbook image import \
  --lookbook <lookbook-id> \
  --file <project-relative-path> \
  --sections <comma-separated-section-keys> \
  --json

renku lookbook image set-sections \
  --image <lookbook-image-id> \
  --sections <comma-separated-section-keys> \
  --json

renku lookbook image delete \
  --image <lookbook-image-id> \
  --json

renku lookbook card-image set \
  --lookbook <lookbook-id> \
  --image <lookbook-image-id> \
  --json

renku lookbook card-image clear \
  --lookbook <lookbook-id> \
  --json
```

Add a dedicated CLI flag:

```text
--image
```

Do not use `--file` for image IDs.

Valid section keys:

```text
thesis,palette,tone_mood,composition,lighting,texture,camera
```

Image import should keep the existing storage behavior:

- source file must be a project-relative path inside the project;
- core copies the file to `visual-language/lookbook/`;
- core registers an `asset` and `asset_file`;
- core creates a `lookbook_image`;
- section placement is stored in `lookbook_image_section`, not in JSON.

`card-image clear` requires a small core addition. If omitted from the first
implementation slice, the UI can still survive because deleting the chosen image
should remove the relationship. The command is still worth designing now because
it is the natural inverse of `card-image set`.

## Source Inspiration Commands

The Lookbook skill needs to read Inspiration folders and analyses. It should use
the commands from plan 0022:

```bash
renku inspiration list --json
renku inspiration show --folder <folder-id> --json
renku inspiration analysis show --folder <folder-id> --json
```

Those commands return folder metadata and folder paths, not per-image listings.
If an agent needs to inspect the source images, it should `cd` into the returned
folder path and use shell commands such as `ls` or `find`. Renku should not
register individual Inspiration images as assets or track them as per-image
SQLite rows.

The Lookbook command surface should also support durable source relationships:

```bash
renku lookbook inspiration set \
  --lookbook <lookbook-id> \
  --file <source-inspiration-json> \
  --json

renku lookbook inspiration list \
  --lookbook <lookbook-id> \
  --json
```

Source JSON shape:

```json
{
  "kind": "lookbookSourceInspirations",
  "inspirationFolderIds": [
    "inspiration_folder_blade_runner",
    "inspiration_folder_deakins"
  ]
}
```

Rules:

- Every folder ID must exist.
- Duplicate folder IDs are warnings or errors. Prefer errors for a clean first
  contract.
- The order is meaningful. It records the order in which the source references
  influenced the Lookbook.
- Source relationships should not duplicate analysis JSON inside the Lookbook.
  Agents can read the current analysis from the Inspiration folders.

## Data Model Addition

Add a small relationship table:

```text
lookbook_inspiration
  id text primary key
  lookbook_id text not null references lookbook(id) on delete cascade
  inspiration_folder_id text not null references inspiration_folder(id) on delete cascade
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Constraints:

- unique `(lookbook_id, inspiration_folder_id)`;
- unique `(lookbook_id, sort_order)` if the current schema patterns allow it.

Why a table instead of JSON:

- source inspirations are relationships between durable project objects;
- agents and UI can query them without parsing section content;
- deleting a folder can cascade the relationship cleanly;
- this avoids copying analysis into Lookbook state.

Migration rules:

- Follow `docs/architecture/drizzle-migrations.md`.
- The Drizzle TypeScript schema is the source of truth.
- Use Drizzle Kit to generate the SQL migration.
- Do not hand-write a TypeScript migration registry.
- Do not add compatibility readers for a no-source relationship state.

Implementation files likely touched:

```text
packages/core/src/server/schema/
packages/core/src/server/database/access/lookbook-inspirations.ts
packages/core/src/server/commands/lookbook-commands.ts
packages/core/src/server/resources/lookbook.ts
packages/core/src/client/visual-language.ts
packages/core/src/server/project-data-service-contracts.ts
packages/core/src/server/project-data-service.ts
```

Use the exact local schema folder structure found at implementation time.

## Lookbook JSON Document

Move agent-authored Lookbook input from a bare sections object to a tagged
document.

```json
{
  "kind": "lookbook",
  "lookbook": {
    "thesis": {
      "statement": "3-5 sentence visual-language thesis for this movie.",
      "principles": [
        "Imperative principle another generator or cinematographer could follow."
      ]
    },
    "palette": {
      "description": "How color should operate as a project strategy.",
      "colors": [
        {
          "hex": "#B8B0A1",
          "name": "Aged limestone",
          "meaning": "Public history, old stone, exhausted daylight."
        }
      ],
      "observations": [
        {
          "text": "Use muted warm stone against desaturated military blues."
        }
      ]
    },
    "toneMood": {
      "tone": "solemn, weathered, intimate",
      "moodTags": ["reverent", "besieged", "tactile"],
      "description": "How contrast, saturation, exposure, day/night behavior, and emotional temperature should feel."
    },
    "composition": {
      "description": "Overall compositional strategy.",
      "patterns": [
        {
          "name": "Small figures under monumental architecture",
          "description": "Use scale contrast to make private choices feel historically pressured."
        }
      ]
    },
    "lighting": {
      "description": "Overall lighting approach.",
      "patterns": [
        {
          "name": "Candle logic against cold architecture",
          "description": "Let warm practical light define faces while the environment falls into cool ambient shadow."
        }
      ]
    },
    "texture": {
      "description": "Surface, grain, tactility, weather, lens/filter feel, production texture.",
      "observations": [
        {
          "text": "Prefer worn stone, dulled metal, cloth fibers, smoke, and imperfect surfaces."
        }
      ]
    },
    "camera": {
      "description": "Camera movement, motion, and framing strategy.",
      "movement": [
        {
          "name": "Measured pressure",
          "description": "Use slow, deliberate moves when power shifts."
        }
      ],
      "motion": [
        {
          "name": "Human interruption",
          "description": "Let handheld texture appear only when order breaks."
        }
      ],
      "framing": [
        {
          "name": "Threshold frames",
          "description": "Frame characters through gates, arches, curtains, and weapon lines."
        }
      ]
    }
  },
  "sourceInspirationFolderIds": [
    "inspiration_folder_blade_runner",
    "inspiration_folder_deakins"
  ]
}
```

Rules:

- `sourceInspirationFolderIds` is optional for validation, but `create` and
  `update` should validate every provided ID.
- `sourceInspirationFolderIds` updates the `lookbook_inspiration` relationship
  table when present.
- If `sourceInspirationFolderIds` is omitted on `update`, keep existing source
  relationships unchanged.
- If it is present as an empty array, clear source relationships.
- Lookbook JSON must not include `imageFiles`.
- Unknown fields are rejected.
- Missing required sections are errors.
- Section arrays such as `principles`, `colors`, `patterns`, `movement`,
  `motion`, and `framing` must contain at least one entry where the current
  section schema requires it.

## Schema And Validation Implementation

Add top-level document schemas to:

```text
packages/core/src/client/visual-language-json-schemas.ts
```

Expected exports:

```ts
export const lookbookDocumentSchema = { ... } as const;
export const lookbookSectionsSchema = { ... } as const;
export const lookbookSourceInspirationsDocumentSchema = { ... } as const;
```

Update:

```text
packages/core/src/server/visual-language-json/validator.ts
```

Expected core functions:

```ts
export interface LookbookDocument {
  kind: 'lookbook';
  lookbook: LookbookSections;
  sourceInspirationFolderIds?: string[];
}

export interface LookbookSourceInspirationsDocument {
  kind: 'lookbookSourceInspirations';
  inspirationFolderIds: string[];
}

export function parseLookbookDocument(input: {
  contents: string;
  filePath?: string;
}): LookbookDocument;

export function validateLookbookDocument(input: {
  document: LookbookDocument;
  existingInspirationFolderIds?: Set<string>;
  filePath?: string;
}): DiagnosticResult;
```

Validation should continue rejecting `imageFiles` anywhere in the Lookbook
document. Example impact:

- If an agent tries to cite Inspiration images directly in Lookbook JSON, the
  CLI fails and tells the agent to use Inspiration source relationships or
  Lookbook image placement commands instead.

## Core Service Implementation

Add command report types in:

```text
packages/core/src/client/visual-language.ts
```

Suggested names:

```ts
export interface LookbookListReport extends VisualLanguageCommandReport {
  activeLookbookId: string | null;
  lookbooks: LookbookListItemWithSources[];
}

export interface LookbookShowReport extends VisualLanguageCommandReport {
  lookbook: Lookbook;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
  cardImage: LookbookImage | null;
  isActive: boolean;
  images: LookbookImage[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
}

export interface LookbookWriteReport extends VisualLanguageCommandReport {
  lookbook: Lookbook;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}
```

Add or rename service contracts in:

```text
packages/core/src/server/project-data-service-contracts.ts
```

Expected additions:

```ts
validateLookbook(input: ValidateLookbookInput): Promise<LookbookValidationReport>;
createLookbook(input: CreateLookbookInput): Promise<LookbookWriteReport>;
updateLookbook(input: UpdateLookbookInput): Promise<LookbookWriteReport>;
renameLookbook(input: RenameLookbookInput): Promise<LookbookWriteReport>;
setLookbookSourceInspirations(input: SetLookbookSourceInspirationsInput): Promise<LookbookWriteReport>;
listLookbookSourceInspirations(input: ListLookbookSourceInspirationsInput): Promise<LookbookSourceInspirationsReport>;
```

The current raw-object service methods can become private helpers or be renamed
directly to the command-report shape. Do not create convenience re-export stubs.

Update implementation in:

```text
packages/core/src/server/commands/lookbook-commands.ts
packages/core/src/server/resources/lookbook.ts
```

Expected responsibilities:

- Resolve current or explicit project.
- Validate Lookbook documents before writes.
- Validate source Inspiration folder IDs.
- Create, update, rename, delete, activate, and clear active Lookbooks.
- Set or clear source Inspiration relationships.
- Register and place Lookbook images.
- Return consistent reports with resource keys.
- Append Studio refresh events after successful mutations.

## CLI Implementation

Update:

```text
packages/cli/src/commands/lookbook-command.ts
packages/cli/src/cli.ts
packages/cli/src/cli.test.ts
docs/cli/commands.md
```

Delete or split the existing Visual Language CLI adapter:

```text
packages/cli/src/commands/visual-language-command.ts
```

Do not keep a stub file that forwards `visual-language lookbook ...` to the new
command. That would preserve an obsolete command path and violate the project
rule against compatibility layers.

Add flags:

```text
--image
--lookbook
--name
--file
--sections
--project
--json
```

The CLI dispatcher should route the top-level `lookbook` command directly
instead of routing through `visual-language`. The CLI help text should list
`lookbook` directly and remove the old `visual-language` command entry when
Inspiration has also moved.

Add direct Lookbook command parsing:

```ts
const [action, nested, operation] = options.input;
```

Examples:

```bash
renku lookbook validate --file lookbook.json --json
renku lookbook create --name "Ivory Siege" --file lookbook.json --json
renku lookbook update --lookbook lookbook_abc --file lookbook.json --json
renku lookbook image set-sections --image lookbook_image_abc --sections palette,lighting --json
renku lookbook card-image set --lookbook lookbook_abc --image lookbook_image_abc --json
renku lookbook inspiration set --lookbook lookbook_abc --file source-inspirations.json --json
```

When `--file -` is used, read JSON from stdin.

Use the same structured CLI diagnostics as screenplay:

- `CLI082` for unreadable JSON input files.
- `CLI083` for stdin read failure.
- `PROJECT_DATA201` for invalid JSON.

## Studio Skills Project

Add a new skill to:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/lookbook-designer/
```

Recommended structure:

```text
skills/lookbook-designer/
  SKILL.md
  agents/
    openai.yaml
  references/
    lookbook-cli-workflow.md
    lookbook-json-contract.md
    lookbook-design-guidelines.md
    using-inspiration-sources.md
  samples/
    create-lookbook.json
    update-lookbook.json
    source-inspirations.json
```

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/README.md
```

### Skill Description

Use a direct description:

```yaml
name: lookbook-designer
description: Create or revise Renku Studio Visual Language Lookbooks from project context, user direction, and optional Inspiration analyses, then validate and persist the Lookbook through the Renku CLI.
```

### Progressive Disclosure Instructions

`SKILL.md` should stay short and route the agent to references only when needed.

Main file sections:

- Start Here
- Project Preflight
- Decide Create Or Update
- Use Inspiration Sources
- Validate And Persist
- Reference Files
- Non-Negotiables
- Quality Bar

Reference files:

- `lookbook-cli-workflow.md`: command order, current project, list/show,
  validate/create/update, active Lookbook behavior, image placement.
- `lookbook-json-contract.md`: exact `kind: "lookbook"` shape and section
  rules.
- `using-inspiration-sources.md`: how to list folders, read analyses, inspect
  folder files with shell commands, and synthesize across references without
  copying analysis verbatim.
- `lookbook-design-guidelines.md`: cinematography and generation-oriented
  guidance for thesis, palette, tone and mood, composition, lighting, texture,
  and camera.

### Skill Workflow

1. Resolve project context:

```bash
renku project open <project-name> --json
```

2. Read existing Lookbooks:

```bash
renku lookbook list --json
```

3. Decide whether the user wants:

- a new Lookbook;
- a revision to an existing Lookbook;
- setting one Lookbook as active;
- attaching generated example images;
- only brainstorming before persistence.

4. If the user references Inspiration folders, inspect them:

```bash
renku inspiration list --json
renku inspiration analysis show --folder <folder-id> --json
```

Use the returned:

- folder name;
- folder path;
- existing analysis;
- analysis image filename citations.

If an Inspiration folder has no analysis and the user wants to rely on it, the
skill should either:

- ask to run `inspiration-analyzer` first, or
- proceed with direct image inspection by using filesystem commands inside the
  returned folder path when the user wants momentum.

5. For updates, read the existing Lookbook first:

```bash
renku lookbook show --lookbook <lookbook-id> --json
```

6. Write a `kind: "lookbook"` JSON document.

7. Validate:

```bash
renku lookbook validate --file <lookbook-json> --json
```

8. Create or update:

```bash
renku lookbook create --name <name> --file <lookbook-json> --json
renku lookbook update --lookbook <lookbook-id> --file <lookbook-json> --json
```

9. Set active only when the user asked for it or the workflow clearly calls for
   the new Lookbook to become the project direction:

```bash
renku lookbook set-active --lookbook <lookbook-id> --json
```

10. Read back after mutation:

```bash
renku lookbook show --lookbook <lookbook-id> --json
```

### Lookbook Design Guidance

The skill should write for two audiences:

- the user, who needs a clear creative direction;
- generation agents, which need repeatable visual constraints.

Quality expectations:

- Make the Lookbook a project direction, not a neutral analysis.
- Synthesize Inspiration sources into a new visual language for the user's
  movie.
- Keep the source inspirations visible in reasoning, but do not make the
  Lookbook a collage of references.
- Use concrete cinematography language: contrast, exposure, shadow behavior,
  color separation, blocking, lens feel, movement, texture, and production
  surface.
- Include actionable principles that can guide image and video generation.
- Keep `camera` focused on movement, motion behavior, and framing.
- Use cautious language when describing source influence.
- Preserve continuity on update. Read the existing Lookbook and intentionally
  revise only what the user wants changed.

### Non-Negotiables

The skill must say:

- Do not write directly to `.renku/project.sqlite`.
- Do not register Inspiration folder images as assets or create per-image
  database records for them.
- Do not store `imageFiles` in Lookbook JSON.
- Do not attach example images by editing Lookbook JSON.
- Use Lookbook image commands for image placement.
- Validate before create or update.
- For updates, read the existing Lookbook first.
- Do not overwrite a user's existing Lookbook unless the user asked for that
  Lookbook to be updated.
- Do not set a Lookbook active unless the user asked or the workflow explicitly
  requires it.
- Do not invent source Inspiration folder IDs. Use IDs returned by the CLI.

## Tests

Add CLI tests covering:

- `lookbook validate` succeeds without writing.
- `lookbook validate` rejects unknown fields.
- `lookbook validate` rejects `imageFiles` anywhere in the document.
- `lookbook create` writes a Lookbook and optional source Inspiration
  relationships.
- `lookbook update` updates sections and preserves source Inspiration
  relationships when `sourceInspirationFolderIds` is omitted.
- `lookbook update` clears source Inspiration relationships when
  `sourceInspirationFolderIds: []` is present.
- `lookbook show` returns source Inspiration folders with folder paths, Lookbook
  images, card image, active state, and resource keys.
- `lookbook image set-sections` updates placement.
- `lookbook card-image set --image` uses an image ID and rejects images from
  another Lookbook.
- old confusing command shapes are not accepted after replacement.

Add core tests covering:

- top-level `kind: "lookbook"` schema validation;
- source Inspiration folder ID validation;
- duplicate source folder ID rejection;
- no database mutation on validation failure;
- Lookbook source relationship ordering;
- Studio resource keys after create, update, source update, active change, and
  image placement.

## Implementation Checklist

- [ ] Add `lookbook_inspiration` to the Drizzle schema.
- [ ] Generate the SQL migration with Drizzle Kit.
- [ ] Add database access module for Lookbook source Inspirations.
- [ ] Add top-level Lookbook document schema.
- [ ] Add top-level source Inspirations document schema.
- [ ] Add Lookbook document parse and validation functions.
- [ ] Add command report types for Lookbook list/show/write/image mutations.
- [ ] Add `validateLookbook`.
- [ ] Update `createLookbook` and `updateLookbook` to accept tagged documents
      and return reports.
- [ ] Add `renameLookbook`.
- [ ] Add source Inspiration set/list commands.
- [ ] Add `lookbook image set-sections` CLI command.
- [ ] Add `lookbook card-image set --image` and optional `card-image clear`.
- [ ] Add `--image` CLI flag.
- [ ] Replace `read` with `show`.
- [ ] Add direct top-level `lookbook` CLI parsing.
- [ ] Remove the `visual-language lookbook ...` CLI surface instead of keeping
      aliases.
- [ ] Replace bare-section JSON input with `kind: "lookbook"` document input.
- [ ] Return consistent command reports.
- [ ] Append Studio refresh events after successful Lookbook mutations.
- [ ] Document the new commands in `docs/cli/commands.md`.
- [ ] Add the `lookbook-designer` skill to `studio-skills`.
- [ ] Add progressive disclosure reference files for the skill.
- [ ] Update `studio-skills/README.md`.

## Open Questions

- Should `lookbook create` set the new Lookbook active by default? The safer
  first behavior is no. The skill can explicitly call `set-active` when the user
  wants the new Lookbook to become the project direction.
- Should Lookbook source relationships be required for Lookbooks created from
  Inspiration? The CLI should allow source-free Lookbooks because a user may
  create one from conversation, screenplay context, or direct art direction.
- Should Lookbook documents eventually include prompt-oriented generation notes
  per section? Keep that out of this first plan unless a concrete downstream
  generator contract needs it.
