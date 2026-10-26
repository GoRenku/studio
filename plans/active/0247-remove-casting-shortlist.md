# 0247 Remove The Casting Shortlist

Status: implemented
Date: 2026-10-25

Related: [ADR 0127](../../docs/decisions/0127-cast-looks-costumes-and-casting-rounds.md),
plan 0242 (casting rounds), plan 0246 (Casting tab one Look at a time).

## Decisions

The user decided on 2026-10-25:

1. The shortlist is removed everywhere. A candidate is either kept or hidden;
   Hide is the only mark the director makes. Hidden candidates leave the
   default views so they stop cluttering the screen.
2. Compare has no "favorite". It is two equal sides: leave one side where it
   is (the anchor) and step the other through the remaining candidates. Each
   side has its own Cast and Hide. Zoom floats over the pictures as in the
   image viewer. The thumbnail strip and "Make favorite", "Cast favorite" and
   "Remove" go.
3. Nothing has shipped, so there is no migration file. The one local project
   with casting data (Big Fish) is fixed directly.

4. "More like these" sends every kept candidate of the Look (decided on the
   review page).
5. Hidden candidates are never deleted. Studio's "Show N hidden" and the
   Codex "Hidden" tab bring them back in place, where each can be shown
   again or cast directly. The cast candidate always shows, even if it was
   hidden.

## Review Attention

- **Beyond the literal request, and why:**
  - "More like the shortlist" must be replaced, because the agent needs
    reference candidates for the next round. It becomes "More like these",
    sending the Look's kept candidates.
  - The Codex board's "Cast this Look" footer button goes: it only worked
    with exactly one starred candidate, and Cast is now on every tile, the
    viewer and both Compare sides.
  - Studio collapses hidden candidates behind a quiet "N hidden" button per
    Look so they can still be shown again.
- **Changed contracts:**
  - Core `CASTING_CANDIDATE_STATUSES` and the `casting_candidate.status`
    Drizzle enum become `candidate | hidden`.
  - CLI `renku cast casting candidate status --status candidate|hidden`.
  - Codex `casting.board.act` drops `shortlist`; `casting.board.request`
    kind `moreLikeShortlist` becomes `moreLikeKept`; the consumed request is
    `{ kind: 'moreLikeKept', lookId, referenceAssetFileIds, notes }`.
- **Data:** Big Fish's `.renku/project.sqlite` gets one `UPDATE` turning its 9
  `shortlisted` candidates into `candidate`, after a file copy backup. No
  Drizzle migration and no `user_version` change: the column is plain text
  with no database constraint, so the schema shape is unchanged.
- **Other repository:** `studio-skills` casting-director `SKILL.md` and
  `references/casting-rounds.md` are updated to the new words and request.
- **Deliberately unchanged:** casting rounds, references, cast selection,
  sheets mode of the board, the notes field, the round panel.

## Summary

The shortlist made the director star candidates before Compare would show
them, then press "Make favorite" and "Cast favorite" to cast. Hide already
removes candidates the director doesn't want. After this plan a candidate is
kept or hidden, Compare walks the kept ones with Cast on each side, and the
next round's references are the kept candidates.

## Product Behavior

### Statuses

`candidate` (kept) and `hidden`. Restoring a hidden candidate sets
`candidate`. Casting a hidden candidate is allowed and leaves its status as
is; views treat the cast candidate as shown (kept views list a candidate when
it is not hidden or is the cast one).

### Tiles (Studio and Codex)

At rest: the picture; green ring and "✓ Cast" on the cast one. On hover or
keyboard focus: model name, Hide (eye-off; "Show again" with an eye on a
hidden one) and Cast. No star anywhere.

### Image viewer

Close alone top right. Zoom pill: `− Fit + 100% │ Hide  Cast` (or
`Show again`, `✓ Cast`).

### Compare (shared)

- Steps through the Look's kept candidates. Needs at least two.
- Two equal sides, each with a 40px header: `‹ 2 of 5 ›` centered, Hide
  (eye-off icon button, "Hide") and Cast (or "✓ Cast") on the right.
- Each side's arrows skip the candidate the other side shows. ← → step the
  right side.
- Hiding a side's candidate moves that side to the next kept one; if fewer
  than two remain, Compare closes (Studio) or returns to the board (Codex).
- Zoom: floating pill at the bottom center over both pictures, linked.
- Layout: side by side or stacked, chosen automatically as today.

### Studio Casting tab

- Look status: "✓ Cast", "5 candidates" (kept count) or "Not cast".
- Look header: name, scene count, `Compare 5` when ≥2 kept.
- Rounds show kept candidates only. Under the rounds, a quiet
  `Show 2 hidden` / `Hide 2 hidden` text button when the Look has hidden
  ones; shown hidden tiles are dimmed with "Show again".
- Request line while not cast and ≥1 kept: "Run another casting round for
  Edward Bloom · Young adult — 18–30s like the candidates I kept."

### Codex casting board

- Tabs: `Candidates N` (kept plus generating tiles) and `Hidden N`.
- Footer: notes, `Compare N` / `Back to board`, `More like these`
  (enabled with ≥1 kept). "Cast this Look" is gone.

## Worked Example: Big Fish

Before, `casting_candidate` holds 18 `candidate` and 9 `shortlisted` rows.
After the fix: 27 `candidate`, 0 `hidden`. Edward Bloom · Young adult shows
"✓ Cast" and `Compare 5`; Compare opens with FLUX 3 on the left and Seedream
5.0 Pro (✓ Cast) on the right.

## Architecture Shape Gate

- **Core** (`packages/core`): `client/casting/model.ts` statuses;
  `server/schema/casting.ts` enum; `server/casting/rounds/commands.ts`
  suggestion text; `media-generation-context/purposes/casting.ts` comment.
  The status rule stays in core.
- **CLI** (`packages/cli`): help text and suggestion only; still reads
  `CASTING_CANDIDATE_STATUSES` from core.
- **Server** (`packages/studio/server/http/casting-candidate-status-request.ts`):
  suggestion text only.
- **Codex board tiles** gain Cast, matching Studio, since "Cast this Look"
  is gone.
- **Codex** (`packages/codex/src/casting-board`): `contracts.ts`,
  `schemas.ts`, `board-actions.ts` handler tables, `candidate-actions.ts`
  (`requestMoreLikeKept` replaces `requestMoreLikeShortlist`), `tools.ts` and
  `opening.ts` descriptions; `casting-round/schemas.ts` reference description.
- **Studio app**:
  - `casting-views/candidate-actions.tsx`: `CandidateHideToggle` replaces
    `CandidateStatusToggles`; `CandidatePreviewActions` drops shortlist.
  - `casting-views/candidate-tile.tsx`: drops `onShortlist` and the star.
  - `casting-views/compare-view.tsx`: two `CompareSide` panes with their own
    index state; local `ComparePaneHeader`; floating zoom. Stays under ~230
    lines; split the pane header into its own file if it grows past that.
  - `codex-casting-board/board-summaries.ts`: tabs `candidates | hidden`.
  - `codex-casting-board/candidate-board-view.tsx`: footer and Compare wiring.
  - `movie-studio/cast/casting/*`: `casting-summaries.ts` (`lookKept`
    replaces `lookShortlist`; `lookStatus`), `casting-rounds.tsx` (kept
    tiles, hidden toggle), `look-casting.tsx`, `casting-compare-dialog.tsx`.
  - `movie-studio/agent-request-copy.ts`: `moreLikeKeptRequest` replaces
    `moreLikeShortlistRequest`.
- **Forbidden:** keeping `shortlisted` as an alias or read-time mapping; any
  code that recognizes the old value; model ids in panels; raw controls.

## Implementation Slices

1. Core, CLI, server text, Codex contracts and handlers, with their tests.
2. Shared tiles, viewer actions and Compare.
3. Codex board view and Studio Casting tab.
4. Docs: ADR 0127, domain vocabulary, CLI commands; studio-skills
   casting-director.
5. Big Fish: copy `.renku/project.sqlite` to the scratchpad, run the one
   `UPDATE`, confirm counts.
6. Rebuild the Codex panels (`pnpm --filter @gorenku/studio build:codex`) so
   the extension shows the new UI.

## Tests And Guardrails

- Core casting tests: `candidate` and `hidden` save; an unknown status is
  refused with `CASTING_CANDIDATE_STATUS_INVALID` (no test names the removed
  value).
- Codex casting board tests: `shortlist` act refused by the schema;
  `moreLikeKept` carries every kept candidate and refuses when all are hidden.
- Server route and Studio API tests use `candidate | hidden`.
- Studio tests: tiles have no shortlist control; viewer pill has Hide and
  Cast; Compare steps both sides, skips the other side's candidate, casts
  and hides per side; Studio hidden toggle; Codex board tabs and footer.

## Final Verification

- `pnpm build:core`, `pnpm --filter @gorenku/studio-core test`,
  `pnpm --filter @gorenku/studio-codex test`, `pnpm test:cli`,
  `pnpm --filter @gorenku/studio lint`, Studio typecheck and
  `pnpm --filter @gorenku/studio test`.
- Browser on Big Fish Edward Bloom; Codex Compare through a throwaway page.
- `grep -ri shortlist packages docs/decisions docs/architecture docs/cli`
  returns nothing outside historical plans.
- `git diff --stat` and full diff review.

## Completion Checklist

### Review Area

- [x] Status rule still owned by core; adapters only echo it.
- [x] No alias, mapping or diagnostic for the removed value.
- [x] `compare-view.tsx` stays reviewable.

### Implementation Slices

- [x] Slice 1 core, CLI, server, Codex contracts.
- [x] Slice 2 tiles, viewer, Compare.
- [x] Slice 3 Codex board and Studio tab.
- [x] Slice 4 docs and studio-skills.
- [x] Slice 5 Big Fish fixed, backup kept.
- [x] Slice 6 Codex panels rebuilt.

### Tests

- [x] Tests listed above pass; full Studio, core, codex and CLI suites pass.

### Final Verification

- [x] Lint and typecheck clean.
- [x] Browser checks done.
- [x] No `shortlist` left in current code or docs.
- [x] Diff reviewed for churn.
