# Context-First Generation Foundation Manifest

Date: 2026-07-12

Status: historical implementation evidence; Shot/Take inventory superseded by
Decision `0052`

Role: implementation and cutover evidence for Plans `0134` and `0136`; Plan
`0136` consolidates the retained Plan `0135` requirements

## Reproducible Scope

Run the checked-in manifest command from the repository root:

```bash
node scripts/context-first-generation-manifest.mjs --git-ref HEAD
node scripts/context-first-generation-manifest.mjs
```

The manifest covers the old Core media-generation and Generation Preview
trees, generation client contracts, Engines generation and Shot route layers,
generation CLI handlers, Studio server adapters/projections, Studio generation
editing and reference-selection code, Shot planning/reference-policy
consumers, and related tests. It reports tests separately and excludes docs,
migrations, generated metadata, catalog data, and vendored code.

Baseline at the pre-foundation `HEAD`, using the final combined-scope script:

| Kind | Files | Lines |
| --- | ---: | ---: |
| Production | 225 | 57,841 |
| Tests | 90 | 32,071 |

These counts are review evidence, not an acceptance quota. The broad scope is
intentional: it makes hidden relocation into adapters or Shot consumers visible
during Plan `0136` review.

## User-Visible Behavior Inventory

The coordinated cutover must preserve:

- Generation Preview Prompt, References, and Config tabs;
- incomplete editing, diagnostics, schema-derived controls, preview, estimate,
  exact approval, and run feedback;
- Regenerate/Edit source context and Image Revision actions;
- Shot General, Lookbook, Cast, Location, and dialogue reference organization;
- reference cards, alternate pickers, previews, audio/video playback, inclusion
  controls, per-Shot scope, and save status;
- AI Production model choice, run progress, output review, and explicit final
  video import;
- Lookbook, Cast, Location, Storyboard, dialogue, and generic image entry
  points;
- focused attachment/import ownership and surviving imported media.

The accepted intentional presentation changes are recorded only in Plan `0136`.

## Completed Plan 0134 Backend Deletion

Plan `0134` deleted:

- `packages/core/src/server/media-generation/dependencies/**`;
- `packages/core/src/server/media-generation/lifecycle/purpose-definitions/**`;
- old lifecycle dependency, draft, inventory, plan, checklist, recursive
  estimate, purpose-cost registry, and purpose-specific preview binding code;
- purpose-specific client spec/model/validation/report unions replaced by
  `packages/core/src/client/generation.ts`;
- Shot planning, preflight, dependency-selection, reference-policy,
  input-policy, route/input-mode, graph-estimate, and provider-payload builders;
- tests whose asserted behavior is dependency planning, creative requirement,
  fallback selection, recursive price, or purpose-owned provider validation.

Plan `0136` owns the remaining CLI, Studio server, React, and Skills callers
listed in
`docs/architecture/reference/context-first-generation-caller-handoff.md`.

Replace callers directly with:

- generic Core generation commands under `packages/core/src/server/generation`;
- Engines provider field descriptors and provider request assembly;
- one Plan `0136` purpose descriptor/reference-guide tree;
- exact guide-placed selections with one authored `included` boolean;
- one local Studio editor state and thin CLI/HTTP adapters.

Retain and narrow:

- Engines schemas, catalog, pricing, file upload/loading, request hashing,
  execution, output normalization, and receipts;
- generic spec/run persistence concepts and exact-request approval;
- focused domain imports and valid asset-file provenance;
- take ownership, copy, and recoverable deletion rules unrelated to generation
  planning;
- domain-neutral Studio media controls and the behavior inventory above.

## Foundation Import Audit

The Plan `0134` foundation must have no imports from old dependency planning,
Shot reference policy, context candidate queries, or purpose guide definitions
inside provider validation. Core services may import Engines' generic catalog,
request assembly, pricing, and execution boundaries. Database schema imports
remain confined to database-access and schema modules.

Plan `0134` owns physical deletion of the old Engines/Core backend. Plan `0136`
owns direct replacement or deletion of Studio, CLI, server-adapter, and Skill
callers. The intermediate workspace is intentionally non-runnable. No temporary
adapter, alias, compatibility reader, dual schema, or second route family is
part of the handoff.

## Plan 0134 Checkpoint Counts

| Kind | Files | Lines |
| --- | ---: | ---: |
| Production | 69 | 16,950 |
| Tests | 33 | 11,118 |

Compared with the baseline scope, the checkpoint removes 119 production files
and 35,369 production lines, plus 40 test files and 14,915 test lines. These
figures are evidence that backend complexity was deleted rather than moved;
they are not a numeric acceptance threshold. Plan `0136` owns the combined
program comparison after the remaining public callers are replaced.

## Urban Basilica Pre-Migration Audit

The real project database was inspected without applying a migration. A
pre-cutover backup was created at:

```text
$HOME/renku-movies/urban-basilica/.renku/backups/project.sqlite.before-0134-20260712.sqlite
```

Observed rows:

| Entity | Rows |
| --- | ---: |
| `media_generation_spec` | 56 |
| `media_generation_run` | 46 |
| `asset_file_generation` | 24 |
| `asset_file` | 84 |
| `scene_shot_video_take` | 30 |
| `scene_shot_video_take_media_input` | 12 |
| `scene_shot_video_take_media_input_shot` | 36 |

The active take media inputs include three selected First Frames, three selected
Last Frames, and two selected Video Prompt Sheets. Persisted take state also has
explicit Character Sheet, Location Sheet, Lookbook Sheet, dialogue-audio, and
dependency-inclusion selections. Those exact records form the migration audit
set. The migration must resolve their stored asset/file identities and approved
guide placement without choosing replacements.

The final copied-database proof migrated 13 Shot specs containing 31 exact
reference selections. It preserved include/exclude intent, including the
explicitly excluded Urban Basilica Location Sheet selection, advanced all 30
take states to version 3, and removed every retired generation-state path.
SQLite `quick_check` returned `ok` and `foreign_key_check` returned no rows.

The final generated `0053_drop-obsolete-shot-media-inputs.sql` migration was
then replayed with the corrected `0052` from the verified generation-41 backup.
The copied database retains 13 Shot-selection specs with 31 exact selections,
23 provenance-backed historical request specs and runs, all 24 generation
provenance links, and 30 version-3 takes; both obsolete media-input tables are
absent. The current Urban Basilica working database was previously migrated by
the destructive form of `0052` and must be restored from this pre-migration
backup before replaying the corrected migration:

```text
$HOME/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-41-to-42-20260712T184750377Z-59cde3.sqlite
```

The corrected migration also preserves all 35 Take-to-Shot membership rows (19
active) and all four final-video rows. A transaction-level migration test
protects both child tables from SQLite parent-rebuild cascades.

## Combined Program Result

The final combined manifest reports:

| Kind | Files | Lines |
| --- | ---: | ---: |
| Production | 155 | 25,803 |
| Tests | 51 | 10,033 |

Against the final combined-scope baseline, the result removes 70 production
files and 32,038 production lines, plus 39 test files and 22,038 test lines.
The comparison is review evidence that the dependency/planning backend was
deleted rather than relocated; it is not a size quota.

The 56 old specs span Cast, Location, Lookbook, dialogue, Storyboard, image
edit, and Shot purposes. Two rows use the obsolete
`shot.multi-shot-storyboard-sheet` purpose. The one-way migration converts the
23 specs and runs that own exact generated-asset provenance into the current
generic request shape. Unlinked drafts and obsolete purpose rows are removed;
runtime code does not recognize their old shapes. The 84 imported asset files
and all 24 generation-provenance links must survive.
