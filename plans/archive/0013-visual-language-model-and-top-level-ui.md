# 0013 Visual Language Model And Top-Level UI

Date: 2026-05-15

Status: active draft

## Purpose

Redesign the first durable Visual Language model and implement the first
top-level Studio UI for browsing user-named Visual Language collections.

This plan intentionally separates product decisions from implementation steps.
The current model is not ready to implement as-is because the old database shape
stores categories as project rows and assumes one generic `visual_language`
table. The desired product direction is different:

- Studio owns the category vocabulary in code.
- Users do not create categories.
- Users create named reusable collections of Visual Language category instances.
- Each category has its own future UI and its own future storage needs.
- The first implementation should be minimal and should not invent columns for
  needs we have not designed yet.

## Current State

The current code has:

- a `visual_language_category` table;
- a `visual_language` table with `category_id`, `name`, `one_line_summary`,
  `priority`, ordering, and timestamps;
- setup YAML fields named `visualLanguageCategories` and flat `visualLanguage`;
- a Studio sidebar row that shows a count but does not expand;
- a placeholder Visual Language panel.

The current shape is wrong for the new product direction because it makes
categories look project-owned and generic. It also encourages one common table
for category instances even though category data will diverge.

## Product Direction

### Code-Owned Categories

Studio owns this first category set in code:

- `Color, Grade and Lighting`
  Palette, grade, light behavior, contrast, source logic, mood, and color rules.
- `Camera Grammar`
  Shot size, lens behavior, camera restraint, movement rules, and recurring
  camera language.
- `Composition`
  Frame organization, negative space, staging, balance, horizon behavior, and
  visual hierarchy.
- `Motion & Rhythm`
  Visual tempo, stillness, repeated movement, broad motion rules, and rhythm.
- `Texture & Atmosphere`
  Materials, grain, weathering, tactile surfaces, smoke, dust, air, and
  environmental feel.

These categories should live in code because each category is a product surface,
not user taxonomy. We can add, rename, merge, or split categories as the product
develops.

### User-Named Collections

Users need named reusable collections so they can organize and reference Visual
Language while developing the movie.

Examples:

- `Location Visual Language`
- `Interior Firelight`
- `Battlefield Smoke`
- `Palace Ceremony`
- `Character Close-Ups`

A collection can contain any subset of categories. For example:

- `Location Visual Language`
  - `Color, Grade and Lighting`
  - `Texture & Atmosphere`

- `Interior Firelight`
  - `Color, Grade and Lighting`
  - `Motion & Rhythm`

- `Observational Camera Language`
  - `Camera Grammar`
  - `Composition`

Users reference the collection name when they want to reuse that bundle of
Visual Language decisions.

## Naming Options

The previous name `VisualLanguageGroup` is too long and reads like internal
machinery. We should choose a shorter product word before implementing.

### Option A: `Look`

User-facing examples:

- `Location Look`
- `Interior Firelight Look`
- `Battlefield Smoke Look`

Code/table examples:

- public contract: `Look`
- table: `visual_language_look`
- route: `/visual-language/looks/:lookId`

Pros:

- short;
- familiar to filmmakers, photographers, colorists, and designers;
- natural in the sidebar;
- works well in sentences: "Add a Color, Grade and Lighting section to this
  look."

Cons:

- can sound narrower than Visual Language if interpreted as color-only;
- needs product copy to make clear that a look can include camera, composition,
  motion, texture, and atmosphere.

### Option B: `Treatment`

User-facing examples:

- `Location Treatment`
- `Interior Firelight Treatment`
- `Palace Ceremony Treatment`

Code/table examples:

- public contract: `Treatment`
- table: `visual_language_treatment`
- route: `/visual-language/treatments/:treatmentId`

Pros:

- strong creative-development word;
- implies a reusable package of direction;
- less color-centric than `Look`.

Cons:

- can be confused with story treatments;
- less immediate in a sidebar;
- may feel document-like instead of production-direction-like.

### Option C: `Visual Set`

User-facing examples:

- `Location Visual Set`
- `Interior Firelight Visual Set`

Code/table examples:

- public contract: `VisualSet`
- table: `visual_language_set`
- route: `/visual-language/sets/:setId`

Pros:

- compact;
- communicates a collection;
- not tied to a single category.

Cons:

- "set" may conflict with film sets and locations;
- `VisualSet` sounds a bit technical;
- less emotionally clear than `Look`.

### Option D: `Language`

User-facing examples:

- `Location Language`
- `Interior Firelight Language`

Code/table examples:

- public contract: `VisualLanguage`
- table: `visual_language`
- route: `/visual-language/:visualLanguageId`

Pros:

- directly tied to the product phrase "Visual Language";
- concise;
- avoids adding another product noun.

Cons:

- confusing with spoken project languages/locales;
- `VisualLanguage` is already used for the whole feature area and current entry
  model;
- likely to create naming ambiguity in code.

### Recommendation

Use `Look` unless we decide it is too narrow after product review.

Suggested names:

- product surface: `Visual Language`
- user-created collection: `Look`
- code-owned category: `Visual Language Category`
- category-specific record examples:
  - `ColorGradeLighting`
  - `CameraGrammar`
  - `Composition`
  - `MotionRhythm`
  - `TextureAtmosphere`

This gives us short UI language without losing the larger Visual Language
concept.

## Data Model Principles

Do not build a generic "category instance" table.

Each category will eventually store different data. For example, `Color, Grade
and Lighting` may store a YAML palette file, while `Camera Grammar` may store
lens and movement rules, and `Texture & Atmosphere` may store material and
particle guidance. A shared table would either become vague or fill with nullable
columns that only apply to one category.

The first model should be:

- minimal;
- explicit;
- category-specific;
- easy to evolve with new columns later;
- free of compatibility shims for the old category-table model.

Avoid vague or speculative columns:

- do not add `priority`;
- do not add `one_line_summary`;
- do not add category metadata to project SQLite;
- do not add catch-all JSON columns unless we explicitly decide that a category
  needs structured flexible data;
- do not add "just in case" fields for future UI.

Use `summary` if we need a compact description. It is shorter and clear enough.
If the first implementation does not need it for durable behavior, defer it.

## Proposed Database Shape

Assuming the recommended `Look` name:

```text
visual_language_look
  id text primary key
  name text not null
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Category-specific tables:

```text
visual_language_color_grade_lighting
  id text primary key
  look_id text not null references visual_language_look(id)
  created_at text not null
  updated_at text not null

visual_language_camera_grammar
  id text primary key
  look_id text not null references visual_language_look(id)
  created_at text not null
  updated_at text not null

visual_language_composition
  id text primary key
  look_id text not null references visual_language_look(id)
  created_at text not null
  updated_at text not null

visual_language_motion_rhythm
  id text primary key
  look_id text not null references visual_language_look(id)
  created_at text not null
  updated_at text not null

visual_language_texture_atmosphere
  id text primary key
  look_id text not null references visual_language_look(id)
  created_at text not null
  updated_at text not null
```

Each category table should have a unique index on `look_id` for now, because the
current UI model is "a look contains zero or one instance of each category."

Open decision:

- Do we want a look to support multiple instances of the same category later?
  Example: two separate `Color, Grade and Lighting` entries inside one look.
  If yes, remove the unique `look_id` constraint and add a required `name`
  column to category tables. If no, keep category tables one-per-look and let
  the look name carry the referenceable identity.

### Category Data Files

Some category data should live in files rather than columns.

For `Color, Grade and Lighting`, likely future storage:

```text
visual_language_color_grade_lighting
  id text primary key
  look_id text not null references visual_language_look(id)
  palette_file text nullable
  created_at text not null
  updated_at text not null
```

But do not add `palette_file` in the first migration unless the first slice also
creates, reads, validates, and displays the palette YAML file.

The first migration can leave the category tables structurally minimal and add
category-specific columns only when the corresponding category UI and file
contract are designed.

## Public Contract Direction

Assuming the recommended `Look` name:

```ts
export interface Look {
  id: string;
  name: string;
  categories: LookCategory[];
}

export type LookCategory =
  | { kind: 'colorGradeLighting'; id: string }
  | { kind: 'cameraGrammar'; id: string }
  | { kind: 'composition'; id: string }
  | { kind: 'motionRhythm'; id: string }
  | { kind: 'textureAtmosphere'; id: string };
```

For the top-level UI, the browser only needs:

- look id;
- look name;
- which category instances exist.

Do not expose empty placeholder category payloads. Category-specific detail
resources should be added when we build each category UI.

## Setup YAML Direction

The YAML should describe looks and the category instances included in each look.

Do not keep `visualLanguageCategories`.

Suggested shape:

```yaml
looks:
  - name: Location Visual Language
    categories:
      - colorGradeLighting
      - textureAtmosphere

  - name: Observational Camera Language
    categories:
      - cameraGrammar
      - composition
```

Why this is intentionally minimal:

- category-specific data contracts are not designed yet;
- we should not force every category into a fake shared `guidanceFile` or
  `promptFile` shape;
- it lets the first UI render real looks and category presence without implying
  that all category UIs share one storage contract.

Future category-specific YAML can extend this shape deliberately:

```yaml
looks:
  - name: Location Visual Language
    colorGradeLighting:
      paletteFile: sample-project/visual-language/location/palette.yaml
    textureAtmosphere:
      materialNotesFile: sample-project/visual-language/location/materials.md
```

Open decision:

- Should the first YAML key be `looks`, `visualLooks`, or `visualLanguage`?

Recommendation:

- Use `looks` if we choose the `Look` name.
- Use `visualLanguage` only if we decide the collection object itself should be
  called `VisualLanguage`, which risks ambiguity with the whole feature.

## Studio UI Plan

### Sidebar

Visual Language becomes an expandable sidebar section.

Expanded state:

```text
Visual Language
  Location Visual Language
  Interior Firelight Look
  Observational Camera Language
```

Clicking the top-level `Visual Language` row shows all looks.

Clicking a look row shows the look details.

Do not show raw category rows in the sidebar in the first implementation unless
we also implement stable category selection routes. The user can select category
cards inside the details area first.

### Top-Level Visual Language Panel

The right area for top-level Visual Language shows all looks as cards.

Header:

- title: `Visual Language`
- top-right add button;
- add button label/icon can be `New Look` if `Look` is accepted.

Card content:

- look name;
- category badges for included categories;
- empty-state copy when a look has no categories;
- click opens the look.

Layout:

- horizontal-first cards on wide screens;
- responsive grid on narrower screens;
- no nested cards;
- use local shadcn primitives for buttons and cards;
- keep cards at 8px radius or less to match project guidance.

### Look Details Panel

Header:

- breadcrumb: `Visual Language -> Location Visual Language`
- top-right add-category dropdown.

Body:

- category cards for categories present in the look;
- each card uses the code-owned category name and short product description;
- selecting a category opens a placeholder category-specific surface only if a
  stable selection route is added.

Add-category dropdown:

- lists code-owned categories not already present;
- disabled items or omitted items for categories already present;
- first implementation may be UI-only if mutation commands are not part of this
  slice.

Open decision:

- Should "add look" and "add category" be durable in the first implementation,
  or should the first implementation only render starter/YAML data and show the
  intended controls disabled?

Recommendation:

- First implementation should render starter/YAML data and include disabled
  controls with clear tooltips only if we want a low-risk UI review slice.
- If we want the controls functional, add explicit core commands and server
  routes in the same slice. Do not fake local-only mutations.

## Routing And Selection

Potential routes if `Look` is accepted:

```text
/projects/:projectName/visual-language
/projects/:projectName/visual-language/looks/:lookId
```

Future category detail route:

```text
/projects/:projectName/visual-language/looks/:lookId/color-grade-lighting
```

The first implementation can stop at look selection. Category-specific routes
should wait until category-specific UIs exist.

## Migration Plan

This is a breaking project SQLite schema change because runtime reads would use
new tables.

Follow `docs/architecture/reference/drizzle-migrations.md`:

1. Update Drizzle schema.
2. Generate a migration with Drizzle Kit.
3. Increment the project store schema generation.
4. Add `PRAGMA user_version = <new generation>;` to the generated migration.
5. Apply the migration to development projects explicitly.

Migration should:

- create `visual_language_look`;
- create one category-specific table per code-owned category;
- remove or stop using `visual_language_category`;
- remove or stop using the generic `visual_language` table if we choose the
  category-specific model.

Because this is pre-customer software, do not preserve old readers or aliases.
Update callers directly and tests should describe only the new model.

## Implementation Phases

### Phase 1: Approve Product Names And Model

Decide:

- collection name: `Look`, `Treatment`, `Visual Set`, or another name;
- whether each category can appear once or multiple times inside a collection;
- whether add controls must be functional in the first UI slice;
- initial YAML key name.

No code implementation should start before these are settled.

### Phase 2: Core Contract And Schema

After approval:

- add the code-owned category registry;
- replace browser contracts with the approved collection name;
- add category-specific SQLite tables;
- remove database-backed category contracts;
- remove `priority`;
- avoid `one_line_summary`;
- add only the columns needed by the first UI.

### Phase 3: Setup YAML

After schema approval:

- replace `visualLanguageCategories` and flat `visualLanguage`;
- update setup reader validation;
- update setup writer;
- update sample project YAML;
- update tests.

### Phase 4: Studio UI

After contracts are stable:

- make the Visual Language sidebar expandable;
- list looks/collections in the sidebar;
- build top-level Visual Language card grid;
- build selected look details panel;
- add category badges/cards;
- add disabled or functional add controls based on Phase 1 decision.

### Phase 5: Validation

Run focused checks first:

```bash
pnpm test:core
pnpm test -- --run packages/studio/src/features/movie-studio
pnpm lint
```

Then run root-level checks if the focused checks pass:

```bash
pnpm check
pnpm build
```

## Acceptance Criteria

- The plan-approved collection name is used consistently.
- Visual Language categories are defined in code, not project SQLite.
- There is no generic `visual_language` category-instance table unless we
  explicitly reject category-specific tables.
- No `priority` field exists in the new model.
- No `one_line_summary` field is introduced in the new model.
- The YAML starter uses the approved new shape.
- The sidebar opens Visual Language and shows user-named collections.
- The top-level Visual Language panel shows collections as cards.
- The selected collection panel shows included category instances.
- Add controls either perform real persisted mutations or are intentionally
  disabled; no local-only fake persistence.
