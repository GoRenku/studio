# 0202 Previs Direction Cues and Shot Segments

Status: implemented
Date: 2026-09-09

## Summary

Replace the generic Previs cue interpretation with a first-class Core contract
for dialogue turns, action points, camera points, and shot segments. A cut is the
boundary at which a subsequent segment starts. Continuous Previs uses the same
model with one segment. Directors can seek to direction points and audition an
individual dialogue turn without highlighting every ongoing animation control.

The change spans registration, retained playback metadata, Core projections,
HTTP/CLI contracts, Studio interaction, and agent authoring guidance. Correcting
Urban Basilica alone cannot solve the problem. Its recovered annotations are a
bounded data-correction slice after the product contract and behavior work.

## Review Attention

- **Verified playback defect:** the shared asset HTTP endpoint ignored byte ranges,
  leaving Chrome's Generation seekable range at `[0,0]`. Implement single-byte-range
  delivery (206 / Content-Range, 416 for unsatisfiable ranges) in the existing HTTP
  file-response owner and forward the request from its two routes. This is necessary
  for the requested cue seeking, not a Core metadata or provider contract change.
  Unsupported multipart/unit requests receive the full representation; conditional
  If-Range requests receive it because this endpoint has no matching validator.

- **Public contract replacement:** retain `playback.json` and `PrevisPlayback`,
  but replace generic seconds/range cues with explicitly typed, identified cues,
  rational frame rate, frame count and ordered shot segments. Update every caller
  directly; no compatibility reader or interpretation of prose/animation keys.
- **Frame timing:** integer zero-based frame positions are authoritative for the
  Previs timeline. Dialogue may have an explicit end; Action and Camera are
  points. Segment starts are the sole stored cut boundaries. No duplicate cuts
  array, segment end fields, or cue-to-segment mirrors.
- **Registration policy changes:** absent playback remains valid, but supplied
  malformed timeline metadata fails before registration writes. This intentionally
  replaces ADR 0095's preserve-malformed-display-at-registration behavior. Missing
  optional audio stays a localized warning and does not block usable video.
- **Storage choice:** the typed, Core-validated retained revision document is the
  authoritative domain value. No parallel SQL cue/segment tables or new Shot rows
  are needed. This is a first-class public contract, not a Skill-only convention.
- **Playback:** only Dialogue gets an audition control, enabled when its end is
  known. Main playback remains continuous. Action/Camera/Cut clicks select and
  seek, never start bounded playback. Selection and audition use different styles.
  Turn audition uses its exact recording or Previs audio; Generation audio remains
  muted during audition because its speech timing is not established by pairing.
- **Existing data:** propose one backed-up correction of the three already
  recovered Harbor revision annotations and their source hashes, preserving
  revision ids, numbering, render bytes and AI associations. This explicitly
  changes retained annotation files; it requires approval with implementation of
  this plan. Original source/annotation bytes remain in the backup. No cleanup,
  file deletion, general conversion feature, or rewriting provider provenance.
  This correction is a local operation for the single Project copy on this
  machine. It must not add repository migrations, journal entries, snapshots,
  shipped repair scripts, or schema-generation changes.
- **Unchanged:** two equal monitors, Description viewer, Shot List workflow,
  Assets/Audio tabs, independent generated Assets, provider review/approval,
  `--previs-revision`, and equal-elapsed-second comparison. No automatic retiming.
- **Limits:** the timeline describes authored Previs direction, not verified AI
  performance. Browser seeking targets a frame's time; exact decoded-frame landing
  must be verified on supported media, not promised merely because storage uses
  frames. No editor, transition effects, cut detection, transcription, or NLE.

## Requirement Ledger

| ID | Source | Required result |
| --- | --- | --- |
| R1 | User: cues are specific action/speech changes | Explicit Dialogue, Action, Camera meanings; no review captions, continuing pose controls or location filler promoted into cues. |
| R2 | User: turn-based playback | Dialogue start markers and bounded audition; actions have no Play button; no interval-driven mass highlighting. |
| R3 | User accepted continuous shots and cuts | Ordered shot segments, frame-exact authored cut boundaries, one-segment continuous case, cuts crossed without stopping dialogue. |
| R4 | User: first-class Renku support | Core contract and registration validation, safe projections, thin adapters, current CLI and Skill workflows. |
| R5 | User: do not invent/misrepresent recovered material | Evidence-backed Harbor correction; provisional dialogue timing and generation differences remain explicit. |
| R6 | Existing ownership/integrity rules | Preserve retained source hashing, exact audio file identity, revision pairing, independent Asset lifecycle and creative opacity. |
| R7 | Existing monitor/desktop rules | Preserve paired geometry, full cue list/timeline, Description, revision refresh, existing player/fullscreen and real Studio shell. |

## Context and Evidence

### Confirmed failure

Harbor revision 3's converted `playback.json` contains four dialogue entries,
eleven animation-control intervals, and five review-caption intervals. At 11s,
six entries satisfy the current UI's range-containment highlighting condition.
The solid gray lane consists of subjectless review captions; “03 MARA SLOWLY
TURNS TO URBAN” is a caption, not an additional event. The conversion generated
these classifications rather than obtaining them from an explicit domain model.

In `tmp/harbor-previs/motion.py`, `envelope` controls blending and held orientation;
later controls can override earlier ones. A control ending at 17s does not mean
the visible turn lasts until 17s. Dialogue caption timings were explicitly
provisional. The soldier's `talk` behavior supplies gestures, not authored speech.

The accepted AI input was a 15s derivative of the 17s v003 master, recorded in
`tmp/operations/media-generation/harbor-h3-max/preparation-notes.json`. The existing
AI video is approximately 15.1s. Neither equal seconds nor a simple duration ratio
establishes actual AI speech/action correspondence.

### Existing owners and reuse inventory

| Owner | Present behavior and intended change |
| --- | --- |
| Core `client/shot-plan-previs.ts` | Generic cues have no type, stable cue identity or segments. Replace this contract in place. |
| Core `server/shot-plan-previs/playback.ts` | Safe optional-file/audio resolution and read-time decoder are mixed. Reuse file safety and audio resolution; extract pure contract validation and frame arithmetic. |
| Core `registration.ts` / `projection.ts` | Retain source/hash/render revisions and exact identity. Validate a supplied timeline before writes and reuse the validator on read. |
| HTTP `previs-responses.ts` / browser `services/shot-plan-previs` | Preserve full typed union and timeline; attach safe URLs only to explicit Dialogue audio. |
| Studio `previs/cues.tsx` | Generic ranges, gray subject fallback, active-time highlighting and Play on every row. Replace with typed timeline/list presentation. |
| Studio `use-previs-playback.ts` / `VideoPlayer` | Shared clock and generic bounded cue audition. Keep linked transport, isolate explicit dialogue audition and browser event handling. |
| Core Dialogue Audio / generation context | Already supplies Scene dialogue context and exact audio takes. Reuse for authoring evidence; do not create a second dialogue/audio-selection system. |
| Sister `studio-skills` Blender planner / Media Producer | Authors retained files and carries exact revision into generation. Update all cue variants, segment semantics and evidence checks. |

Constraints: ADRs 0041, 0094, 0095; architecture naming, coding practices,
front-end guidelines, structured diagnostics and storage conventions; product
Previs design guidelines. Plan 0200 is the implemented authoring/storage baseline.
Plan 0201 is the implemented monitor baseline with standalone fullscreen acceptance
still open. This follow-up replaces its cue semantics; do not rewrite its history.
Plan 0194 owns Dialogue Audio. Plan 0199 remains separate isolation work, not a
prerequisite for a temporary fixture in this change.

The older Previs paragraph in `data-model-and-storage.md` still calls playback
opaque while its opening addition and ADR 0095 authorize display interpretation.
Resolve that documentation inconsistency in the accepted follow-up ADR. Structural
validation is permitted; creative interpretation remains agent/user-owned.

### Right-sized choice

1. Keeping the contract unchanged cannot distinguish a dialogue turn from a pose
   control or represent cut boundaries. UI heuristics would preserve the defect.
2. Extend the existing Previs owner: typed cues and frame timing, validated on
   registration/read. This is the chosen change.
3. Introduce only the bounded concept the current contract lacks: Previs shot
   segments. Do not reuse Shot List `Shot` rows: they carry independent briefs,
   images and coverage that a Previs segment does not own. No segment CRUD or
   independent lifecycle is needed; the revision document owns the whole sequence.

## Product Behavior and Definitions

### Cue types

| Kind | Meaning and required identity | Timeline/list behavior |
| --- | --- | --- |
| `dialogue` | One authored turn begins. Cue id identifies this occurrence; `speaker` references an explicit local subject; `text` preserves the exact authored line. | Speech start marker; optional restrained duration span when end is known. Only this kind has Play/Pause. |
| `action` | A physical action or change begins. Optional subject identifies actor/object; text describes the point. | Point marker and seekable timestamp, no duration fill or Play. |
| `camera` | A camera direction changes within a shot: movement starts/stops, target or focus changes. | Distinct camera point symbol and seekable timestamp; no subject-colored actor lane or Play. |

A continuing gaze, pose, walking loop, location, review heading or general Beat
is not automatically a cue. Agents author only direction changes useful to review;
they must not mechanically export every parameter or infer types from wording.
A deliberate stop/arrival can be its own Action point. Several directions may
share a frame. Text remains opaque to runtime validation.

### Segments and cuts

A `PrevisShotSegment` describes one uninterrupted camera view within this
revision. One segment beginning at frame 0 represents a continuous shot. Each
subsequent segment start is a cut to its incoming view. The next start, or total
frame count for the last segment, determines the segment end. No stored end,
redundant cut entity, or duplicated list of boundaries.

Render a narrow segment-label strip and a distinct vertical cut boundary spanning
the cue lanes. The opening segment is not labeled as a cut. Authored labels such
as “Mara close-up” are meaningful; do not display raw ids. A cut is seekable and
keyboard accessible but has no Play button. Dialogue and actor action may continue
across it; do not split or duplicate their cues. At an exact cut frame the incoming
segment is current. Camera points at that frame apply to the incoming segment.

### Interaction states

- **Main Play:** continuous playback until the end; no action-row highlighting.
  Cuts do not pause or restart either video. Pause/resume keeps the current time.
- **Seek/select:** clicking a cue timestamp, marker, segment label or cut pauses,
  cancels any audition, selects that authored entity and seeks both monitors.
  Selection uses a neutral outline, never the amber playing treatment.
- **Dialogue audition:** starts at its start frame and stops at the explicit end
  frame, end-exclusive. Starting a different turn cancels the prior audition.
  The selected audition alone has the amber row and Pause icon. Pausing audition
  retains its identity/time; pressing its Play resumes, and replay after completion
  starts at the turn's beginning. Main Play explicitly leaves audition mode.
- **Unknown dialogue end:** retain its start and seek affordance; show disabled
  audition with accessible “Dialogue end is not set.” Do not infer from another
  cue, a cut, the next speaker or video end. Absence of a recording alone does not
  disable a timed visual rehearsal.
- **Audio:** audition an exact attached recording at its authored offset when
  present, muting both embedded tracks to avoid duplicates. Without a recording,
  play the Previs segment with its own embedded audio, keep Generation muted, and
  describe the control accessibly as a Previs dialogue rehearsal. Do not imply
  caption timing proves audible speech. Main playback retains its ordinary audio
  behavior. Shared mute applies to whichever audio source is active. Missing or
  failed external audio leaves visual rehearsal available with a localized status.
  If a recording ends before the authored turn end, it becomes silent while visual
  rehearsal continues to that boundary; do not spill into the next recording.
- **Overlaps:** simultaneous directions are normal. Explicit overlapping dialogue
  timings are representable, but audition plays only the chosen turn, never a
  second recording automatically. Continuous playback highlights no rows as
  auditions. No inferred active-turn selection or winner based on array order.
- **Lifecycle:** revision changes cancel/reset to zero; generation changes cancel
  audition and pause at the current Previs time. Refresh preserves selected cue
  by id only when its type/timing/audio fields remain identical; otherwise cancel
  safely. Historical revision selection remains stable as new work arrives.

### Timeline composition

Preserve the existing two-monitor and lower timeline/list/Description composition,
fonts and theme tokens. Use a segment strip, actor/object lanes containing point
markers and optional dialogue spans, and a Camera lane only when camera cues exist.
Subjectless Action points use one neutral Action lane with an action symbol and
no invented subject dot. No solid caption lane. Legends use explicit subject
labels/colors, without listing unused subjects solely to fill space.

The ruler uses the revision's frame count/rate; never expand it to accommodate an
invalid cue. At crowded or coincident positions, stack markers within the lane
without losing click/keyboard access; the complete chronological list remains
available. Point selection, timeline playhead and audition must remain visibly
separate in both themes. Show frame position in cut tooltips/accessibility text.
No mobile work or wider monitor redesign.

## Public Contracts and Persistence

Extend `packages/core/src/client/shot-plan-previs.ts` with these public types
(exported through the existing client entrypoint):

```ts
interface PrevisFrameRate { numerator: number; denominator: number }
interface PrevisShotSegment { id: string; startFrame: number; label: string }
interface PrevisSubject { key: string; label: string; color: string }
interface PrevisDialogueAudio {
  assetId: string;
  assetFileId: string;
  offsetSeconds?: number;
}
type PrevisCue =
  | { id: string; kind: 'dialogue'; startFrame: number; endFrame?: number;
      speaker: string; text: string; audio?: PrevisDialogueAudio }
  | { id: string; kind: 'action'; startFrame: number; subject?: string; text: string }
  | { id: string; kind: 'camera'; startFrame: number; text: string };
interface PrevisPlayback {
  frameRate: PrevisFrameRate;
  frameCount: number;
  segments: PrevisShotSegment[];
  subjects: PrevisSubject[];
  cues: PrevisCue[];
}
```

These are public domain values, not SQL entities. Local cue/segment ids are authored
stable identifiers scoped to the revision document; agents preserve them for
unchanged directions in subsequent revisions. Dialogue's cue id identifies the
Previs turn occurrence. Do not create mutable screenplay-turn-number foreign keys
or require a screenplay association to play an explicitly authored line. Existing
Scene dialogue context remains the agent's source for exact wording and speaker.

All positions are zero-based integer frames. `frameRate` has positive safe-integer
numerator/denominator, allowing 24/1 and 24000/1001 without decimal approximation.
`frameCount` is a positive safe integer. Use `frame * denominator / numerator` for
player seconds; a boundary at frame 192 at 24/1 is 8s. The final end-exclusive
boundary is `frameCount`, not an extra frame. Frame rate/count are explicit facts
of the authored constant-frame-rate Previs; do not derive them from AI duration.
No variable-frame-rate editing support is introduced.

### Validation and errors

Core owns `validatePrevisPlayback(value: unknown):
{ playback: PrevisPlayback; warnings: DiagnosticIssue[] }` and
`previsFrameToSeconds(frame: number, frameRate: PrevisFrameRate): number` in the
bounded Previs module. The validator collects actionable structural issues and
throws `ProjectDataError` with `CORE_PREVIS_PLAYBACK_INVALID` and precise paths.
Check discriminants/field types, unique nonempty local ids, valid subject keys
and six-digit colors, finite safe arithmetic, bounds, strictly increasing segment
starts with first at zero, and dialogue ends greater than starts and no later
than frameCount. Cue and segment starts satisfy `0 <= startFrame < frameCount`;
segments is nonempty, and segment labels are nonempty authored text.
Action/Camera cannot carry an end/audio; Camera has no subject.
Speaker and supplied Action subject must resolve within this same document.
These are local envelope identities, not semantic Cast membership validation.
Malformed optional Dialogue audio produces a warning in the returned result and
is omitted from the usable projection; it does not turn a structurally usable
timeline into a registration failure. Retained source bytes are not rewritten.
Allow cue overlaps and coincident timestamps; sort display order by startFrame
then authored array order. Preserve text/labels exactly. Unknown creative extension
fields may be ignored, but never influence playback or field inference.

Optional missing playback remains `null`: video and Description still work, and
Studio does not invent a one-shot timeline. When supplied, validation happens on
the stable candidate before registration creates any durable files/rows. Existing
safe source inspection/hash/copy checks still detect candidate changes; validate
the bytes being retained, not a different unchecked read. Retry behavior remains
source+render hash based.

On read, use the same validator. Missing/unreadable/malformed retained display
metadata remains localized via existing `CORE_PREVIS_DISPLAY_UNAVAILABLE` and
`CORE_PREVIS_PLAYBACK_INVALID` warnings and null playback; preserve revision/render.
Audio envelope and exact-file failures use `CORE_PREVIS_AUDIO_UNAVAILABLE`, preserve
the dialogue and disable only the unavailable recording. Audio resolution remains
Core-owned, and HTTP adds safe URLs only after it. No obsolete-shape diagnostics,
runtime repair, cue inference, or semantic matching to media/prompts.

`PrevisRevision.playback`, the GET response and `shot-plan previs show --json`
carry this same shape. Keep `registerShotPlanPrevis`, `readShotPlanPrevis`,
`renku shot-plan previs register/show`, and the existing GET path unchanged.
No new CLI flags or HTTP mutation endpoints. Agent authoring uses complete
candidate documents and the existing registration operation, not individual cue
writes. `generation context` remains the existing Scene/Shot Plan briefing;
Media Producer additionally reads the exact chosen revision through `previs show`,
avoiding a duplicated timeline in general generation-context responses.

## Architecture Shape Gate

| Module / file | Ownership and intended change |
| --- | --- |
| Core `client/shot-plan-previs.ts` | Public types above; no filesystem or runtime behavior. |
| Core `server/shot-plan-previs/playback.ts` | Shrink to retained display IO and exact audio-file resolution. |
| Core `server/shot-plan-previs/timeline.ts` (new) | Pure validator and frame arithmetic; bounded discriminant handling for three cue variants and segment invariants. No IO or player state. |
| Core `server/shot-plan-previs/registration.ts` | Invoke timeline validation before writes, preserve registration transaction and copy/hash owner. |
| Core `server/shot-plan-previs/projection.ts` | Reuse read owner; no second cue decoder or cut array. |
| Studio HTTP `server/http/asset-file-response.ts` | Own single-byte-range delivery after Core resolves file identity; routes only forward Request. No domain ownership checks in HTTP. |
| Studio HTTP `server/http/previs-responses.ts` | Explicit Dialogue audio URL translation, preserve other variants/segments/frame fields without interpretation. Route remains thin. |
| Studio `src/services/shot-plan-previs/{contracts,api}.ts` | Derive browser union from Core with URL-bearing Dialogue audio; avoid non-distributive Omit that erases variant fields. |
| Studio `.../shot-plans/previs/cues.tsx` | List/legend and typed row composition; remove generic range activation. |
| Studio `.../shot-plans/previs/timeline.tsx` (new) | Segment strip, cut boundaries, lanes/markers/playhead; no validation or persistence. |
| Studio `.../shot-plans/previs/use-previs-playback.ts` | Single explicit sequence/dialogue mode with playing/paused status, selected audition id/bounds, cancellation identity and player-event coordination. |
| Studio `.../shot-plans/previs/{previs-tab,monitor,use-previs}.tsx/.ts` | Compose typed selection/audition, refresh, unchanged monitor geometry and take handling. |
| Studio `src/ui/video-player.tsx` | Generic media events and handles only; no dialogue/segment rules. |
| CLI `commands/shot-plan-previs-command-handlers.ts` | Existing parse/delegate/format path, no cue decoding. |

No new public barrel is needed. Existing package `index.ts` files remain exports
and thin composition only. A bounded exhaustive cue-kind switch belongs in the
validator or row presentation; no plugin registry or extensible event engine.
Keep media readiness/end/error handling within the generic player and transport,
not in the cue renderer.

Stop if implementation requires parsing animation scripts in runtime, duplicating
cue state in SQL and retained JSON, creating fake Shot rows, adding a generic
metadata patch service, coupling Engines to editing semantics, or growing one
module into validation+IO+playback+rendering. Fix ownership before proceeding.

## Implementation Slices

1. **Core timeline contract (R1, R3, R4, R6).** Replace the generic public shape;
   extract pure validation/frame arithmetic into `timeline.ts`; update
   registration and read projection together. Preserve missing metadata and
   localized unavailable audio. Update direct consumers and remove generic decoder.
2. **Thin surfaces (R4).** Update browser contracts and HTTP serialization for
   every variant, segments and timing. CLI stays delegated; document the revised
   retained input and `previs show` result. No new provider machinery.
3. **Transport correctness (R2, R6, R7).** Separate intent from asynchronous media
   events. Audit/reproduce play→pause→play, rapid turn switching, end→replay,
   seeking during audition, and rejected/stale play promises. A late rejection
   from a canceled play must not stop the new play. A shorter generation ending
   must not pause Previs; Previs end must settle exactly at timeline end. Media
   errors must identify the affected pane and leave the other usable where
   possible. Investigate the reported “Unable to play media” separately from
   highlighting; do not claim fixing cue selection resolves decode/network errors.
4. **Timeline/list composition (R1–R3, R7).** Extract timeline rendering, implement
   all three cue presentations and derived cuts, separate selection from audition,
   remove Play from non-dialogue rows and the generic active-range styling.
   Preserve keyboard access, scrolling, paired monitors and Description.
5. **Agent workflow (R1, R3–R6).** Update the exact Skill surfaces below. Author
   segments/cues from directing decisions; check frame timing against the actual
   Previs. For cuts, author Blender camera switching/assembly in the specific
   plan's implementation and retain it with the render. Do not build a universal
   Blender engine. Keep dialogue crossing a cut as one turn. Pass the chosen
   revision and cut/turn direction through existing provider-native handoff.
6. **Harbor correction (R5, R6).** Execute the bounded procedure below after code
   and isolated examples pass. No repository migration or new runtime
   metadata-edit operation. Preserve unrelated working-tree/project changes.
7. **Documentation and final acceptance (R1–R7).** Add the new ADR, reconcile
   accepted docs, verify desktop behavior on continuous and multi-shot examples,
   and record actual playback findings rather than equating DOM assertions with
   timing correctness.

## Harbor Data Correction

Target only Project `project_x2htekrs`, Scene `scene_fzf8844n`, plan
`shot_plan_zx39wxev`, and its three registered recovered revisions. First reread
current identities/hashes, make a verified database backup and copy the retained
annotation/source trees. Record an explicit before/after manifest under Project
`tmp/operations/previs/harbor-cue-correction/`; keep a recovery copy under the
existing `.renku/project-database-backups/` backup location as well.

Review original configuration, README, caption evidence and actual rendered
motion before authoring replacements. Each render is continuous: one segment at
frame zero; verify 24fps and the actual frame counts. Remove broad review-caption
entries from cues. Author Action points for visible direction changes, not direct
exports of all blending controls. Preserve exact dialogue wording; explain in
Description that historical caption timings are planned until verified, and do
not invent recorded audio references. Recover each version independently.

Do not silently round a decimal caption time into a claim of a measured frame.
For authored frame placement, explicitly choose the nearest frame (ties forward),
record the original seconds and chosen frame in the correction manifest, then
review the render. Corrected Description distinguishes reconstruction from
historically original metadata. No automatic creative-data converter is shipped.

The three historical revisions should remain three revisions. As a one-time
pre-customer correction, replace their retained `playback.json` and affected
`description.md`, then recompute their complete source hashes with the existing
Core source-inspection algorithm. Update only the exact revision/source-hash rows
through a one-off local repair script kept under the Project's operation folder,
outside the repository. Use an explicit SQLite transaction with exact Project,
revision-id and before-hash guards. This is the user's authorized exception for
repairing this single development Project, not a runtime mutation API or a schema
migration. Do not modify the repository's migration SQL, Drizzle journal,
snapshots, schema generation, or the Project's applied-migration ledger.
This explicitly overrides immutability for this authorized repair only. Files
and SQL are not one atomic transaction: run offline from Studio, stage and verify
all files first, stop on mismatch, and retain sufficient backup evidence to
restore consistently. No runtime migration/read fallback or shipped repair tool.

Preserve render hashes/AssetFiles, creation times, revision identities, source
provenance notes, AI weak references, and accepted provider evidence. Update the
editable `previs/source` annotations to the corrected current direction. Originals
and exploration files are not deleted. Other local test fixtures are rebuilt or
updated directly to the new contract; they are not product migration targets.

## Tests and Guardrails

### Core, once at the owning layer

- All three variants round-trip without rewriting prose; unknown extensions do
  not drive behavior. Unique ids, local subject resolution, missing/invalid audio,
  time bounds and accurate diagnostic paths are covered in `timeline.test.ts`
  and existing registration tests.
- One continuous segment; multiple segments; initial zero; exact rational-rate
  conversions; invalid ordering/duplicates/out-of-bounds; cut at a dialogue's
  start or inside it; simultaneous points and overlapping dialogue accepted.
- Registration rejects malformed supplied timelines before files/rows; missing
  timeline allowed; candidate changes fail safely; valid retries remain idempotent.
  Read warnings preserve video/history; exact audio resolution stays safe.
- Existing generation association and discard/restore invariants remain unchanged.
  Do not duplicate their complete matrices in the new timeline tests.

### Adapter and UI behavior

- HTTP preserves each union variant and segment fields, converts only exact
  Dialogue audio references to URLs, and exposes no source paths. CLI representative
  registration error/delegation and `show` serialization, without Core matrix copies.
- UI test a dialogue plus coincident Action/Camera and a cut inside that turn:
  only dialogue has audition; selected audition alone highlights; cut/point seek
  never starts playback; unknown end disables only audition; full list accessible.
- Realistic media-event tests exercise asynchronous play/pause/ended/seeking and
  rejection, not only mocks whose play never emits events. Prove stale promises
  cannot cancel a later turn, shorter generation holds, main play remains continuous,
  mute/recording offset works, seek leaves audition, revision/refresh cancels safely.
- Reproduce the reported end-of-video and rapid cue-play failures in standalone
  Chrome using local media, inspect actual media error/events, and fix verified
  owning-layer defects. Test fullscreen there only; never automate it inside Codex.
- Existing import-boundary/complexity guards apply. No source-text assertions
  listing implementation names. Inspect large modules and public entrypoints.

### Agent and visual acceptance

Use isolated local examples: one continuous harbor-like scene and a two-camera
sequence with a mid-dialogue cut. No paid generations. Inspect frames around
cut-1/cut/cut+1, onset/stop events and dialogue bounds. Distinguish planned timing
from actual speech. Verify a gestured conversation creates Action points, not
invented dialogue; broad captions stay in Description; camera movement creates
Camera points and a cut comes only from a segment boundary.

Full-shell desktop captures must show the segment strip/cuts, sparse markers,
full list, one selected audition, simultaneous directions without mass highlighting,
unknown-end state and unchanged Description in both themes. Preserve the approved
0201 monitor composition; the cue semantics and timeline details intentionally
change under this plan. Visual checks must use actual new behavior, not the old
prototype's generic ranges as the acceptance rule.

## Documentation and ADR Effects

During implementation add `docs/decisions/0096-use-typed-previs-direction-timelines.md`
(check number remains free). Record domain ownership, frame timing, typed cues,
derived cuts, registration validation and the one-time historical correction.
Add concise supersession notices to ADR 0095 and, where needed, 0094; preserve their
historical bodies. ADR 0041 remains the creative-opacity boundary.

Update `docs/architecture/data-model-and-storage.md`,
`docs/architecture/project-asset-storage-conventions.md`,
`docs/architecture/reference/domain-vocabulary.md`,
`docs/product/design-guidelines.md`, and `docs/cli/commands.md`.

Sister `/Users/keremk/Projects/aitinkerbox/studio-skills` source changes:

- `skills/blender-shot-planner/SKILL.md` and
  `references/{plan-files-and-generations,directing-workflow,blender-authoring,ai-handoff}.md`:
  full typed contract, frame conversion, continuous/cut authoring, dialogue vs
  gestures, no animation-range/caption export, exact revised registration workflow.
- `skills/blender-shot-planner/evals/director-iteration.md`: continuous and cut
  examples, one turn across a cut, explicit endings, onset verification and
  preserved historical uncertainty. Add `samples/playback-continuous.json` and
  `samples/playback-cuts.json` containing all three cue kinds across the examples.
- `skills/media-producer/references/shot-plan-video/{blender-previs,workflow,director-handoff}.md`
  and `evals/shot-plan-video/forward-test-cases.md`: read the chosen revision,
  preserve segment/cut and turn intent, inspect selected provider capabilities,
  disclose derivative timing changes, and never promise AI alignment. Keep native
  requests, Preview/approval/provenance and exact revision attachment unchanged.

Do not add common provider schemas, Skill runtime cue validators, a shared Blender
starter, or guidance that treats inferred metadata as verified performance. Update
source Skills, not installed plugin cache. Leave plans 0200/0201 as implementation
history; this plan owns the corrective direction.

## Final Verification

Planning runs no production changes, migrations, media writes, paid calls or tests.
During implementation run focused tests for the modified owners, then:

```bash
pnpm check
pnpm lint
pnpm build
```

Run focused Core `shot-plan-previs/timeline.test.ts` and registration tests, Studio
Previs hook/component, VideoPlayer and serializer tests, and CLI Shot Plan command
tests using existing package Vitest commands with `--no-file-parallelism`. Run
package fixture suites sequentially: current cleanup hooks can remove concurrent
packages' temporary fixture directories. No dependency installation.

Exercise the local repair script on an isolated copy before the real correction;
verify exact target guards, rejection of an unrelated Project, hash conflicts and backups.
Verify real files against before/after manifest, database integrity, preserved
render/media bytes, and source-hash retry behavior. Record the actual commands
and results rather than marking repair checks from SQL inspection alone.
Confirm the repository contains no migration or executable repair artifact from
this correction and both migration ledgers remain unchanged.

Inspect full diff/stat and new/heavily modified files, with special attention to
transport complexity and registration IO. Confirm thin entrypoints, no duplicated
cut boundaries or validation, no SQL/runtime escape hatch, no unrelated formatting,
and no implementation imported from plans or project fixture directories.

## Completion Checklist

### Review and architecture

- [x] Confirm R1–R7 remain covered without editor/provider/dependency expansion.
- [x] Accept typed frame contract, registration-policy change and bounded retained
      Harbor annotation correction called out in Review Attention.
- [x] Match the Architecture Shape Gate; keep public indexes/adapters thin and
      timeline validation separate from IO, playback and presentation.
- [x] Preserve creative opacity: no content inference, motion parsing or generated
      performance validation in runtime; no fake Shot rows or duplicate SQL state.

### Core contracts and registration

- [x] Implement explicit Dialogue/Action/Camera variants with stable local ids,
      frame positions and correct variant-specific fields.
- [x] Implement rational frame rate/count, ordered segments and single-source cut
      boundaries, including continuous shots and dialogue crossing cuts.
- [x] Collect structural errors before registration writes; preserve missing
      optional timeline, candidate hashing and retry behavior.
- [x] Reuse validator on reads and localized safe audio resolution; preserve
      history/video on read failures and never infer missing dialogue ends.
- [x] Replace generic decoder and all direct public/browser consumers without
      aliases, obsolete-shape tests or compatibility paths.

### HTTP, CLI and Studio

- [x] Serialize all variants/segments/timing and URL-bearing Dialogue audio safely;
      retain existing CLI commands, GET endpoint and thin adapters.
- [x] Implement segment strip, incoming cut labels/boundaries, Action/Camera points
      and dialogue start markers, with no caption lane or invented subject labels.
- [x] Keep complete chronological list, crowded/coincident marker access, subject
      legends, keyboard support and frame-position cut labels.
- [x] Restrict audition controls to Dialogue; unknown end remains seekable with
      disabled audition; cuts and directions never gain Play buttons.
- [x] Separate neutral selection, moving playhead and single amber audition;
      remove active-range highlighting, including while paused.
- [x] Implement continuous main playback and bounded turn resume/replay, cross-cut
      audition, explicit overlap handling and exact recording offsets/shared mute.
- [x] Handle stale media events/promises, rapid switching, end/replay, generation
      ending first, unavailable media and revision/refresh cancellation.
- [x] Preserve two-pane geometry, take selection, Description panel/dialog, real
      shell/themes, Shot List, Assets/Audio tabs and existing fullscreen behavior.

### Skills and Harbor correction

- [x] Update every named planner/producer reference and current sample/eval;
      demonstrate all cue kinds, continuous shots and a cut within one dialogue.
- [x] Verify agent-authored events against render frames without equating animation
      controls/gestures/review captions with direction points or spoken turns.
- [x] Keep AI handoff revision-specific and timing limitations explicit; no paid
      generation or automatic retiming introduced by this plan.
- [x] Back up Harbor database/source evidence; author and review each revision's
      corrected annotations and document planned/unverified timing honestly.
- [x] Rehearse and apply the guarded local file/hash repair outside the repository;
      retain three identities, original backups, renders and AI associations.
- [x] Add no repository migrations, journal entries, snapshots, shipped repair
      scripts or schema-generation changes; leave the applied-migration ledger alone.
- [x] Update editable current source and verify all non-target data/media unchanged.

### Tests, documentation and final verification

- [x] Cover frame/segment/variant/registration invariants once in Core and test
      adapter translation and UI behavior at their owning boundaries.
- [x] Reproduce actual media playback faults and validate fixes with realistic
      event ordering plus standalone-browser playback; don't infer a fix from cues.
- [x] Capture desktop continuous/cut/dialogue/selection/error states in both themes;
      verify actual boundary frames and keep fullscreen outside Codex embedding.
- [x] Add ADR 0096 with linked notices; reconcile storage/vocabulary/design/CLI and
      docs, leaving historical decisions/plans intact.
- [x] Run focused tests, check/lint/build, local repair rehearsal and real integrity
      verification; record material warnings and any remaining limitations.
- [x] Inspect complete diff/stat, large modules and index files; confirm no god
      file, broad dispatcher, duplicated state, compatibility layer or format churn.
- [x] Confirm no item was satisfied by accepting unreviewable structure or a
      visual regression; only then mark this plan complete.

## Implementation and verification evidence — 2026-09-09

Implemented the typed timeline across Core registration/read, HTTP and Studio,
with no schema/migration changes. The new validator is isolated from retained
file IO; timeline rendering is separate from transport. Public indexes remain
unchanged/thin. Full diff and heavily modified modules were inspected, with no
compatibility reader, cue inference, fake Shot rows, duplicate cut state, generic
metadata mutation API, or format-only rewrites.

The playback investigation found two independent concerns: explicit transport
intent must not be driven by queued media events, and the file server must support
HTTP ranges. Chrome originally reported `[0,0]` for Generation seekability and
stayed at zero after an 11-second seek. After the HTTP fix both players sought to
11s; dialogue stopped both at 13.166666s. Main playback completed Previs at17s while
holding Generation at15.104s, and replay restarted both. Rapid dialogue switching
followed by Action selection paused both at6s with zero audition highlights.

An isolated six-second assembly of two existing camera views tested a cut at
frame72. Decoded frames71/72/73 show the incoming view at72. One dialogue audition
crossed that cut and stopped at its own frame96 (4s). Simultaneous Action/Camera
points, unknown-end disabled audition, neutral selection, complete scrollable
list, and both desktop themes were inspected. Foreground standalone Chrome152
verified Previs and Generation fullscreen play/pause/exit. Background Chrome
rejected fullscreen, so that attempt was not counted as acceptance. Production
Harbor had no console/media errors. The isolated fixture's unrelated browser-event
registration routes logged HTTP500; they did not affect these playback checks.

Focused tests: Core timeline/registration31; CLI Previs1; Studio transport,
resource selection, cue composition, generic video player, serialization and
HTTP byte ranges27. `pnpm check` (including lint), `pnpm build`, and `git diff
--check` pass. Existing warnings: workspace dependency/lockfile synchronization,
Studio server console lint warning and large production bundle chunks. No
installation or paid generation was performed.

Sister source Skills now document the contract, authoring semantics and provider
handoff, with continuous/cut JSON samples. Installed plugin cache is unchanged.

Harbor's local operation is at
`/Users/keremk/renku-movies/urban-basilica/tmp/operations/previs/harbor-cue-correction/`.
Its manifest records original caption seconds, chosen frames and uncertainty.
R001/R002/R003 contain respectively7/8/10 cues (four dialogue turns plus selected
action points), one continuous segment, and360/360/408 frames at24fps. No speech
recording or camera change was inferred. Actual event frames and retained notes
were reviewed. Descriptions explicitly identify silent planned rehearsal and
unverified AI timing, including r003's15-second derivative.

The guarded repair passed on an isolated copy, rejected an unrelated Project and
hash conflict, then ran with the local Studio process suspended and resumed.
The verified backup is
`.renku/project-database-backups/harbor-cue-correction-20260909/` in the Project.
It contains the database, retained/editable source trees, before/after hashes and
integrity report. Only the eight annotation files and three source-hash values
changed; all other database table values, media hashes, ids, creation times, AI
associations and applied migrations were preserved. All three registrations were
retried through Core and remained exactly three revisions without warnings.
The operation scripts and evidence are local Project files; no repository
migration, journal, snapshot, schema-generation or repair script was added.
