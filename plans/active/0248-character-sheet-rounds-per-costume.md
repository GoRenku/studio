# 0248 Character Sheet Rounds Per Costume

Status: implemented
Date: 2026-10-26

Related: [ADR 0127](../../docs/decisions/0127-cast-looks-costumes-and-casting-rounds.md),
plan 0242 (casting rounds, Looks and wardrobe), plan 0244 (detail levels),
plan 0246 (Casting tab one Look at a time), plan 0247 (remove shortlist).

## Decisions

The user approved these on 2026-10-26 from the "Wardrobe Sheet Rounds"
proposal page:

1. A costume gets rounds of character sheets the way a Look gets casting
   rounds: models, per-model counts, detail level and estimate, then hide,
   compare and pick per costume. The Casting round panel, the casting board,
   Compare, the candidate tile and the image viewer are reused.
2. Character sheet rounds have their own saved defaults (models and counts),
   separate from casting defaults. Detail keeps the existing
   `characterSheetDetail` default.
3. Studio Casting tab, option A: under the picked Look, one row of cards — a
   Casting card showing the cast picture, then one card per costume showing
   its picked sheet. The picked card's rounds show in one box below, with the
   only Compare button in that box's header.
4. One round panel covers several costumes of one Look; each ticked costume
   gets its own round.
5. Big Fish: the Tent-shirt traveller sheet is filed under Surplus-tent
   canvas shirt as a second sheet of its Round 1. Brown workwear stays in
   Karl's Assets only.
6. Picking a sheet saves at once and sends no chat message. "Send picks to
   agent" is removed.

## Review Attention

- **Beyond the literal request, and why:**
  - A Casting Round now has a subject: a Look (candidates) or a costume
    (character sheets). Without a durable sheet-to-costume link the "every
    sheet under every costume" bug cannot be fixed.
  - Picking a sheet for a costume requires the sheet to come from that
    costume's rounds (mirrors the Look rule). Invalid picks fail before the
    write.
  - A sheet round requires its costume's Look to be cast (the cast picture is
    the identity reference; ADR 0127 already says casting comes first).
  - A costume with sheet rounds cannot move to another Look in a wardrobe
    plan; removing the costume instead deletes its rounds and keeps the sheets
    in Assets. Moving would put a different face's sheets under the costume.
  - Attaching a sheet never picks it (same as casting candidates).
  - When no sheet defaults are saved, the panel opens with the image lane's
    model at **2 sheets per costume** (casting opens at 10).
- **Changed contracts:** `casting_round` table (subject columns), Project
  Settings document version 10 (`casting.routes` → `casting.candidateRoutes`,
  new `casting.characterSheetRoutes`), `castingRoundCreate` document
  (`subject` replaces `lookId`), `cast.character-sheet` target kind
  (`castingRound` replaces `castCostume`), `CastCastingResource` (costumes
  carry rounds; `characterSheets` removed), `casting.round.open` input and
  panel contract (`subject`), `casting.board.open` sheets mode (`lookId`
  replaces `castMemberId`), board requests (`sheetPicksDone` removed;
  `moreLikeKept` gains a subject), wardrobe write report
  (`releasedSheetAssetFileIds`), CLI `cast casting show --costume`.
- **New diagnostics:** `CASTING_ROUND_LOOK_NOT_CAST`,
  `CASTING_COSTUME_LOOK_CHANGE_HAS_SHEETS`, CLI `CLI174` (`casting show`
  needs exactly one of `--look` / `--costume`). A missing subject reuses
  `CASTING_LOOK_NOT_FOUND` / `CASTING_COSTUME_NOT_FOUND`. Existing
  `CORE_ASSET_SELECTION_INVALID` gains a costume message.
- **Migrations and data effects:** one Drizzle Kit schema migration; one
  custom migration that moves settings to version 10 and clears every
  costume pick (no sheet belongs to a costume round yet). Only Big Fish has
  costume picks (2); a one-time local Big Fish conversion restores them as
  Round 1 rounds. Other local projects (Sintel, Urban Basilica,
  sample-project) have sheets but no costume picks; their sheets stay in
  Assets and their costumes start with no rounds.
- **Removed:** Codex `SheetBoardView` rows of every sheet, Studio
  `CostumeSheets` and `CostumeSheetTile`, `sheet-actions.tsx`
  (`ExpandSheetButton`, `PickSheetAction`), `sheetPicksDone`, "Send picks to
  agent", the Route Chooser plus generation review path for
  `cast.character-sheet`, `costumeCharacterSheetsRequest`.
- **Deliberately unchanged:** Look rounds and casting behavior, Look picker
  cards, scene ordering, the Settings screen (it already shows both detail
  levels; routes stay editable only through the panel save box and
  `renku settings casting set`), scene generation context (picked sheet stays
  the first Cast continuity suggestion), the `casting_candidate` asset type
  for faces and `character_sheet` for sheets.
- **Naming decision to confirm in review:** the `casting_candidate` table and
  `CastingCandidate` type now also hold costume-round sheets (status and model
  key per round image). "Candidate" reads as "an image a round produced,
  waiting for a choice". Renaming the table is out of scope.

## Summary

Karl (Big Fish) has three costumes and four character sheets. Sheets are
owned by the Cast Member only, so the Codex sheet board and the Studio Casting
tab show all four sheets under every costume, including two that belong to no
costume. Sheets were made through the Route Chooser and generation review, one
model, no counts, no defaults, and Compare works for faces only.

After this plan a costume has rounds. The Casting round panel opens for a
Look's costumes; each ticked costume gets a round with the confirmed models,
per-costume counts and detail. The casting board shows one costume's rounds at
a time behind a row of costume cards, with Hide, Pick, Compare and "More like
these". Studio shows the cast picture and every costume's picked sheet in one
row and the picked card's rounds below.

## Context

- ADR 0127 owns Looks, costumes, casting rounds, scoped selection, the board
  and Compare. It is updated by this plan.
- Plan 0242 created rounds, costumes and the sheet board; plan 0246 the
  one-Look Casting tab and shared Compare; plan 0247 removed the shortlist.
- Real data: `~/renku-movies/big-fish`, Karl (`cast_gd6yacxh`), Looks
  Storybook Giant (`cast_look_nuzzja8h`, 16 scenes, cast `asset_file_7watj35b`
  `candidate-gpe8.png`) and Real Karl, 55 (`cast_look_3xf22qqk`, scenes
  198–200, cast `asset_file_bfnkt3ps`). Costumes Cave rags
  (`cast_costume_hzcgzjds`, scene 47, picked `asset_file_w3cnc6tw`),
  Surplus-tent canvas shirt (`cast_costume_jrty447f`, 15 scenes, picked
  `asset_file_vxbbmhea`), Funeral suit (`cast_costume_rd8e9876`, scenes
  198–200, no sheet). Unpicked sheets: `asset_file_2mpkdesm` (Tent-shirt
  traveller), `asset_file_3qnbkadr` (Brown workwear). All four sheets were
  made by provider `codex`, model `chatgpt-images-2.5`.
- Codex thread 2026-10-26 (Karl wardrobe): the user generated three sheets in
  one review, then replaced one; the board then showed all sheets per costume.
- Skills: `studio-skills/skills/casting-director/references/casting-rounds.md`,
  `cast-media-handoff.md`, `wardrobe-plan.md`, `SKILL.md`;
  `studio-skills/skills/media-producer/references/cast-character-sheets.md`.

## Product Behavior

### Character sheet round panel (Codex)

`casting.round.open` with `subject: { kind: 'costumes', costumeIds }` (all of
one Look) opens the existing Casting round panel with:

- header `Character sheet round` · `Karl · Storybook Giant`;
- a **Costumes** checklist: one row per requested costume, ticked, with its
  scene summary and `N sheets · picked` / `N sheets` / `No sheets`. At least
  one must stay ticked to generate;
- the brief box titled `What each sheet shows`, with "Same person as" showing
  the round references (the Look's cast candidate by default);
- `Sheets per costume` stepper (the total stepper's per-costume meaning) and
  the helper `split across the models you pick · 2 costumes, 4 sheets`;
- Detail opening on `casting.characterSheetDetail` (`highest`);
- model cards and prices as today; the estimate covers every ticked costume
  (`Estimated $0.18 for 4 sheets`);
- save box: `Save these models, counts and detail as this project's character
  sheet defaults` — writes `characterSheetRoutes` and `characterSheetDetail`
  only;
- button `Ask agent to generate 4`.

Preselection order: the agent's `suggested` routes, then
`casting.characterSheetRoutes`, then the image lane model with 2 per costume.
The answered summary reads `Karl · Storybook Giant · 2 costumes · GPT Image
2.5 ×1, FLUX 3 ×1 each · Highest · $0.18`.

`casting.round.open` with `subject: { kind: 'look', lookId }` is today's
casting panel unchanged, reading `candidateRoutes`.

### Sheet board (Codex)

`casting.board.open { project, mode: 'sheets', lookId, costumeId? }`:

- header `Character sheets` · `Karl · Storybook Giant` · `2 of 2 picked`;
- a row of costume cards (picked sheet or "No sheets yet", name, scene
  summary, `✓ Picked · 2 sheets` / `2 sheets` / `No sheets`). Opens on
  `costumeId` when given, else the first costume without a pick, else the
  first;
- below: the same body as the candidate board for the picked costume —
  `Sheets N` / `Hidden N` tabs, rounds newest first with progress and pending
  tiles, tiles 16:9 with hover Hide and Pick, image viewer with Hide and
  Pick in the zoom pill over that costume's sheets only;
- footer: notes, `Compare N` (kept sheets of the picked costume, ≥2),
  `More like these` (sends `moreLikeKept` for the picked costume with its
  kept sheets as references).
- Pick saves through Core and sends no message.

### Compare (shared)

Unchanged view; the choice word comes from the round kind: `Cast` / `✓ Cast`
for candidates, `Pick` / `✓ Picked` for sheets. Wide sheets stack by the
existing arrangement rule.

### Studio Casting tab (option A)

Look picker and scene bar unchanged in place. Under the picked Look header
(`Storybook Giant · 16 scenes`):

- **Subject row** (shown once the Look is cast): the `Casting` card (cast
  picture, `✓ Cast · 3 kept · 3 hidden`), a thin divider, then one card per
  costume of the Look (picked sheet or dashed `No sheets yet`, name, scene
  summary, `✓ Picked · 2 sheets` / `2 sheets` / nothing). Before the Look is
  cast, no row shows and the casting box shows directly, as today.
- **Default pick:** the Casting card when the Look is not cast or has no
  costumes; otherwise the first costume without a picked sheet, else the
  first costume. Component state, reset on reload or Look change.
- **Subject box:** header with the subject name, its scene summary and
  `Compare N` (≥2 kept). Body: rounds (`Round 1 · 2 sheets · $0.18`), tiles
  with hover Hide and Cast/Pick, `Show N hidden` / `Fold away N hidden`.
- **Requests, at most one card:**

| Picked subject state | Shown |
| --- | --- |
| Casting, no rounds | today's card "Run a casting round for Karl · Storybook Giant." |
| Casting, rounds, not cast | today's line "Run another casting round …" |
| Casting, cast, Look has no costumes | card "Plan Karl's wardrobe." under the box |
| costume, no rounds | card "Run a character sheet round for Karl's Funeral suit." |
| costume, rounds | line "Run another sheet round for Karl's Surplus-tent canvas shirt, like the kept sheets." |

- **Scene bar:** with a costume picked, that costume's scenes are full color,
  the rest of the Look's scenes at the current partial strength, other Looks'
  scenes dimmed as today. Casting picked: unchanged.

## Worked Example: Karl After Conversion

| Costume | Rounds | Picked | Studio card status |
| --- | --- | --- | --- |
| Cave rags | Round 1: `asset_file_w3cnc6tw` (codex / GPT Image 2.5 ×1) | `asset_file_w3cnc6tw` | `✓ Picked · 1 sheet` |
| Surplus-tent canvas shirt | Round 1: `asset_file_2mpkdesm`, `asset_file_vxbbmhea` (codex / GPT Image 2.5 ×2) | `asset_file_vxbbmhea` | `✓ Picked · 2 sheets` |
| Funeral suit | none | none | card "Run a character sheet round for Karl's Funeral suit." |

`asset_file_3qnbkadr` (Brown workwear) stays a Karl `character_sheet` in
Assets with no round. Round 1 rows store `estimatedCost: null`,
`maxConcurrentGenerations` from Big Fish's image lane, references
`[asset_file_7watj35b]`, `createdAt` = the earliest sheet's `createdAt`.

Stored round (Cave rags):

```json
{
  "id": "casting_round_…",
  "subject": { "kind": "castCostume", "id": "cast_costume_hzcgzjds" },
  "number": 1,
  "routes": [{ "provider": "codex", "model": { "key": "chatgpt-images-2.5", "name": "GPT Image 2.5" }, "count": 1 }],
  "maxConcurrentGenerations": 5,
  "referenceAssetFileIds": ["asset_file_7watj35b"],
  "estimatedCost": null
}
```

Settings after migration (Big Fish):

```json
"casting": {
  "candidateRoutes": [{ "provider": "codex", "model": { "key": "chatgpt-images-2.5", "name": "GPT Image 2.5" }, "count": 2 }, "…"],
  "characterSheetRoutes": [],
  "candidateDetail": "lowest",
  "characterSheetDetail": "highest"
}
```

## Architecture Shape Gate

### Ownership

- `packages/core` owns round subjects, the sheet-to-costume rule, round
  creation, costume removal effects, settings shape, resource projection and
  cost aggregation. Studio server, CLI and Codex call core commands only.
- `packages/codex` owns panel and board sessions: subject resolution for the
  panel, answers, consume results, board projection from core resources.
- `packages/studio` owns React views. Feature code renders core projections
  and sends intent; it never decides whether a sheet may be picked.
- Skills own when to open a sheet round and how to write sheet prompts.

### File layout

`packages/core/src`:

- `server/schema/casting.ts` — `casting_round.cast_look_id` nullable,
  `cast_costume_id` nullable FK to `cast_costume`, a `check` that exactly one
  is set, partial unique indexes `casting_round_look_number_idx` (look,
  number) where costume is null and `casting_round_costume_number_idx`
  (costume, number) where look is null.
- `drizzle/0097_*.sql` (Drizzle Kit generated) and
  `drizzle/0098_character_sheet_round_settings.sql` (custom, documented
  header like 0096).
- `client/casting/model.ts` — `CastingRoundSubject`, `CastingRound.subject`,
  `CastingRoundCreateDocument.subject`, `CastingSettings` fields,
  `CastCastingResource.costumes[].rounds`, `CastWardrobeReport.
  releasedSheetAssetFileIds`, `CastingCostumeReport`, and the
  `CastingRoundKind` type (`candidates` | `characterSheets`).
- `client/casting/cost-estimate.ts` — `estimateCastingRoundCost` takes
  `{ options, routes, detail, roundCount }`.
- `server/database/access/casting/rounds.ts` — subject-keyed
  `listCastingRoundRecords(session, subject)`,
  `nextCastingRoundNumber(session, subject)`, insert with subject columns,
  `deleteCastingRoundRecordsForCostume(session, costumeId)` returning the
  removed candidates' asset file ids.
- `server/casting/rounds/subjects.ts` (new) — `resolveCastingRoundSubject`
  (a two-entry resolver record; returns `{ castMemberId, look, costume }`,
  throws the Look or costume not-found error) and `assertCostumeLookCast`.
- `server/casting/rounds/commands.ts` — `createCastingRound` uses the
  subject module; `showCastingLook` and new `showCastingCostume`;
  `requireCandidateCastMember` resolves through the subject.
- `server/casting/rounds/views.ts` — `listCastingRoundViews(session, subject)`.
- `server/casting/resource.ts` — costumes with rounds; `characterSheets`
  removed.
- `server/casting/wardrobe/commands.ts` and `validate.ts` — removal deletes
  sheet rounds; Look change refused when rounds exist.
- `server/casting/settings.ts`, `documents.ts`,
  `server/project-settings/document.ts` — version 10 shape and defaults.
- `server/asset-files/selection.ts` — `assertSheetBelongsToCostume` beside
  `assertCandidateBelongsToLook`.
- `server/generation/attachment-destinations.ts` — `cast.character-sheet`
  resolves a costume round; `cast.casting-candidate` rejects costume rounds;
  both return `castingRoundId`; neither returns `selectionTarget`.
- `client/media-attachments.ts` — `cast.character-sheet` target kind
  `castingRound`.
- `server/media-generation-context/purposes/casting.ts` — rename
  `buildCastCostumePurposeContext` to
  `buildCharacterSheetRoundPurposeContext`: resolves round → costume → Look;
  identity references are the round's references plus the Look's cast
  candidate; continuity suggestion lists the costume's kept sheets.
- `server/project-data-service-contracts.ts` and the service — expose
  `showCastingCostume`.

`packages/cli/src/commands/cast-casting-command.ts` — `casting show` accepts
`--look` or `--costume` (exactly one).

`packages/codex/src`:

- `casting-round/contracts.ts` — `CastingRoundSubjectInput`,
  `CastingRound.subject` (`{ kind: 'look'; look }` |
  `{ kind: 'costumes'; look; costumes: CastingRoundCostume[] }`),
  respond `costumeIds`, `saveAsDefaults`, answer `defaultsSaved`, consume
  `subject`.
- `casting-round/subjects.ts` (new) — `readLookRoundSubject`,
  `readCostumesRoundSubject` (one Look, cast, ≥1 costume), and
  `ROUND_SUBJECT_DEFAULTS`, a two-entry record mapping subject kind to the
  saved routes field, detail field, fallback count and copy.
- `casting-round/opening.ts`, `options.ts` (`preselectCastingRoutes` takes
  the fallback count), `tools.ts`, `schemas.ts`.
- `casting-board/contracts.ts`, `sheet-board.ts`, `schemas.ts`,
  `board-requests.ts`, `board-actions.ts`, `opening.ts`.

`packages/studio/src`:

- `features/casting-views/round-kind-labels.ts` (new) —
  `CASTING_ROUND_KIND_LABELS`: choose / chosen words, tile aspect class,
  image noun ("candidate" / "sheet").
- `features/casting-views/candidate-tile.tsx`, `candidate-actions.tsx`,
  `compare-view.tsx` — take `kind: CastingRoundKind`; `CandidateCastAction`
  becomes `CandidateChoiceAction`.
- `features/casting-views/casting-subject-choice.tsx` (new) —
  `CastingSubjectChoice`: a Tabs trigger card with picture (16:9), name, one
  status line, empty state.
  Used by the Studio subject row and the Codex sheet board.
- `features/casting-views/sheet-actions.tsx` — deleted.
- `features/codex-casting-round/casting-round-panel.tsx` — renders
  `CostumeChecklist` when the subject is costumes; labels from subject.
- `features/codex-casting-round/costume-checklist.tsx` (new).
- `features/codex-casting-board/casting-rounds-board.tsx` (new) — the body
  extracted from `candidate-board-view.tsx`: tabs, round sections, preview,
  compare, footer. Props: rounds, chosen asset file id, kind, callbacks.
- `features/codex-casting-board/candidate-board-view.tsx` — thin: header +
  `CastingRoundsBoard`.
- `features/codex-casting-board/sheet-board-view.tsx` — rewritten: header,
  costume card row, `CastingRoundsBoard` for the picked costume.
- `features/codex-casting-board/candidate-preview.tsx`,
  `board-summaries.ts` — kind-aware labels; `sheetRequestSummary` replaced
  by the costume `moreLikeKept` summary.
- `features/movie-studio/cast/casting/casting-subject-picker.tsx` (new) —
  `CastingSubjectPicker`: Casting card + divider + costume cards (Tabs list).
- `features/movie-studio/cast/casting/subject-rounds.tsx` (new) —
  `SubjectRounds`: box header with Compare, `CastingRounds`, hidden toggle,
  compare dialog.
- `features/movie-studio/cast/casting/look-casting.tsx` — thin composition
  of picker, `SubjectRounds` and the one request.
- `features/movie-studio/cast/casting/casting-rounds.tsx`,
  `casting-compare-dialog.tsx`, `casting-summaries.ts` — take rounds +
  chosen id + kind instead of a Look.
- `features/movie-studio/cast/casting/look-scene-bar.tsx` — optional
  `highlightSceneIds`.
- `features/movie-studio/cast/casting/costume-sheets.tsx` — deleted.
- `features/movie-studio/cast/casting/use-cast-casting.ts` — unchanged
  routes; `castCandidate` and `pickCharacterSheet` stay.
- `features/movie-studio/agent-request-copy.ts` —
  `characterSheetRoundRequest(castMemberName, costumeName)` and
  `moreSheetsLikeKeptRequest(castMemberName, costumeName)`;
  `costumeCharacterSheetsRequest` deleted.
- `services/studio-project-contracts.ts`, `server/http/cast-casting-responses.ts`
  — costumes with rounds, no `characterSheets`.

### Bounded branches

- Round kind is a two-value closed vocabulary (`candidates`,
  `characterSheets`) derived from the subject. Branching uses the two small
  records (`ROUND_SUBJECT_DEFAULTS` in codex, `ROUND_SUBJECT_COPY` and
  `CASTING_ROUND_KIND_LABELS` in studio). No `if` chains on kind in views.
- Core subject resolution is one function per subject kind behind
  `resolveCastingRoundSubject`.

### Forbidden shapes

- No React or server check of whether a sheet may be picked for a costume.
- No second round table, second candidate table, or copied round
  components for sheets.
- No `characterSheets` list kept beside costume rounds.
- No reading of provider or model ids beyond echoing routes (ADR 0114).
- No fallback that treats a pick without a round as valid.
- No growth of `candidate-board-view.tsx` or `look-casting.tsx`; both shrink.

### Stop conditions

Stop and revise if `CastingRoundsBoard` or `SubjectRounds` exceeds ~180
lines, if a component starts branching on kind outside the labels record, or
if the panel needs per-costume model choices (a new interaction shape, needs
user approval).

## Contracts

### Tables

`casting_round`: `cast_look_id` nullable, new `cast_costume_id` (nullable,
references `cast_costume.id`), check `(cast_look_id is null) <> (cast_costume_id
is null)`, partial unique indexes per subject. `casting_candidate` unchanged;
rows of costume rounds point at `character_sheet` asset files.

### Core types and documents

```ts
type CastingRoundSubject = { kind: 'castLook'; id: string } | { kind: 'castCostume'; id: string };
type CastingRoundKind = 'candidates' | 'characterSheets';

interface CastingRound { id; subject: CastingRoundSubject; number; routes; maxConcurrentGenerations; referenceAssetFileIds; estimatedCost; createdAt }
interface CastingRoundCreateDocument { kind: 'castingRoundCreate'; subject: CastingRoundSubject; routes; maxConcurrentGenerations; referenceAssetFileIds; estimatedCost }
interface CastingSettings { candidateRoutes; characterSheetRoutes; candidateDetail; characterSheetDetail }
interface CastCastingResource { castMember; scenes; looks; costumes: Array<CastCostume & { rounds: CastingRoundView[] }> }
interface CastWardrobeReport { …; clearedSheetSelections: string[]; releasedSheetAssetFileIds: string[] }
interface CastingCostumeReport { …; costume: CastCostume; rounds: CastingRoundView[] }
function estimateCastingRoundCost(input: { options; routes; detail; roundCount: number }): CastingRoundCostEstimate
```

### Media

`cast.character-sheet` target `{ kind: 'castingRound', id }` of a costume
round; attachment requires `--casting-model` naming a route model key, as
candidates do. `cast.casting-candidate` requires a Look round.

### CLI

- `renku cast casting round create --file round.json` — document with
  `subject`.
- `renku cast casting show --look <id>` | `--costume <id>`.
- `renku settings casting set` — version 10 shape.

### Codex tools

- `casting.round.open { project, subject: { kind: 'look', lookId } | { kind: 'costumes', costumeIds }, brief, notes?, references?, suggested? }`.
  Costumes default references: the Look's cast candidate when `references` is
  omitted.
- `casting.round.respond { panelId, choice: { kind: 'generate', routes, maxConcurrentGenerations, detail, costumeIds? } | { kind: 'canceled' }, saveAsDefaults }`.
- `casting.round.consume` → `{ status: 'generate', panelId, subject: { kind: 'look', lookId } | { kind: 'costumes', costumeIds }, routes, maxConcurrentGenerations, detail, referenceAssetFileIds, estimatedCost }`
  where routes and `estimatedCost` are per round (one costume).
- `casting.board.open { project, mode: 'candidates', lookId } | { project, mode: 'sheets', lookId, costumeId? }`.
- `CastingBoardRequest`: `{ kind: 'moreLikeKept'; subject: CastingRoundSubject; referenceAssetFileIds; notes }`
  | `{ kind: 'cast'; lookId; assetFileId }`.
- `CastingBoardRequestAction`: `{ kind: 'moreLikeKept'; notes; costumeId? }`.

### Studio routes

Unchanged paths. `PUT …/costumes/:costumeId/selected-sheet/:assetFileId`
now fails with `CORE_ASSET_SELECTION_INVALID` for sheets outside the
costume's rounds. `PUT …/casting/candidates/:assetFileId/status` accepts
sheet round rows.

### Diagnostics

| Code | When |
| --- | --- |
| `CASTING_ROUND_LOOK_NOT_CAST` | sheet round for a costume whose Look has no cast candidate |
| `CASTING_COSTUME_LOOK_CHANGE_HAS_SHEETS` | wardrobe plan moves a costume with sheet rounds to another Look |
| `CORE_ASSET_SELECTION_INVALID` | "A costume can only be picked from a sheet of its own rounds." |
| `CODEX_CASTING_ROUND_INVALID` | costumes subject spans Looks, is empty, or `costumeIds` answer not a subset |

## Implementation Slices

1. **Core model and schema.** Subject types, round-kind module, schema
   columns, Drizzle Kit generate 0097, write custom 0098 (guard version 9;
   rename `routes` → `candidateRoutes`, add `characterSheetRoutes: []`,
   version 10; delete `selected_asset_file` rows with `castCostume:` keys),
   access functions, settings shape and defaults. Update all `lookId` round
   callers directly.
2. **Core commands.** Subject resolution, `createCastingRound`,
   `showCastingCostume`, round views by subject, resource projection,
   candidate status via subject, wardrobe removal and Look-change rule,
   selection rule, attachment destinations, purpose context, estimate
   `roundCount`. CLI `casting show --costume`.
3. **Codex runtime.** Round subjects module, opening, options fallback count,
   respond/consume, saving defaults per subject; board sheets projection by
   Look with costume rounds, `moreLikeKept` with subject, delete
   `sheetPicksDone`.
4. **Shared Studio views.** Kind labels, tile/actions/compare by kind,
   `CastingSubjectChoice`, delete `sheet-actions.tsx`.
5. **Codex panels.** Costume checklist and labels in the round panel;
   extract `CastingRoundsBoard`; thin candidate board; rewrite sheet board.
6. **Studio Casting tab.** Subject picker, `SubjectRounds`, thin
   `LookCasting`, generalized rounds/compare/summaries, scene bar highlight,
   request copy, response DTO; delete `costume-sheets.tsx`.
7. **Skills** (studio-skills): `casting-rounds.md` covers both subjects and
   the chat-text round for harnesses without panels; `cast-media-handoff.md`
   and `wardrobe-plan.md` route sheets through sheet rounds, drop `--select`
   on import, describe `releasedSheetAssetFileIds`;
   `media-producer/references/cast-character-sheets.md` attachment targets
   the round with `--casting-model`; `SKILL.md` workflow line.
8. **Big Fish conversion (local, not product code).** Back up
   `~/renku-movies/big-fish/.renku/project.sqlite`; run the upgrade on a
   copy; insert Round 1 for Cave rags and Surplus-tent canvas shirt with the
   worked-example values (model name from the synced Default Model List),
   candidate rows (`status: candidate`, `model_key: chatgpt-images-2.5`),
   and re-select the two picks through `renku asset select`; verify with
   `renku cast casting show --costume` and the Studio page; then replace the
   original. Record the outcome in the final report only.
9. **Docs.** ADR 0127, `data-model-and-storage.md`,
   `domain-vocabulary.md`, `docs/cli/commands.md`,
   `reference/drizzle-migrations.md` migration list.

## Tests And Guardrails

- Core: round create for each subject; subject errors; Look-not-cast error;
  numbering per subject; selection rule for costume (own round passes, other
  costume's sheet and round-less sheet fail before write); wardrobe removal
  deletes rounds and reports released sheets; Look change refused; candidate
  status on a sheet row; resource costumes carry rounds; attachment for each
  purpose rejects the other subject; estimate with `roundCount`; settings v10
  shape; migration 0098 on a v9 fixture (renames, clears costume picks,
  rejects other versions).
- Codex: open with costumes subject (spanning Looks fails, uncast Look fails,
  preselect order with fallback 2), respond subset check, save writes only
  sheet fields, consume shape; sheet board projection per costume, pick via
  core, `moreLikeKept` with costume subject.
- Studio: tile/compare labels by kind; round panel costume checklist and
  per-costume total; sheet board shows only the picked costume's sheets;
  Casting tab default pick table, one request at most, Compare in box header
  only, scene bar highlight; fictional routes only in tests (ADR 0114).
- Architecture: existing import-boundary tests stay; no new name-based
  tests.

## Documentation

- ADR 0127: costumes have character sheet rounds; scoped costume selection
  from own rounds; separate sheet defaults; one panel for several costumes;
  Studio subject row; board sheets mode by Look.
- `docs/architecture/data-model-and-storage.md`,
  `docs/architecture/reference/domain-vocabulary.md` (Character Sheet Round,
  round subject).
- `docs/cli/commands.md` (`casting show --costume`, round document subject).
- Skills as in slice 7.

## Final Verification

- `pnpm build:core`, `pnpm --filter @gorenku/studio-core test`,
  `pnpm --filter @gorenku/studio-codex test`, `pnpm test:cli`,
  `pnpm --filter @gorenku/studio test`, then `pnpm check`.
- Drizzle Kit: generate produces only the planned casting changes; migrate a
  copy of each local project (Big Fish, Sintel, Urban Basilica).
- Real data: Big Fish Karl in Studio
  (`http://localhost:5173/projects/big-fish/cast/cast_gd6yacxh`) matches the
  worked example; build the Codex apps and open the round panel and sheet
  board against Big Fish.
- Shape review: `git diff --stat`; inspect `look-casting.tsx`,
  `candidate-board-view.tsx`, `sheet-board-view.tsx`, `rounds/commands.ts`,
  `attachment-destinations.ts`; no formatting churn.

## Completion Checklist

### Review Area

- [x] Durable rules (subject validity, sheet-to-costume pick, Look cast
      before sheets, costume removal and Look change) live in core only.
- [x] Studio server and CLI handlers stay thin; React sends intent only.
- [x] Final file shape matches the Architecture Shape Gate; no new god file
      or broad dispatcher.
- [x] No model or provider knowledge added outside engines and skills.

### Architecture And Contracts

- [x] `CastingRoundSubject` replaces `lookId` on rounds; all callers updated,
      no aliases.
- [x] Settings version 10: `candidateRoutes`, `characterSheetRoutes`; no
      reader of `routes` remains.
- [x] `CastCastingResource.characterSheets` removed; costumes carry rounds.
- [x] `cast.character-sheet` targets a costume round; attach never picks.
- [x] `sheetPicksDone` and "Send picks to agent" removed.
- [x] New diagnostics structured with suggestions.

### Implementation Slices

- [x] Slice 1 schema, generated 0097, custom 0098 with header.
- [x] Slice 2 core commands, selection rule, attachments, context, estimate,
      CLI.
- [x] Slice 3 Codex runtime subjects, defaults per subject, board by Look.
- [x] Slice 4 shared views by kind, `CastingSubjectChoice`,
      `sheet-actions.tsx` deleted.
- [x] Slice 5 round panel checklist; `CastingRoundsBoard` extracted; sheet
      board rewritten.
- [x] Slice 6 Studio subject row, `SubjectRounds`, scene bar highlight,
      request copy; `costume-sheets.tsx` deleted.
- [x] Slice 7 skills updated in studio-skills.
- [x] Slice 8 Big Fish converted from a backup-verified copy.
- [x] Slice 9 docs updated.

### Tests And Guardrails

- [x] Core, Codex, CLI and Studio tests listed above added or updated.
- [x] Migration test on a version 9 fixture.
- [x] Panel tests use fictional routes.

### Documentation

- [x] ADR 0127, data model, vocabulary, CLI docs updated.
- [x] Historical plans untouched.

### Final Verification

- [x] Focused package tests and `pnpm check` pass.
- [x] Local projects migrate on copies; Big Fish matches the worked example.
- [ ] Codex panel and board checked against Big Fish (needs the Codex Renku server restarted on the new build).
- [x] `git diff --stat` and large-file inspection done; no formatting churn.
- [x] No checklist item satisfied by accepting unreviewable structure.
