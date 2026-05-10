# 0005 Project Storage Foundation

Date: 2026-05-10

Status: implemented

## Goal

Create the first usable project storage slice:

- first-class project-relative paths;
- a clean Drizzle schema for project structure, assets, asset files, and
  explicit domain asset relationship tables;
- Markdown asset materialization from `sample-project.yaml`;
- folder allocation for `Working Assets/Base/`;
- no compatibility with the earlier prototype schema.

This combines the storage foundation and setup Markdown work because without
Markdown assets the schema has no meaningful content to verify.

## References

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/domain-vocabulary.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/project-storage-boundaries.md`
- `docs/architecture/project-files-and-assets.md`
- `docs/architecture/project-relative-paths.md`
- `docs/architecture/drizzle-migrations.md`
- `docs/architecture/structured-diagnostics.md`
- `sample-project.yaml`

## Deliverable

Running project creation with `sample-project.yaml` creates:

- a fresh `.renku/project.sqlite` using the current schema;
- short display fields in SQLite;
- Markdown files for rich text fields;
- `asset` and `asset_file` rows for Markdown files;
- explicit SQLite relationship rows in domain-specific tables connecting those
  assets to project, visual language, sequence, scene, and clip records;
- project projections that can expose both direct SQLite text fields and
  Markdown-backed rich text asset links.

## Key Data Model Clarification

Assets are intentionally stored in one flat `asset` table, but their domain
scope, meaning, and usage are not inferred and are not hidden in paths.

The project SQLite database represents exactly one project. For that reason,
project-owned tables should not repeat `project_id` on every row.

Every asset in the database belongs to that project because it is stored in that
project's database.

Every domain relationship is represented by an explicit SQLite relationship row
with a real foreign key.

Use domain-specific relationship tables:

```text
project_asset
visual_language_asset
cast_asset
sequence_asset
scene_asset
clip_asset
```

These are not separate asset stores. They do not mean "cast assets live in
`cast_asset`" or "clip assets live in `clip_asset`." All assets live in the
single `asset` table. The domain relationship tables answer where and why that
asset is used:

- `asset` says "this registered thing exists."
- `asset_file` says "these files belong to that thing."
- `clip_asset` says "this thing is attached to this clip as narration,
  subtitle, prompt, reference image, video take, or another clip-scoped role."
- `cast_asset` says "this thing is attached to this cast member as a character
  sheet, portrait, voice sample, costume reference, or another cast-scoped
  role."

This is more tables than a polymorphic attachment table, but it gives us:

- clear Drizzle table definitions;
- clear TypeScript record types;
- real foreign keys;
- simpler joins;
- relationship-specific roles and future constraints;
- no free-text `owner_type` / `owner_id` target fields;
- no nullable-FK grab bag table with a fragile "exactly one target" check.

In TypeScript, core should keep the attachment target separate from the locale
variant. The target answers "what domain object gives this asset meaning?" The
locale context answers "is this relationship locale-neutral or specific to one
configured project locale?"

```ts
type AssetTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; visualLanguageId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'clip'; clipId: string };

type AssetLocaleContext = {
  localeId?: string | null;
};
```

The command layer can switch on `kind` and write the matching relationship
table. The database still stays relational and strongly shaped.

`default_project_relative_path` should not be stored on `cast_member`,
`visual_language`, or narrative tables in this slice. A cast member or clip does
not own a folder as durable metadata by itself. The durable data is:

- the domain record;
- asset rows;
- asset file rows with `project_relative_path`;
- explicit domain asset relationship rows.

Folder allocation can be recomputed by core when creating new files. Existing
files are resolved through `asset_file.project_relative_path`.

## Locale Model

The `project_locale` table represents a locale configured for this project.

Use the public term **Project Locale** for this row shape in code and docs.
Avoid language-prefixed project locale table or column names in schema and
TypeScript because they are too easy to confuse with `visual_language`. Also
avoid `supported_locale_id` for asset rows because it is too vague for the
relationship being modeled.

In this slice:

- `project_locale` stores configured locales, including the base locale.
- `project_locale.is_base` identifies the base locale.
- `project_locale.locale_tag` stores the BCP 47-style locale tag, such as
  `en-US` or `tr-TR`.
- Locale is a variant dimension on an asset relationship, not its own asset
  area.
- Domain asset relationship tables can have `locale_id` when the relationship
  is locale-specific.
- `locale_id = null` means locale-neutral, not "base locale."
- If an asset is specifically in the base locale, use the base
  `project_locale.id`.
- Do not add `project_locale_asset`. A Turkish project glossary is still a
  project asset; Turkish narration is still a clip asset; a Turkish voice sample
  is still a cast asset. The locale belongs on the relationship row that gives
  the asset its domain meaning.
- Do not add a generic locale column to `asset` in this slice.

Examples:

- A Turkish glossary is an `asset` plus a `project_asset` row whose
  `locale_id` points at the Turkish `project_locale`.
- A Turkish subtitle for a clip is an `asset` plus a `clip_asset` row whose
  `locale_id` points at the Turkish `project_locale`.
- A base-locale project treatment is an `asset` plus a `project_asset` row
  whose `locale_id` points at the base `project_locale`.
- A locale-neutral style reference is an `asset` plus a
  `visual_language_asset` row with no `locale_id`.

## Source Asset Relationships

Do not add `source_asset_id` to `asset` in this slice.

The phrase "source asset" can mean too many different things:

- a localized asset translated from a base-locale asset;
- a production asset materialized from a selected working asset;
- a derivative thumbnail generated from a video;
- a take generated from a prompt or reference image;
- a repaired or edited version of another file.

Those relationships need specific names and rules. Adding one generic
`source_asset_id` now would create unclear lineage semantics before the product
has modeled them.

When a later slice needs one of these relationships, add a purpose-specific
table or column with a precise name.

Examples:

```text
localized_asset_source
production_asset_source
derived_asset_source
```

Those are examples, not decisions for this slice.

## Code Structure

Use focused modules under the existing project package area:

```text
packages/core/src/project/
  contracts.ts

packages/core/src/node/project/files/
  project-paths.ts
  project-relative-paths.ts
  project-asset-paths.ts
  markdown-asset-files.ts

packages/core/src/node/project/setup/
  project-setup-reader.ts
  project-setup-validator.ts
  project-setup-assets.ts

packages/core/src/node/project/data/
  project-records.ts
  project-locale-records.ts
  narrative-records.ts
  visual-language-records.ts
  cast-member-records.ts
  asset-records.ts
  asset-file-records.ts
  project-asset-records.ts
  visual-language-asset-records.ts
  cast-asset-records.ts
  narrative-asset-records.ts
  sqlite-project-store.ts
```

Responsibilities:

- `project-relative-paths.ts`: validate, normalize, join safe segments, and
  resolve `ProjectRelativePath` values.
- `project-asset-paths.ts`: owns folder constants and deterministic path
  allocation for working asset roots.
- `markdown-asset-files.ts`: writes Markdown files with no frontmatter by
  default.
- `project-setup-assets.ts`: maps rich setup fields to Markdown asset creation
  requests and domain asset relationship requests.
- `asset-records.ts`: owns asset row inserts/queries.
- `asset-file-records.ts`: owns asset file row inserts/queries.
- `project-asset-records.ts`: owns project-level asset relationship rows.
- `visual-language-asset-records.ts`: owns visual-language asset relationship
  rows.
- `cast-asset-records.ts`: owns cast asset relationship rows.
- `narrative-asset-records.ts`: owns sequence, scene, and clip asset
  relationship rows.

Do not introduce broad files such as `asset-helper.ts`, `path-utils.ts`, or
`storage-manager.ts`.

## Schema Direction

Replace the current early schema. Do not preserve old migrations, old text
columns, old loaders, or compatibility tests.

Initial schema:

```text
project
  id
  name
  title
  type
  logline
  aspect_ratio
  cover_file
  created_at
  updated_at

project_locale
  id
  locale_tag
  display_name
  is_base
  supports_audio
  supports_subtitles
  position

visual_language
  id
  name
  one_line_summary
  position
  created_at
  updated_at

cast_member
  id
  name
  kind
  role
  short_description
  position
  created_at
  updated_at

sequence
  id
  title
  short_title
  one_line_summary
  position
  created_at
  updated_at

scene
  id
  sequence_id -> sequence.id
  title
  one_line_summary
  position
  created_at
  updated_at

clip
  id
  scene_id -> scene.id
  title
  one_line_summary
  position
  created_at
  updated_at

asset
  id
  asset_type
  media_kind
  title
  one_line_summary
  origin
  status
  created_at
  updated_at

asset_file
  id
  asset_id -> asset.id
  role
  project_relative_path
  mime_type
  media_kind
  size_bytes
  content_hash
  width
  height
  duration_seconds
  created_at
  updated_at

project_asset
  id
  asset_id -> asset.id
  locale_id -> project_locale.id nullable
  asset_role
  sort_order
  created_at
  updated_at

visual_language_asset
  id
  visual_language_id -> visual_language.id
  asset_id -> asset.id
  locale_id -> project_locale.id nullable
  asset_role
  sort_order
  created_at
  updated_at

cast_asset
  id
  cast_member_id -> cast_member.id
  asset_id -> asset.id
  locale_id -> project_locale.id nullable
  asset_role
  sort_order
  created_at
  updated_at

sequence_asset
  id
  sequence_id -> sequence.id
  asset_id -> asset.id
  locale_id -> project_locale.id nullable
  asset_role
  sort_order
  created_at
  updated_at

scene_asset
  id
  scene_id -> scene.id
  asset_id -> asset.id
  locale_id -> project_locale.id nullable
  asset_role
  sort_order
  created_at
  updated_at

clip_asset
  id
  clip_id -> clip.id
  asset_id -> asset.id
  locale_id -> project_locale.id nullable
  asset_role
  sort_order
  created_at
  updated_at
```

Constraints:

- `asset_file.project_relative_path` must be normalized and project-relative.

Notes:

- `one_line_summary` is optional short display text only.
- Rich summaries, descriptions, visual intent, and scripts become Markdown
  assets in this plan.
- `media_kind` should start with the values needed now: `text`, `image`,
  `audio`, `video`, `subtitle`, `timing`, `compound`, `other`.
- `asset_type` and `asset_role` should be deliberately named from the domain.
- Base/shared assets that are not naturally owned by a clip, cast member, or
  visual language can use `project_asset`.
- Locale-specific shared assets, such as a glossary or shared dubbed intro, can
  use `project_asset.locale_id`.
- Production-specific materialized relationships are deferred to plan 0007,
  where production folder semantics are implemented.

## Drizzle And TypeScript Shape

The explicit relationship tables should be boring in Drizzle.

Example shape:

```ts
export const assets = sqliteTable('asset', {
  id: text('id').primaryKey(),
  assetType: text('asset_type').notNull(),
  mediaKind: text('media_kind').notNull(),
  title: text('title').notNull(),
  oneLineSummary: text('one_line_summary'),
  origin: text('origin').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const clipAssets = sqliteTable('clip_asset', {
  id: text('id').primaryKey(),
  clipId: text('clip_id')
    .notNull()
    .references(() => clips.id),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id),
  localeId: text('locale_id').references(() => projectLocales.id),
  assetRole: text('asset_role').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

Record types are then direct Drizzle inferred types:

```ts
type AssetRecord = typeof assets.$inferSelect;
type ClipAssetRecord = typeof clipAssets.$inferSelect;
```

Public/core command types should use discriminated unions rather than exposing
table details directly. Keep locale outside the target union so it does not
look like a separate attachment target:

```ts
type AssetTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; visualLanguageId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'clip'; clipId: string };

type AssetLocaleContext = {
  localeId?: string | null;
};

type RegisterAssetRelationshipInput = {
  target: AssetTarget;
  locale?: AssetLocaleContext;
  assetRole: string;
  sortOrder?: number;
};
```

The command handler switches on `kind` and calls the matching data-layer module.
This keeps the public API ergonomic while preserving real relational structure
inside SQLite.

## Asset Path Resolution

Asset file paths resolve in one direction only:

```text
project folder + asset_file.project_relative_path -> absolute local path
```

SQLite stores:

```text
asset_file.project_relative_path
```

Runtime code receives or already knows:

```text
projectFolder
```

Core resolves the absolute local path through `project-relative-paths.ts`.

Example:

```text
projectFolder:
  /Users/keremk/Movies/constantinople

asset_file.project_relative_path:
  Working Assets/Base/Sequences/01-logistics/Scenes/01-foundry-at-night/Clips/001-cannon-inspection/clip-brief.md

resolved absolute path:
  /Users/keremk/Movies/constantinople/Working Assets/Base/Sequences/01-logistics/Scenes/01-foundry-at-night/Clips/001-cannon-inspection/clip-brief.md
```

Rules:

- never store the resolved absolute path in SQLite;
- never accept an absolute path as a `ProjectRelativePath`;
- reject `..` traversal;
- normalize separators to `/` before storing;
- resolve symlink/security details in the Node-side helper before reading or
  writing;
- do not infer asset scope or relationship meaning from path segments.

When setup creates Markdown assets, the flow should be:

```text
determine domain target
allocate project-relative path from target and asset role
write Markdown file under project folder
insert asset row
insert asset_file row with project_relative_path
insert domain relationship row
```

## Setup Text Mapping

Use this initial mapping for `sample-project.yaml`:

```text
project.name -> SQLite
project.title -> SQLite
project.type -> SQLite
project.aspectRatio -> SQLite
project.logline -> SQLite
project.summary -> Markdown asset attached to project

languages[].localeTag -> project_locale.locale_tag
languages[].displayName -> project_locale.display_name

visualLanguage.name -> SQLite
visualLanguage.summary -> SQLite one_line_summary
visualLanguage.intent -> Markdown asset attached to visual_language

cast.name -> SQLite
cast.kind -> SQLite
cast.role -> SQLite
cast.shortDescription -> SQLite

sequence.title -> SQLite
sequence.shortTitle -> SQLite
sequence.summary -> Markdown asset attached to sequence

scene.title -> SQLite
scene.summary -> Markdown asset attached to scene

clip.title -> SQLite
clip.summary -> Markdown asset attached to clip
clip.visualIntent -> Markdown asset attached to clip
```

Initial setup Markdown generated from `sample-project.yaml` should be treated
as base-locale text unless a field is explicitly locale-neutral. That means the
relationship row should usually set `locale_id` to the base project locale for
prose assets such as project summary, sequence summary, scene summary, clip
summary, and clip visual intent. Locale-neutral visual reference images, SFX,
reusable music, and structural helper assets can leave `locale_id` null.

This mapping is intentionally case-by-case. It follows the guideline that rich,
paragraph-length, or formatted text becomes Markdown while compact display text
can remain in SQLite.

## Folder Output

Initial setup should write Markdown assets under:

```text
Working Assets/
  Base/
    Narrative/
    Visual Language/
    Cast/
    Sequences/
```

Examples:

```text
Working Assets/Base/Narrative/project-summary.md
Working Assets/Base/Visual Language/001-ottoman-court-miniature/intent.md
Working Assets/Base/Sequences/01-young-sultans-obsession/sequence-summary.md
Working Assets/Base/Sequences/.../Scenes/.../scene-summary.md
Working Assets/Base/Sequences/.../Scenes/.../Clips/.../clip-brief.md
Working Assets/Base/Sequences/.../Scenes/.../Clips/.../visual-intent.md
```

Folder names are human-facing. SQLite owns identity and relationships.

## Folder Constants

Add constants/allocation helpers for:

```text
Working Assets/Base/
Working Assets/Localization/<locale>/
Production Assets/Master/
Production Assets/Localized/<locale>/
```

Only `Working Assets/Base/` allocation is required to be exercised in this plan.
The other roots can be constants used by later plans.

Do not infer relationships from these paths.

## Verification

- `pnpm test:core`
- Running project creation with `sample-project.yaml` produces Markdown files.
- Focused tests prove:
  - absolute project-relative paths are rejected;
  - `../outside.md` is rejected;
  - valid paths normalize to `/` separators;
  - project DB creation creates the current schema;
  - old rich text columns are not present in the generated schema;
  - no `default_project_relative_path`, `owner_type`, or `owner_id` columns are
    used for asset attachment;
  - generated Markdown files have matching `asset` rows;
  - generated Markdown files have matching `asset_file.project_relative_path`
    rows;
  - generated Markdown files have matching domain asset relationship rows with
    real target foreign keys;
  - no Markdown frontmatter is written by default;
  - project projection can expose both direct SQLite text fields and rich text
    asset links;
  - missing or invalid setup fields produce structured diagnostics.

## Non-Goals

- No user-facing asset registration CLI commands.
- No production materialization.
- No sample project fixture media script.
- No UI work.
- No localized Markdown generation beyond folder foundation.
- No compatibility with existing prototype project databases.
