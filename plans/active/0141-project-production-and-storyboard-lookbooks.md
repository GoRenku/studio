# 0141 Project Production And Storyboard Lookbooks

Status: implemented
Date: 2026-07-14
Implemented: 2026-07-14

## Summary

Replace the repeatable, selectable Lookbook collection with two project-owned
visual-language products:

- one `ProductionLookbook` for final-video visual direction;
- one `StoryboardLookbook` for storyboard visual direction.

Each role may be empty before it is authored, but a project can never contain
more than one Lookbook for either role. Authored Lookbook owner rows are
permanent and cannot enter Trash. There is no Lookbook selection
state, no list of alternative Lookbook definitions, and no stored relationship
from the Storyboard Lookbook to one or more Production Lookbooks. The role is
the identity.

Both Lookbooks can continue to own multiple generated sheet representations:

- the Production Lookbook owns zero or more `lookbook.video-sheet` outputs;
- the Storyboard Lookbook owns zero or more `lookbook.storyboard-sheet`
  outputs.

The Studio sidebar presents a `Lookbooks` branch with exactly two fixed
destinations, `Production` and `Storyboard`, alongside the separate
`Inspiration` branch. A creative Lookbook name remains page content; it does
not create another navigation item or another Lookbook instance.

This plan must be implemented before Plan 0142. It changes only the Lookbook
domain and the current callers that depend on Lookbook selection. It does not
implement the broader generation-reference slot redesign.

## Product Decisions

### Exactly two project roles

The durable invariant is **at most one permanent row per Lookbook role**. The
two roles are always visible in product navigation even when their document has
not yet been authored.

`ProductionLookbook` replaces the current public `MovieLookbook` name. The
word `movie` must not remain as a current Lookbook type, command flag, JSON kind,
UI label, or readiness field.

### Role, not selection

The following concepts are removed:

- `lookbook_selection` storage;
- `isSelectedForType` and `selectedLookbookIdsByType` response fields;
- select and clear-selection commands, routes, controls, events, and copy;
- selected Movie/Storyboard Lookbook readiness checks;
- the Lookbook list/grid as a chooser between same-role definitions.

The absence of a Production or Storyboard definition is represented by a null
role resource, not by an unselected collection.

### No Storyboard-to-Production pointer

`storyboard_lookbook_source_movie` and `sourceMovieLookbookIds` are removed.
There is only one Production Lookbook, so a durable cross-Lookbook choice is
redundant. Agent context may read both project Lookbooks when authoring, but it
must not persist a source selection.

### Multiple sheets remain ordinary owned media

The singleton rule applies to Lookbook definitions, not Lookbook Sheets.
Lookbook images, section placements, card images, Inspiration relationships,
and multiple sheet outputs remain supported and continue to use the internal
Lookbook row id as their foreign key.

## Context

This plan is constrained by:

- `AGENTS.md`, especially Core ownership, no compatibility layers, opaque AI
  artifacts, deliberate naming, structured diagnostics, and Drizzle Kit;
- `docs/architecture/reference/visual-language.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/drizzle-migrations.md`;
- `docs/architecture/front-end-guidelines.md`;
- `docs/architecture/coding-practices.md`;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- completed Plan 0140, which deliberately left Lookbooks unchanged;
- draft requirements in Plan 0139;
- `/Users/keremk/Projects/aitinkerbox/studio-skills`, which owns the Lookbook
  Designer and Media Producer agent workflows;
- `/Users/keremk/renku-movies/urban-basilica`, the required real migration and
  desktop verification project.

Read-only inspection of `urban-basilica` on 2026-07-14 found:

- one selected legacy Movie Lookbook, `lookbook_c7g2k6w8` (`Imperial Wound`);
- one selected Storyboard Lookbook, `lookbook_p55dpu7c`
  (`Sepia Graphite Siege Boards`);
- one legacy Storyboard-to-Movie source row between those records;
- one Production/Movie Lookbook Sheet and no Storyboard Lookbook Sheet yet.

Those exact counts are verification evidence, not runtime assumptions.

## Architecture Shape Gate

### Ownership and public entrypoints

`packages/core` owns the two-role invariant, typed documents, persistence,
commands, resources, generation-target validation, and structured errors.

The public Core service entrypoints will be:

- `readProjectLookbooks(input): Promise<ProjectLookbooksResource>`;
- `readProductionLookbook(input): Promise<ProductionLookbookResource>`;
- `readStoryboardLookbook(input): Promise<StoryboardLookbookResource>`;
- `validateProductionLookbook(input)`;
- `validateStoryboardLookbook(input)`;
- `writeProductionLookbook(input)`;
- `writeStoryboardLookbook(input)`.

Image placement, card-image, sheet discard, and Inspiration commands remain
focused commands against the internally returned Lookbook id. They must verify
that the owner is one of the two current project Lookbooks.

### Intended Core module shape

- `packages/core/src/client/visual-language.ts` owns the public
  `ProductionLookbook`, `StoryboardLookbook`, their definitions/sections, and
  `ProjectLookbooks` contracts.
- `packages/core/src/server/schema/visual-language.ts` keeps the bounded
  `lookbook` owner table, changes its discriminator to
  `kind: 'production' | 'storyboard'`, adds the one-row-per-kind constraint,
  removes Lookbook discard lifecycle columns, and removes both legacy
  relationship tables.
- `packages/core/src/server/database/access/lookbook.ts` owns low-level reads
  by kind/id and insert/update operations. It does not decide command
  behavior.
- `packages/core/src/server/commands/production-lookbook-commands.ts` owns
  Production document validation and writes.
- `packages/core/src/server/commands/storyboard-lookbook-commands.ts` owns
  Storyboard document validation and writes.
- `packages/core/src/server/resources/project-lookbooks.ts` composes the two
  nullable role resources without selection fields or a repeatable collection.
- `packages/core/src/server/visual-language-json/production-lookbook.ts` and
  `storyboard-lookbook.ts` own focused document validation/serialization while
  shared section-envelope utilities stay small.
- the existing Lookbook service wiring `index.ts`, if used, remains a thin
  public entrypoint containing exports/wiring only.

### Adapter and UI shape

- `packages/cli/src/commands/lookbook-command.ts` remains a thin dispatcher to
  focused action handlers. The current long function must shrink rather than
  gain more role branches.
- the current CLI is directly replaced with:
  - `renku lookbook show --kind production|storyboard --json`;
  - `renku lookbook validate --file <document.json> --json`;
  - `renku lookbook apply --file <document.json> --json`;
  - existing focused image/card-image/inspiration operations where still
    applicable.
- `packages/studio/server/routes/visual-language.ts` exposes thin routes by
  `production` or `storyboard`, never by a chooser selection.
- `packages/studio/src/features/movie-studio/visual-language/` keeps focused
  Production and Storyboard report components and removes the chooser card
  grid and selection controls.
- `studio-sidebar.tsx` renders a `Lookbooks` branch with exactly two fixed
  children, `Production` and `Storyboard`, and no list reconstructed from
  database rows.

### Bounded dispatch

A two-entry Lookbook-kind registry is allowed only for mapping a validated
document kind to the corresponding focused Core validator/command. It must not
become a generic Visual Language dispatcher or contain persistence and UI
projection logic.

### Explicitly forbidden shape

- No generic `selectLookbook`, active-Lookbook, default-Lookbook, or
  last-opened-Lookbook state.
- No compatibility aliases for `MovieLookbook`, `movieLookbook`, or `movie`.
- No list API whose purpose is to preserve repeatable Lookbook semantics.
- No route, CLI, or React enforcement of the singleton invariant.
- No semantic inspection or rewriting of Lookbook definitions or images.
- No two separate implementations of shared image/sheet ownership behavior.
- No god-file rewrite of all Visual Language commands.

### Stop conditions

Stop and revise before implementation continues if:

- the database permits two rows with the same Lookbook kind;
- a caller still needs to select a Lookbook before reading generation context;
- the migration would choose a legacy winner using name, creation order, id,
  or file contents;
- the CLI handler, route file, or one Core command file accumulates both role
  implementations plus persistence and projection logic;
- an obsolete type/name is retained to avoid updating a caller;
- implementing the sidebar requires reconstructing a list of Lookbook rows.

## Contracts

### Public domain contracts

Add and use these direct public types:

```ts
interface ProductionLookbook {
  id: string;
  name: string;
  kind: 'production';
  definition: ProductionLookbookDefinition;
}

interface StoryboardLookbook {
  id: string;
  name: string;
  kind: 'storyboard';
  definition: StoryboardLookbookDefinition;
}

interface ProjectLookbooks {
  production: ProductionLookbook | null;
  storyboard: StoryboardLookbook | null;
}
```

`ProductionLookbookDefinition`, `ProductionLookbookSection`, and
`ProductionLookbookDocument` directly replace their current `Movie*` names.
The JSON kinds are `productionLookbook` and `storyboardLookbook`.
`StoryboardLookbookDocument` has no `sourceMovieLookbookIds` or replacement
source field.

`ProjectLookbooksResource` contains two explicit nullable role resources. It
does not contain `lookbooks: []`, a selected-id map, or selection booleans.

### Storage invariant

Keep the internal `lookbook` table because Lookbook-owned images, sheets,
placements, and generation targets require an owner id. Change the owned
discriminator, remove its discard lifecycle, and add an unconditional unique
index equivalent to:

```text
unique lookbook(kind)
```

Remove `lookbook_selection` and `storyboard_lookbook_source_movie`.
Lookbook Images and Lookbook Sheets keep their independent recoverable discard
lifecycle.

### Generation and readiness callers

- `lookbook.video-sheet` requires the target id to resolve to the current
  Production Lookbook.
- `lookbook.storyboard-sheet` requires the target id to resolve to the current
  Storyboard Lookbook.
- existing lookbook-owned image operations accept either typed owner after
  Core validates the row.
- purpose guides read Production or Storyboard sheets by role directly; they
  never call a selected-Lookbook query.
- Director context reports `productionLookbook` and `storyboardLookbook`
  readiness from existence, not selected ids.
- Scene Shot List context reads the Production Lookbook directly.

Use structured diagnostic codes in the `CORE_LOOKBOOK_*` family, including
`CORE_LOOKBOOK_ALREADY_EXISTS`, `CORE_LOOKBOOK_NOT_AUTHORED`, and
`CORE_LOOKBOOK_TARGET_KIND_INVALID`.

## Migration Policy

Use the documented Drizzle Kit workflow and the next generated migration.
Because this is a one-way development-data contraction, document any required
custom SQL before adding it.

For each legacy type:

1. preserve the row referenced by `lookbook_selection` and map legacy `movie`
   to current `production`;
2. if there is no selection and exactly one current row of that type, preserve
   that only row;
3. if there is no selection and more than one current row, fail the migration
   preflight with an actionable diagnostic; do not guess;
4. remove unpreserved duplicate Lookbooks and their owned relationships through
   the planned one-way migration;
5. preserve ids and all owned media/relationships of retained rows;
6. remove the redundant Storyboard-to-Movie relationship and both legacy
   tables;
7. add the new uniqueness constraint and verify foreign keys/quick check.

Before applying the migration to any real project, use Core's existing project
backup workflow. Apply and verify it against `urban-basilica` while Studio is
stopped.

## Implementation Slices

### Slice 1: accept the two-role architecture

- Add ADR
  `docs/decisions/0048-use-one-production-and-one-storyboard-lookbook-per-project.md`.
- Update domain vocabulary and Visual Language reference documentation.
- Freeze the public names and storage invariant from this plan before code.

### Slice 2: schema and data migration

- Change the Drizzle schema source of truth.
- Generate the next migration with Drizzle Kit.
- Add only the documented custom data contraction if generated SQL cannot
  express the legacy selection mapping safely.
- Add migration preflight, backup, integrity, and exact retained-owner tests.

### Slice 3: typed Core contracts and commands

- Replace Movie/repeatable contracts with the two hard types.
- Split Production and Storyboard validation/write behavior into focused files.
- Replace list/select/clear operations with two role reads and role writes.
- Remove Lookbook owner discard lifecycle and the Lookbook Trash kind.
- Keep image, sheet, placement, and Inspiration ownership shared and focused.
- Update generation-target validation and Director/Shot List context callers.

### Slice 4: CLI and Studio server

- Replace create/update/list/select/clear-selection flows with show/apply by
  kind and expose no Lookbook deletion command or HTTP route.
- Keep parsing and JSON formatting in CLI only.
- Replace id/selection HTTP routes with kind-addressed thin routes.
- Remove obsolete request parsers, fake-service methods, and event shapes.

### Slice 5: desktop Studio

- Render a `Lookbooks` sidebar branch containing the fixed `Production` and
  `Storyboard` destinations.
- Remove selection labels, toggles, chooser grids, and selected summaries.
- Keep the existing typed report layouts and asset tabs.
- Show a quiet role-specific empty state when a Lookbook is not authored.
- Preserve meaningful authored names inside the definition page.

### Slice 6: agent skills and real project

- Update Lookbook Designer to inspect/write one role rather than list/select.
- Replace Movie terminology with Production directly in current samples.
- Remove `sourceMovieLookbookIds` and selection commands from instructions.
- Update Media Producer target discovery for the two role reads.
- Migrate and verify `urban-basilica` without paid generation.

## Tests And Guardrails

- Core schema tests prove a second row of either kind fails before
  writes complete.
- Core command tests prove apply creates the missing role and later apply
  updates the same role/id.
- Validation tests reject a Production document through the Storyboard command
  and vice versa with structured diagnostics.
- Migration tests cover selected winner, one unselected row, ambiguous
  unselected duplicates, retained owned media, and removal of redundant tables.
- Generation context tests prove each sheet purpose accepts only its correct
  Lookbook role and requires no selection.
- Director/Shot List tests prove existence-based context.
- CLI tests cover the current show/apply surface and focused owned-media
  operations.
- Studio route tests prove handlers delegate role intent to Core.
- Desktop tests prove the `Lookbooks` branch contains exactly two entries in
  both empty and authored states and has no selection control.
- Architecture tests protect package/import boundaries and the database
  uniqueness behavior; they must not enumerate private function names.
- Repository scans confirm current runtime/docs/skills contain no
  `MovieLookbook`, `movieLookbook`, `lookbook_selection`,
  `sourceMovieLookbookIds`, or Lookbook select command, excluding historical
  migrations and historical plans.

## Documentation

- Add ADR 0048.
- Update Visual Language, domain vocabulary, layers/responsibility, CLI, Studio
  server route, and generation-purpose references that describe selection.
- Update the current source skills and their samples in `studio-skills`.
- Do not edit historical plans or historical migrations for naming sweeps.
- Mark this plan implemented only after the real project evidence is recorded.

## Final Verification

Run focused package tests first, then:

```bash
pnpm check
pnpm build
pnpm test
pnpm lint
```

Also:

- validate all changed Studio Skills;
- stop Studio, back up and migrate `urban-basilica`, then run SQLite foreign-key
  check and quick check;
- confirm the retained Lookbook ids, definitions, images, sheets, card images,
  and Inspiration links match the pre-migration backup;
- restart Studio and verify the `Lookbooks` branch and its two fixed desktop
  sidebar destinations;
- inspect `git diff --stat` and the complete diffs in both repositories;
- inspect every new or heavily modified file and confirm public `index.ts`
  files remain thin;
- confirm no selection logic or repeatable Lookbook list survived in current
  runtime code.

## Implementation Evidence

- Drizzle migration `0055_project_lookbook_roles.sql` was generated from the
  current schema and its intentional one-way data contraction is documented in
  ADR 0048. Migration tests cover the selected winner, sole unselected winner,
  ambiguous rollback, retained owned media, removed legacy tables, and the
  current-kind uniqueness constraint.
- Drizzle migration `0056_permanent-project-lookbooks.sql` removes Lookbook
  owner discard lifecycle columns and enforces unconditional uniqueness by
  role. Its migration test proves owned rows survive. `urban-basilica` was
  backed up and migrated from generation 43 to 44; `quick_check` returned `ok`,
  `foreign_key_check` returned no rows, and the two Lookbooks, seven images,
  one sheet, one card image, and three Inspiration links remained present. The
  backup is
  `.renku/project-database-backups/project-before-migration-from-generation-43-to-44-20260714T144908104Z-9fc41d.sqlite`.
- The `urban-basilica` project was backed up and migrated from database
  generation 42 to 43 while Studio was stopped. The backup is
  `.renku/project-database-backups/project-before-migration-from-generation-42-to-43-20260714T135125921Z-9b7da0.sqlite`.
- The retained Production id is `lookbook_c7g2k6w8`; its definition remained
  14,982 bytes with SHA3-256
  `6737EF413B3E791F871A3445F85D140F1332089E2B9B2DE3B203AAB0F0FE21F9`.
  The retained Storyboard id is `lookbook_p55dpu7c`; its definition remained
  5,035 bytes with SHA3-256
  `6EEF72942A8AEEAA63647199984D26B0A1A3111CDD6B410F37901294FC9A0124`.
- All seven Lookbook images, the Production sheet, the Storyboard card image,
  and all three Production Inspiration links were retained. The redundant
  Storyboard source pointer and both legacy tables were removed. SQLite
  `foreign_key_check` returned no rows and `quick_check` returned `ok`.
- Core (190 tests), CLI integration (31 tests), Studio unit (265 tests), and
  Studio integration (62 tests) passed. The full repository `pnpm check`,
  `pnpm build`, `pnpm test`, and `pnpm lint` commands passed; lint retained only
  the pre-existing `packages/studio/server/bin.ts` console warning.
- Lookbook Designer, Media Producer, Movie Director, and Scene Shot Designer
  skills passed their validators. A fresh-agent forward test found that an
  omitted `sourceInspirationFolderIds` field could clear existing links; the
  Core write contract was corrected so omission preserves links and an explicit
  empty array clears them.
- Live desktop verification against migrated `urban-basilica` showed exactly
  the fixed `Production` and `Storyboard` sidebar destinations, rendered both
  authored reports and their retained media, and used the canonical Storyboard
  role URL. A subsequent sidebar correction places those destinations beneath
  the distinct `Lookbooks` branch rather than beneath `Inspiration` and is
  covered by the App integration test. Studio was restarted after the live
  verification.

## Completion Checklist

### Review Area

- [x] Confirm the product has exactly two Lookbook roles and no same-role
      alternatives.
- [x] Confirm multiple Lookbook Sheets remain supported per role.
- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm the final module shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Add and accept ADR 0048.
- [x] Add the `ProductionLookbook` and `StoryboardLookbook` hard types.
- [x] Replace all current Movie Lookbook names directly.
- [x] Replace repeatable/list/selection resources with two explicit nullable
      role resources.
- [x] Remove Storyboard source-Lookbook ids without a replacement pointer.
- [x] Keep durable singleton and target-kind rules in Core.
- [x] Keep package-boundary errors structured.
- [x] Add no compatibility aliases or old-shape recognition.

### Storage And Migration

- [x] Update the Drizzle schema source of truth.
- [x] Generate the next migration through Drizzle Kit.
- [x] Document any intentional custom SQL before adding it.
- [x] Preserve only an explicit selection or unambiguous sole legacy row.
- [x] Fail ambiguous legacy data rather than guessing.
- [x] Preserve retained ids and all owned media relationships.
- [x] Remove `lookbook_selection` and
      `storyboard_lookbook_source_movie`.
- [x] Enforce one permanent row per Lookbook kind in the database.
- [x] Back up, migrate, and integrity-check `urban-basilica`.

### Core And Generation Callers

- [x] Implement focused role reads, validates, and writes.
- [x] Split Production and Storyboard validation/command modules.
- [x] Keep shared image/sheet ownership logic shared and bounded.
- [x] Validate video sheets against Production and storyboard sheets against
      Storyboard.
- [x] Remove every selected-Lookbook query from generation and Shot List
      context.
- [x] Replace selected-id Director readiness with role existence.
- [x] Remove Lookbook owner discard and restore handling while keeping owned
      media independently recoverable.

### CLI, Server, And Desktop UI

- [x] Replace list/create/update/select/clear-selection with show/apply by kind
      and expose no Lookbook deletion surface.
- [x] Keep CLI handlers and HTTP routes thin.
- [x] Remove obsolete API clients, parsers, fake methods, and events.
- [x] Render a `Lookbooks` branch containing the fixed `Production` and
      `Storyboard` sidebar destinations.
- [x] Remove the Lookbook chooser grid and selection controls/copy.
- [x] Verify authored and empty states on the desktop layout.
- [x] Use only local shadcn controls.

### Agent Skills

- [x] Update Lookbook Designer workflow, references, and samples.
- [x] Update Media Producer Lookbook target discovery.
- [x] Remove selection and source-Movie instructions.
- [x] Validate the changed skills and run a fresh-agent forward test.

### Tests And Guardrails

- [x] Add database uniqueness and fail-before-write tests.
- [x] Add command, validation, target-kind, readiness, and migration tests.
- [x] Add CLI, route, resource, and desktop sidebar tests.
- [x] Add stable boundary tests without private implementation-name needles.
- [x] Run the forbidden-concept scan with historical files excluded.

### Documentation

- [x] Update accepted architecture, CLI, and Studio Skills documentation.
- [x] Record real-project migration evidence in this plan.
- [x] Do not edit historical plans merely for naming cleanup.

### Final Verification

- [x] Run focused Core, CLI, and Studio tests.
- [x] Run `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm lint`.
- [x] Verify the migrated `urban-basilica` UI on desktop.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect large/heavily modified files and split unreviewable code.
- [x] Confirm all `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item was satisfied by accepting a monolithic shape.
- [x] Only then mark Plan 0141 complete and begin Plan 0142.
