# 0023 Visual Language Lookbook CLI And Skill

Date: 2026-05-24

Status: implemented

## Goal

Design the Renku Studio CLI commands and Studio Skills workflow that let agents
create and revise multiple Visual Language Lookbooks.

The Lookbook workflow is agent-assisted but project-native:

- the user can ask for a new lookbook idea;
- the user can ask to revise an existing lookbook;
- the user can base a lookbook on one or more Inspiration folders and their
  analysis;
- the user can base a lookbook on Inspiration folder images even when no
  analysis has been written yet;
- the user can cite movies, directors, cinematographers, photographers,
  painters, movements, periods, locations, or other visual references as
  creative context;
- the user can describe a desired visual system directly, for example "similar
  to The Substance, but use acid green to mean contamination and tenderness";
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

The first implementation is not a browser-side generation workflow. The skill
and commands should make it possible for an agent to create the Lookbook,
generate example images later, and attach those images cleanly, but model
selection, prompt dispatch, and editing controls are deliberately deferred.

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
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/inspiration-analyzer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/inspiration-analyzer/references/inspiration-analysis-cli-workflow.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/inspiration-analyzer/references/inspiration-analysis-json-contract.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/inspiration-analyzer/references/cinematography-analysis-guidelines.md`
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
- The current Lookbooks UI has a rendering target, but the Lookbook designer
  skill needs a clear contract that its output will appear in the same report
  language as Inspiration Analysis.

Because Renku Studio is pre-customer software, update the command names
directly. Remove the `visual-language` CLI prefix instead of keeping it as an
agent-facing namespace. Do not keep compatibility aliases for the old
`visual-language lookbook ...`, `read`, `set-card-image --file`, or direct
bare-section JSON input.

## Conversational Product Scope

The Lookbook designer skill is a creative-direction conversation, not a single
fire-and-forget command wrapper.

Supported user intents:

- "Create me a new lookbook based on the X inspiration folder."
- "Create a new look from these two folders, but make it warmer and less
  clinical."
- "Use the analysis from the Substance folder, but make the red/green logic mean
  body horror versus tenderness."
- "Give me something like early Fincher, but for a coastal family drama."
- "Revise the active lookbook so the palette is colder and the camera language
  is less handheld."
- "Generate two images that represent the color palette in this lookbook."

The first five intents belong in this plan. The last intent is important
context for the future image-generation workflow, but this plan should only
prepare the durable Lookbook, section placement, CLI discovery, and skill
structure that later generation commands can build on.

When creating a Lookbook, the skill should synthesize from these inputs in
priority order:

1. The user's explicit creative direction.
2. The existing Lookbook being revised, when this is an update.
3. Existing Inspiration Analysis documents.
4. The actual images in selected Inspiration folders.
5. General film, photography, painting, design, or cinematography context when
   the user names a reference and that context is reliable.
6. Project screenplay, cast, location, or story context when it helps make the
   Lookbook specific to the movie.

The output should be a new project visual language, not a summary of the
references. For example, if the user asks for "The Substance but with color X
to denote Y", the Lookbook should translate that into a usable color system,
tone, lighting, camera, composition, and texture strategy for the user's movie.
It should not merely describe The Substance.

The skill may brainstorm before persistence when the user is still exploring.
It should only call `lookbook create` or `lookbook update` once the user has
asked for a durable Lookbook or the conversation clearly implies persistence.

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

Those commands return folder metadata and resolved folder paths only. They must
not add image filename arrays, image counts, image manifests, thumbnails, or
per-image records to their JSON results. The folder path is enough.

If an agent needs to inspect the source images, it should `cd` into the returned
folder path and use regular shell commands such as `ls`, `find`, or `rg
--files`. Renku should not register individual Inspiration images as assets,
track them as per-image SQLite rows, or duplicate normal filesystem discovery in
the CLI response.

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

All agent-authored JSON inputs for this workflow must have explicit JSON
Schemas. The CLI should validate those schemas before any write command mutates
project state.

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

## Studio Visual Representation

The visual representation lives in Studio. The CLI stays JSON-first so agents
can inspect, validate, mutate, and refresh project state predictably.

The Lookbook UI should follow the design direction from
`plans/active/0021-visual-language-inspiration-lookbook-ui.md`:

- reuse the same shared report rendering components used by Inspiration
  Analysis, especially `visual-language-report.tsx`,
  `visual-language-report-section.tsx`, section-specific visual language
  renderers, and the shared image grid/card components;
- render the same compact numbered section rhythm: Thesis, Palette, Tone &
  Mood, Composition, Lighting, Texture, and Camera;
- use the same palette swatches, tone strip, mood tags, pattern rows, and image
  grids wherever the schemas overlap;
- show source Inspiration folders as durable relationships, not copied analysis
  text;
- show the active Lookbook state clearly on the Lookbooks index and detail
  surface;
- show the chosen card image through the explicit `lookbook_card_image`
  relationship;
- show generated example images through `lookbook_image` and
  `lookbook_image_section`, never through JSON embedded in a section;
- expose future action slots near sections for editing, probing, or generation,
  but do not implement those controls in this plan.

The initial Lookbook detail surface is read-oriented, matching the Analysis
section. Editing controls for palettes, tone tags, section copy, and generated
image prompts will be designed later. The component contract should still make
future edit slots possible without rewriting the report layout.

Component reuse should be explicit, not just visual similarity:

- shared components own report spacing, typography, numbered section labels,
  section headings, palette rendering, tone/mood rendering, pattern rows,
  texture observations, and image grid/card presentation;
- Inspiration Analysis and Lookbook pass different image-source adapters into
  the shared image components;
- Inspiration Analysis resolves supporting images from folder-local `imageFiles`
  in the analysis JSON;
- Lookbook resolves supporting images from `imagesBySection` backed by
  `lookbook_image_section` rows and registered assets;
- source-specific containers own resource loading, empty states, route handling,
  active Lookbook controls, source Inspiration badges, and card-image behavior;
- the shared report renderer should not branch on loose object shapes or infer
  storage ownership from paths. It should receive normalized section data and
  explicit image props.

The expected non-shared pieces are also clear:

- Inspiration Analysis includes Lineage/Inspired By.
- Lookbook includes Camera.
- Lookbook has active-state, card-image, source-Inspiration, and future edit or
  generation action slots.

When a CLI mutation succeeds, returned `resourceKeys` should allow Studio to
refresh:

- the Lookbooks index;
- the selected Lookbook detail surface;
- active Lookbook state in the Visual Language sidebar;
- generated image placement in affected sections.

Do not add a separate terminal-rendered lookbook board in this phase. Human
readability in the terminal can improve through concise non-JSON summaries
later, but the agent contract is the structured `--json` output.

## Future Image Generation Hooks

The user should eventually be able to ask:

```text
Generate 2 images that represent the color palette in this lookbook.
```

This plan should not implement model/provider image generation yet. It should
make that next plan straightforward by keeping the boundaries clean:

- `renku lookbook show` returns the sections, active state, source Inspiration
  folders, card image, and placed images needed to build prompts;
- source Inspiration folder paths remain available through Inspiration commands
  so a generation agent can inspect reference images when needed;
- generated files are attached with `renku lookbook image import`, then placed
  with section keys;
- section placement stays in `lookbook_image_section`, so generated examples can
  appear under Palette, Lighting, Camera, or multiple sections without changing
  the Lookbook JSON schema;
- workflows that require a project direction can explicitly require an active
  Lookbook and fail with a structured diagnostic when none is set.

Later generation work can add a higher-level command such as
`renku lookbook image generate`, but this plan should not reserve flags or fake
provider behavior before that workflow is designed.

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
    reference-driven-lookbook.json
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

4. Collect source context. The user may provide:

- one Inspiration folder;
- multiple Inspiration folders;
- named references such as movies, directors, cinematographers, photographers,
  painters, movements, locations, or periods;
- direct art direction with custom symbolism, such as a color meaning or camera
  behavior;
- project context from story, cast, or locations.

5. If the user references Inspiration folders, inspect them:

```bash
renku inspiration list --json
renku inspiration show --folder <folder-id> --json
renku inspiration analysis show --folder <folder-id> --json
```

Use the returned:

- folder name;
- folder path;
- existing analysis;
- analysis image filename citations.

Do not expect or request an image list from the Renku CLI. The Inspiration
folder path is the discovery boundary. To find grabs, use regular shell
commands inside that path:

```bash
cd "<folder.absolutePath>"
find . -maxdepth 1 -type f
```

If an Inspiration folder has no analysis and the user wants to rely on it, the
skill should either:

- ask to run `inspiration-analyzer` first, or
- proceed with direct image inspection by using filesystem commands inside the
  returned folder path when the user wants momentum.

6. For updates, read the existing Lookbook first:

```bash
renku lookbook show --lookbook <lookbook-id> --json
```

7. Write a `kind: "lookbook"` JSON document.

8. Validate:

```bash
renku lookbook validate --file <lookbook-json> --json
```

9. Create or update:

```bash
renku lookbook create --name <name> --file <lookbook-json> --json
renku lookbook update --lookbook <lookbook-id> --file <lookbook-json> --json
```

10. Set active only when the user asked for it or the workflow clearly calls for
   the new Lookbook to become the project direction:

```bash
renku lookbook set-active --lookbook <lookbook-id> --json
```

11. Read back after mutation:

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
- Do not add or depend on image lists in Inspiration CLI results. Use the
  returned folder path and regular shell commands to discover images.
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

Add Studio tests covering:

- Lookbook detail renders through the same shared report section components as
  Inspiration Analysis.
- shared report components receive normalized section data and explicit image
  props instead of inferring mode from folder paths or loose object shape.
- source Inspiration folders appear on the Lookbook detail surface.
- active Lookbook state appears on the Lookbooks index and sidebar context.
- section image grids render images from `imagesBySection`.
- no raw browser controls are introduced in feature components.

## Completion Checklist

Use this checklist to decide whether the Lookbook designer plan is fully
implemented. The plan is not complete until the skill, CLI, core service,
source relationships, Studio rendering, documentation, and focused tests are all
done.

- [x] Add `lookbook_inspiration` to the Drizzle schema.
- [x] Generate the SQL migration with Drizzle Kit.
- [x] Add database access module for Lookbook source Inspirations.
- [x] Add top-level Lookbook document schema.
- [x] Add top-level source Inspirations document schema.
- [x] Add Lookbook document parse and validation functions.
- [x] Add command report types for Lookbook list/show/write/image mutations.
- [x] Add `validateLookbook`.
- [x] Update `createLookbook` and `updateLookbook` to accept tagged documents
      and return reports.
- [x] Add `renameLookbook`.
- [x] Add source Inspiration set/list commands.
- [x] Ensure Inspiration command reports used by this workflow return folder
      paths only for image discovery, with no image filename lists, image
      counts, manifests, or per-image records.
- [x] Add `lookbook image set-sections` CLI command.
- [x] Add `lookbook card-image set --image` and optional `card-image clear`.
- [x] Add `--image` CLI flag.
- [x] Replace `read` with `show`.
- [x] Add direct top-level `lookbook` CLI parsing.
- [x] Remove the `visual-language lookbook ...` CLI surface instead of keeping
      aliases.
- [x] Replace bare-section JSON input with `kind: "lookbook"` document input.
- [x] Return consistent command reports.
- [x] Append Studio refresh events after successful Lookbook mutations.
- [x] Document the new commands in `docs/cli/commands.md`.
- [x] Ensure Lookbook list/show reports include the source relationships and
      image placement data Studio needs for rendering.
- [x] Ensure the Lookbooks UI reuses the shared Inspiration Analysis report
      rendering components where the section schemas overlap.
- [x] Ensure Inspiration Analysis and Lookbook use source-specific containers
      plus shared section/image renderers, with explicit image-source props.
- [x] Ensure the Lookbook detail surface renders source Inspiration folders,
      active state, card image, and generated example images by section.
- [x] Leave editing controls and browser-side generation out of this first
      implementation while keeping component action slots available for later.
- [x] Preserve future image-generation compatibility by keeping generated
      examples attached through Lookbook image commands, not embedded section
      JSON.
- [x] Add the `lookbook-designer` skill to `studio-skills`.
- [x] Add progressive disclosure reference files for the skill.
- [x] Add skill samples for a new Lookbook, an update, source Inspiration
      relationships, and a reference-driven/custom-symbolism Lookbook.
- [x] Update `studio-skills/README.md`.
- [x] Verify the skill supports creating from one folder, multiple folders,
      existing analyses, direct image inspection, named references, and direct
      user art direction.
- [x] Run focused core, CLI, and Studio tests relevant to the touched packages.

## Resolved Decisions

- `lookbook create` does not set the new Lookbook active by default. The skill
  explicitly calls `set-active` when the user wants the new Lookbook to become
  the project direction.
- Lookbook source relationships are optional. The CLI allows source-free
  Lookbooks because a user may create one from conversation, screenplay context,
  named references, or direct art direction.
- Prompt-oriented generation notes stay out of the first Lookbook document
  schema unless a concrete downstream generator contract needs them.
- The first CLI implementation stays JSON-first for agents and Studio refresh
  correctness. A human-readable terminal summary can come later after the Studio
  representation is stable.
