# 0246 Casting Tab: One Look At A Time

Status: implemented
Date: 2026-10-25

Related: [ADR 0127](../../docs/decisions/0127-cast-looks-costumes-and-casting-rounds.md),
plan 0242 (casting rounds, Looks and wardrobe), plan 0241 (guided empty
states, `AgentRequest`).

## Decisions

The user approved these on 2026-10-25 from the "Casting tab cleanup" proposal
page:

1. The Studio Casting tab shows one Look at a time, picked from a row of
   Look cards.
2. One "Ask your agent" card on screen at a time; optional follow-ups are a
   quiet copy line.
3. Candidate tiles show their controls only on hover or keyboard focus.
4. Compare comes to Studio, sharing one Compare view with the Codex casting
   board.

5. In the image viewer, Close stays alone in the top-right corner and the
   candidate buttons (Shortlist, Hide, Cast; Pick for sheets) join the
   floating zoom pill. The user chose this over a bar under the picture.
   Viewers without buttons stay as they are.

## Review Attention

- **Beyond the literal request, and why:**
  - Two more Look colors (`lookD`, `lookE`). Today colors repeat after the
    third Look, so Edward Bloom's five Looks share colors; the approved mockup
    shows five distinct colors. The Codex Looks panel picks these up too.
  - `OverlayIconButton` is deleted: its only caller, Compare, moves its
    buttons into the bottom bar.
  - `wardrobeBands`, `lookDetails` and the costume band of the wardrobe strip
    are deleted from the Studio tab. Each costume row keeps its own scene
    list.
- **Changed shared UI:** `CandidateTile`, `CandidateStatusToggles`,
  `CandidateCastAction`, `CandidatePreviewActions`, `ImagePreviewDialog`
  (`actions` move into the zoom pill), `ImageZoomControls` (optional
  trailing `children`) and the moved `CompareView`. Each
  change also shows in the Codex casting board.
- **No** core, server route, CLI, schema, migration, Settings or diagnostic
  changes. Durable writes keep using the existing casting routes.
- **Deliberately unchanged:** the Codex board's footer (notes, Back to board,
  More like the shortlist, Cast this Look), the Codex wardrobe panels'
  `SceneStrip` and `LookCard`, the whole-tab empty state when a Cast Member
  has no Looks, and image viewers without buttons.
- **Uncommitted work this plan builds on:** `compare-arrangement.ts` and its
  test from earlier today are not committed; slice 1 moves them.

## Summary

Edward Bloom's Casting tab (Big Fish) shows five Look cards with full scene
lists, a 202-column strip with clipped Look names, six "Ask your agent"
cards, a round line naming every model, tiles with up to five controls each,
and a Character sheets section that cannot be acted on yet. The image viewer
puts ☆, ✕ (hide), Cast and ✕ (close) side by side. Compare exists only in the
Codex panel.

After this plan:

- a Look picker row (picture, name, one status) chooses the Look;
- a thin, text-free scene bar lights up the picked Look's scenes;
- the picked Look shows its rounds, a Compare button, and its costumes;
- at most one `AgentRequest` card is on screen;
- tiles are quiet at rest;
- the candidate and sheet viewers keep Close alone and put their buttons in
  the zoom pill;
- Studio opens the same Compare view as the Codex board.

## Context

- ADR 0127 describes the Casting tab and the Codex board's Compare.
- Plan 0242 "Studio Casting tab" lists the old layout; ADR 0127 is the doc
  to update.
- `AgentRequest`, `AgentRequestLine` and `AgentRequestHint` live in
  `packages/studio/src/ui/agent-request.tsx` (plan 0241).
- Real data: `~/renku-movies/big-fish`, Cast Member Edward Bloom
  (`cast_8q9yhq9c`), served by the user's dev server at
  `http://localhost:5173/projects/big-fish/cast/cast_8q9yhq9c`.

## Product Behavior

### Look picker

A `Tabs` list of Look cards in Look order. Each card: the cast candidate's
picture or a person placeholder, a color dot, the Look name, and one status:

| Look state | Status |
| --- | --- |
| a candidate is cast | `✓ Cast` (green) |
| not cast, ≥1 shortlisted | `3 shortlisted` |
| not cast, rounds but no shortlist | `5 candidates` |
| no rounds | `Not cast` |

Default pick: the first Look with at least one round, else the first Look.
The pick lives in component state and resets when the page reloads.

### Scene bar

One row, one cell per scene in screenplay order, colored by the Look that
covers it; empty scenes stay neutral. Cells of other Looks are dimmed to
about 30% opacity. Each cell's `title` reads `Scene 46 · Young adult — 18–30s`.
Tick labels under the bar: the first scene, every 50th, and the last.

### Picked Look

- **Header:** Look name, `73 scenes`, and `Compare N` (outline button) when
  the Look has ≥2 shortlisted candidates.
- **Rounds:** each round line reads `Round 1 · 5 of 6 · $0.16` (or
  `Round 2 · 6 candidates` with no estimate), then its tile grid.
- **Requests, exactly one card at most:**

| Picked Look state | Shown |
| --- | --- |
| no rounds | panel "No casting rounds yet" + `AgentRequest` "Run a casting round for Edward Bloom · Newborn." |
| rounds, not cast, ≥1 shortlisted | `AgentRequestLine` "Run another casting round … like the shortlisted candidates." |
| rounds, not cast, no shortlist | nothing |
| cast, Look has no costumes | Costumes: `AgentRequest` "Plan Edward Bloom's wardrobe." |
| cast, costumes, no character sheets | Costumes: `AgentRequest` "Make Edward Bloom's character sheets." above the rows |
| cast, costumes and sheets | Costumes rows only |

- **Costumes** (only when the Look is cast): the Look's costumes only, each
  with its scene list and every character sheet to pick from, as today.

### Candidate tile (Studio and Codex board)

- At rest: picture only. Shortlisted: gold ring and a filled star.
  Cast: green ring and a `✓ Cast` chip. Hidden: dimmed.
- On hover or focus-within: a dark gradient bar along the bottom with the
  model name, ☆ shortlist, hide (eye-off icon; "Show again" uses an eye
  icon), and the `Cast` button (not on the cast candidate).
- Pending tiles are unchanged.

### Image viewer with buttons

When `ImagePreviewDialog` gets `actions`:

- Top right: Close only.
- The actions render inside the floating zoom pill at the bottom center,
  after a thin divider: `− Fit + 100% │ ☆ Shortlist  Hide  Cast`.
- Candidate actions are labeled: `Shortlist` / `Shortlisted`, `Hide` /
  `Show again` (eye-off / eye icons), `Cast` / `✓ Cast`. Sheets show
  `Pick` / `Picked`.
- When zoom is switched off for a screen, the actions sit in the same
  floating pill on their own.

Viewers without `actions` stay exactly as they are.

### Compare (shared)

- The favorite on one side, one challenger at a time on the other, shared
  zoom, automatic side-by-side or stacked layout, and the collapsible
  shortlist strip, as today.
- The per-side Cast buttons and the ☆/✕ over the challenger go. One bar
  under the pictures: left the `Shortlist N ▾` strip toggle, center zoom,
  right `Make favorite`, `Remove` (challenger) and `Cast favorite` (or
  `✓ Cast` when the favorite is the cast candidate).
- Colors use Studio's tokens, like the tiles already do in the Codex panel.
- **Codex board:** opens inline from the existing `Compare N` footer button.
- **Studio:** `Compare N` in the Look header opens a large dialog
  (`Compare · Young adult — 18–30s`, Close top right) holding the same view.
  Cast and Remove call the existing Studio casting routes.

## Worked Example: Edward Bloom (Big Fish)

| Look | Rounds | Status card | Picked-Look request |
| --- | --- | --- | --- |
| Newborn | 0 | Not cast | card: "Run a casting round for Edward Bloom · Newborn." |
| Child — about 10–13 | 0 | Not cast | card: "Run a casting round for Edward Bloom · Child — about 10–13." |
| Young adult — 18–30s | 1 (5 of 6, $0.16) | ✓ Cast (Seedream 5.0 Pro) | Costumes card: "Plan Edward Bloom's wardrobe." |
| Middle-aged father — about 40–50s | 0 | Not cast | card: "Run a casting round … Middle-aged father — about 40–50s." |
| Older Edward — about 58–61 | 0 | Not cast | card: "Run a casting round … Older Edward — about 58–61." |

Default pick: Young adult (the only Look with a round). Today the page shows
six request cards; after, it shows one.

## Architecture Shape Gate

All changes are `packages/studio` React and UI code. Durable state is
unchanged and still written only through the existing casting services and
routes, which call core.

### Ownership and files

`packages/studio/src/features/casting-views/` (shared by Studio and Codex):

- `candidate-tile.tsx` — `CandidateTile`: rest and hover layers.
- `candidate-actions.tsx` — `CandidateStatusToggles` (eye-off hide),
  `CandidateCastAction` (`✓ Cast` marker), `CandidatePreviewActions`
  (labeled viewer buttons). `OverlayIconButton` deleted.
- `compare-view.tsx` — moved from `codex-casting-board/`. Owns favorite and
  challenger state, area measurement, keyboard stepping, the grid, the bar
  and the strip. Takes resolved URLs; no media loading.
- `compare-arrangement.ts` and `compare-arrangement.test.ts` — moved
  unchanged.
- `casting-tones.ts` — adds `lookD`, `lookE`.

`packages/studio/src/ui/`:

- `image-zoom-controls.tsx` — `ImageZoomControls` takes optional
  `children`, drawn after a divider inside the same pill.
- `image-preview-dialog.tsx` — passes `actions` into the zoom pill instead
  of the top-right corner. No new exported component.

`packages/studio/src/features/movie-studio/cast/casting/`:

- `cast-member-casting-tab.tsx` — loads the resource, holds the picked Look
  id, renders `Tabs` with `LookPicker`, `LookSceneBar` and the picked
  `LookCasting`. Stays thin.
- `look-picker.tsx` (new) — `LookPicker`: the `TabsList` of Look cards.
- `look-scene-bar.tsx` (new) — `LookSceneBar` and its local tick helper.
- `look-casting.tsx` (new) — `LookCasting`: header, rounds or the empty
  panel, the request rules, `CastingCompareDialog`, and `CostumeSheets`.
- `casting-rounds.tsx` — `CastingRounds` lists rounds without its own
  section heading or request; `CastingRound` keeps the grid and viewer.
- `casting-compare-dialog.tsx` (new) — `CastingCompareDialog`: `Dialog`
  around the shared `CompareView`.
- `costume-sheets.tsx` — takes the picked Look's costumes; heading
  "Costumes"; the two request cards.
- `casting-summaries.ts` — `roundSummary` (shorter), new `lookStatus`,
  `lookShortlist` and `defaultPickedLook`; `wardrobeBands`, `lookDetails`,
  `castingLine` and the exported `formatEstimatedCost` deleted.

`packages/studio/src/features/codex-casting-board/`:

- `candidate-board-view.tsx` — resolves shortlist URLs with
  `usePanelMediaUrls` and maps them to `CompareCandidate`.
- `compare-view.tsx`, `compare-arrangement.ts`, test — removed (moved).

### Bounded branches

- The request rule is one small function in `look-casting.tsx` that maps the
  picked Look's state to one of the table's outcomes; no nested ternaries.
- `lookStatus` returns `{ label, cast }` from four ordered checks.
- The Compare bar's right side picks `Cast favorite` or the `✓ Cast` marker
  through `CandidateCastAction`, as today.

### Forbidden shapes

- No raw `<button>`/`<input>`; use `Button`, `Tabs`, `Dialog`.
- No casting rules in `ui/`; `ImagePreviewDialog` only lays out the slot it
  is given.
- No media loading inside `CompareView`; callers pass URLs.
- No per-surface copies of Compare; Studio and Codex use the one view.
- No `--dd-*` tokens in `casting-views/`.
- No model ids or provider names in code; model names come from data.

### Stop conditions

- `cast-member-casting-tab.tsx` grows past orchestration (request rules,
  round rendering or compare state inside it).
- `compare-view.tsx` passes ~230 lines; split the bar or strip into local
  components in the same file first, then into sibling files.
- `ImagePreviewDialog` needs a casting-specific prop.

## Contracts

```ts
// casting-views/compare-view.tsx
export interface CompareCandidate {
  assetFileId: string;
  imageUrl: string | undefined;
  /** "Round 1 · FLUX 3": the alt text and the strip button label. */
  label: string;
}
export function CompareView(input: {
  candidates: CompareCandidate[];
  castAssetFileId: string | null;
  disabled: boolean;
  castDisabled: boolean;
  onCast: (assetFileId: string) => void;
  onRemoveFromShortlist: (assetFileId: string) => void;
}): JSX.Element | null;

// casting-views/candidate-actions.tsx
export function CandidatePreviewActions(input: {
  status: CastingCandidateStatus;
  isCast: boolean;
  disabled?: boolean;
  castDisabled?: boolean;
  onShortlist: () => void;
  onHide: () => void;
  onCast?: () => void;
}): JSX.Element; // labeled buttons for the zoom pill

// casting-views/casting-tones.ts
export type CastingTone = 'lookA' | 'lookB' | 'lookC' | 'lookD' | 'lookE' | 'costume';

// movie-studio/cast/casting/casting-summaries.ts
export interface LookStatus { label: string; cast: boolean }
export function lookStatus(look: CastCastingLookResponse): LookStatus;
export function lookShortlist(look: CastCastingLookResponse): CastingRoundViewResponse['candidates'];
export function defaultPickedLook(looks: CastCastingLookResponse[]): CastCastingLookResponse | undefined;
export function roundSummary(round: CastingRoundViewResponse): string;

// movie-studio/cast/casting/look-picker.tsx
export function LookPicker(input: { looks: CastCastingLookResponse[] }): JSX.Element;

// movie-studio/cast/casting/look-scene-bar.tsx
export function LookSceneBar(input: {
  scenes: SceneStripScene[];
  looks: CastCastingLookResponse[];
  pickedLookId: string;
}): JSX.Element;

// movie-studio/cast/casting/look-casting.tsx
export function LookCasting(input: {
  castMemberName: string;
  look: CastCastingLookResponse;
  costumes: CastCastingResourceResponse['costumes'];
  characterSheets: StudioAssetFileResponse[];
  scenes: SceneStripScene[];
  pendingAssetFileId: string | null;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onCast: (lookId: string, assetFileId: string) => void;
  onPickSheet: (costumeId: string, assetFileId: string) => void;
}): JSX.Element;

// movie-studio/cast/casting/casting-compare-dialog.tsx
export function CastingCompareDialog(input: {
  look: CastCastingLookResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAssetFileId: string | null;
  onCast: (assetFileId: string) => void;
  onRemoveFromShortlist: (assetFileId: string) => void;
}): JSX.Element;
```

`ImagePreviewDialog` props are unchanged; `actions` now renders in the zoom
pill. `ImageZoomControls` gains `children?: ReactNode`.
No HTTP, CLI, core, schema or Codex tool contract changes.

## Implementation Slices

1. **Shared Compare.** Move `compare-view.tsx`, `compare-arrangement.ts`
   and its test into `casting-views/`. Switch `CompareView` to
   `CompareCandidate` with URLs and Studio tokens. Replace the per-side Cast
   buttons and overlay buttons with the bottom bar. Delete
   `OverlayIconButton`. Update `candidate-board-view.tsx` to resolve URLs.
   Update the Codex board tests.
2. **Viewer pill.** `ImageZoomControls` takes trailing `children`;
   `ImagePreviewDialog` passes `actions` there and keeps Close alone.
   Labeled `CandidatePreviewActions`; `PickSheetAction` unchanged. Update `image-preview-dialog.test.tsx`.
3. **Quiet tiles.** `CandidateTile` rest and hover layers, eye-off hide,
   `✓ Cast` marker. Update `candidate-tile.test.tsx`.
4. **Look colors.** Add `lookD`, `lookE` with two more tone classes.
5. **Casting tab.** `LookPicker`, `LookSceneBar`, `LookCasting`,
   `CastingCompareDialog`; slim `CastingRounds`; `CostumeSheets` per Look;
   summaries cleanup. Rewrite `cast-member-casting-tab.test.tsx` for the new
   behavior.
6. **Docs.** ADR 0127: the Studio Casting tab's one-Look layout, the
   one-request rule, and Compare in Studio sharing the board's view.

## Tests And Guardrails

- `compare-arrangement.test.ts` — moved, unchanged.
- `casting-board-panel.test.tsx` — Compare still steps, switches favorite,
  removes, casts the favorite from the bar, folds the strip, keeps zoom.
- `image-preview-dialog.test.tsx` — with actions: Close is the only top
  button and the actions sit inside the zoom toolbar; without actions:
  the zoom toolbar is unchanged.
- `candidate-tile.test.tsx` — hide button labeled "Hide", marker reads
  "Cast" with the check, callbacks still fire.
- `cast-member-casting-tab.test.tsx`:
  - default pick is the first Look with rounds;
  - picking another Look shows its rounds or empty panel;
  - at most one "Ask your agent" card in every state of the request table;
  - Costumes hidden until the Look is cast, then filtered to that Look;
  - `Compare 2` appears with two shortlisted, opens the dialog, casts the
    favorite and removes a challenger through the Studio routes;
  - existing shortlist, hide, cast, sheet pick and failure tests keep
    passing in the new layout.
- No new architecture tests; the import boundary (no media loading or
  `codex-panels` imports inside `casting-views/compare-view.tsx`) is covered
  by review.

## Documentation

- ADR 0127: update the Studio Casting tab and Compare descriptions.
- Do not edit plan 0242.

## Final Verification

- `pnpm --filter @gorenku/studio lint`
- `pnpm --filter @gorenku/studio exec tsc -p tsconfig.app.json --noEmit`
- `pnpm --filter @gorenku/studio test`
- Browser at desktop size on the user's dev server: Edward Bloom Casting tab
  (default Look, switching Looks, scene bar hover, one request card, hover
  tiles, viewer pill, Studio Compare). Codex board Compare through a
  throwaway page in the git-ignored `packages/studio/tmp/`, deleted after.
- `git diff --stat`; read the full diff for formatting churn.

## Completion Checklist

### Review Area

- [x] Only `packages/studio` React/UI code and ADR 0127 changed.
- [x] No casting rule in `ui/`, server, or core changed.
- [x] File shape matches the Architecture Shape Gate.
- [x] No god file: `cast-member-casting-tab.tsx` only orchestrates.

### Architecture And Contracts

- [x] `CompareView` takes `CompareCandidate` with URLs; no media loading.
- [x] No `--dd-*` tokens in `casting-views/`.
- [x] `OverlayIconButton`, `wardrobeBands`, `lookDetails`, `castingLine`
      deleted with no aliases.
- [x] `ImagePreviewDialog` props unchanged.

### Implementation Slices

- [x] Slice 1 shared Compare, Codex board updated.
- [x] Slice 2 viewer pill with Close alone and labeled actions.
- [x] Slice 3 quiet tiles with hover and focus-within layer.
- [x] Slice 4 five Look colors.
- [x] Slice 5 Look picker, scene bar, picked Look, Studio Compare, Costumes
      per Look, one-request rule.
- [x] Slice 6 ADR 0127 updated.

### UI

- [x] Only local `src/ui` controls in feature code.
- [x] No invented copy beyond the strings in Product Behavior.
- [x] Tile controls reachable by keyboard (focus-within).

### Tests

- [x] Tests listed above added or updated and passing.
- [x] Full Studio test suite passing.

### Final Verification

- [x] Lint, typecheck and tests pass.
- [x] Browser checks done on Big Fish and the Codex Compare page.
- [x] Throwaway page deleted.
- [x] `git diff --stat` and full diff reviewed; no formatting churn; large
      files inspected.
