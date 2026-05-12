# 0007 Visual Language Catalog And Project Model

Date: 2026-05-11

Status: implemented

## Goal

Define the first durable model for visual language in Renku Studio, including:

- project-owned visual language entries that can be modified and referenced by
  generation work;
- a system visual language catalog that Studio and agents can browse as a
  source of options;
- Markdown-first prompt and guidance storage;
- a separate continuity-reference model for recurring locations, costumes,
  props, architecture, and other consistency-critical subjects.

This plan should be implemented after:

- `0005-project-storage-foundation.md`
- `0006-asset-commands-and-selects.md`
- `0007-production-asset-materialization.md`

Those plans are already implemented and provide the project storage, asset
relationship, select, and production materialization foundations this work
should build on.

## References

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/project-relative-paths.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `sample-project.yaml`

## Product Direction

Visual language has two related but distinct jobs:

1. Help a user specify the visual preferences for one specific project.
2. Help users and agents discover reusable cinematic vocabulary and examples.

Those should not be the same storage model.

The project model stores decisions for this movie. The catalog stores options
that can be copied into a project and then edited there.

## Core Distinctions

### Visual Language

Visual Language is the project-specific creative direction system for AI
generation.

It should answer questions such as:

- what camera grammar this project prefers;
- what lighting rules are used in certain situations;
- what color and texture language should guide generated images and video;
- what composition patterns should recur;
- what should be avoided.

Visual Language entries are reusable project decisions. They can be bound to
clips, scenes, cast members, and continuity references.

### Visual Language Catalog

The Visual Language Catalog is a system-owned library of examples and prompt
vocabulary.

It should help beginners and agents discover common options such as:

- camera movements;
- shot sizes;
- composition patterns;
- lighting modes;
- color treatments;
- texture and material language;
- atmosphere and weather language;
- production-design language.

Catalog entries are not project decisions. They are templates and references.
When a user chooses a catalog entry, Studio creates a project-owned Visual
Language entry that can be edited independently.

### Continuity References

Locations, costumes, props, architecture, vehicles, ships, symbols, and other
recurring subjects should not be forced into Visual Language.

For example:

- "Mehmed's council chamber should look the same whenever the film returns to
  it" is a continuity concern.
- "Use practical-source low-key interiors" is a visual language concern.

Continuity References own consistency-critical recurring subjects. Visual
Language owns how those subjects should generally be photographed, lit,
colored, textured, or composed.

## Non-Goals

- Do not build a full Studio UI in this slice.
- Do not add generation execution behavior in this slice.
- Do not store the system Visual Language Catalog in project SQLite.
- Do not store heavily authored prompt text in SQLite.
- Do not require one universal "thesis" prompt for all generation types.
- Do not bake a closed category taxonomy into the product.
- Do not preserve compatibility with the current loose `visualLanguage` setup
  shape if this plan changes it.

## Optional Visual Direction Brief

A project may have an optional Visual Direction Brief, but it should not be a
required Visual Language category and it should not be automatically injected
into every generation prompt.

The brief is useful for:

- orienting users and agents;
- explaining the overall taste of the project;
- resolving conflicts between narrower entries;
- reviewing whether generated assets feel aligned.

The brief is not a generation primitive. Generation context should be assembled
from specific Visual Language entries and Continuity References.

## Project Visual Language Categories

Project categories should be editable and extensible.

Studio may seed common defaults, but users must be able to define new
categories.

Initial default categories:

```text
Color
Lighting
Camera
Composition
```

Avoid treating these as the only valid categories. A project may add categories
such as:

```text
Historical Grounding
Miniature Influence
Naval Imagery
Ritual And Ceremony
Map And Diagram Language
Battle Restraint
```

### Schema Direction

Add a project-owned category table:

```text
visual_language_category
  id text primary key
  name text not null
  description text nullable
  source text not null
  position integer not null
  created_at text not null
  updated_at text not null
```

Rules:

- `source = 'system'` means the category was seeded from Studio defaults.
- `source = 'project'` means the category was created for this project.
- `source` does not make the row immutable. Once a category is in the project,
  it belongs to the project database.
- Do not use category names as IDs.
- Do not infer category meaning from folder names.

## Project Visual Language Entries

Update the project-owned `visual_language` table so each entry belongs to a
category.

Table shape:

```text
visual_language
  id text primary key
  category_id text not null references visual_language_category(id)
  name text not null
  one_line_summary text nullable
  position integer not null
  created_at text not null
  updated_at text not null
```

Rules:

- Prompt text does not belong in this table.
- Markdown guidance does not belong in this table.
- Long descriptions do not belong in this table.
- `one_line_summary` is for display only.

Suggested browser-safe contract:

```ts
export interface VisualLanguageCategory {
  id: string;
  name: string;
  description?: string;
  source: 'system' | 'project';
}

export interface VisualLanguage {
  id: string;
  categoryId: string;
  name: string;
  summary?: string;
  assets?: VisualLanguageAssetLink[];
}
```

Keep naming aligned with `docs/architecture/naming-guidelines.md`: use
`VisualLanguage`, not `VisualLanguageProfile`.

## Markdown-First Visual Language Assets

All heavily authored visual-language text should be stored as Markdown assets.

SQLite should store:

- identity;
- category;
- ordering;
- role;
- relationship;
- selection state;
- file references.

Markdown should store:

- guidance;
- prompt templates;
- positive prompt language;
- negative prompt language;
- model-specific notes;
- examples;
- "use when" rules;
- "avoid" rules.

Use `visual_language_asset` to attach Markdown, image, video, and diagram
assets to a project Visual Language entry.

Initial role values:

```text
guidance
prompt
reference
anti_reference
palette_sheet
lighting_sheet
camera_work
motion_reference
```

Future role values may include:

```text
model_notes
texture_sheet
```

Do not add the future roles until the UI or generation code needs them.

## Reference Relationships Deferred

Do not add visual-language-to-target or continuity-to-target reference tables in
this slice.

Generation will eventually need a systematic way to reference:

- project Visual Language entries;
- Continuity References;
- Cast Members;
- Reference Sets;
- selected assets;
- narrative targets such as sequences, scenes, and clips.

That relationship model has not been designed yet. Do not prematurely introduce
a one-off polymorphic table such as:

```text
visual_language_binding
  target_kind text
  target_id text
```

That shape would conflict with the current storage direction, where domain
relationships use explicit tables and real database references wherever
possible.

For this slice, Visual Language entries and Continuity References can exist and
own assets, but nothing should claim to solve how generation targets reference
them. Design that later as a broader generation-context and reference-resolution
model.

## Continuity References

Add a separate model for recurring subjects that need consistency across the
movie.

Suggested table:

```text
continuity_reference
  id text primary key
  kind text not null
  name text not null
  one_line_summary text nullable
  position integer not null
  created_at text not null
  updated_at text not null
```

Initial `kind` values:

```text
location
costume
prop
architecture
vehicle
symbol
other
```

Use a domain name if a better one emerges before implementation. Avoid `world`
as a catch-all for this model because it is too genre-specific and too vague for
normal productions.

Attach assets with a dedicated relationship table:

```text
continuity_reference_asset
  id text primary key
  continuity_reference_id text not null references continuity_reference(id)
  asset_id text not null references asset(id)
  locale_id text nullable references project_locale(id)
  role text not null
  sort_order integer not null
  selection text not null default 'take'
  selection_order integer nullable
  created_at text not null
  updated_at text not null
```

Initial role values:

```text
description
reference
anti_reference
sheet
```

Examples:

```text
Location / Mehmed's council chamber
Prop / Giant bombard
Costume / Mehmed campaign cloak
Architecture / Rumelihisari fortress
Location / Constantinople sea walls
```

The future generation-context model should be able to resolve separate kinds of
context without treating them as the same thing:

```text
Visual Language:
- Lighting / Practical-source low-key interiors
- Camera / Slow observational camera grammar

Continuity References:
- Location / Mehmed's council chamber
- Costume / Mehmed campaign cloak
- Prop / Campaign map table
```

## System Visual Language Catalog

The Visual Language Catalog belongs in `@gorenku/studio-core`, not
`@gorenku/studio-engines`.

Reason:

- the catalog is a Studio creative-direction concept;
- Studio UI must display it;
- CLI and agents must be able to read it;
- engines should stay focused on asset generation engines and model/provider
  catalogs.

This mirrors the existence of the model catalog in `packages/engines`, but the
ownership is different.

## Catalog Storage Location

Catalog assets should be available outside a project so both Studio and agents
can read them.

Use the user config directory:

```text
~/.config/renku/visual-language/
```

On macOS, this intentionally stays under the XDG-style config path unless the
project later adopts a cross-platform config-path abstraction.

Suggested installed shape:

```text
~/.config/renku/visual-language/
  catalog.json
  camera/
    locked-off-tripod/
      explanation.md
      prompt-template.md
      illustration.png
    slow-dolly-in/
      explanation.md
      prompt-template.md
      illustration.mp4
  lighting/
    practical-candlelight/
      explanation.md
      prompt-template.md
      illustration.png
  composition/
    foreground-occlusion/
      explanation.md
      prompt-template.md
      illustration.png
```

The exact `catalog.json` file is optional. The first implementation can discover
entries from `explanation.md` files if validation is clear and fast. If
discovery becomes slow or error-prone, generate a manifest as an implementation
detail.

## Catalog Entry Format

Each catalog entry is represented by an `explanation.md` file with frontmatter.

Required frontmatter:

```yaml
id: camera.locked-off-tripod
category: camera
name: Locked-off tripod
summary: A stable camera position that creates observation, formality, or restraint.
promptTemplate: prompt-template.md
illustration:
  file: illustration.png
  mediaKind: image
```

Optional frontmatter:

```yaml
tags:
  - camera
  - restraint
  - documentary
appliesTo:
  - clip.video
  - cast.character_sheet
difficulty: beginner
```

Rules:

- `id` is stable and unique across the catalog.
- `category` is the catalog category key, not necessarily the project category
  name.
- `promptTemplate` is a relative path from the entry folder.
- `illustration.file` is a relative path from the entry folder.
- `illustration.mediaKind` must be `image` or `video`.
- Catalog paths must be normalized and must not escape the catalog root.
- Unknown frontmatter keys should be warnings, not errors, unless they create
  ambiguous behavior.
- Missing required frontmatter fields are structured errors.

The Markdown body of `explanation.md` is the human-readable explanation shown in
Studio and readable by agents.

`prompt-template.md` stores reusable prompt language and authoring notes.

Example `prompt-template.md`:

```md
# Prompt Template

Locked-off tripod shot, stable frame, no camera movement, restrained
observational composition.

## Use When

- the scene should feel formal or measured
- geography or blocking matters more than motion
- character movement should carry the shot

## Avoid

- fast action that needs physical immediacy
- emotional beats that need a motivated push-in
```

## Core Catalog Reader

Add a core reader that can be used by both Studio and CLI.

Suggested module shape:

```text
packages/core/src/visual-language-catalog/
  contracts.ts

packages/core/src/node/visual-language-catalog/
  visual-language-catalog-paths.ts
  visual-language-catalog-reader.ts
  visual-language-catalog-validation.ts
```

Suggested contracts:

```ts
export interface VisualLanguageCatalogEntry {
  id: string;
  category: string;
  name: string;
  summary: string;
  explanationMarkdown: string;
  promptTemplateMarkdown: string;
  illustration: VisualLanguageCatalogIllustration;
  tags: string[];
  appliesTo: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface VisualLanguageCatalogIllustration {
  projectRelativePath?: never;
  catalogRelativePath: string;
  mediaKind: 'image' | 'video';
}
```

The catalog is outside a project, so do not use `ProjectRelativePath` for
catalog files. Use a separate catalog-relative path contract.

Reader behavior:

- resolve the catalog root;
- discover catalog entries;
- parse frontmatter from `explanation.md`;
- read referenced `prompt-template.md`;
- validate referenced illustration files;
- return structured diagnostics for missing or invalid entries;
- expose a list operation for Studio and CLI;
- expose a read-by-id operation for agents.

Use `@gorenku/studio-diagnostics` for errors and warnings.

## Catalog Installation

The first implementation may use a bundled seed catalog inside the repository
and copy it into the user config directory on demand.

Suggested bundled source:

```text
packages/core/catalog/visual-language/
```

Suggested user destination:

```text
~/.config/renku/visual-language/
```

Open implementation question:

- Should Studio always read from the bundled catalog when the user config
  catalog does not exist?
- Or should core copy the bundled catalog into user config the first time the
  catalog is requested?

Preferred first behavior:

- copy the bundled catalog into user config on demand;
- fail fast if the copy fails;
- expose a `--catalog-root` override for tests and agent workflows.

Do not run package-management commands for this work.

## Creating Project Entries From Catalog Entries

When a user chooses a catalog entry, Studio should create a project-owned Visual
Language entry.

The copied project entry should:

- create or reuse a matching project Visual Language category;
- create a `visual_language` row;
- create Markdown assets from the catalog explanation and prompt template;
- optionally copy the illustration into the project as a reference asset;
- attach those assets through `visual_language_asset`;
- leave the catalog entry unchanged.

After creation, the project entry is independent. Editing it must not modify the
catalog.

Suggested copied asset roles:

```text
guidance      <- explanation.md body
prompt        <- prompt-template.md
reference     <- illustration image/video, if copied
```

The copy operation should be explicit about file locations and should use the
existing project asset registration logic. Setup-time creation may still create
these assets directly as part of project creation, following the existing setup
asset materialization pattern.

## Project Setup YAML Direction

Update `sample-project.yaml` so it declares structural relationships and file
paths, not large prompt bodies.

Suggested shape:

```yaml
visualLanguageCategories:
  - name: Color
  - name: Lighting
  - name: Camera
  - name: Composition

visualLanguage:
  - category: Lighting
    name: Practical-source low-key interiors
    shortDescription: Candle, oil lamp, furnace, and torchlight motivate warm interiors with deep brown shadows.
    guidanceFile: sample-project/visual-language/lighting/practical-source-low-key-interiors/guidance.md
    promptFile: sample-project/visual-language/lighting/practical-source-low-key-interiors/prompt.md

  - category: Camera
    name: Slow observational camera grammar
    shortDescription: Mostly locked-off, slow lateral tracking, slow push-ins, and restrained reveals.
    guidanceFile: sample-project/visual-language/camera/slow-observational-camera-grammar/guidance.md
    promptFile: sample-project/visual-language/camera/slow-observational-camera-grammar/prompt.md
```

Continuity setup:

```yaml
continuityReferences:
  - kind: location
    name: Mehmed's council chamber
    shortDescription: Formal Ottoman planning room with maps, textiles, oil lamps, and controlled court staging.
    descriptionFile: sample-project/continuity/locations/mehmeds-council-chamber/description.md

  - kind: prop
    name: Giant bombard
    shortDescription: Massive bronze siege cannon, physically dangerous and almost too heavy to move.
    descriptionFile: sample-project/continuity/props/giant-bombard/description.md
```

Rules:

- setup file paths must be project-local or setup-relative according to one
  documented rule;
- missing setup files are errors;
- unknown YAML fields are warnings and ignored;
- prompt and guidance bodies should live in Markdown files;
- do not preserve the old loose `visualLanguage[].intent` shape as a
  compatibility path.

## Documentation Updates

Update accepted architecture docs after the model is implemented:

- `docs/architecture/reference/domain-vocabulary.md`
  - define Visual Language Category;
  - define Visual Language Catalog Entry;
  - define Continuity Reference;
  - clarify that catalog entries are options and project entries are decisions.

- `docs/architecture/reference/project-files-and-assets.md`
  - add continuity reference assets;
  - clarify visual-language asset roles.

- `docs/architecture/reference/project-storage-boundaries.md`
  - document that visual-language prompts live in Markdown assets;
  - document that the system catalog is outside project SQLite.

- `docs/architecture/naming-guidelines.md`
  - update `VisualLanguage` expected shape;
  - add `VisualLanguageCategory`;
  - add `ContinuityReference`.

## Implementation Steps

1. Add project schema for `visual_language_category` and update
   `visual_language.category_id`.
2. Add `continuity_reference` and `continuity_reference_asset`.
3. Update project contracts and project reader projections.
4. Update setup reader validation for:
   - `visualLanguageCategories`;
   - category-backed `visualLanguage`;
   - Markdown file references;
   - `continuityReferences`.
5. Add catalog contracts under `packages/core/src/visual-language-catalog/`.
6. Add node catalog reader and validation under
   `packages/core/src/node/visual-language-catalog/`.
7. Add a tiny bundled seed catalog under
   `packages/core/catalog/visual-language/`.
8. Add tests for:
   - valid catalog entry reading;
   - missing prompt template;
   - missing illustration;
   - invalid frontmatter;
   - setup-created visual language categories and Markdown assets;
   - setup-created continuity references and Markdown assets.
9. Update `sample-project.yaml` and add sample Markdown files under
   `sample-project/`.
10. Update docs listed above.

Use the Drizzle Kit workflow from `docs/architecture/reference/drizzle-migrations.md` for
schema changes.

## Verification

Focused verification:

```bash
pnpm test:core
pnpm build:core
```

Broader verification when the slice is complete:

```bash
pnpm check
```

Expected outcomes:

- core can read the Visual Language Catalog from a test catalog root;
- catalog validation reports structured diagnostics;
- project setup creates category-backed Visual Language entries;
- project setup stores prompt and guidance text as Markdown assets;
- project setup creates Continuity References;
- generated project projections expose visual language categories, entries, and
  continuity references;
- no catalog data is stored in project SQLite unless the user explicitly copies
  a catalog entry into the project.

## Impact On Existing And Later Plans

This plan intentionally does not update the implemented asset target model from
`0006-asset-commands-and-selects.md`.

Continuity References own assets through `continuity_reference_asset`, but the
broader question of how generic asset commands, CLI target syntax, and
generation context should reference Continuity References belongs in a later
reference-resolution design.

`0010-development-sample-project-skill.md` should use the new setup shape and
fixture folders after this plan is implemented.
