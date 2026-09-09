# 0201 Previs Director’s Monitor UI

Status: implemented; standalone fullscreen acceptance check pending
Date: 2026-09-09

## Summary

Bring the director-approved Previs prototype into Studio’s existing Scene Shot
Plans workflow. A Previs plan opens a fixed pair of monitors, one shared playback
transport, a subject legend, colored cue timeline, playable vertical cue list,
and the existing highlighted Description viewer. Directors use this surface
while directing the agent in Codex; generation and creative edits remain in that
conversation and the existing agent workflows.

The approved experience is the implementation target, not an illustrative
wireframe. Integration must preserve its composition and interactions while
using the real Studio shell, navigation, tab bands, fonts and theme tokens.

## Review Attention

- **Preserve the approved UI:** two equal monitor panes remain present at every
  revision, including an understated missing-generation placeholder. Keep the
  cue timeline **and** vertical list, their color coding and playback controls,
  one shared scrubber, and highlighted Description in both panel and dialog.
- **Do not import prototype chrome:** its Renku wordmark/header, breadcrumbs,
  custom tab styling, font imports/overrides, body sizing and fixture data are
  excluded. Use Studio’s existing surrounding UI and typography.
- **Necessary contract work:** the existing backend stores revisions but does
  not expose display annotations or identify the exact revision behind an AI
  generation. This plan proposes a narrowly scoped playback-display contract,
  revision-retained `description.md`, and an explicit weak generation-to-revision
  reference. These are implementation decisions for approval with this plan;
  the UI approval alone did not establish their backend shape.
- **Public changes:** extend the Previs read report and Shot Plan list projection;
  add a read-only `/screenplay/shot-plans/:shotPlanId/previs` endpoint and the
  `previs` detail-tab value; add optional `previsRevisionId` to media attachment
  and `--previs-revision` to the existing `renku media import` command. No new
  generation purpose, Settings, provider workflow or browser mutation route.
- **Storage:** one nullable, indexed weak reference on generated Assets requires
  a Drizzle Kit migration. No destructive data cleanup, file relocation,
  retroactive revision guessing, cue tables or new Asset owner kinds. Existing
  generated videos remain independent Project Assets.
- **Assumptions made explicit:** initial playback starts paused at zero;
  revision changes pause/reset playback without changing geometry; linked time
  means equal elapsed seconds, with no automatic retiming. If a revision has
  several generated takes, a compact selector in its Generation header exposes
  them and initially shows the newest. This small control handles existing
  multiple-take behavior without changing the two-monitor composition.
- **Unchanged:** Shot List workflow, mixed-card presentation, Assets and Audio
  tabs, Scene Generations, provider review/attachment, retained-source ownership,
  and existing Trash semantics. Green Screen remains outside this plan.

## Implementation Evidence — 2026-09-09

The implementation request approved the contract decisions above. Core now owns
retained display-file reads, localized diagnostics, and exact weak revision
matching. Studio uses a focused Previs feature, the existing VideoPlayer and
ShotDescriptionViewer, and the existing mixed MediaCard grid. The CLI forwards
`--previs-revision` through the normal attachment service.

**Additional necessary correction:** the existing shared font tokens referenced
themselves inside Tailwind's inline theme, making the computed mono family fall
back to surrounding sans text. The existing literal font stacks now live directly
in that theme. This fixes token resolution without adding fonts, imports, or a
Previs-specific typography override.

Drizzle Kit generated migrations 0086 and 0087 (nullable indexed weak reference,
then schema generation 69). They were applied to an isolated temporary Project;
Urban Basilica was not changed. Source Skill references and evals were updated in
the sister `studio-skills` repository, preserving its other working changes.

Full-shell desktop verification used local synthetic video and audio in
`/tmp/studio-previs-monitor`, with an isolated server binding under ignored
`tmp/previs-monitor`. That binding supplies the fixture home to the existing
Project service; it does not change production configuration or routes. Captures
include paired and unpaired revisions, the highlighted Description dialog, and
light-theme desktop layout. Equal 16:9 panes retain their dimensions across
revisions. The shared seek reaches the same elapsed second in both videos; a
bounded audio cue stops at its authored end. Assets and Audio tabs remain usable.
Audio verification covers transport behavior, not speech or voice fidelity.

Focused verification covers Core registration/display/association and video-edit
attachments, CLI flag forwarding, HTTP serialization, Shot Plans, refresh and
linked playback. Studio's final focused run passes 23 tests. `pnpm check`, `pnpm lint` and
`pnpm build` pass. Existing console and bundle-size warnings remain. Core's
focused registration/display tests pass (17), as do video-edit attachment tests
(4) and CLI media-import tests (6). Package test runs were sequential because the
existing fixture cleanup hook removes other concurrently running tests' temporary
directories.

Desktop evidence is retained under ignored `tmp/previs-monitor/screenshots/`:
`paired.png`, `unpaired.png`, `description.png`, `light-desktop.png` and
`multiple-takes.png`. The take selector defaults to the newest attached take;
selecting an older take preserves both pane dimensions and pauses playback.

**Open acceptance check:** standalone Chrome rejected fullscreen from the
background test tab. The existing player's focused tests pass, but a foreground
standalone enter/exit check is still required. No fullscreen automation was run
inside Codex's embedded browser. This plan remains open only for that acceptance
check and the final completion sign-off.

## Requirement Ledger

Each implementation outcome below traces to one source. The IDs are reused in
the slices and checklist to make omissions visible.

| ID | Source | Required outcome |
| --- | --- | --- |
| R1 | User: Shot Plans contains different representations | Keep Shot List and Previs together in the existing MediaCard grid; Previs uses its render video, title and Beats. |
| R2 | User: approved prototype and latest integration direction | Preserve the monitor/content design inside the actual Studio shell, tab primitives and font system. |
| R3 | User: revision layout correction | Always show two equal panes; missing generation uses a placeholder; Prev/Next never resizes the monitor or lower content. |
| R4 | User: linked scrubbing and fullscreen | One shared transport controls both videos; each reuses the existing fullscreen player. |
| R5 | User: timeline restoration and playable cues | Show color legend, timeline lanes/ranges/markers, moving playhead and every key point in a vertical list; support cue and voice playback. |
| R6 | User: Description reuse | Show model-neutral authored Description with the actual Shot List highlighted text component, scrollable in place and in a larger dialog. |
| R7 | User: iteration with the Codex agent | Display the selected revision’s media and cues, and reflect newly registered revisions/generations through existing refresh coordination. |
| R8 | Hard ownership and safety boundaries | Core resolves exact media/revision identity and safe file envelopes; HTTP translates; React presents. Creative interpretation stays with the director/agent. |
| R9 | Current product: weak Project-owned generated Assets | Preserve independent Asset lifecycle and exact existing take collections; revision pairing must not infer ownership or creative provenance from prompts. |

## Context and Current Evidence

### Visual source of truth

The final approved iteration is retained at:

- [Approved prototype screenshot](../exploration/previs-ui-prototype/screenshots/approved-previs.png).
- [Working prototype source](../exploration/previs-ui-prototype/src/App.jsx),
  [styles](../exploration/previs-ui-prototype/src/styles.css), and
  [playback behavior](../exploration/previs-ui-prototype/src/use-previs-playback.ts).
- [Durable design feedback](../exploration/previs-ui-prototype/AGENTS.md).

Use the approved screenshot’s **content below the mocked tab bar** for visual
comparison. Earlier `single.png`, the first paired mock, and the early QA report
are historical exploration, not current acceptance targets. In particular, the
single expanding monitor and a cue-list-only layout were superseded.

### Existing owners and gaps

| Current implementation | Reuse or required change |
| --- | --- |
| `packages/core/src/client/shot-plans.ts`: `ShotPlan.type` is `shot-list \| previs`; Previs has no artificial Shots | Keep this existing representation model; do not add a plugin registry or speculative Green Screen variant. |
| `packages/core/src/server/shot-plan-previs/{registration,projection}.ts` | Reuse `readShotPlanPrevis`, `registerShotPlanPrevis`, retained source directories, numbering and render Assets. Extend the read owner for presentation. |
| `PrevisRevision` currently contains id, number, sourceDirectory, createdAt and render | No Description, playback projection or paired generations currently exists. The projection currently omits rows whose render Asset is unavailable; preserve revision rows for this UI instead. |
| `packages/core/src/server/shot-plan-video-generations/projection.ts` | Project-owned `shot_plan_video` Assets are grouped by weak Shot Plan authorship. That is not an exact revision association. |
| `MediaGenerationProvenance` stores provider request/receipt JSON | Do not parse provider request text or guess timestamps/reference derivatives to decide revision pairing. |
| `packages/studio/src/features/movie-studio/shot-plans/scene-shot-plans-tab.tsx` | Keep MediaCard grid sizing, overlay title/Beat copy, actions and focus restoration. Add the video-media branch to the same surface. |
| `shot-plan-detail-page.tsx` | Currently assumes Shots and mounts a rail/detail view. Keep its tab/header integration; split Shot List composition from Previs composition. |
| `ShotDescriptionViewer` and its CodeMirror themes | Reuse directly in both Description sizes. It preserves authored Markdown while coloring headings/strong text; do not add semantic mention enrichment. |
| `VideoPlayer` and the prototype’s existing working-tree enhancement | Reuse the actual player; complete its optional external-transport handle/callback contract. Do not build a second video player or import prototype DOM selectors. |
| `useStudioResourceRefresh`, Scene Shot Plan and Scene video-generation resource keys | Reuse event invalidation; no new watcher, polling service, agent callback or persistent editing session. |

Plan 0200 and ADR 0094 established type/storage/registration and deliberately
deferred the player. Plan 0194/ADR 0090 owns Shot Plan Dialogue Audio; this plan
references exact existing audio files without rebuilding its turn-range or
selection model. Plans 0189/0191 and ADR 0069 constrain provider-independent
attachment and weak generation context. No provider functionality is restored
or redesigned here.

Relevant accepted documents:

- `docs/product/design-guidelines.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/{coding-practices,naming-guidelines,data-model-and-storage}.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/{structured-diagnostics,drizzle-migrations}.md`;
- ADRs 0041, 0069, 0090 and 0094.

The design guidelines contain older examples of raw buttons and legacy shell
anatomy. The current AGENTS rule requiring local shadcn controls and the actual
Studio shell implementation take precedence. The applicable Description rule
is exact authored text with presentation-only syntax coloring, not semantic
recognition of names or filmmaking intent.

Read-only inspection of Urban Basilica’s `.renku/project.sqlite` found four
Shot List plans and no registered Previs revisions. The prototype uses actual
Harbor exploration videos with illustrative metadata; it is not evidence of a
populated production Previs read path. Do not silently convert that Shot List,
rewrite old sources, or import the prototype fixtures into the real database.

### Reuse decision

1. **Unchanged contracts** suffice for shell, cards, Description rendering,
   playback primitives and provider workflow, but cannot supply revision-specific
   annotations or exact generation pairing.
2. **Extend existing owners** for Previs reads, Shot Plan list media and Asset
   weak source context. This is the selected approach.
3. **A new generic timeline/revision/dependency system** is unnecessary. The new
   bounded concepts are only the authored display envelope and the missing
   exact revision reference; neither becomes an animation engine or owner graph.

## Product Behavior and Visual Acceptance

### Entry and surrounding Studio UI — R1, R2

- Keep the existing Project sidebar, Scene heading, Scene tabs, back action and
  Shot Plan title handling. Do not add another Renku header or breadcrumb row.
- Use the existing `Tabs`, `LineTabBar`, and `LineTabsContent`. Shot List keeps
  `Shots / Assets / Audio`; Previs uses `Previs / Assets / Audio`. Assets and
  Audio remain their real functioning tabs, unlike the disabled prototype tabs.
- Keep the Shot Plans MediaCard grid at its existing minimum width, gap, ratio,
  overlay copy and actions. Shot List uses the existing mosaic. Previs uses the
  latest registered revision’s render with the existing hover-muted video
  treatment. If that render is unavailable or no revision exists, use a quiet
  video empty state in the same card; do not substitute an AI take or an older
  revision without saying so.
- Keep existing Scene-local plan number/title and actual covered-Beat copy.
  Do not add fixture names, filenames or ids to the cards. Previs delete copy
  must not incorrectly promise deletion of Shot images; use accurate existing
  plan-to-Trash semantics without changing them.

### Fixed director’s monitor — R3, R4

- Prev, `Revision N of M`, Next remain a compact bar above the media. Disable
  navigation at the first/last registered revision. Use actual revision numbers;
  `M` is the available history count, not a fabricated sequence.
- Always render a 50/50 pair labelled **Previs** and **Generation**, with equal
  16:9 viewing surfaces, contained uncropped media, fine borders and rounded
  corners. Match the approved Revision 3 proportions at the same content width.
- A missing generation reads **No generation for this revision** with a subdued
  film icon. No Compare button, generation CTA, large instructions or hidden
  alternate layout. Loading and errors occupy the same fixed pane.
- Before the first revision, show **No revisions** with disabled Prev/Next and
  **No visualization yet** in the left pane. An unavailable registered render
  gets a concise unavailable state in that same pane. Disable the shared
  transport and cue seeking until the previs has playable metadata; do not
  remove its history entry or collapse the layout.
- Prev/Next may change video, labels, cue content and Description, but not pane
  widths, viewing height, transport position or lower-panel geometry. Stop all
  playback and initialize the new revision at zero. No auto-play or eight-second
  fixture seek. No animated growing/shrinking transition.
- One shared play/pause control, elapsed/duration display, thin amber scrubber
  with solid thumb and mute control sits under both videos. Do not add inline
  per-video scrubbers or a second volume-slider line.
- Both videos seek to the same elapsed seconds. Previs is the clock and duration
  authority; a shorter generation holds its last frame, and a longer one pauses
  when the previs ends. Show actual durations in the pane headers. Do not stretch
  either video or infer provider timing alignment. A generated performance may
  differ from the authored cues; the UI is for reviewing that difference.
- Reuse each VideoPlayer’s fullscreen affordance and fullscreen controls. When
  fullscreen is open its normal player controls may appear; they remain linked
  to the shared clock. Closing fullscreen preserves position and returns focus.
- Multiple matched generations use a small local Select in the Generation header,
  only when needed. Order by createdAt descending then id, default to the newest,
  use existing authored take titles, and keep that choice while it remains
  available. This is a browsing choice, not canonical Asset selection.

### Legend, timeline and playable vertical cues — R5

- Keep the compact subject legend immediately below the monitor. Render the
  revision’s authored labels/colors in order; never hard-code Mara/Urban or
  infer Cast identity from text. Include objects as well as cast proxies. Keep
  a fixed-height legend strip with horizontal overflow rather than wrapping and
  pushing the panels down when a different revision has more subjects.
- Keep the lower split approximately 61% cues / 39% Description, with a 16px
  gap and equal bounded panel heights, as in the approved prototype. Size the
  panel bodies independently of cue count so revision navigation does not
  change their outer dimensions.
- The lower-left panel has the **Previs cues** heading, a time ruler, colored
  lanes and a moving vertical playhead, followed by the vertical list. Preserve
  the colored outlines/fills, restrained track background, round play controls,
  subject dots and amber active-row treatment from the approved screenshot.
- An authored start/end interval is a range; a start-only cue is a marker. This
  is structural presentation, not a runtime speech/action classifier. Never
  branch on a particular subject’s name as the prototype fixture does.
- Timeline and list consume the same cue collection and clock. Clicking a range,
  marker or row timestamp seeks both videos. Timeline lanes are not extra
  full-width transport sliders. Accessible buttons and the shared slider provide
  keyboard operation.
- Show **all** authored key points in chronological order, with authored order
  breaking equal-time ties. No speech-only filtering or three-row limit. The
  list scrolls within its panel. Lane labels and horizontal time alignment stay
  readable; when subjects exceed the allotted lane space, scroll the lanes
  vertically while retaining the ruler and list. No right-hand cue rail.
- Subjectless cues use a neutral **Cues** lane and keep their text in the list.
  An unknown local subject does not remove a cue or block playback: display its
  supplied key with a neutral dot. Empty annotations keep the videos usable.
- Each row has separate seek and play controls. A range plays from its start to
  its end; a point plays from its timestamp until paused or the video ends.
  Clicking the active play control pauses. Starting another cue stops the prior
  audition. Playback position determines the highlighted interval; a point is
  highlighted until the next cue start, or the video end.
- When a cue has an explicit audio reference, play its exact recorded file from
  the specified offset at the cue start. Seeking into its interval seeks the
  audio to the corresponding offset. Stop at the cue end or audio end, without
  stretching or manufacturing speech. Missing audio leaves the cue seekable and
  playable as video, with a concise unavailable-audio indication on that cue.
- Ordinary playback uses generation audio when a generation is present, otherwise
  previs audio. Cue-play with an attached recording temporarily auditions that
  recording and mutes video audio to prevent double speech, restoring ordinary
  audio when the audition ends. The shared mute applies to the active audio.
  This preserves the approved controls; no new audio mixer/source menu or
  automatic multitrack voice playback is introduced. Overlapping authored
  intervals remain visible; auditioning a different cue stops the prior audition
  without rewriting either interval.

### Description and content styling — R2, R6

- The right lower panel remains a bounded, scrollable inset Description surface
  with an expand icon. Use `ShotDescriptionViewer` in both this panel and a large
  Studio Dialog. The dialog uses Studio header/body anatomy and a scrollable
  reading area, approximately the prototype’s 850px width with desktop viewport
  bounds. Do not replace either view with plain paragraphs or a generic textarea.
- Feed the exact same authored Markdown to both instances. Preserve heading and
  strong-text colors, copied text and line wrapping. No model prompt, summary,
  rewriting, mention lookup, semantic highlighting or generated explanatory copy.
- Read the Description retained with the selected revision. A later source edit
  must not make a historical render display new instructions. Missing Description
  uses a quiet **No description** state in the same box.
- Use Studio `font-sans`/`font-mono`, inherited from
  `src/styles/theme.css` and the app’s existing font loading. Current families
  are Montserrat and Geist Mono. No Google Fonts import, new font family,
  `:root.dark` override or copied mock wordmark. Use app text scales: 11px
  uppercase section labels, readable body/cue text, secondary monospace timecodes.
- Map the approved charcoal depth, inset surfaces, subtle borders/radii, muted
  labels and amber accent to existing semantic tokens. Use the current theme in
  both dark and light mode; never force the whole app dark or introduce a new
  Previs theme setting. Authored subject colors remain data.
- Use local shadcn controls and Tailwind utilities. No prototype-wide CSS, root
  min-width, custom tab selectors, arbitrary MediaCard slots or style reset.

### Refresh and smaller desktop windows — R7

Initially select the latest registered revision. If the director is viewing the
latest revision, a newly registered revision becomes selected, paused at zero.
If they deliberately moved backward, preserve that historical selection; Next
becomes available. An arriving take for the current revision fills the reserved
Generation pane without shifting the layout. Preserve an explicit local take
selection across unrelated refreshes.

Use the existing resource-refresh events for revision registration, Asset
attachment, discard/restore and Audio changes. Do not introduce filesystem
polling; the supported agent flow writes a revision candidate and registers it.

Fit into the actual remaining Studio content width, including its sidebar and
header bands. Keep monitors side by side at supported desktop widths. On shorter
windows, allow the tab’s existing content area to scroll; retain bounded cue and
Description scrolling and access to the shared transport. Do not shrink text to
illegibility, hide key points or introduce mobile layouts.

## Explicit Non-goals

No in-app agent chat, generation button/workflow, Blender execution UI, drag-to-edit
timing, persistent playhead, revision restore/delete controls, fullscreen redesign,
timeline export, audio generation, automatic transcript alignment, Green Screen
support, Shot Plan type filters, generic revision framework or provider time-map
interpreter. The prototype remains design evidence, not a runtime dependency.

## Contracts and Ownership

### Display artifacts: explicit narrow extension of ADR 0094

Add optional `description.md` beside `playback.json` in the agent’s revision
candidate. Registration already copies exact source bytes; retain both under
`previs/revisions/rNNN/` without adding database columns for their text. The
editable authoring copy lives under `previs/source/`. The agent owns model-neutral
Description and derives cues from its directing choices; Studio never derives
them from Python, scene.json, audio transcription or media inspection.

The playback display vocabulary is:

```ts
interface PrevisPlayback {
  subjects: Array<{ key: string; label: string; color: string }>;
  cues: Array<{
    startSeconds: number;
    endSeconds?: number;
    subject?: string;
    text: string;
    audio?: {
      assetId: string;
      assetFileId: string;
      offsetSeconds?: number;
    };
  }>;
}
```

This is a display envelope, not an animation or screenplay schema. Empty arrays
are valid. Labels/text are opaque strings, subject keys are local, and an absent
end denotes a point. Audio is an exact existing Project AssetFile reference,
normally from Shot Plan Dialogue Audio; never resolve “currently selected” audio
at playback time. `offsetSeconds` defaults to zero as a documented playback rule.

Core reads only these two fixed filenames beneath the selected retained source
directory, using existing project-relative/realpath guards. It validates only
JSON structure, finite nonnegative times, end greater than start, unique local
subject keys, a six-digit hex display color, and audio identity/media-kind/path
envelopes. Do not require Cast/Beat/turn matches, nonempty creative prose,
particular subjects, cue counts, terms or agreement with the actual performance.
Unrecognized creative extensions are not interpreted or copied into UI logic.

Registration continues to accept source snapshots without either file and does
not gain an annotation validator. During reads, a missing optional file means no
annotations/Description. An unreadable or structurally invalid display file
produces a localized diagnostic and an unavailable annotation area while the
render remains playable; never silently rewrite the file or reject the render.
An unavailable audio reference is omitted from playable audio with a cue-located
warning, preserving its text/timing. Cues outside the media’s duration remain in
the list; disable out-of-range seeking instead of clamping their authored time
or pretending they match the video.

This narrowly changes ADR 0094’s “playback JSON remains opaque” rule to permit
display-only projection of explicit annotations. It does **not** permit creative
semantic interpretation under ADR 0041. Record that decision explicitly before
implementation; do not smuggle parsing into React or the HTTP adapter.

### Existing Previs read and list contracts

Extend `PrevisRevision` in `packages/core/src/client/shot-plan-previs.ts` with:

- `render: Asset | null` (retain the history row if its Asset is unavailable);
- `description: string | null`;
- `playback: PrevisPlayback | null`;
- `generations: Asset[]` (active matched Project `shot_plan_video` Assets);
- `warnings: DiagnosticIssue[]` for that revision’s display/media issues.

Keep the existing id, number, sourceDirectory and createdAt. Keep
`ShotPlanPrevisReport` and `readShotPlanPrevis` as the read entrypoint; do not add
a competing generic snapshot service. Registration returns this extended report
without changing source/hash/retry behavior. Update registration response
consumers and CLI show fixtures for nullable renders directly. The current
`media-generation-context/purposes/shot-plan.ts` already exposes registered
render Assets independently; preserve that existing reference-candidate path.

Add `previsRender: Asset | null` to the existing `ShotPlanListReport` list entry
for the latest registered revision only; it is null for Shot List and Previs
without an available latest render. This supplies cards in one Scene read,
without each card loading every revision or independently selecting its source.
Reuse a focused latest-render database query; do not load Description/playback
files for the card grid.

Add `GET /studio-api/projects/:projectName/screenplay/shot-plans/:shotPlanId/previs`.
It calls `ProjectDataService.readShotPlanPrevis`, then serializes browser-safe
Assets with existing Asset response helpers. `StudioShotPlanPrevis` contains
shotPlanId, revisions and resourceKeys; exclude filesystem project/source paths.
Each browser revision keeps the Core display fields, replacing render/generation
Asset files with existing `StudioShotAsset` URL-bearing shapes. Resolved cue
audio receives `url` from the same AssetFile URL mechanism; never accept arbitrary
audio URLs or filesystem paths from JSON. Reuse the authenticated Asset file
endpoint and Range support; no general source-directory browsing endpoint.

Core diagnostic additions are limited to
`CORE_PREVIS_PLAYBACK_INVALID`, `CORE_PREVIS_DESCRIPTION_UNAVAILABLE`,
`CORE_PREVIS_CUE_AUDIO_UNAVAILABLE` and `CORE_PREVIS_GENERATION_SOURCE_INVALID`.
Reuse existing source-path, type and render-unavailable diagnostics where they
already apply. Reads expose revision/cue-local issues; HTTP maps fatal errors
through `projectErrorResponse`. Missing optional annotations are not warnings.

### Exact weak generation reference — R8, R9

Extend existing Asset authorship rather than creating a separate take collection:

```ts
// Existing Asset.authoredFrom shape, extended in its current owner.
authoredFrom: {
  kind: 'shotPlan';
  id: string;
  previsRevisionId?: string;
} | null;
```

Persist `asset.authored_from_previs_revision_id` as nullable indexed text beside
the existing weak Shot Plan id, without a foreign key or cascade. The Core
attachment service verifies that a supplied revision belongs to the specified
Previs plan before any file/database write. It is allowed only for
`shot-plan.video-generation`; unrelated purposes must not silently accept it.

Add optional `previsRevisionId` to `AttachGenerationMediaInput` and its current
ProjectDataService contract/wiring. Extend `renku media import` with
`--previs-revision <revision-id>`; the CLI only passes the value to Core. Media
Producer supplies it when attaching a take made for the selected revision,
including when the provider received a prepared derivative. Provider provenance
remains unchanged. A supplied invalid reference fails with the source diagnostic;
an omitted reference remains a valid unpaired generation, visible in Scene
Generations. Do not infer pairing from filename, newest revision, prompt, provider
request shape, video length or a reference path.

The Previs read owner queries by exact plan/revision identity. More than one
generation per revision is valid. Trashing either plan/render does not trash the
generated take or block its ordinary lifecycle. Restore retains the same weak
reference. Existing `video.edit` continuation copies the source Asset’s weak
revision reference just as it already copies Shot Plan authorship; it does not
re-evaluate creative lineage. No generic update API or relink UI is added.

Generate and apply the nullable-column migration through Drizzle Kit, following
the current migration/distribution docs. Existing rows remain null: no backfill
heuristic, repair-on-read or Harbor data conversion. No migration is run during
this planning task.

### Navigation and refresh contracts

Extend `ShotPlanDetailTab` in `client/resources.ts` with `previs` and update
`src/app/use-project-session.ts` parsing/serialization. Card activation explicitly
uses the correct primary tab. An omitted tab resolves from the loaded plan type;
an explicitly incompatible tab/Shot id uses the existing invalid-selection
handling, not a fake Shots view. Assets/Audio remain valid for both types.

Keep local revision id, generation id and playback state in the Previs feature;
they are browsing state, not new URL or database contracts. Use existing Scene
Shot Plan, Scene Generations and Shot Plan Audio refresh keys. Ensure render
discard/restore invalidates the existing Shot Plans surface as registration does.
Do not create a new resource-key family merely for the tab.

## Architecture Shape Gate

### Intended module layout and public entrypoints

```text
packages/core/src/
  client/
    shot-plan-previs.ts               # existing read types + display envelope
    shot-plans.ts                    # existing Scene list render projection
    assets.ts                        # existing weak authoredFrom extension
    resources.ts                     # previs detail tab
  server/
    shot-plan-previs/
      registration.ts                # existing registration; no creative parser
      projection.ts                  # revision/read composition
      playback.ts                    # safe display-file reads and envelope decoding
      generation-source.ts           # exact revision validation and matching
    shot-plans/projection.ts          # list render summary, no per-card file IO
    assets/{projection,resource-keys}.ts  # existing Asset projection/invalidation
    schema/assets.ts                 # nullable weak reference
    database/access/assets.ts         # existing insert/projection plumbing
    generation/{attachments,attachment-persistence}.ts
    video-edit-attachments/attachment.ts
    project-data-service-contracts.ts
    project-data-service-wiring/{shot-plans,generation}.ts

packages/cli/src/
  cli.ts                             # flag declaration and dispatch only
  commands/media-import/{command,generic}.ts

packages/studio/
  server/routes/shot-plans.ts         # one additional thin GET handler
  server/http/shot-plan-responses.ts  # list media serialization
  server/http/previs-responses.ts    # browser-safe report serialization
  src/services/shot-plan-previs/
    contracts.ts                     # browser URL shapes, no new domain model
    api.ts                           # readStudioShotPlanPrevis transport
  src/services/studio-shot-plans-contracts.ts
  src/app/use-project-session.ts
  src/features/movie-studio/shot-plans/
    scene-shot-plans-tab.tsx          # existing mixed card entry
    shot-plan-detail-page.tsx         # shared tab composition, stays small
    shot-list-tab.tsx                 # extract existing Shot rail/body composition
    shot-description-viewer.tsx       # reuse existing highlighted viewer directly
    previs/
      previs-tab.tsx                 # resource state + monitor/cues/Description
      use-previs.ts                  # loading, selected revision/take, refresh
      monitor.tsx                    # revision bar, two panes, single transport
      use-previs-playback.ts          # clocks, seek/pause, cue/audio playback
      cues.tsx                       # legend, timeline lanes, playable list
      description.tsx                # viewer panel + expanded Studio Dialog
  src/ui/video-player.tsx             # existing domain-neutral playback primitive
```

Use `readShotPlanPrevis`, `registerShotPlanPrevis`, `listSceneShotPlans` and
`attachGenerationMedia` through the existing Core server public entrypoint and
ProjectDataService. No new barrel is needed; any additions to existing `index.ts`
files are exports only. `previs-tab.tsx` is the feature entry component; import
it directly. The service API module owns HTTP calls, not domain selection.

Only two representation branches are needed in the existing card/detail owners:
Shot List and Previs. Do not add a generic representation registry for possible
future types. Keep source validation/matching in the bounded Previs Core module;
do not grow the already broad attachment dispatcher with its implementation.
The existing attachment function delegates once to that owner and persists the
returned explicit identity through its established transaction/write-set path.

`shot-plan-detail-page.tsx` must shrink by moving its Shot List rail/body into
`shot-list-tab.tsx`, preserving current interactions, rather than appending the
whole Previs implementation to it. Reuse `ShotDescriptionViewer` directly;
the new Description component owns real panel/dialog composition, not a re-export.

Refine the existing prototype enhancement to `VideoPlayer` in place. Keep its
domain-neutral handle (`play`, `pause`, `seek`, `setMuted`, `getCurrentTime`),
optional time/duration/playing/seek callbacks and `inline | external` controls.
Core knows nothing about browser player handles. Feature playback code must not
query or mutate private VideoPlayer DOM or construct another video player.

**Stop conditions:** revise the slice before adding a generic state patch,
provider-specific association logic, annotation parsing in React/HTTP, a second
Description theme, invented fonts/tabs, a cue database, cross-domain lifecycle
guards, or a file combining fetch, media clocks, timeline drawing and dialog
rendering. Passing tests cannot excuse those shapes. Do not move this prototype’s
App/styles wholesale into production.

## Implementation Slices

1. **Contracts and display ownership (R6–R9).** Record the narrow ADR decision;
   add description/playback reads to the existing Previs owner, safe audio-file
   resolution, nullable-render history and the latest-render list projection.
   Update report callers directly. Keep registration’s snapshot and
   idempotency boundaries intact; no annotation validation at write time.
2. **Exact generated-take context (R7–R9).** Add the weak nullable column with its
   Drizzle migration, Core attachment validation/persistence/projection, CLI flag
   and video-edit propagation. Keep the matching logic in `generation-source.ts`.
   Extend existing refresh invalidation for rendered Assets, without altering
   Asset membership, generation purposes or Trash ownership.
3. **Browser transport and Studio integration (R1, R2, R7).** Add the thin GET and
   browser serializer/service, extend card media and route tab vocabulary, extract
   the current Shot List tab, and mount `PrevisTab` through the current detail
   page. Existing Assets/Audio and header/back/focus behavior remain functional.
4. **Approved director UI (R2–R6).** Implement monitor, playback, cues and
   Description modules using the saved approved image and actual app typography.
   Replace every fixture shortcut: subject-name conditions, fixed tick spacing,
   initial eight-second seek, hard-coded actors/cues, custom tabs and font CSS.
   Keep two panes and the approved visual treatment in all revision states.
5. **Agent handoff and integration evidence (R5–R9).** Update source Skills,
   samples/evals and accepted docs. Demonstrate a registered revision with an
   exact matched generation and a voice cue on an isolated development fixture,
   while keeping the real Urban Basilica project unchanged unless separately
   authorized. Confirm visual acceptance inside the full Studio shell.

## Tests and Guardrails

No tests or production implementation are run while authoring this plan. The
user’s request to skip tests applied to fast prototype iteration; the following
is focused coverage for the eventual production implementation, not a new
prototype QA project.

- **Core, once at the owning layer:** missing optional files; exact retained
  Description text; safe path/media envelopes; absent/unknown subjects; valid
  point/range/overlap input; localized malformed-display/audio issues without
  losing render/history; latest card render; exact revision matching; several
  takes; unpaired Assets; supplied cross-plan revision rejected before writes;
  weak reference preserved through existing discard/restore/edit flows. Keep
  source registration retry tests focused on their existing invariants.
- **HTTP/CLI:** one representative serialization/URL-safety and error-mapping
  check; `--previs-revision` forwarded to Core. Do not repeat Core’s input matrix.
- **UI behavior:** correct primary tabs and mixed card entry; unchanged Shot List
  navigation; stable pane geometry with/without a take; revision-specific cues,
  Description and generation; one transport; clickable timeline and cue play;
  optional voice audition, mute and shorter video end; highlighted viewer
  in both sizes; refresh preserves historical selection. Use small focused
  feature/player tests, not a browser journey for every edge case.
- **Architecture:** use existing import-boundary/complexity rules. Do not add
  source-text assertions naming private helpers or listing every handler. Inspect
  the diff to verify parsing and association remain in Core and UI imports only
  client contracts/services.
- **Visual acceptance:** a short full-shell desktop walkthrough and screenshots
  of paired, missing-generation, timeline/list and expanded Description states.
  Compare the monitor/content crop against `approved-previs.png` at equal content
  width; separately verify the surrounding shell/tabs/fonts match the live app.
  Functional assertions alone cannot satisfy this requirement.

## Documentation and Agent Effects

During implementation add
`docs/decisions/0095-use-previs-playback-display-metadata.md` (reserve this name
with this plan; check it is still unused before implementation). Record the
narrow display interpretation and weak revision reference. Add a brief linked
notice to ADR 0094 without rewriting its historical decision. ADR 0041’s creative
opacity rule remains; the new ADR must explain the explicit display envelope.

Update `docs/architecture/data-model-and-storage.md`,
`docs/architecture/project-asset-storage-conventions.md` and
`docs/product/design-guidelines.md` with the accepted current contracts and the
fixed director-monitor pattern. Update `docs/cli/commands.md` and CLI help for
the single new media-import flag; do not add a separate generation guide/runtime.

In the sister `studio-skills` source project, update:

- `skills/blender-shot-planner/references/plan-files-and-generations.md`: exact
  `description.md` and playback display vocabulary, source/revision placement,
  optional exact audio file references and point/range examples;
- `references/directing-workflow.md` and `references/ai-handoff.md` in that Skill:
  derive description/cues from the same directing choices and carry the selected
  registered revision id into the generation handoff;
- `skills/blender-shot-planner/evals/director-iteration.md`: revision-specific
  prose, changed timings, object/subjectless cues and optional voice audition;
- `skills/media-producer/references/shot-plan-video/{blender-previs,workflow,director-handoff}.md`:
  pass `--previs-revision` on the existing attachment command, including derivative
  inputs, without bypassing current Preview/approval/provenance steps;
- `skills/media-producer/evals/shot-plan-video/forward-test-cases.md` and
  `samples/shot-plan-video/video-review.json` in that Skill:
  exact revision attached, no latest-revision inference, no paid generation for
  contract verification. Edit source Skills, not the installed plugin cache.

Do not rewrite historical plans or delete the approved prototype/reference
artifacts. The production implementation must not import from `plans/`.

## Final Verification for Implementation

Run focused Core tests for `shot-plan-previs` and the changed attachment owner,
focused Studio tests for Shot Plans/Previs/VideoPlayer and its GET serializer,
and the changed CLI media-import test. Then use `pnpm check`, `pnpm lint` and
`pnpm build` for the cross-package contract change. Do not install dependencies,
run paid generations or repeat full test matrices without a concrete failure.

Inspect the generated Drizzle SQL/journal and apply it only to the explicit
development fixture using the documented migration command. No request-time
migrations or database backfills. Run the short visual walkthrough described
above in windowed Chrome. **Do not automate fullscreen inside Codex’s in-app
browser:** that prototype check froze the whole host app. Verify existing-player
fullscreen separately in the standalone Studio browser, without claiming the
Codex host issue was fixed by this feature.

Inspect `git diff --stat`, the full diff and all new/heavily modified modules.
Confirm the Shape Gate, direct caller updates, thin entrypoints, no unrelated
formatting, no app shell/font regressions and no generated files under source.
No automatic plan-review agent or review loop is part of this plan’s creation.

## Completion Checklist

### Review and architecture shape

- [x] Approve the display-only playback/Description contract and weak generation
      revision reference called out in Review Attention.
- [x] Confirm each planned outcome still traces to R1–R9 with no added generation
      workflow, editor, Settings, Green Screen type or dependency framework.
- [x] Match the module layout, extract Shot List composition and keep the detail
      page, HTTP/CLI adapters and existing `index.ts` entrypoints thin.
- [x] Keep filesystem/envelope resolution and exact identity matching in Core;
      retain UI-only clocks and local revision/take browsing state in the feature.

### Core contracts and persistence

- [x] Extend Previs read types with exact Description, playback, matched
      generations, localized warnings and nullable render without losing history.
- [x] Project the latest render into the existing Scene Shot Plan list without
      per-card annotation/history reads.
- [x] Read fixed retained `description.md` / `playback.json` safely; preserve
      authored strings and support absent annotations without blocking video.
- [x] Support point/range, overlapping and subjectless cues and exact optional
      audio files; resolve failures locally without creative interpretation.
- [x] Preserve registration copy/hash/retry behavior and update nullable-render
      report consumers directly; retain existing generation-context candidates.
- [x] Add the nullable indexed weak Asset revision reference through Drizzle Kit,
      with no FK, cascade, historical guessing or runtime migration.
- [x] Validate supplied revision identity at attachment before writes; preserve
      unpaired takes and independent Project Asset lifecycle.
- [x] Carry the weak reference through existing video edits and restore behavior;
      reuse refresh keys for render/generation changes.

### HTTP, CLI and agent surfaces

- [x] Add the thin Previs GET, browser-safe Asset/audio URL serialization and
      service API; expose no retained source-directory browsing or raw paths.
- [x] Extend `ShotPlanDetailTab`, route parsing/serialization and type-aware
      primary-tab selection without changing Assets/Audio behavior.
- [x] Add `--previs-revision` to existing media-import flag/dispatch/help and
      delegate its identity validation to Core.
- [x] Update the named Blender planner and Media Producer references/evals for
      retained Description, cue/audio metadata and exact generation attachment.

### UI acceptance — no regression from the approved prototype

- [x] Use the real Studio shell/header/back action/line tabs and app font tokens;
      import none of the mocked chrome, global styling or font-loading overrides.
- [x] Keep mixed Shot List/Previs MediaCards with existing title/Beats/actions and
      video preview for Previs; preserve focus restoration and accurate Trash copy.
- [x] Keep equal fixed monitor panes at every revision, with a quiet missing-
      generation placeholder and no Compare button or resizing transition.
- [x] Preserve compact revision navigation, labels, actual durations, thin amber
      shared scrubber, layered surfaces, borders/radii and fullscreen affordances.
- [x] Link play/pause/seek and fullscreen controls; start/reset at zero, hold the
      shorter video, and make multiple takes reachable without changing geometry.
- [x] Show the authored subject legend, colored timeline ranges/markers and
      moving playhead above the full scrollable vertical cue list.
- [x] Keep subject dots, active amber row treatment, separate seek/play controls,
      keyboard access and all action/dialogue/object/subjectless key points.
- [x] Play explicit voice recordings at authored offsets, support seeking and
      shared mute without duplicate audio, a new mixer or automatic retiming.
- [x] Use the same ShotDescriptionViewer in compact and expanded views with
      exact Markdown, colored highlights, scrolling and Studio dialog anatomy.
- [x] Reflect arriving revisions/takes while preserving intentional historical
      browsing and the fixed pane geometry.
- [x] Fit supported desktop content widths/heights with the real sidebar present;
      preserve readable typography and scrolling in dark and light themes.

### Focused validation and documentation

- [x] Cover Core display/envelope/identity behavior once at its owning layer;
      cover adapter translation and UI interactions without duplicate matrices.
- [x] Complete representative paired/placeholder/cue-audio/Description journeys
      on isolated development data; leave real Urban Basilica unmodified unless
      separately authorized.
- [x] Add ADR 0095 and its notice on ADR 0094; update storage/data-model/design
      docs and existing CLI help without rewriting decision history.
- [x] Retain the approved screenshot/prototype as design evidence and exclude
      all fixture names/media imports and subject-name branches from production.

### Final verification

- [x] Run the focused tests and cross-package check/lint/build commands above.
- [x] Inspect migration output and verify its nullable addition on the fixture.
- [x] Compare full-shell desktop captures and the normalized content crop with
      the approved prototype; verify fonts/tabs separately against the app.
- [ ] Check fullscreen only in a standalone browser, never via Codex embedded
      fullscreen automation.
- [x] Inspect complete diff/stat and large changed files; verify thin entrypoints,
      no god files, broad dispatchers, compatibility layers or formatting churn.
- [ ] Confirm no checklist item was satisfied through unreviewable structure or
      a visual regression; only then mark this plan complete.
