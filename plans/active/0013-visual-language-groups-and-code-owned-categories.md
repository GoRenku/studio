# 0013 Visual Language Groups And Code-Owned Categories

Date: 2026-05-15

Status: active

## Purpose

Rework Visual Language so Studio owns the category vocabulary in code, while
projects store user-named Visual Language groups and the category instances
inside those groups.

This replaces the current database-backed category model. Users should organize
Visual Language around named groups they can reference while developing a movie.
Categories are product surfaces with their own future UI, so they should be
defined by Studio code and evolve with the product.

## Current Problem

The current model stores `visual_language_category` rows in project SQLite and
stores Visual Language entries directly under those category rows.

That does not match the intended product model:

- categories are not user-created taxonomy;
- each category needs a dedicated Studio experience;
- users need named reusable groups, such as "Location Visual Language" or
  "Battle Interior Look";
- a group may contain only the relevant category instances;
- the sidebar should expose groups first, not raw category entries.

The current Studio UI also shows the Visual Language count but does not let the
user inspect the entries.

## Product Model

### Code-Owned Categories

Studio owns this initial category vocabulary in code:

- `Color, Grade and Lighting`
  The look and mood board: palette, grade, light logic, contrast, source
  behavior, and emotional tone.
- `Camera Grammar`
  Shot size, lens behavior, camera restraint, movement rules, and recurring
  camera language.
- `Composition`
  Frame organization, negative space, staging, balance, horizon behavior, and
  visual hierarchy.
- `Motion & Rhythm`
  Broad rhythm of motion, pacing, visual tempo, stillness, repeated movement,
  and edit-adjacent visual cadence.
- `Texture & Atmosphere`
  Materials, grain, weathering, tactile surfaces, smoke, dust, air, humidity,
  and environmental feel.

The category key should be stable and code-owned. The display label and
description can change in code as the product matures.

### Project-Owned Groups

A `VisualLanguageGroup` is a user-named project object. It exists so users can
organize and reference a reusable bundle of visual direction.

Examples:

- `Location Visual Language`
- `Ottoman Court Interiors`
- `Night Siege`
- `Character Close-Ups`

A group can contain any subset of code-owned category instances. It does not
need all categories.

### Category Instances

A `VisualLanguage` row is now a category instance inside a group.

It stores:

- group relationship;
- code-owned category key;
- optional user-facing instance name;
- compact summary;
- priority;
- ordering;
- Markdown-backed guidance and prompt assets through `visual_language_asset`.

The category instance opens the future category-specific UI. The first
implementation can show a placeholder body per category, but the data contract
should already make room for category-specific surfaces.

## Naming

Use:

- `VisualLanguageGroup` for the user-named durable grouping.
- `VisualLanguage` for the category instance inside a group.
- `VisualLanguageCategoryKey` for the code-owned category identifier.
- `VISUAL_LANGUAGE_CATEGORIES` for the code-owned category registry.

Do not use:

- `VisualLanguageProfile`
- `Style`
- `VisualLanguageCategoryRecord`
- database categories
- compatibility aliases for the old category table

This follows `docs/architecture/naming-guidelines.md`: public contract objects
use plain domain names, setup input shapes use `Setup`, and database row shapes
use `Record`.

## Database Direction

Project SQLite should store:

```text
visual_language_group
  id text primary key
  name text not null
  one_line_summary text nullable
  position integer not null
  created_at text not null
  updated_at text not null

visual_language
  id text primary key
  group_id text not null references visual_language_group(id)
  category_key text not null
  name text not null
  one_line_summary text nullable
  priority text not null
  position integer not null
  created_at text not null
  updated_at text not null
```

Remove:

```text
visual_language_category
visual_language.category_id
```

Because current runtime reads require the new shape, this is a breaking project
store schema change. Increment the project store schema generation and set
`PRAGMA user_version` in the generated migration.

Use the Drizzle Kit codebase-first workflow from
`docs/architecture/reference/drizzle-migrations.md`:

1. Update the Drizzle TypeScript schema.
2. Generate SQL with `pnpm drizzle-kit generate --config drizzle.config.ts`.
3. Review generated SQL and add schema generation pragma when required.
4. Apply through the project migration command for development databases.

## Setup YAML Direction

Replace `visualLanguageCategories` plus flat `visualLanguage` with groups:

```yaml
visualLanguageGroups:
  - name: Location Visual Language
    shortDescription: Shared look rules for locations, interiors, and material texture.
    visualLanguage:
      - category: colorGradeLighting
        name: Muted earth, stone, bronze, and textile palette
        priority: default
        shortDescription: Umber leather, smoke-gray wool, dirty ivory linen, oxidized bronze, faded burgundy, and blue-gray stone.
        guidanceFile: sample-project/visual-language/location/color-grade-lighting/guidance.md
        promptFile: sample-project/visual-language/location/color-grade-lighting/prompt.md
      - category: textureAtmosphere
        name: Weathered tactile material truth
        priority: default
        shortDescription: Worn linen, cracked leather, smoke, mud, soot, oxidized bronze, rough stone, and frayed ropes.
        guidanceFile: sample-project/visual-language/location/texture-atmosphere/guidance.md
        promptFile: sample-project/visual-language/location/texture-atmosphere/prompt.md
```

Unknown category keys are setup validation errors. Do not infer categories from
display labels or old names.

## Studio UI Direction

### Sidebar

The Visual Language sidebar section expands to show Visual Language groups.

Clicking a group selects that group. The right-hand area shows the category
instances inside the group.

Future nested behavior:

- group row expands to category instances;
- selecting a category instance opens its category-specific surface;
- the details header shows a breadcrumb such as:

```text
Location Visual Language -> Color, Grade and Lighting
```

### Top-Level Visual Language Area

Selecting top-level Visual Language shows all groups.

First implementation:

- header with `Visual Language` title and an add button on the top right;
- responsive group card grid;
- horizontal-first cards on wide screens;
- cards show group name, summary, and included category labels;
- add button can be present but disabled or local-only until the mutation
  command exists.

### Group Area

Selecting a group shows:

- breadcrumb back to Visual Language;
- group name and summary;
- add category dropdown on the top right;
- category instance cards for instances in the group;
- disabled dropdown items for category keys already present in the group.

Each category instance card should use the code-owned category label and make it
clear that the custom UI for that category is coming later.

## First Implementation Scope

Implement now:

- code-owned category registry;
- `VisualLanguageGroup` public contract;
- project SQLite schema for groups and category-keyed instances;
- setup YAML reader/writer for `visualLanguageGroups`;
- sample project YAML update;
- project shell/full-project projections exposing groups and entries;
- sidebar expansion showing groups;
- Visual Language top-level card grid;
- group detail surface with add-category dropdown;
- tests for setup creation, shell projection, sidebar rendering, and panel
  rendering where practical.

Defer:

- durable create/update/delete commands for groups and category instances;
- category-specific editing UIs;
- generation-time Visual Language resolution;
- binding Visual Language groups to cast, scenes, clips, or episodes.

## Acceptance Criteria

- No project SQLite table stores Visual Language categories.
- Code exports a single Visual Language category registry.
- `sample-project.yaml` uses `visualLanguageGroups`.
- A project shell exposes groups and category instances.
- The sidebar Visual Language section expands to show groups.
- The Visual Language top-level panel shows all groups in cards.
- A selected group shows its category instances and an add-category dropdown.
- The code uses local Shadcn UI primitives for interactive controls.
- Root checks pass for the touched packages, or any remaining failures are
  clearly documented.
