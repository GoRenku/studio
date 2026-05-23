# 0020 Visual Language Inspiration And Lookbook Data Model

Date: 2026-05-22

Status: implemented

## Goal

Replace the current project Visual Language category and entry model with a
smaller model that supports the new product direction:

- **Inspiration**: user-created folders of reference grabs, with optional
  agent-written analysis for each folder.
- **Lookbook**: the movie's project-level visual language, generated and
  revised by agents and users, with inline generated example images.

This is a redesign of the project Visual Language storage surface. The current
project tables are removed directly:

```text
visual_language_category
visual_language
visual_language_asset
```

There is no compatibility layer for the old category/entry model.

The user has explicitly decided that this change should not increment the
project-store `user_version`, because no current project depends on the old
tables. The implementation should still use the Drizzle Kit workflow and should
not add old readers, aliases, fallback branches, or compatibility migrations.

## References

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/project-relative-paths.md`
- `docs/architecture/json-storage-validation.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/naming-guidelines.md`
- `plans/active/0006-asset-commands-and-selects.md`
- `/Users/keremk/Projects/cinema-analyze/skills/renku-cinema-analyze/SKILL.md`
- `/Users/keremk/Projects/cinema-analyze/skills/renku-cinema-analyze/assets/viewer.html`

## Product Requirements Captured

Visual Language has two UI sections available from the Studio sidebar under the
Visual Language dropdown.

### Inspiration

Users need a place to collect visual references before the movie's own visual
language is generated.

Requirements:

- Users can create and delete Inspiration folders.
- Folder names should be recognizable references, such as movie titles,
  cinematographers, or directors. Movie names are expected to work best because
  agents can use the reference name as background context during analysis.
- Each folder has a Grabs tab where users can drag and drop or upload images.
- Grabs display as lightweight image cards in a grid.
- Each image card has a small footer with a delete action, visually quiet until
  hover.
- Each folder has an Analysis tab.
- The Analysis tab is empty until an agent analyzes the folder.
- The analysis displays:
  - Thesis
  - Palette, also called Color
  - Tone & Mood, also called Grading
  - Composition
  - Lighting
  - Texture
  - Lineage, shown as Inspired By
- Agents will eventually use Renku CLI commands to write the analysis.

### Lookbook

The Lookbook is the movie's generated and editable visual language.

Requirements:

- Users and agents can generate the Lookbook from the project context, optionally
  using Inspiration folders.
- Users can tweak the generated sections.
- Agents can generate example images from the Lookbook sections and the broader
  project context, including screenplay context.
- Generated images display inline in the relevant Lookbook section.
- Users can probe an individual section to generate new example images.
- The Lookbook displays:
  - Thesis
  - Palette, also called Color
  - Tone & Mood, also called Grading
  - Composition
  - Lighting
  - Texture
  - Camera, including movement, motion, and framing

The cinema-analysis prototype is a useful rendering reference, especially its
Cinema style, section treatment, palette swatches, tone strip, pattern lists,
and inline still grids. Its JSON shape is a useful starting point, but Studio
should use project asset IDs instead of external FilmGrab URLs for stored image
references.

## Naming

Use these domain names for the first implementation pass:

```text
Visual Language Inspiration Folder
Inspiration Grab
Inspiration Analysis
Lookbook
Lookbook Image
```

`Lookbook` is the working name for the second section. It is short, visual, and
clear for users. Before implementation, confirm whether the user wants to keep
`Lookbook` or replace it with another user-facing and schema-facing name. If the
name changes, update the plan and callers directly. Do not keep aliases.

Avoid these names:

- `Style`
- `Style Guide`
- `Moodboard` as the top-level Visual Language replacement
- `VisualLanguageProfile`
- `data`
- `item`
- `detail`
- `manager`
- `helper`

## Storage Boundary

SQLite owns durable metadata and structured Visual Language state:

- Inspiration folder identity, name, and ordering.
- Inspiration folder project-relative folder path.
- Inspiration analysis section JSON.
- Lookbook section JSON.
- Lookbook image asset relationships.
- Lookbook image section placement.
- Created and updated timestamps.

The filesystem owns content:

- Imported Inspiration grab image files.
- Generated Lookbook image files.
- Any future long-form notes or prompt drafts that become Markdown assets.

Do not store absolute local paths in SQLite. Registered Lookbook image file
references remain on `asset_file.project_relative_path`. Inspiration folder
contents are filesystem-owned and are read from the folder recorded on
`inspiration_folder.project_relative_path`.

Do not infer owners, sections, folder IDs, or ordering from file paths. The
folder structure is only a human-readable working asset layout.

## Project Folder Shape

Use the Visual Language feature folder at the project root:

```text
visual-language/
```

Recommended durable file layout:

```text
<project>/
  visual-language/
    inspiration/
      <folder-label>/
        <uploaded-image-file>

    lookbook/
      <generated-image-file>
```

Rules:

- `<folder-label>` is derived from the Inspiration folder name for readability,
  for example `avatar` or `roger-deakins`.
- If a folder label collides, core allocates a unique readable path segment.
- Folder names do not need to be unique. If two folders have the same display
  name, their generated filesystem labels still differ.
- The folder label is not identity. `inspiration_folder.id` is identity.
- Renaming an Inspiration folder may rename the folder on disk as a convenience,
  but the database must update `inspiration_folder.project_relative_path`
  through a core command. Do not infer the folder from the path.
- Inspiration images are not registered as assets in SQLite. Users and agents
  may drag image files directly into an Inspiration folder, and the UI reads the
  folder contents from disk.
- Generated Lookbook images are flatly allocated under `visual-language/lookbook/`.
  Section placement is stored in SQLite, not encoded in folders.
- Agents may use `.renku/tmp/` for temporary generation work, but durable
  Lookbook images must be registered as assets under `visual-language/lookbook/`.

## Schema Overview

Add these project-local tables:

```text
inspiration_folder
inspiration_analysis
lookbook
lookbook_image
lookbook_image_section
```

Keep the existing shared asset tables:

```text
asset
asset_file
```

Remove the old project Visual Language tables:

```text
visual_language_category
visual_language
visual_language_asset
```

Do not add a table for Inspiration images. Inspiration folder contents are
filesystem-owned.

## Table: `inspiration_folder`

Stores one user-created Inspiration folder.

```text
inspiration_folder
  id text primary key
  name text not null
  project_relative_path text not null
  position integer not null
  created_at text not null
  updated_at text not null
```

Column meanings:

- `id`: Opaque durable folder ID. Do not derive it from the name.
- `name`: User-facing folder name, such as `Avatar`, `Blade Runner 2049`,
  `Roger Deakins`, or `Sofia Coppola`. This name is useful creative context for
  agents.
- `project_relative_path`: The project-relative folder path for this folder,
  such as `visual-language/inspiration/avatar`. This is required because folder
  names do not have to be unique and users may drop files directly into the
  folder outside Studio.
- `position`: Sidebar ordering among Inspiration folders.
- `created_at`: ISO timestamp for creation.
- `updated_at`: ISO timestamp for the latest folder metadata change.

Do not add columns for director, cinematographer, year, source URL, or analysis
status in this first pass. The folder name is the only user-authored context
required by the stated product need.

Folder names are not unique by design. Do not add a uniqueness constraint.

Deleting a folder from the UI deletes its folder record and, after confirmation,
removes the corresponding folder on disk. Files inside that folder are not asset
rows, so there are no Inspiration asset relationships to clean up.

## Table: `inspiration_analysis`

Stores the current agent-written analysis for one Inspiration folder.

```text
inspiration_analysis
  folder_id text primary key references inspiration_folder(id)
  thesis text not null
  palette text not null
  tone_mood text not null
  composition text not null
  lighting text not null
  texture text not null
  inspired_by text not null
  created_at text not null
  updated_at text not null
```

Column meanings:

- `folder_id`: The analyzed folder. One folder has at most one current analysis
  in this first pass.
- `thesis`: JSON text matching `ThesisSection`.
- `palette`: JSON text matching `PaletteSection`.
- `tone_mood`: JSON text matching `ToneMoodSection`.
- `composition`: JSON text matching `PatternSection`.
- `lighting`: JSON text matching `PatternSection`.
- `texture`: JSON text matching `TextureSection`.
- `inspired_by`: JSON text matching `InspiredBySection`.
- `created_at`: ISO timestamp for first analysis creation.
- `updated_at`: ISO timestamp for the latest analysis replacement.

The Analysis tab is empty when no row exists for the folder.

The first pass stores the current analysis only. Do not add analysis versioning,
analysis task records, provider run records, or raw model response storage until
generation history is designed as a broader feature.

## Table: `lookbook`

Stores the movie's current Lookbook.

```text
lookbook
  id text primary key
  thesis text not null
  palette text not null
  tone_mood text not null
  composition text not null
  lighting text not null
  texture text not null
  camera text not null
  created_at text not null
  updated_at text not null
```

Column meanings:

- `id`: Opaque durable Lookbook ID. The first product version has one Lookbook
  row per project database.
- `thesis`: JSON text matching `ThesisSection`.
- `palette`: JSON text matching `PaletteSection`.
- `tone_mood`: JSON text matching `ToneMoodSection`.
- `composition`: JSON text matching `PatternSection`.
- `lighting`: JSON text matching `PatternSection`.
- `texture`: JSON text matching `TextureSection`.
- `camera`: JSON text matching `CameraSection`.
- `created_at`: ISO timestamp for first Lookbook creation.
- `updated_at`: ISO timestamp for the latest Lookbook change.

The Lookbook UI is empty when no row exists.

Do not add multiple named Lookbooks, active Lookbook pointers, approval states,
or generation status columns in this first pass. The stated product direction is
one movie-level visual language.

## Table: `lookbook_image`

Attaches generated example images to the current Lookbook without assigning
section meaning. Section placement lives in `lookbook_image_section` because one
image can illustrate several Lookbook sections.

```text
lookbook_image
  id text primary key
  lookbook_id text not null references lookbook(id)
  asset_id text not null references asset(id)
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Column meanings:

- `id`: Opaque durable relationship ID.
- `lookbook_id`: The Lookbook that owns the generated image.
- `asset_id`: The registered generated image asset.
- `sort_order`: Overall Lookbook image ordering.
- `created_at`: ISO timestamp for attachment creation.
- `updated_at`: ISO timestamp for the latest relationship change.

The asset row should use:

```text
asset.type = lookbook_image
asset.media_kind = image
asset.origin = generated
asset.availability = ready
asset_file.role = source
```

## Table: `lookbook_image_section`

Places a Lookbook image inline with one Lookbook section. One image can have
many placement rows.

```text
lookbook_image_section
  id text primary key
  image_id text not null references lookbook_image(id)
  section text not null
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Column meanings:

- `id`: Opaque durable placement ID.
- `image_id`: The Lookbook image being placed.
- `section`: The section that should display the image inline. Initial allowed
  values:
  - `thesis`
  - `palette`
  - `tone_mood`
  - `composition`
  - `lighting`
  - `texture`
  - `camera`
- `sort_order`: Inline ordering for images in this section.
- `created_at`: ISO timestamp for placement creation.
- `updated_at`: ISO timestamp for the latest placement change.

Do not store prompts, provider IDs, costs, or generation packets on these tables.
Those belong to the future task/generation model.

## Section Schemas

The section columns are stored as JSON text, but the stored contract is not
informal. Every section shape must have an explicit JSON Schema and must be
validated with AJV by core before writes and after reads, following
`docs/architecture/json-storage-validation.md` and the existing
`screenplay-json/validator.ts` pattern.

Invalid incoming or stored JSON should fail fast with structured diagnostics.
Column names should use the domain concept directly, such as `thesis`,
`palette`, and `camera`; do not append `_json`.

Add browser-safe schema constants under:

```text
packages/core/src/client/
  visual-language-json-schemas.ts
```

Add the server-side validator under:

```text
packages/core/src/server/visual-language-json/
  validator.ts
```

The validator must:

- use AJV v8 draft 2020-12 through `Ajv2020`;
- register Visual Language schemas once with `addSchema`;
- retrieve compiled validators with `getSchema`;
- use the same strict options documented in
  `docs/architecture/json-storage-validation.md`;
- validate all section JSON before persistence;
- validate all parsed section JSON after reads from SQLite;
- map AJV errors into `@gorenku/studio-diagnostics` issues with useful field
  paths;
- run semantic checks, such as Inspiration `imageFiles` existence, after AJV
  structural validation.

All JSON object schemas reject unknown top-level keys in core-owned writes. This
keeps the stored contract small and deliberate. CLI import of future external
formats can warn on unknown input fields before writing the normalized current
shape.

### Shared Rules

- Strings must be trimmed and non-empty unless explicitly optional.
- Inspiration analysis may cite supporting folder images by folder-local
  filename in `imageFiles` fields. These are not asset IDs and are not stored in
  a separate image table.
- Lookbook section JSON does not store image references. Lookbook image
  placement is stored in `lookbook_image_section`.
- Hex colors must be uppercase or lowercase `#RRGGBB`.
- Arrays should preserve user or agent order.
- Empty arrays are allowed only where the UI can render a meaningful empty
  state.

### `ThesisSection`

Used by:

- `inspiration_analysis.thesis`
- `lookbook.thesis`

```ts
interface ThesisSection {
  statement: string;
  principles: string[];
  imageFiles?: string[];
}
```

Field meanings:

- `statement`: The 3 to 5 sentence core visual thesis.
- `principles`: Imperative or declarative principles a cinematographer or image
  generation agent can apply.
- `imageFiles`: Optional supporting Inspiration image filenames. Omit this field
  from Lookbook writes; Lookbook image placement uses `lookbook_image_section`.

### `PaletteSection`

Used by:

- `inspiration_analysis.palette`
- `lookbook.palette`

```ts
interface PaletteSection {
  description: string;
  colors: ColorSwatch[];
  observations: Observation[];
}

interface ColorSwatch {
  hex: string;
  name: string;
  meaning: string;
}

interface Observation {
  text: string;
  imageFiles?: string[];
}
```

Field meanings:

- `description`: How color works as a visual strategy.
- `colors`: Ordered palette swatches.
- `colors[].hex`: Display color.
- `colors[].name`: Evocative swatch name.
- `colors[].meaning`: What the color does visually or narratively.
- `observations`: Specific color observations, each tied to supporting images
  when available.

### `ToneMoodSection`

Used by:

- `inspiration_analysis.tone_mood`
- `lookbook.tone_mood`

```ts
interface ToneMoodSection {
  tone: string;
  moodTags: string[];
  description: string;
  imageFiles?: string[];
}
```

Field meanings:

- `tone`: Short tonal phrase, such as `weathered restraint`.
- `moodTags`: Compact tags displayed as chips.
- `description`: How shadows, midtones, highlights, contrast, saturation, and
  day/night behavior work.
- `imageFiles`: Optional supporting Inspiration image filenames. Omit this field
  from Lookbook writes.

The UI can derive a tone strip from `palette.colors`.

### `PatternSection`

Used by:

- `inspiration_analysis.composition`
- `inspiration_analysis.lighting`
- `lookbook.composition`
- `lookbook.lighting`

```ts
interface PatternSection {
  description: string;
  patterns: Pattern[];
}

interface Pattern {
  name: string;
  description: string;
  imageFiles?: string[];
}
```

Field meanings:

- `description`: Overall strategy for the section.
- `patterns`: Repeated techniques or choices.
- `patterns[].name`: Memorable pattern name.
- `patterns[].description`: How the pattern works.
- `patterns[].imageFiles`: Optional supporting Inspiration image filenames.
  Omit this field from Lookbook writes.

For Lighting, each pattern represents a lighting technique. For Composition,
each pattern represents a compositional pattern.

### `TextureSection`

Used by:

- `inspiration_analysis.texture`
- `lookbook.texture`

```ts
interface TextureSection {
  description: string;
  observations: Observation[];
}
```

Field meanings:

- `description`: Surface, grain, tactility, lens or filter feel, and production
  texture.
- `observations`: Specific texture observations tied to supporting images when
  available.

### `InspiredBySection`

Used by:

- `inspiration_analysis.inspired_by`

```ts
interface InspiredBySection {
  description: string;
  items: InspiredByItem[];
}

interface InspiredByItem {
  category: 'movie' | 'director' | 'cinematographer';
  name: string;
  confidence: 'low' | 'medium' | 'high';
  why: string;
  imageFiles?: string[];
}
```

Field meanings:

- `description`: Overall Inspired By note. This should be careful language, not
  a claim of confirmed influence unless there is explicit sourcing.
- `items`: Candidate affinities.
- `items[].category`: Kind of reference.
- `items[].name`: Reference name.
- `items[].confidence`: Strength of visual resemblance.
- `items[].why`: The visible strategy shared with the folder's grabs.
- `items[].imageFiles`: Optional supporting Inspiration image filenames.

The Lookbook does not store `inspired_by` in v1. Inspiration analysis may
inform the Lookbook, but the movie's own visual language should not store its
influences as a required section.

### `CameraSection`

Used by:

- `lookbook.camera`

```ts
interface CameraSection {
  description: string;
  movement: Pattern[];
  motion: Pattern[];
  framing: Pattern[];
}
```

Field meanings:

- `description`: Overall camera grammar for the movie.
- `movement`: Camera movement choices, such as locked-off frames, slow push-ins,
  handheld drift, or lateral tracking.
- `motion`: Motion behavior inside the frame, including pace, blocking rhythm,
  subject movement, and image energy.
- `framing`: Framing rules, such as distance, negative space, occlusion,
  symmetrical staging, or close-up restraint.

Inspiration analysis does not include Camera in v1 because the product request
listed Camera only for the Lookbook.

## Core Contracts

Update browser-safe contracts under:

```text
packages/core/src/client/
  visual-language.ts
  visual-language-json-schemas.ts
  resources.ts
  assets.ts
  project.ts
  index.ts
```

Remove the old public contracts:

```text
VisualLanguage
VisualLanguageCategory
VisualLanguagePriority
VisualLanguageCategorySource
VisualLanguageNavigationRow
```

Add current contracts:

```ts
interface InspirationFolder {
  id: string;
  name: string;
  projectRelativePath: ProjectRelativePath;
}

interface InspirationImage {
  fileName: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image';
  sizeBytes?: number;
}

interface InspirationAnalysis {
  folderId: string;
  thesis: ThesisSection;
  palette: PaletteSection;
  toneMood: ToneMoodSection;
  composition: PatternSection;
  lighting: PatternSection;
  texture: TextureSection;
  inspiredBy: InspiredBySection;
}

interface Lookbook {
  id: string;
  thesis: ThesisSection;
  palette: PaletteSection;
  toneMood: ToneMoodSection;
  composition: PatternSection;
  lighting: PatternSection;
  texture: TextureSection;
  camera: CameraSection;
}

type LookbookSection = 'thesis' | 'palette' | 'tone_mood' | 'composition' | 'lighting' | 'texture' | 'camera';

interface LookbookImage {
  id: string;
  asset: Asset;
  sections: LookbookSection[];
}
```

Resource contracts:

```ts
interface InspirationResource {
  folders: PageResponse<InspirationFolder>;
}

interface InspirationFolderResource {
  folder: InspirationFolder;
  images: InspirationImage[];
  analysis: InspirationAnalysis | null;
}

interface LookbookResource {
  lookbook: Lookbook | null;
  images: LookbookImage[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
}
```

Update `Project` and `ProjectShell`:

- Remove `visualLanguageCategories`.
- Remove `visualLanguage`.
- Remove Visual Language category and entry counts.
- Keep Visual Language loaded through dedicated resources, not the project
  shell.

Do not add broad eager Visual Language maps to `ProjectShell`.

## Asset Target Changes

Remove the old asset target:

```ts
{ kind: 'visualLanguage'; visualLanguageId: string }
```

Do not replace it with an Inspiration target. Inspiration images are files under
an Inspiration folder, not registered assets.

Lookbook image registration is handled by Visual Language commands that insert
`asset`, `asset_file`, `lookbook_image`, and optional
`lookbook_image_section` rows. Do not encode Lookbook section placement in an
asset target or a role column.

Do not keep the old `visualLanguage` target as an alias.

## Core Source Structure

Recommended core files:

```text
packages/core/src/server/schema/
  visual-language.ts

packages/core/src/server/database/access/
  inspiration-folders.ts
  inspiration-analysis.ts
  lookbook.ts
  lookbook-images.ts

packages/core/src/server/visual-language-json/
  validator.ts

packages/core/src/server/resources/
  inspiration.ts
  lookbook.ts

packages/core/src/server/commands/
  inspiration-commands.ts
  lookbook-commands.ts
```

Responsibilities:

- `schema/visual-language.ts`: the new Drizzle table definitions only.
- `inspiration-folders.ts`: folder insert, update, delete, reorder, and list
  reads.
- `inspiration-analysis.ts`: analysis upsert and read logic.
- `lookbook.ts`: Lookbook upsert and read logic.
- `lookbook-images.ts`: Lookbook image insert/list/delete and section placement
  reads.
- `visual-language-json/validator.ts`: AJV-backed validation for all
  Inspiration analysis and Lookbook section JSON before writes and after reads.
- `resources/inspiration.ts`: browser-safe resource assembly, including
  filesystem image listing.
- `resources/lookbook.ts`: browser-safe Lookbook assembly.
- `commands/inspiration-commands.ts`: project mutations for folder and image
  file workflows.
- `commands/lookbook-commands.ts`: project mutations for Lookbook text,
  generated image import, and image section placement.

Do not create files named `data.ts`, `helper.ts`, `manager.ts`, `details.ts`,
`create.ts`, or `open.ts`.

## ProjectDataService Surface

Add explicit core service methods:

```ts
listInspirationFolders(input): Promise<PageResponse<InspirationFolder>>;
readInspirationFolder(input): Promise<InspirationFolderResource>;
createInspirationFolder(input): Promise<InspirationFolder>;
renameInspirationFolder(input): Promise<InspirationFolder>;
deleteInspirationFolder(input): Promise<void>;
upsertInspirationAnalysis(input): Promise<InspirationAnalysis>;

readLookbook(input): Promise<LookbookResource>;
upsertLookbook(input): Promise<Lookbook>;
importLookbookImage(input): Promise<LookbookImage>;
deleteLookbookImage(input): Promise<void>;
setLookbookImageSections(input): Promise<LookbookImage>;
```

Implementation notes:

- Browser uploads to Inspiration write image files directly into the folder's
  `project_relative_path`. They do not create asset rows.
- Browser uploads or agent-generated Lookbook images are registered as assets
  and attached through `lookbook_image`.
- CLI and agent workflows can call core with existing project-relative Lookbook
  image files created by generation commands.
- Core owns path allocation and validation.
- Core owns AJV and JSON Schema validation before writing section columns and
  after reading stored section columns.

## Studio Server API Shape

Add a project route module:

```text
packages/studio/server/routes/
  visual-language.ts
```

Mount it under:

```text
/studio-api/projects/:projectName/visual-language
```

Recommended endpoints:

```text
GET    /visual-language/inspiration
POST   /visual-language/inspiration/folders
GET    /visual-language/inspiration/folders/:folderId
PATCH  /visual-language/inspiration/folders/:folderId
DELETE /visual-language/inspiration/folders/:folderId
POST   /visual-language/inspiration/folders/:folderId/images
DELETE /visual-language/inspiration/folders/:folderId/images/:fileName
PUT    /visual-language/inspiration/folders/:folderId/analysis

GET    /visual-language/lookbook
PUT    /visual-language/lookbook
POST   /visual-language/lookbook/images
PUT    /visual-language/lookbook/images/:imageId/sections
DELETE /visual-language/lookbook/images/:imageId
```

The exact upload encoding belongs in the UI implementation plan. The data model
requires only that Inspiration images land inside the folder path and Lookbook
images become registered assets with project-relative file references.

## CLI Shape For Agents

Agents need CLI commands because the user expects Renku CLI based generation and
analysis workflows.

Recommended first CLI surface:

```text
renku visual-language inspiration list
renku visual-language inspiration create --name <name>
renku visual-language inspiration delete --folder <folder-id>
renku visual-language inspiration read --folder <folder-id>
renku visual-language inspiration write-analysis --folder <folder-id> --file <analysis-json>
renku visual-language inspiration read-analysis --folder <folder-id>

renku visual-language lookbook read
renku visual-language lookbook write --file <lookbook-json>
renku visual-language lookbook import-image --file <project-relative-path> --sections <section-list>
```

Do not add CLI compatibility commands for the old Visual Language category/entry
model.

## Migration Plan

Use Drizzle Kit exactly as described in
`docs/architecture/reference/drizzle-migrations.md`.

Implementation steps:

1. Update `packages/core/src/server/schema/visual-language.ts` to define only
   the new tables.
2. Update `packages/core/src/server/schema/assets.ts` to remove the old
   `visual_language_asset` table. Keep the new Lookbook tables in
   `schema/visual-language.ts` unless implementation discovers a clearer local
   ownership boundary.
3. Remove old access files:
   - `database/access/visual-language.ts`
   - `database/access/visual-language-categories.ts`
   - `database/access/asset-relationships/visual-language.ts`
4. Update asset relationship target configuration to remove old
   `visualLanguage`. Do not add an Inspiration target.
5. Generate a Drizzle migration from `packages/core`.
6. The generated migration should drop old tables and create new tables.
7. Do not add `PRAGMA user_version = ...` to this migration.
8. Apply migrations to development sample projects with `renku project migrate`
   after the schema and code are updated.

The no-`user_version` decision is intentional for this phase. Do not compensate
by adding runtime fallback readers for old tables.

## Structured Diagnostics

Use `ProjectDataError` and `@gorenku/studio-diagnostics` at package boundaries.

Required failure cases:

- Inspiration folder ID does not exist.
- Lookbook ID does not exist when attaching an image.
- Uploaded or generated file is outside the project folder.
- Generated Lookbook image file does not exist when registered by CLI.
- Inspiration analysis references an image filename that is not inside the
  folder.
- Lookbook image ID does not exist.
- Lookbook image section is not one of the accepted section keys.
- Section JSON is not valid JSON.
- Section JSON does not match the current AJV JSON Schema.
- Stored section JSON read from SQLite no longer matches the current AJV JSON
  Schema.
- A delete command would leave inconsistent Lookbook asset rows or file rows.

Do not silently drop invalid sections or guess missing image references.

## Tests

Focused core tests should cover:

- Creating, listing, renaming, reordering, and deleting Inspiration folders.
- Reading Inspiration folder images from the filesystem.
- Deleting an Inspiration image file from the folder.
- Writing and reading Inspiration analysis.
- Rejecting invalid section JSON with AJV-backed structured diagnostics.
- Rejecting malformed stored section JSON during reads with AJV-backed
  structured diagnostics.
- Writing and reading the project Lookbook.
- Registering flat Lookbook images.
- Assigning one Lookbook image to multiple sections.
- Reading `imagesBySection`.
- Removing the old `visualLanguage` asset target.
- Project shell no longer exposing old Visual Language categories or entries.
- Project counts no longer relying on dropped tables.

Migration tests should verify:

- New tables exist after migration.
- Old tables do not exist after migration.
- `user_version` is not changed by this migration.

## Completion Checklist

Use this checklist to decide whether the data-model phase is complete and ready
for UI implementation review.

- [x] Final product decisions are resolved or explicitly deferred: durable
  `Lookbook` name, Inspiration folder delete behavior, and whether first
  Lookbook writes must include all required sections.
- [x] Old Visual Language category, entry, and asset relationship tables are
  removed from the Drizzle schema with no aliases, shims, fallback readers, or
  compatibility loaders.
- [x] New Drizzle tables exist exactly for `inspiration_folder`,
  `inspiration_analysis`, `lookbook`, `lookbook_image`, and
  `lookbook_image_section`.
- [x] Inspiration folder names are not unique, and folder identity comes only
  from `inspiration_folder.id`.
- [x] Inspiration images are fully filesystem-owned under each folder's recorded
  `project_relative_path`; there is no Inspiration image table and no
  Inspiration asset target.
- [x] Lookbook images are registered assets stored flatly under
  `visual-language/lookbook/`.
- [x] Lookbook image section placement is stored through
  `lookbook_image_section`, allowing one image to appear in multiple sections.
- [x] The project folder layout uses `visual-language/inspiration/<folder-label>/`
  and `visual-language/lookbook/`, with no stale `working-assets/base`,
  Lookbook `images/`, or Inspiration `grabs/` folder levels.
- [x] Browser-safe Visual Language contracts are updated under
  `packages/core/src/client/` and old public Visual Language category contracts
  are removed directly.
- [x] `visual-language-json-schemas.ts` defines explicit JSON Schemas for every
  stored section shape.
- [x] `visual-language-json/validator.ts` validates all section JSON with AJV
  before writes and after reads, using the shared JSON storage validation
  pattern.
- [x] AJV validation errors and semantic validation failures are surfaced through
  structured diagnostics with useful field paths.
- [x] Core commands cover Inspiration folder create, rename, reorder, delete,
  image file workflows, Inspiration analysis upsert, Lookbook upsert, Lookbook
  image import, image deletion, and image section placement.
- [x] Core resources expose paginated Inspiration folder data, selected
  Inspiration folder data, Lookbook data, and `imagesBySection` without adding
  eager Visual Language data to `ProjectShell`.
- [x] Studio server routes are added under the Visual Language API surface and
  call shared core operations rather than duplicating storage rules.
- [x] CLI commands for agents can read and write Inspiration analysis and
  Lookbook JSON using the same core validators.
- [x] The generated Drizzle migration drops old tables, creates new tables, and
  does not increment or patch `PRAGMA user_version`.
- [x] Development sample projects are migrated after the schema and commands are
  updated.
- [x] Focused core tests and migration tests listed above pass.
- [x] Root or focused verification commands relevant to touched packages pass
  before the data-model implementation is marked complete.

## Open Questions Before Implementation

Resolved during implementation:

- The durable schema-facing and user-facing name remains `Lookbook`.
- Deleting an Inspiration folder deletes the folder-owned image files from disk.
- First Lookbook writes must include all required sections, because every
  section column is required and AJV-validated before persistence.
