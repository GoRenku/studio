# 0140 Merge Cast Character Sheet Generation Purposes

Status: implemented
Date: 2026-07-14

## Summary

Replace the two Cast Character Sheet generation purposes
`cast.video-character-sheet` and `cast.storyboard-character-sheet` with the one
current domain purpose `cast.character-sheet`.

The distinction does not change the generated product: both current purposes
target a Cast Member, produce an image, recommend 16:9 and high quality, and use
the same generic reference-guide behavior. A finished Cast Character Sheet is a
shared character-continuity asset that may guide either storyboard or final-video
generation. The separate Lookbook purposes remain unchanged because
`lookbook.video-sheet` and `lookbook.storyboard-sheet` represent deliberately
different visual-language products.

This is a direct contract replacement. Update every current caller, stored
purpose, attachment role, reference slot, test, document, and Studio skill to the
single current name. Do not add aliases, fallback purpose recognition,
compatibility roles, dual-read behavior, or migration options.

Apply the resulting one-way Drizzle migration to the current sample project at
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite`. That database
is already on the current migrated schema, so this plan does not include legacy
schema detection, repair modes, or alternate migration paths.

## Implementation Notes

Implemented on 2026-07-14.

- Added Drizzle migration
  `packages/core/drizzle/0054_merge_cast_character_sheet_purposes.sql` without
  changing `PRAGMA user_version`.
- Applied the migration through the local built CLI with
  `renku project migrate urban-basilica` behavior.
- Core created and verified this pre-migration backup:
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-42-to-42-20260714T112644797Z-dfc365.sqlite`.
- Backup metadata was written to:
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-42-to-42-20260714T112644797Z-dfc365.json`.
- The migrated database passes `PRAGMA quick_check`, remains at schema
  generation 42, and now records 55 applied Drizzle migrations.
- The sample now has 4 `cast.character-sheet` specs, 4 matching runs, 4 matching
  run snapshot purposes, and 11 `character-sheet` Cast relationships.
- All 3 saved Shot Video Take Cast selections use `character-sheet` while
  preserving their exact Shot scope, Cast subject, asset id, and asset-file id.
- Owned database fields contain zero removed Cast purposes, specialized Cast
  slots, or obsolete Cast relationship roles.
- Direct comparison with the verified backup confirmed that the 2 Lookbooks, 1
  Lookbook Sheet, 2 Lookbook selections, 7 Lookbook generation specs, ids,
  names, types, and relationships were unchanged.
- Current Cast generation context and saved-spec listing succeeded against
  `urban-basilica` without invoking paid generation.
- `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm test:integration` passed.
  Lint reported the existing non-blocking `console` warning in
  `packages/studio/server/bin.ts`; there were no lint errors.
- Studio was stopped before migration and restarted successfully afterward on
  `http://localhost:5173/`.

## Scope

In scope:

- merge the two Cast generation purpose contracts into
  `cast.character-sheet`;
- use `character-sheet` as the single Cast Character Sheet relationship role
  and generation reference slot id;
- update storyboard, Shot Video Take, Cast Profile, image-edit, attachment,
  import, preview, and agent workflows to consume that one role and purpose;
- add one Drizzle-owned data migration for current project databases;
- apply and verify that migration against `urban-basilica`;
- update current accepted documentation and the sister `studio-skills` project.

Out of scope:

- any change to `lookbook.video-sheet` or `lookbook.storyboard-sheet`;
- any change to Movie versus Storyboard Lookbook selection;
- any change to provider routing, model recommendations, prompt contents, or
  image-generation behavior;
- any attempt to infer whether an existing Character Sheet is visually suited
  to storyboards or video;
- renaming the existing `asset.type = character_sheet` storage classification;
- changing `asset_file.role = primary` for Cast Character Sheet files;
- interpreting or rewriting the creative text stored in `cast_asset.purpose`;
- compatibility support for either removed Cast purpose after migration.

## Context

Accepted architecture and implementation constraints:

- `AGENTS.md`: architecture ownership, no compatibility layers, opaque AI
  artifacts, structured diagnostics, and Drizzle Kit requirements;
- `docs/architecture/reference/drizzle-migrations.md` and
  `docs/decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md`:
  custom data migrations must be created and applied through Drizzle Kit;
- `docs/architecture/naming-guidelines.md`: rename callers directly and do not
  preserve obsolete names;
- `docs/architecture/coding-practices.md`: keep the generation-purpose registry,
  attachment dispatch, and CLI handlers focused;
- `docs/architecture/reference/domain-vocabulary.md`: Cast Character Sheet is
  the shared Cast design reference product;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`: the migration
  may rewrite owned envelope fields but must not inspect or alter creative
  prompts or media contents;
- `packages/core` owns generation purposes, attachment roles, reference guides,
  persistence, and migration behavior;
- `packages/cli` and `packages/studio` remain thin consumers of the Core
  contract;
- `/Users/keremk/Projects/aitinkerbox/studio-skills` owns the agent-facing
  generation workflow and samples;
- `/Users/keremk/renku-movies/urban-basilica` is the required real-project
  migration and verification target.

Read-only inspection of the current `urban-basilica` database on 2026-07-14
found:

- `PRAGMA user_version = 42` and 54 applied Drizzle migrations;
- 4 `media_generation_spec` rows with purpose
  `cast.video-character-sheet`;
- 4 `media_generation_run` rows with purpose
  `cast.video-character-sheet`;
- those 4 runs also store `cast.video-character-sheet` at
  `spec_snapshot_json.purpose`;
- 11 `cast_asset` rows with relationship role `character_sheet`;
- 2 `shot.video-take` specs whose `references_json` contains one or more
  `placement.slotId = video-character-sheet` selections;
- corresponding saved run snapshots may contain the same reference placement;
- no current `cast.storyboard-character-sheet` spec, run, or Cast relationship
  row in this sample database.

Those counts are verification fixtures for this sample migration, not runtime
assumptions. The migration itself must rewrite both removed purpose variants and
all three non-canonical relationship-role spellings wherever the owned field is
present.

## Architecture Shape Gate

### Ownership

`packages/core/src/server/generation` remains the owner of the Cast Character
Sheet purpose and its attachment/reference behavior.

The public caller entrypoints remain the existing Core generation and media
attachment services. Callers pass `cast.character-sheet`; no new command,
service facade, route, or wrapper is introduced.

### Intended module and file shape

- `packages/core/src/server/generation/purposes/cast-character-sheet.ts` owns
  the single purpose descriptor.
- `packages/core/src/server/generation/purposes.ts` remains the thin bounded
  registry and registers that descriptor once.
- `packages/core/src/client/generation.ts` exposes only
  `cast.character-sheet` in `GenerationPurpose`.
- `packages/core/src/server/generation/attachments.ts` keeps one focused Cast
  attachment case that writes relationship role `character-sheet`.
- existing purpose-specific consumers such as `cast-profile.ts`,
  `scene-storyboard-sheet.ts`, `shot-video-take.ts`, and `image-edit.ts` retain
  their own reference-guide ownership while using the same `character-sheet`
  slot and role.
- the existing CLI media-import handler registry contains one
  `cast.character-sheet` declaration; no Cast-specific CLI branching is added.
- the Studio generation-preview title map contains one Cast Character Sheet
  entry; no new Cast-only UI component is introduced.
- one Drizzle custom migration in `packages/core/drizzle/` owns the one-way
  stored-data rewrite. There is no runtime migration helper or application-level
  data repair command.
- the two obsolete purpose descriptor files disappear.

No new `index.ts` file is needed. Existing package and bounded-module entrypoints
must remain thin.

### Bounded dispatch

The existing purpose registry and attachment switch are already the accepted
bounded dispatch boundaries. This change shrinks both boundaries. It must not
introduce a general purpose-renaming map, role-normalization helper, or fallback
resolver in runtime code.

### Explicitly forbidden shape

- Do not recognize either removed purpose in current TypeScript runtime code.
- Do not retain the removed descriptor exports or files as re-export stubs.
- Do not keep arrays such as `['video-character-sheet',
  'storyboard-character-sheet', 'character-sheet']` in current consumers.
- Do not add a generic role-normalization utility whose purpose is to translate
  obsolete values during normal reads.
- Do not place migration SQL in TypeScript or run ad hoc SQLite writes from the
  CLI, Studio server, React, or a skill.
- Do not edit historical Drizzle migration `0052_context-first-generation.sql`.
- Do not rewrite prompt text, `cast_asset.purpose`, provider payloads, generated
  outputs, or any other creative/opaque field.
- Do not modify the two Lookbook sheet purposes as collateral cleanup.

### Stop conditions

Stop and revise the implementation before continuing if:

- preserving a removed purpose or role appears necessary in normal runtime
  code;
- the migration cannot identify purpose and slot fields structurally and would
  require broad string replacement across arbitrary JSON or creative text;
- the change starts expanding into Lookbook purpose consolidation or asset-type
  renaming;
- a registry, handler, route, or UI file grows rather than becoming smaller;
- migration of `urban-basilica` would require an unplanned schema repair rather
  than the direct current-state rewrite described here.

## Contracts

### Public generation purpose

Replace:

```text
cast.video-character-sheet
cast.storyboard-character-sheet
```

with:

```text
cast.character-sheet
```

The target remains `castMember`, output media kind remains `image`, model use
remains `any`, recommended aspect ratio remains `16:9`, recommended quality
remains `high`, and the recommended model remains GPT Image 2 through the
existing provider descriptor.

### Attachment contract

`attachGenerationMedia` for `cast.character-sheet` must:

- require a `castMember` target;
- use the existing `cast.characterSheet` project-asset-file destination;
- attach the Cast relationship role `character-sheet`;
- retain the existing Character Sheet label, media kind, resource key, and
  provenance behavior.

### Reference-guide contract

Use the same current slot everywhere a Cast Character Sheet is selected:

```text
sectionId: cast or source, as owned by the consuming purpose
slotId: character-sheet
slotLabel: Character Sheet
owner/subject: the Cast Member
roles: [character-sheet]
```

Scene Storyboard Sheet and Shot Video Take generation may initialize different
Cast Members based on their existing scene/shot direction, but they select from
the same Character Sheet role. Cast Profile also initializes from that role.
There is no storyboard-versus-video fallback order.

### CLI and Studio contract

- `renku generation ... --purpose cast.character-sheet` is the only Cast
  Character Sheet generation purpose.
- `renku media import --purpose cast.character-sheet --target cast:<id> ...`
  is the only focused Cast Character Sheet import.
- generation previews use the existing visible title `Character Sheet
  Generation Preview` for the single purpose.
- Studio Cast asset projections recognize `character-sheet` as the relationship
  role. Existing `asset.type = character_sheet` remains unchanged.

### Migration contract

Create the next Drizzle custom migration from `packages/core` with:

```bash
pnpm drizzle-kit generate --config drizzle.config.ts --custom --name merge_cast_character_sheet_purposes
```

The migration is data-only and must not change the TypeScript schema or
`PRAGMA user_version`.

The migration must perform these structural rewrites:

1. `media_generation_spec.purpose`:
   - `cast.video-character-sheet` -> `cast.character-sheet`;
   - `cast.storyboard-character-sheet` -> `cast.character-sheet`.
2. `media_generation_run.purpose`: the same two-to-one rewrite.
3. `media_generation_run.spec_snapshot_json.purpose`: the same rewrite using
   SQLite JSON functions.
4. `media_generation_spec.references_json` placement objects:
   - `video-character-sheet` -> `character-sheet` when the exact owned JSON
     field is `placement.slotId`;
   - `storyboard-character-sheet` -> `character-sheet` at the same exact field.
5. `media_generation_run.spec_snapshot_json.references` placement objects: the
   same exact `placement.slotId` rewrite.
6. `cast_asset.role`:
   - `character_sheet` -> `character-sheet`;
   - `video-character-sheet` -> `character-sheet`;
   - `storyboard-character-sheet` -> `character-sheet`.

The JSON updates must preserve array order, ids, inclusion flags, scope,
subjects, exact asset/file references, prompt values, model configuration, and
all unrelated fields. Broad text replacement is forbidden.

The migration must not change:

- `cast_asset.purpose`, which contains user/agent-authored creative purpose
  text rather than a generation-purpose enum;
- `asset.type = character_sheet`;
- `asset_file.role = primary`;
- Lookbook purposes, roles, or reference slots;
- historical migration files.

## Implementation Slices

### Slice 1: Replace the Core purpose declaration

Expected files:

- `packages/core/src/client/generation.ts`;
- `packages/core/src/server/generation/purposes.ts`;
- add `packages/core/src/server/generation/purposes/cast-character-sheet.ts`;
- delete the two obsolete Cast purpose descriptor files;
- `packages/core/src/server/generation/purposes.test.ts`.

Replace the public union and registry entries directly. Preserve the existing
settings and generic reference-guide behavior. Tests must assert the single
current descriptor and must not assert that obsolete names are rejected by
name.

### Slice 2: Unify attachment and reference roles

Expected files include:

- `packages/core/src/server/generation/attachments.ts`;
- `packages/core/src/server/generation/purposes/cast-profile.ts`;
- `packages/core/src/server/generation/purposes/scene-storyboard-sheet.ts`;
- `packages/core/src/server/generation/purposes/shot-video-take.ts`;
- `packages/core/src/server/generation/purposes/image-edit.ts` where needed;
- `packages/core/src/server/image-revision-workflow/attachment.ts`;
- current Cast resource/readiness projections that still use a non-canonical
  Character Sheet role;
- `packages/studio/src/features/movie-studio/cast/cast-member-assets.ts`;
- `packages/studio/src/services/studio-project-assets-api.ts`.

Update current consumers to use only `character-sheet`. Do not change
Cast-member targeting, selection semantics, reference cardinality, scope,
subject, asset type, file role, or path allocation.

### Slice 3: Update thin CLI and Studio surfaces

Expected files include:

- `packages/cli/src/commands/media-import-command-handlers.ts`;
- affected CLI integration tests and fixtures;
- `packages/studio/src/features/generation-preview/generation-preview-title.ts`;
- affected Studio route, preview, service, and E2E fixtures.

Replace the two purpose declarations with one and update fixtures to describe
current behavior. Do not add purpose-specific branching to CLI handlers or
Studio routes.

### Slice 4: Add the one-way Drizzle data migration

Expected files:

- the generated custom SQL migration after `0053`;
- Drizzle journal metadata generated by Drizzle Kit;
- a focused migration regression test in the Core database test area.

Generate the custom migration through Drizzle Kit, then write only the
documented structural updates into the generated SQL file. Do not edit the
Drizzle schema because the table shapes do not change. Do not increment
`user_version`.

The regression test must seed both removed purposes, all three obsolete role
spellings, video/storyboard slot ids, unrelated Lookbook values, and opaque
creative fields. It must prove the exact current fields are rewritten while
unrelated and opaque content remains byte-for-byte or structurally unchanged as
appropriate.

### Slice 5: Apply and verify `urban-basilica`

Required target:

```text
/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite
```

With Studio and other writers stopped, run the normal project migration:

```bash
renku project migrate urban-basilica
```

Use the core-created, verified pre-migration backup reported by the command. Do
not add a separate migration script or alternate manual SQL path.

After migration, verify at minimum:

- the database still passes `PRAGMA quick_check`;
- `PRAGMA user_version` remains 42;
- the Drizzle migration count increases by one;
- the 4 existing Cast Character Sheet specs now use
  `cast.character-sheet`;
- the 4 existing runs and their snapshot purposes now use
  `cast.character-sheet`;
- the 11 existing Character Sheet relationships now use `character-sheet`;
- the 2 affected Shot Video Take specs use
  `placement.slotId = character-sheet` while retaining their exact selected
  asset/file ids, shot scopes, and Cast Member subjects;
- corresponding run snapshots use the same current slot id;
- zero occurrences of either removed Cast purpose or either specialized Cast
  slot/role remain in owned database fields;
- Lookbook purpose and role counts are unchanged;
- opening the project and reading generation context succeeds without a schema
  or purpose error.

Record the generated backup paths and the before/after verification counts in
this plan's implementation notes when the work is completed.

### Slice 6: Update accepted docs and Studio skills

Update current documentation that enumerates generation purposes, Cast media
handoffs, or reference roles, including:

- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`;
- current accepted generation-purpose documentation affected by the merge.

Update `/Users/keremk/Projects/aitinkerbox/studio-skills` directly:

- `skills/casting-director/references/cast-media-handoff.md`;
- `skills/media-producer/SKILL.md`;
- `skills/media-producer/references/cast-character-sheets.md`;
- `skills/media-producer/references/voice-over-profile-image.md`;
- `skills/media-producer/references/workflow.md`;
- replace the two Cast Character Sheet sample specs with one current
  `cast-character-sheet` sample;
- `skills/movie-director/references/workflow-playbooks.md`;
- any eval or handoff assertion discovered by the final obsolete-name scan.

Do not edit old or historical plans merely to replace names. Update active plan
0139 only if it remains current implementation direction at implementation
time; otherwise supersede its Cast section through this plan without a broad
historical naming sweep.

## Tests And Guardrails

### Core behavior

- `listGenerationPurposes()` returns `cast.character-sheet` once.
- the descriptor retains the current Cast target, image output, model use, and
  recommended settings.
- generation context accepts `cast.character-sheet` for a Cast Member.
- attaching generated or imported Character Sheet media writes role
  `character-sheet` and preserves provenance.
- a non-Cast target fails through the existing structured Core diagnostic.
- Cast Profile, Scene Storyboard Sheet, Shot Video Take, and image-edit guides
  expose Character Sheet candidates through the canonical role.
- Scene Storyboard Sheet and Shot Video Take retain their existing scope,
  subject, inclusion, and exact-selection behavior.

### CLI and Studio behavior

- CLI context/spec/run/import workflows use `cast.character-sheet`.
- CLI media import attaches a `character-sheet` Cast relationship.
- Studio preview titles and preview editing work for the single purpose.
- Studio Cast asset panels display current Character Sheet relationships.
- no UI copy introduces a storyboard/video distinction for Cast Character
  Sheets.

### Migration behavior

- the generated migration runs through the Drizzle Kit path in a transaction;
- both removed purposes converge to `cast.character-sheet` in spec rows, run
  rows, and snapshot purpose fields;
- all three obsolete relationship-role spellings converge to
  `character-sheet`;
- exact placement slot ids are rewritten in saved specs and run snapshots;
- unrelated placement slots and all Lookbook values remain unchanged;
- opaque prompts, Cast relationship purpose text, provider payloads, outputs,
  receipts, diagnostics, and media remain unchanged;
- rerunning current application reads after migration requires no compatibility
  code.

### Static guardrail

Use a final repository scan across production code, current tests, accepted
docs, and `studio-skills` for:

```text
cast.video-character-sheet
cast.storyboard-character-sheet
video-character-sheet
storyboard-character-sheet
```

The only permitted remaining occurrences are historical Drizzle migration SQL
or explicitly historical documentation. Do not add an architecture test that
hard-codes private implementation names or a complete purpose inventory merely
to enforce this cleanup.

## Documentation

Documentation must describe one Cast Character Sheet generation and import
workflow:

```bash
renku generation context --purpose cast.character-sheet --target cast:<cast-member-id> --json
renku media import --purpose cast.character-sheet --target cast:<cast-member-id> --source <project-relative-path> --title <title> --json
```

Explain that a Cast Character Sheet is reusable continuity guidance for both
storyboard and final-video generation. Do not describe the removed split as an
alternate or deprecated workflow.

Keep Lookbook documentation explicit that its two sheet purposes remain:

```text
lookbook.video-sheet
lookbook.storyboard-sheet
```

## Final Verification

Run focused package checks first:

```bash
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm --dir packages/studio test
```

Run the focused migration regression test directly if the package test command
supports a file filter. Then run root verification because the public purpose
union affects all packages:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Verify `urban-basilica` with read-only SQLite queries after the normal migration
command, then exercise at least:

```bash
renku generation context --purpose cast.character-sheet --target cast:<an-existing-urban-basilica-cast-id> --json
renku generation spec list --purpose cast.character-sheet --target cast:<an-existing-urban-basilica-cast-id> --json
```

Do not invoke paid generation as part of this cleanup.

Final review must also:

- inspect `git diff --stat` in both `studio` and `studio-skills`;
- inspect the complete diffs, especially the generated migration and JSON
  transformation test;
- inspect any newly large or heavily modified file;
- confirm both obsolete descriptor files were deleted rather than retained as
  wrappers;
- confirm the purpose registry, attachment switch, CLI registry, and Studio
  title map became smaller or stayed focused;
- confirm no `index.ts` entrypoint became an implementation module;
- confirm no compatibility role list or purpose alias survives in runtime code;
- confirm no checklist item was satisfied by accepting a broad dispatcher,
  catch-all migration helper, or unreviewable SQL rewrite;
- confirm Lookbook purpose behavior and data were untouched.

## Completion Checklist

### Review Area

- [x] Confirm the implementation preserves Core ownership of generation
      purposes, attachment rules, references, and durable migration behavior.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, facade, or god file was
      added.
- [x] Confirm the scope remains the Cast purpose merge and does not alter either
      Lookbook sheet purpose.
- [x] Confirm no runtime compatibility path recognizes either removed Cast
      purpose or specialized role.

### Architecture And Contracts

- [x] Replace the public Cast purpose union members with exactly
      `cast.character-sheet`.
- [x] Add the single focused Cast Character Sheet descriptor and register it
      once.
- [x] Delete both obsolete descriptor files and update callers directly.
- [x] Preserve the existing target, output media kind, model use, settings, and
      provider recommendation.
- [x] Make `character-sheet` the single attachment relationship role.
- [x] Make `character-sheet` the single generation reference slot id and role.
- [x] Keep `asset.type = character_sheet` and `asset_file.role = primary`
      unchanged.
- [x] Keep package-boundary failures on the existing structured diagnostic path.
- [x] Keep creative prompts, media, and `cast_asset.purpose` opaque and
      unchanged.
- [x] Confirm `lookbook.video-sheet` and `lookbook.storyboard-sheet` remain
      separate first-class purposes.

### Core Implementation

- [x] Update Cast Character Sheet purpose declarations and registry tests.
- [x] Update focused attachment behavior to the one current purpose and role.
- [x] Update Cast Profile reference guidance.
- [x] Update Scene Storyboard Sheet Cast reference guidance.
- [x] Update Shot Video Take Cast reference guidance without changing Shot
      scope or Cast subject behavior.
- [x] Update image-edit and image-revision Character Sheet handling.
- [x] Update current Cast resource/readiness projections that use obsolete role
      spellings.
- [x] Confirm no existing Core file grew into a general purpose or role
      normalizer.

### CLI And Studio Surfaces

- [x] Replace the two CLI media-import declarations with
      `cast.character-sheet`.
- [x] Update CLI integration fixtures and assertions to current behavior.
- [x] Replace the two Studio preview-title entries with one.
- [x] Update Studio server, service, feature, and E2E fixtures.
- [x] Update the Cast asset panel and API defaults to recognize the canonical
      relationship role.
- [x] Confirm Studio and CLI remain thin callers of Core.

### Drizzle Migration

- [x] Generate the custom migration through Drizzle Kit with the deliberate
      `merge_cast_character_sheet_purposes` name.
- [x] Confirm no TypeScript schema change is included.
- [x] Confirm `PRAGMA user_version` is not changed.
- [x] Rewrite both obsolete purposes in `media_generation_spec.purpose`.
- [x] Rewrite both obsolete purposes in `media_generation_run.purpose`.
- [x] Rewrite only the owned purpose field in run spec snapshots.
- [x] Rewrite only exact Character Sheet placement slot ids in saved spec
      references and run snapshots.
- [x] Rewrite all three obsolete `cast_asset.role` spellings to
      `character-sheet`.
- [x] Preserve JSON array order, ids, inclusion flags, scopes, subjects, and
      asset/file references.
- [x] Prove unrelated Lookbook fields and opaque creative fields are unchanged.
- [x] Add a focused transactional migration regression test.
- [x] Confirm historical migration `0052_context-first-generation.sql` was not
      edited.

### `urban-basilica` Migration

- [x] Stop Studio and other project database writers before migration.
- [x] Run `renku project migrate urban-basilica` through the normal Core/Drizzle
      path.
- [x] Record and verify the generated pre-migration SQLite backup and metadata
      sidecar.
- [x] Run `PRAGMA quick_check` on the migrated database.
- [x] Confirm `PRAGMA user_version` remains 42.
- [x] Confirm exactly 4 existing specs now use `cast.character-sheet`.
- [x] Confirm exactly 4 existing runs and their snapshots now use
      `cast.character-sheet`.
- [x] Confirm exactly 11 existing Cast Character Sheet relationships now use
      `character-sheet`.
- [x] Confirm the 2 affected Shot Video Take specs now use the canonical slot
      while retaining exact reference identity and scope.
- [x] Confirm corresponding run snapshot references use the canonical slot.
- [x] Confirm no removed Cast purpose or specialized role remains in an owned
      database field.
- [x] Confirm Lookbook purpose, relationship, selection, and reference data are
      unchanged.
- [x] Confirm current Cast generation context and saved-spec listing work for an
      existing sample Cast Member.
- [x] Record before/after counts and backup paths in implementation notes.

### Tests And Guardrails

- [x] Update Core purpose, attachment, reference-guide, and migration tests.
- [x] Update CLI workflow and handler tests.
- [x] Update Studio route, preview, service, feature, and E2E tests.
- [x] Test both source purpose variants in the migration fixture even though the
      current sample contains only the video variant.
- [x] Test all three obsolete relationship-role spellings in the migration
      fixture.
- [x] Test exact JSON placement rewrites and preservation of unrelated fields.
- [x] Run the final obsolete-name scan across `studio` and `studio-skills`.
- [x] Confirm remaining matches are historical only and review each one.
- [x] Avoid source-text architecture tests tied to private function or file
      names.

### Documentation And Skills

- [x] Update current domain vocabulary and Studio skill handoff documentation.
- [x] Update current CLI command documentation and examples.
- [x] Update `media-producer`, `casting-director`, and `movie-director` guidance
      in `studio-skills`.
- [x] Replace the two Cast sample specs with one current sample.
- [x] Update relevant current eval assertions.
- [x] Preserve the explicit two-purpose Lookbook guidance.
- [x] Do not edit historical plans merely to perform a naming sweep.

### Final Verification

- [x] Run focused Core, CLI, and Studio tests.
- [x] Run `pnpm build`.
- [x] Run `pnpm test`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Exercise current Cast context and spec-list commands against
      `urban-basilica` without paid generation.
- [x] Review `git diff --stat` and the complete diff in both repositories.
- [x] Inspect the generated migration, migration regression test, and all large
      or heavily modified files.
- [x] Confirm registries and switches remain bounded and focused.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure, broad JSON replacement, or runtime compatibility behavior.
- [x] Confirm all required sample database checks passed before marking the plan
      implemented.
