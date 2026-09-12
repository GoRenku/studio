# 0204 Raw Clip Review And Selection

Status: implemented (accepted 2026-09-11)
Date: 2026-09-11

## Summary

Represent ordered raw generated clips for a Previs revision, with alternative
takes, explicit selection and optional source-take attribution. Review the chosen clips
continuously in the Generation monitor. Give Previs and Generation independent
transports, with optional linked elapsed-time playback. Use compact stable labels
such as **Clip 1.1: Initial** and **Clip 1.2: Corrected speakers and drawing**.
The agent can resolve “Use Clip 1.1” directly from the active plan/revision.

This is the Core/CLI/UI companion to
[0203](0203-complete-scene-generation-across-model-limits.md). This
contract supplies the commands referenced by 0203's completed guidance. Neither plan introduces a post-production
editor; the raw outputs will be edited in external tools such as DaVinci.

## Review Attention

Implementation contract refinements: mutations return the refreshed `ShotPlanClips`
report with Project/resource keys, rather than only the changed row. The report
also carries source-attribution display context (source plan title, revision,
clip/take numbers and current selection). Selection/title HTTP routes address the
stable clip/take identity directly; Core resolves its owning revision. These are
projection/adapter details, not added generation rules or editing features.


- Add first-class clip positions and numbered takes scoped to an exact Previs
  revision. A take refers to one whole existing video AssetFile. It has no trim
  range, speed, transition, effect or authored start offset.
- Core allocates stable positive clip/take numbers. Display `Clip N.M` with an
  optional short authored title after `: `. Titles do not establish identity.
  Numbers remain reserved and are not renumbered or reused after discard.
- Browsing is transient; **Use this take** persists the clip's selection.
  **Selected** identifies that choice. There is no “Final” or approval status.
- Optionally record a source take for human/agent attribution. Core does not require
  the preceding clip, the same revision, a final frame or any generation reference.
  Actual generation inputs remain in existing provenance. A changed selection may
  produce an informational comparison, never invalidation or regeneration.
- Two progress bars, unlinked by default. Generation boundaries use actual whole
  clip durations. Linking affects play/pause/seek, never playback speed or content.
- New focused Core commands, CLI/HTTP adapters, schema tables and a Drizzle Kit
  migration are required. They are explicitly authorized product scope, unlike
  a generic sequence editor, asset lineage framework or generation scheduler.
- Existing Assets/files/provenance/revision history remain intact. Existing videos
  without a clip assignment remain available as unassigned candidates; never infer
  clip/take grouping from “Clip 1” titles or creation dates. No automatic sample
  reassignment, media regeneration, file moves, deletion or plugin release.
- No generation pricing, provider Settings, configuration or approval-flow changes.
  No semantic speech/visual validation. Previs timing fidelity is optional unless
  the user explicitly locks timing; voice/mouth sync and complete words are separate.

## Requirements And Evidence

| Requirement | Accepted direction | Owning slice |
| --- | --- | --- |
| Raw clip boundaries in progress bar | User point 1 | UI playback |
| No editing/post-processing controls | User point 2 | All |
| Short meaningful labels, no “Shot Plan Video” title | User points 3/4 and latest `Clip 1.1` naming | Core projection and take controls |
| Exact agent-readable selection and source-take attribution | User point 4 | Core metadata; skills interpret generation inputs |
| Separate transports and optional linking without stretching | User point 5 | UI transport |
| Preserve usable timing differences | User point 5 | UI and plan 0203 |

Current `packages/core/src/client/shot-plan-previs.ts` exposes flat
`PrevisRevision.generations: Asset[]`. `server/shot-plan-previs/generation-source.ts`
lists those Assets by creation time. The UI's `previs/monitor.tsx` renders their
titles in one selector, without clip grouping or persistent take selection.
`previs/use-previs-playback.ts` uses Previs as a single clock and repeatedly seeks
Generation toward that time. These are the exact owners to change.

Reuse existing `asset`/`asset_file` records and measured `durationSeconds`,
generation provenance, discard lifecycle, structured diagnostics and domain context.
`selected_asset` currently represents canonical display selections through
`assets/selection-targets.ts`; do not add a Project-wide video selection there.
This new choice belongs to one clip and selects a take, not a Project representative.

Constraints: ADRs 0041 (opaque creative content), 0090 (audio Takes), 0094–0096
(retained Previs and monitor); `docs/architecture/naming-guidelines.md`,
`reference/front-end-guidelines.md`, `coding-practices.md`,
`drizzle-first-project-data.md` and `reference/drizzle-migrations.md`.
Plans 0200–0202 are implemented foundations; leave their history unchanged.
Use the supplied desktop screenshots as layout evidence and Urban Basilica for
read-only context. Do not infer clip identity from the screenshot's titles.

## Product Behavior

### Clips, takes and labels

Each Previs revision has an ordered list of clips. Clip order is append-only in
this slice; there are no drag-reorder or editing controls. Pending clips can exist
before media arrives. Each clip has zero or more takes and zero or one selected
take. Clip 1.2 means take 2 of clip 1, not a decimal number or an Asset filename.
Use integer-pair parsing so Clip 1.10 is distinct from Clip 1.1.

The revision and Shot Plan provide scope. When the active context is unambiguous,
“Use Clip 1.1” suffices. Otherwise the agent must resolve the intended plan/revision
before selection; never search all projects by title. Core resolves exact numbers.

Use one punctuation style: `Clip 1.1: Initial`. With no meaningful authored title,
show only `Clip 1.1`. New take registration accepts a short optional `title` such
as “Corrected speakers and drawing”; it does not repeat the clip number, duration,
provider category or change log. This title is owned by the take, not copied into
an Asset mirror. Asset titles/provenance remain available in existing inspection.

### Inspecting and choosing

Click a generation-bar segment to seek into its clip and make it the inspected
clip. The compact take selector in the Generation header lists numbered takes
and existing unassigned videos together, without a second controls row. Browsing another
take pauses Generation and auditions that whole file from zero; it does not
change the chosen clip chain. During audition the playhead uses that take’s local seconds on the full scene
scale, and an explicit **Back to clips** action returns to continuous selected playback.
This prevents transient browsing from silently changing the scene's duration.

**Use this take** persists selection and returns to selected-clips playback paused
at that clip's start. Re-selecting it is idempotent. Core is authoritative across
reloads and agent/UI actions; URL/view state never becomes durable selection.
Selecting a take does not approve its creative quality or authorize a paid request.

### Raw clip playback and incomplete coverage

The Generation bar concatenates complete selected files logically for playback;
it does not render or save a joined video. Segment widths are proportional to
measured durations. Core reports ordered clip selection and file duration; the
player derives offsets from that report. Clip labels and dividers remain distinct
from the Previs camera-cut strip below the monitors.

Each compact transport sits directly beneath its own player. The Generation
scale covers at least the Previs duration and expands for longer generated footage.
Tinted background sections show known clip durations; remaining scene time stays
blank. No equal split or duration is invented for pending clips. Continuous playback
stops at a missing middle clip; later takes remain available in the header selector.
Omit separate pending/assignment status rows and clip-button rows.

Play crosses available clip boundaries automatically; seeking maps generation
elapsed time to a file and local time. At an exact internal boundary choose the
incoming clip. Keep the last frame at the known end with
no continuing progress. Preload the next selected file where practical using the
existing media primitive; handle decode/autoplay failure without hiding other media.
No seamless-playback guarantee before desktop verification.

### Source-take attribution

A take may record an optional `sourceTakeId`, supplied by the user or agent for
attribution. It is not a generation dependency or a complete input inventory.
Core checks only that the referenced take exists in the current Project database;
it does not require adjacency, the same plan/revision, active selection, available
source media or a particular provider input. A discarded source retains its identity.
No source is required to register, select or play a take. The attribution is captured
at registration and never inferred from titles, selection or provider request text.

Skills choose continuation inputs and capture attribution before submission when
useful. Engines validates and executes the actual provider-native request. Frames,
audio, multiple references and their roles belong to that request and its existing
provenance, not new Core columns. Core does not verify that an attributed take was
submitted, that an image is its final frame, or that it is suitable for continuation.

Display **Source: Clip 1.1** when attribution exists. If that source clip now has
Clip 1.2 selected, show **Source: Clip 1.1; selected: Clip 1.2**. Compare selection
on the attributed source's own clip, not an inferred predecessor. Include plan and
revision context for cross-scope attribution so compact labels remain unambiguous.
Absent selection is shown as no selected take, not a broken generation chain.
These are factual projections, not continuity judgments. Source discard or later
selection changes do not block the attributed take or trigger regeneration.

### Independent and linked transports

Place one compact transport beneath each equal-size monitor. Put the Link toggle
at the right of the Prev/Next row, with a chain icon and tooltip **Link**. Each has play/pause, time,
progress and mute. Start unlinked on monitor entry; linking is transient view state,
not a Project Setting. Unlinked controls affect only their own player.

On enabling linking, pause both and align to the most recently manipulated
transport's elapsed time (Previs if neither has been manipulated). Clamp each to
its own available end. Subsequent play/pause/seek controls address one common
elapsed time, mapped through Generation clip boundaries. The shorter side ends;
the longer side continues. Turning linking off preserves current positions and
play/pause states. No proportional mapping, authored offsets, speed changes,
retiming or inference from Dialogue cues. Ordinary browser drift correction may
seek to the common clock, but must not normalize creative event timing.

Keep a single audible source while linked: the most recently unmuted player;
default to Generation when available. Unlinked each player's mute is independent.
Dialogue audition retains exact recording semantics: pause Generation, rehearse
Previs with the recording and mute embedded sound. It temporarily suspends linked
transport coupling; exiting audition restores the toggle and realigns on the next
linked transport action. Cue/Camera/Action seeking affects Previs alone when
unlinked and both elapsed positions when linked. Switching revision pauses/reset
both to zero; changing a take or its selection pauses Generation and, if linked,
both players. Stale play promises must not restart discarded selections.

## Public Contracts And Persistence

Use Core client `shot-plan-clips.ts` for these public shapes (all ids are strings,
timestamps ISO strings; numbers positive integers unless specified otherwise):

- `ShotPlanClip`: `id`, `previsRevisionId`, `number`, `selectedTakeId: string | null`,
  `takes: ShotPlanClipTake[]`. Order by number. No duration mirror on the clip.
- `ShotPlanClipTake`: `id`, `clipId`, `number`, `title: string | null`, `assetId`,
  `assetFileId`, `sourceTakeId: string | null`, `createdAt`.
  Source attribution refers to a take identity only; no generation-input fields.
- `ShotPlanClips`: `shotPlanId`, `previsRevisionId`, `clips: ShotPlanClip[]`,
  `assets: Asset[]`, `unassignedAssets: Asset[]`, `resourceKeys: string[]`.
  Assets provide availability/durations/provenance; take records hold no mirrors.
  Unassigned means a revision-associated video not assigned to a clip, a valid
  general import state, not a compatibility format or guessed Clip 1.

Core commands (project input follows existing `ShotPlanProjectInput`):

- `readShotPlanClips({shotPlanId, previsRevisionId}) -> ShotPlanClips`.
- `createShotPlanClip({shotPlanId, previsRevisionId}) -> ShotPlanClips`: append,
  allocate number transactionally; no caller-chosen number.
- `registerShotPlanClipTake({clipId, assetId, assetFileId, title?, sourceTakeId?})
  -> ShotPlanClips`: validate existing exact same-plan/revision video, register
  once. Repeating an identical attachment is idempotent; conflicting reuse fails.
  Each video file belongs to at most one clip take. New takes start unselected.
- `selectShotPlanClipTake({clipId, takeId: string | null}) -> ShotPlanClips`:
  choose/clear atomically; validate active same-clip file before selection.
- `resolveShotPlanClipTake({shotPlanId, previsRevisionId, clipNumber, takeNumber})
  -> ShotPlanClipTake`: exact scoped lookup, including stable discarded identity
  for reports; selection still rejects discarded media.
- `updateShotPlanClipTake({takeId, title: string | null}) -> ShotPlanClips`:
  edit only the short label. No generic metadata patch API.

Add `shot_plan_clip` with `id`, revision FK, `number`, nullable selected-take FK,
`created_at`; unique `(previs_revision_id, number)`. Add `shot_plan_clip_take` with
the take fields above, a nullable `source_take_id` FK for attribution and unique
`(clip_id, number)` and `asset_file_id`. Allocate `max(number)+1` transactionally
over all retained rows, including discarded Assets. No take deletion when media
is trashed; existing lifecycle clears affected selection atomically and restore
leaves it unselected. No cascade to subsequent clips or duplicated discard state.
Keep Assets Project-owned and existing weak Previs authorship intact.

CLI under `renku shot-plan clip`:

```text
list --shot-plan <id> --previs-revision <id> --json
create --shot-plan <id> --previs-revision <id> --json
take add --clip <id> --asset <id> --asset-file <id> [--title <text>]
  [--source-take <id>] --json
take resolve --shot-plan <id> --previs-revision <id> --number 1.1 --json
take select --clip <id> --take <id> --json
take clear --clip <id> --json
take update --take <id> --title <text> --json
```

Existing `renku media import` gains optional `--clip <id>` and `--take-title <text>`
plus optional `--source-take <id>` attribution for `shot-plan.video-generation`. Core validates and
imports/registers one take atomically, returning both Asset and take. Clip identity
resolves required plan/revision; conflicting explicitly supplied target/revision
fails. Import without a clip remains a valid unassigned Project video. Existing
files can be assigned with `take add`; never reimport bytes merely for grouping.

HTTP under `/studio-api/projects/:projectName/screenplay`:
`GET /shot-plans/:shotPlanId/previs/:revisionId/clips`,
`POST /shot-plans/:shotPlanId/previs/:revisionId/clips`,
`PUT /clips/:clipId/selection` body `{takeId: string | null}`,
`PATCH /clip-takes/:takeId` body `{title: string | null}`.
UI does not execute generation or need attachment/resolve endpoints. Core resolves
identity and selection; adapters parse, delegate and serialize only.

Generation context projects the same clip/take report for Previs workflows without
inferring a selected revision. The agent chooses the exact revision, resolves its
selection, then independently chooses generation inputs and optionally supplies
source-take attribution on import. Context is evidence, never reference eligibility
or generation readiness. Do not duplicate per-clip state in
`PrevisRevision.generations`; replace that monitor projection with the new report
and update callers directly. Unassigned candidates remain inspectable and may be
assigned through CLI, but cannot masquerade as a selected clip sequence.

Structured errors: `CORE_SHOT_PLAN_CLIP_NOT_FOUND`,
`CORE_SHOT_PLAN_CLIP_TAKE_NOT_FOUND`,
`CORE_SHOT_PLAN_CLIP_TAKE_INVALID`, `CORE_SHOT_PLAN_CLIP_SELECTION_INVALID`,
`CORE_SHOT_PLAN_CLIP_FILE_ALREADY_ASSIGNED`. Use existing diagnostics for field
issues and authorization. No errors for creative mismatch or imperfect sync.

## Architecture Shape Gate

Core owns identity, numbering, scope, attachment, selection and recorded attribution.
Skills own segmentation, continuation strategy, frame/audio extraction, reference
selection, prompts and creative review. Engines owns provider capability/schema
validation, uploads, execution, recovery and outputs. Core must not acquire those
generation decisions through validators, required inputs, context flags or schemas.
Extend its existing boundaries; no React/CLI business rules. Exact new layout:

- `core/src/client/shot-plan-clips.ts`: public contracts.
- `core/src/server/schema/shot-plan-clips.ts`: Drizzle tables.
- `core/src/server/shot-plan-clips/{commands,projection,validation,records,attachment}.ts`:
  focused orchestration, report, invariants and database access respectively.
  Integrate directly through existing service wiring; no extra barrel is needed.
- Existing generation attachment modules call focused clip validation/registration
  inside their transaction; Asset discard clears selections via the existing
  lifecycle integration. Do not grow a new purpose switchboard.
- `cli/src/commands/shot-plan-clip-command-handlers.ts`: thin dispatch,
  syntactic parsing and Core calls. Existing media-import command consumes the new
  attachment fields without duplicating ownership rules.
- Existing `studio/src/services/shot-plan-previs/{api,contracts}.ts` and focused
  `studio/server/routes/shot-plan-clips.ts` plus its HTTP serializer:
  safe projection and thin HTTP translation. Locate/register
  routes alongside current Shot Plan routes, not in feature components.
- Existing `features/movie-studio/shot-plans/previs/monitor.tsx` becomes layout
  composition. Add `clip-review.tsx`, `transport.tsx`, `clip-playback-sequence.ts`,
  `use-clip-durations.ts`, `use-clip-playback.ts`, `use-monitor-playback.ts`. Refactor
  `use-previs-playback.ts` to Previs/cue audition only; preserve its tests.
  Use existing `VideoPlayer`, `Button`, `Select`, `Slider`, `Toggle` primitives;
  add a missing domain-neutral primitive in `src/ui` before feature use.

No normalized provider request model, shared sequence entity (Screenplay already
owns Sequence), wrapper re-exports, format-only rewrites or monolithic transport
hook. Split before one function combines media loading, all cue behavior, clip
selection mutation and both clocks. No tests freezing internal helper names.

## Implementation Slices

1. Core contracts, schema, focused commands/projection and domain tests. Reuse
   existing Asset lifecycle and attachment transactions; no new Asset ownership.
2. Drizzle Kit migration and public read/context cutover. Read current official
   Drizzle migration docs before generation/application; follow package-owned
   migration tooling. Back up the populated local project before any application.
   Create tables only; do not guess historical assignments. Rehearse on a copy.
3. CLI and HTTP adapters plus atomic media-import integration. Verify `1.10`
   resolution, target-scope rejection and attribution capture under changing selection.
4. Desktop monitor, compact take selector, selected-chain playback and independent/
   linked transports. Preserve equal monitor sizing, fullscreen and cue audition.
5. Skills adoption through plan 0203; document agent examples using `Clip 1.1`.
   Candidate labels contain creative distinctions, not generic Asset categories.

## Tests And Guardrails

Core: stable allocation under concurrency/discard; exact scoped `1.1`/`1.10`;
wrong target-plan/revision/file rejection before writes; idempotent registration;
null selection; active same-clip selection; attributed take survives changed selection
and source discard; atomic attachment failure; missing media without guessed
replacement; unassigned imports without automatic grouping.

Attribution tests accept earlier non-adjacent clips, other plans/revisions in the
same Project, discarded sources and null attribution. Reject an unknown supplied
take id using the existing take-not-found diagnostic. Prove selection/attachment
needs no source frame, generation capability or preceding selected take. Do not
test prompt wording, actual provider input use or visual continuity in Core.

CLI/HTTP: exact parsing/delegation, returned identities, structured errors and
atomic import intent. Do not repeat all Core invalid-state combinations.

UI: browsing never selects; selection survives reload; meaningful compact labels
and missing-title identity; variable-duration boundary seek; pending middle clip;
unknown duration/decode failure; automatic advance and endpoint behavior; alternate
audition/back-to-clips; stale load/play completion; independent playback; link on/off,
leader selection and unequal lengths; mute ownership; cue audition suspension;
revision/selection switch. No semantic timestamp or pixel-content assertions.

Desktop acceptance in the actual shell: one clip with alternatives, three clips
of unequal durations, a pending clip, and changed attributed-source selection. Verify dark
and light modes, keyboard-accessible sliders/labels/selection, two clear bars and
link toggle, full-window sizing and fullscreen. No mobile work or paid generation.
Use synthetic/local fixture media for interaction tests; real user media read-only.

## Documentation And Final Verification

Add ADR `0098-use-raw-clip-takes-and-independent-monitor-playback.md` after acceptance;
record its narrowing of ADR 0096's single-clock monitor rule and expansion of raw
generation identity. Add a concise notice to 0096; preserve historical reasoning.
Update `docs/architecture/data-model-and-storage.md`,
`reference/domain-vocabulary.md`, `reference/project-files-and-assets.md`,
`docs/product/design-guidelines.md`, CLI help and affected skill references.
ADR 0097 remains owned by plan 0203. No generic sequence/editing vocabulary.

Run root `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm check`; skills adoption runs
the sister repository's tests. Verify Drizzle-generated migration on an isolated
copy and preserve all registered files/metadata. Inspect complete diffs/statistics,
large modified hooks and thin `index.ts` files; no compatibility layer or generic
mutation APIs. Report remaining visual/media checks explicitly. No automatic plan
review or implementation is part of this planning turn.

## Implementation Evidence

Completed on 2026-09-11 after plan 0203's skill guidance. Module layout above
records the implemented split: reuse the existing CLI registry and Previs service
instead of adding parallel entrypoints. Core stores clip identity, selection and
optional attribution only; skills choose continuation inputs and Engines retains
provider execution and capability ownership.

- Root build and all 1,029 package tests passed. `pnpm check` passed, including
  typechecks, lint, architecture checks and release checks. Final Core typecheck
  and build also passed after correcting the optional attachment-target type.
- Desktop Chromium regression passed with three unequal clips, alternative takes,
  persistent selection, source-selection comparison, automatic advance, a pending
  middle clip, independent/linked seeking, keyboard control and fullscreen.
  Dark/light screenshots were inspected. This used isolated synthetic media.
- Drizzle Kit migration 0088 was rehearsed against a database copy, preserving
  existing row counts with clean foreign-key and integrity checks. The live Urban
  Basilica database was then backed up and migrated from generation 69 to 70.
  Its backup is retained in `.renku/project-database-backups`. Existing media and
  descriptions remain intact, with no inferred clip assignments.
- The local Studio server was restarted and the real movie view verified: two
  independent transports, link control, and three unassigned videos are visible.
- Sister-repository skill tests passed. Plan 0203 records the preparation-only
  review limits and unavailable generic Python validator; no paid media was made
  and no skill plugin was released or installed.
- Complete tracked diffs, new modules, file sizes and entrypoints were reviewed;
  `git diff --check` passes in both repositories. Existing unrelated work remains
  untouched. One asset-route test fixture now supplies the file size required by
  the existing streaming implementation; production asset streaming is unchanged.

## Completion Checklist

### Review And Architecture

- [x] Confirm raw-only scope, `Clip N.M` naming and Previs-revision identity scope.
- [x] Approve public contracts/migration without editing or generic lineage expansion.
- [x] Keep Core invariants out of adapters and UI; preserve Project Asset ownership.
- [x] Inspect module shape, thin entrypoints and focused playback responsibilities.

### Core And Adapters

- [x] Stable clip/take allocation, optional titles and exact numeric-pair resolution.
- [x] Explicit persistent selection distinct from browsing, with discard integration.
- [x] Optional source-take attribution and non-blocking selection comparison.
- [x] No predecessor/same-revision source rule, frame-input fields or generation-readiness gate in Core.
- [x] Atomic import/register, existing-file assignment and idempotent writes.
- [x] Read/context projection and all callers updated without duplicate flat state.
- [x] Structured errors, CLI help, HTTP serialization and resource refresh.
- [x] Drizzle Kit migration rehearsed; no guessed sample assignment or file moves.

### Desktop Product

- [x] Generation progress bar boundaries reflect actual whole-file durations.
- [x] Selected clips play continuously; gaps and unavailable media stay visible.
- [x] Take audition, Back to clips, Use this take and Selected are distinct.
- [x] Compact labels support “Use Clip 1.1” and omit generic category titles.
- [x] Two independent transports, explicit link toggle and unequal-duration behavior.
- [x] No automatic stretching, trim controls, transitions or export/assembly editing.
- [x] Cue audition, mute, fullscreen, keyboard control and stale-load handling verified.

### Tests, Documentation And Handoff

- [x] Core cases, adapter checks and representative playback interactions pass.
- [x] Real-shell desktop visual verification with unequal clips and alternatives.
- [x] ADR 0098 and scoped 0096 notice; current architecture/UI/CLI docs updated.
- [x] Plan 0203 skills consume Core selection/attribution and independently choose generation inputs.
- [x] Root checks, migration rehearsal and skills checks complete as applicable.
- [x] Full diff/stat and heavily modified files reviewed; no format-only churn.
- [x] No god hooks, catch-all modules or non-index re-export facades accepted.
- [x] Preserve unrelated work/sample data; distinguish source implementation from release.
