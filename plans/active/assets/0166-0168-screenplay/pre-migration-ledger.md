# Urban Basilica Pre-Migration Ledger

Captured: 2026-08-03

Source database:
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite`

Verified Core backup:
`/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-56-to-56-20260803T111003203Z-0b817b.sqlite`

Sidecar:
`/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-56-to-56-20260803T111003203Z-0b817b.json`

Safety checks:

- source schema generation: 56;
- backup schema generation: 56;
- backup `PRAGMA quick_check`: `ok`;
- backup `PRAGMA foreign_key_check`: no rows;
- source database size: 1,462,272 bytes;
- backup database size: 1,380,352 bytes; and
- backup metadata records `verification.opened: true` and
  `verification.quickCheck: "ok"`.

## Row counts

| Owner | Rows |
| --- | ---: |
| Project | 1 |
| Screenplay metadata | 1 |
| Acts | 3 |
| Sequences | 5 |
| Scenes | 10 |
| Scene Locations | 11 |
| Scene production numbers | 10 |
| Scene Beat Sheets | 12 |
| Dialogue-audio setups | 4 |
| Dialogue-audio takes | 5 |
| Shot Plans | 1 |
| Shots | 1 |
| Assets | 90 |
| Asset Files | 98 |
| Asset memberships | 90 |
| Cast Members | 8 |
| Locations | 8 |
| Props | 2 |
| Screenplay analyses | 1 |
| Screenplay revisions | 0 |

## Canonical pre-migration Scene traversal

| # | Act | Sequence | Scene ID | Scene title | Production number |
| ---: | --- | --- | --- | --- | --- |
| 1 | The Offer | The Sound That Opens Stone | `scene_djkfgf9p` | Bombardment | `1` |
| 2 | The Offer | The Emperor Without Coin | `scene_zp6ysnpy` | The First Patron | `2` |
| 3 | The Offer | The Emperor Without Coin | `scene_fzf8844n` | The Harbor Argument | `3` |
| 4 | The Patron | The Sultan Who Understands Scale | `scene_x92u599y` | Four Times the Price | `4` |
| 5 | The Patron | Bronze Remembers | `scene_9yck347d` | The Casting | `5` |
| 6 | The Patron | Bronze Remembers | `scene_tyjrwqqu` | The Test | `6` |
| 7 | The Patron | Bronze Remembers | `scene_hymu6gnu` | The Road | `7` |
| 8 | The Sound | The Maker at the Wall | `scene_svj3cdyg` | Night Repairs | `8` |
| 9 | The Sound | The Maker at the Wall | `scene_257pm3ck` | Too Soon | `9` |
| 10 | The Sound | The Maker at the Wall | `scene_njux6ad9` | The Maker's Sound | `10` |

All ten number reservations belong to current Scenes. No production-number
value is duplicated and no reservation is orphaned.

## Screenplay content

The ten Scenes contain 119 top-level blocks:

| Existing block type | Count |
| --- | ---: |
| Action | 52 |
| Dialogue | 60 |
| Shot | 3 |
| Super | 1 |
| Title Card | 1 |
| Transition | 2 |

The 60 Dialogue blocks contain 60 distinct `dialogueId` values. Screenplay
block JSON contains 34 rows with at least one literal `@handle` token. Beat
Sheet documents contain 101 `screenplayBlockIndexes`, 101 `castMemberIds`, and
101 `locationIds` fields that require meaning-preserving conversion.

Scene Heading source fields are complete for all ten Scenes. Nine Scenes have
one ordered Location; `scene_njux6ad9` has two ordered Locations:
`Theodosian Walls, Ottoman Siege Camp`.

## Production ownership

- Dialogue audio: 4 setup rows and 5 take rows, all owned by Bombardment
  Dialogue IDs. Their setup, Cast Voice, take, Asset, and Asset File identities
  are recorded in the backup and must remain unchanged.
- Shot Plans: `shot_plan_37a3r9yz` belongs to `scene_zp6ysnpy`; its one Shot
  remains Scene-owned through that plan.
- Assets: 90 Assets, 98 Asset Files, and 90 memberships. There are zero
  Sequence-owned Asset memberships.
- Cast costume/design JSON contains zero Sequence-scope and zero Scene-scope
  identity mentions in the current sample.
- The active analysis is `screenplay_analysis_x4hq2er3`, uses the `threeAct`
  structure model, and contains a 37,055-byte document. Its coordinated
  hierarchy-independent conversion is owned by Plan 0169.
- The revision table has zero rows; the revision contract still migrates to the
  new aggregate snapshot shape.

## Project subjects

The eight Cast Member IDs, names, and handles are:

- `cast_pccfdknw` — Constantine XI Palaiologos — `constantine-xi-palaiologos`;
- `cast_zcwb2du7` — Giovanni Giustiniani Longo — `giovanni-giustiniani-longo`;
- `cast_p7y36x5t` — Loukas Notaras — `loukas-notaras`;
- `cast_e786pp6u` — Mara — `mara`;
- `cast_cwdyy6ec` — Mehmed II — `mehmed-ii`;
- `cast_9fdrsqpr` — Narrator — `narrator`;
- `cast_khwcy8zt` — Saruca — `saruca`; and
- `cast_sb5y4gjk` — Urban — `urban`.

The eight Location IDs and names are Edirne Foundry, Edirne Palace Workroom,
Edirne Test Field, Harbor Quarter, Imperial Council Chamber, Ottoman Siege
Camp, Road to Constantinople, and Theodosian Walls. The two Props are
`prop_z4dcd5jx` (Urban’s Great Bombard) and `prop_4k29xsze` (Mehmed II’s Siege
Helmet). The current screenplay contains no Prop identity, so migration must
not invent a Prop reference.

## Metadata conversion guards

The Project-side duplicate story fields are currently empty. The populated
Screenplay metadata therefore supplies the one-time source values without a
conflict. The conversion must preserve the current title, logline, synopsis,
premise, audience, ten-minute runtime, historical-drama genre values, tones,
rating intent, creative boundaries, dramatic fields, themes, historical and
dramatized elements, draft status, research sources, assumptions, four
explicit `Open question:` entries, four `Next iteration option:` entries, and
the unprefixed assumptions. `10-minute short film` converts to
`format: "short film"` plus `targetRuntimeMinutes: 10`.

This ledger is evidence for migration tests and the final migrated-versus-backup
comparison. It is not a runtime compatibility contract.

## Post-Migration Verification

Final migration completed on 2026-08-03 with schema generation `57`.

The first generation-57 attempt exposed that all twelve legacy Beat Sheet
documents carried an empty optional `openQuestions` array, which the current
closed schema correctly rejects. The database was restored from the verified
generation-56 migration backup, migration `0071` was corrected and covered by
the migration test, and the migration was rerun from the restored source. No
manual data repair was applied to the migrated database.

The final migration-time backup and sidecar are:

- `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-56-to-57-20260803T142114749Z-a62246.sqlite`;
- `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-56-to-57-20260803T142114749Z-a62246.json`.

Final verification proves:

- `PRAGMA user_version` is `57`, `PRAGMA quick_check` is `ok`, and
  `PRAGMA foreign_key_check` returns no rows;
- the ten canonical Scenes retain the exact ledger order, IDs, titles, and
  production numbers `1` through `10`;
- the database contains three Act Sections, five Sequence Sections, ten
  Scenes, 119 Blocks, and 126 normalized Screenplay references;
- all 101 Beats have `screenplayBlockIds` and `propIds`, every Block reference
  resolves inside its owning Scene, and active Beat Sheet reads pass the current
  Core schema;
- all four Dialogue Audio setups resolve a current stable Dialogue Turn ID and
  all five takes remain present;
- the active analysis ID, timestamps, summary, criteria, scores, critiques,
  evidence, and suggestions remain readable; its current shape contains three
  Act segments, nine key beats, five Scene groups, ten Scene analyses, and three
  suggested Scenes;
- 90 Assets, 98 Asset Files, 90 memberships, eight Cast Members, eight
  Locations, two Props, one Shot Plan, and one Shot remain present; and
- the obsolete hierarchy, location join, number registry, duplicate metadata,
  old analysis keys, empty optional Beat question arrays, and literal
  screenplay `@handle` tokens are absent.

## Final Verification Gate Record

The coordinated Plan-0166/0169 backend gate completed with:

- Core build and test typecheck passing, with 74 files and 280 tests passing;
- CLI test typecheck, 52 unit tests, and 31 integration workflows passing;
- Studio server build and all 79 focused server tests passing;
- root lint passing with warnings only, plus all architecture and test-partition
  checks passing;
- all five updated sister Skills passing `quick_validate.py`, with the
  Screenplay, Screenplay Analysis, and Scene Beat Sheet samples also validated
  against the owning Core schemas; and
- clean `git diff --check` results in both Studio and `studio-skills`, followed
  by full diff-stat, large-file, module-entrypoint, and deleted-path review.

The root `pnpm build`, `pnpm test`, and `pnpm check` commands stop only in the
Plan-0167 React/browser surface, as anticipated by Plan 0166's verification
contract. The build and test typecheck failures are old-contract UI consumers
of the newly accepted Project, Section, Scene, Beat, dialogue-turn, and Story
Arc contracts. The runtime suite passes 73 Studio test files and 314 tests,
with the remaining two `ScenePanel` tests failing because the removed
`formatSceneProductionNumber` API is still consumed by the Plan-0167 UI. Core,
CLI, Engines, Studio server, architecture, and migration boundaries are green.
