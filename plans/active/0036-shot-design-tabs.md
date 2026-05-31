# 0036 Shot Design Tabs

Date: 2026-05-30

Status: proposed

> Companion to `0033-scene-shot-list-ui.md`. That plan ships the Shot Design
> Surface shell (top video stage + a `LineTabBar` with five tabs) and the
> read-only Description tab. This plan designs the four remaining tabs — Camera
> Framing, Camera Motion, Location, Camera Type — and the write-back path that
> persists a director's camera choices for a shot.

## Goal

Turn each shot's design surface from a scaffold into a working camera-design tool
where a director selects shot framing, camera motion and blocking, location
angle, and camera/lens equipment through **visual, rendered controls** rather than
flat checkbox lists, and where those choices persist as durable per-shot design
parameters that will feed the future video-generation prompt.

Primary design problem this plan owns: the reference mockups present camera
language as long, flat checkbox columns that mix several independent axes
together (height, framing, focus, shot size, movement, mechanism, direction). The
job here is to **organize those axes correctly**, deduplicate the overlapping
shot-size vocabulary, and present each axis as a compact set of rendered tiles
with the right selection semantics (single vs multi), plus a custom entry.

## References

- `docs/product/design-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/json-storage-validation.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `docs/decisions/0024-keep-media-slicing-out-of-app-state.md`
- `plans/active/0032-scene-shot-list-cli-skill-and-data-model.md`
- `plans/active/0033-scene-shot-list-ui.md`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/server/scene-shot-list-json/validator.ts`
- `packages/core/src/server/database/access/scene-shot-lists.ts`
- `packages/studio/src/features/movie-studio/scenes/` (scaffold from 0033)
- StudioBinder — Camera shot sizes:
  `https://www.studiobinder.com/blog/types-of-camera-shots-sizes-in-film/`
- StudioBinder — Camera angles:
  `https://www.studiobinder.com/blog/types-of-camera-angles/`
- StudioBinder — Camera movements:
  `https://www.studiobinder.com/blog/different-types-of-camera-movements-in-film/`
- MasterClass — Shot sizes:
  `https://www.masterclass.com/articles/shot-sizes-explained`

## Product Framing

A shot's "look" is the product of several **independent** decisions. The
reference mockups blur them. The core organizing idea of this plan is to model
each as its own axis with explicit selection semantics:

| Axis | What it controls | Selection | Lives in tab |
|------|------------------|-----------|--------------|
| Shot Size | how much of the subject fills the frame | single (ordered ladder) | Camera Framing |
| Subject Framing | who/what is in frame and their relationship | multi | Camera Framing |
| Camera Angle / Height | vertical viewpoint on the subject | single | Camera Framing |
| Dutch Tilt | lateral roll of the horizon | none / left / right | Camera Framing |
| Camera Movement | what the frame does over time | single primary + optional combo | Camera Motion |
| Rig / Mechanism | how the camera is supported and moved | single | Camera Motion + Camera Type |
| Move Direction / Path | direction and track of the move | multi (direction) + single (track) | Camera Motion |
| Blocking | top-down positions of subjects, props, camera | spatial | Camera Motion |
| Location & Angle | environment and the covered angle | reference (scene-level) | Location |
| Body / Lens / DOF | equipment and optical character | single body, single lens, single DOF | Camera Type |

Two cross-cutting rules resolve the mockups' ambiguities:

1. **Focus / Depth of Field is an optics decision, not a framing decision.** Rack
   Focus, Shallow/Deep Focus, and Tilt-Shift move to **Camera Type** (lens/DOF),
   not Camera Framing. Exception: Rack Focus and Zoom also read as *temporal*
   effects; they appear as optional modifiers in Camera Motion as well, but the
   canonical DOF selection lives in Camera Type. This is called out so the same
   term is never independently editable in two places — Camera Type owns the
   value; Camera Motion references it read-only.
2. **Shot size is one ordered ladder, not three overlapping lists.** The mockups
   split Close-ups / Medium Shots / Long Shots into near-synonyms. We collapse
   them into a single deduplicated scale (below).

## Persistence — The Key New Capability

`0033` is read-only. These tabs are editable, so this plan introduces a
**per-shot design write-back path**. The decisions, in order of preference:

- The `SceneShotListDocument` already stores shot-level camera strings
  (`shotType`, `cameraAngle`, `cameraMovement`, `framing`, `lensIntent`,
  `aspectRatio`). `0032` deliberately kept these as free director-language strings
  and deferred structured camera controls.
- This plan adds an **optional structured `cameraDesign` object per shot** that
  holds the controlled-vocabulary selections, while continuing to maintain the
  existing free-text strings as human-readable summaries derived from the
  structured selection. Structured and string forms coexist; the string fields
  remain the contract the skill and any prompt builder already read.

```ts
// added to SceneShot (all optional; absence = "not yet designed")
cameraDesign?: ShotCameraDesign;

export interface ShotCameraDesign {
  shotSize?: ShotSizeId;                 // single
  subjectFraming?: SubjectFramingId[];   // multi
  cameraAngle?: CameraAngleId;           // single
  dutch?: 'left' | 'right';              // optional roll
  movement?: ShotMovementDesign;
  equipment?: ShotEquipmentDesign;
  // location/angle is scene-level; see Location tab
  custom?: { framing?: string; movement?: string; equipment?: string };
}
```

Write path (no SQLite from the browser; ADR-aligned):

- new CLI/core command `renku screenplay shot-list update-shot --shot-list <id>
  --shot <shotId> --file <patch.json>` **or** a Studio-owned route
  `PATCH /studio-api/projects/:p/screenplay/scenes/:sceneId/shots/:shotId`
  that revalidates the whole document through the existing
  `scene-shot-list-json/validator.ts` and writes a new validated document for the
  active shot list;
- because `0032` makes every write a history row, decide whether per-field UI
  edits create history entries or mutate the active document in place. **Decision
  for this plan:** in-place update of the active shot list's document (no new
  history row per keystroke), with debounced autosave like the project
  information panel; explicit "duplicate as new shot list" remains a CLI/agent
  action. This keeps history meaningful (agent authorship) while letting the
  director tune the active plan.
- emit the existing scoped resource keys
  (`scene-shot-list:<id>:shot:<shotId>`, `scene:<sceneId>`) so the rail and other
  surfaces refresh.

This persistence contract is the single largest piece of new backend work in this
plan and should be settled before the tab UIs are built. See Open Decisions.

## Tab 1 — Description (already shipped)

Shipped read-only in `0033`. This plan leaves it read-only. If inline editing of
narrative text is wanted later, it follows the same autosave/validation path
above, but it is out of scope here to keep the plan focused on camera design.

## Tab 2 — Camera Framing

The flagship reorganization. Three stacked sections, each a row of rendered
selectable tiles using one shared tile primitive. A tile shows a small rendered
illustration of the option plus its label; selected tiles use the app's
primary/amber selection treatment (front-end guidelines), not a checkbox.

### Section A — Shot Size (single-select ordered ladder)

One canonical scale, tightest to widest. The right column maps the mockup's
overlapping labels onto each rung so nothing from the reference is lost:

| Canonical rung | id | Reference labels it absorbs |
|----------------|----|------------------------------|
| Extreme Close-Up | `extreme-close-up` | Extreme Close-up |
| Close-Up | `close-up` | Close-up, Wide Close-up* |
| Medium Close-Up | `medium-close-up` | Medium Close-up, Close Shot, Medium Close Shot |
| Medium Shot | `medium-shot` | Medium Shot |
| Medium Full Shot (Cowboy) | `medium-full-shot` | Medium Full Shot |
| Full Shot | `full-shot` | Full Shot |
| Wide / Long Shot | `wide-shot` | Wide Shot, Long Shot |
| Extreme Wide / Long Shot | `extreme-wide-shot` | Extreme Wide Shot, Extreme Long Shot |

\* "Wide Close-up" (a loose CU including some shoulders/background) maps to
`close-up`; if directors want it distinct, add it as a sub-label rather than a
new rung. Document this in the tile tooltip.

Rationale: shot size is a continuous magnitude — a director picks exactly one
point on it. Presenting it as one labeled ladder (optionally a horizontal scale)
communicates the relationship the three-column mockup hides.

### Section B — Subject Framing (multi-select)

These describe who is in frame and their spatial relationship, and they legitimately
combine (e.g. an over-the-shoulder two-shot, a dirty single):

`single`, `two-shot`, `three-shot`, `group`, `over-the-shoulder`,
`over-the-hip`, `point-of-view`, `insert` (detail/cutaway), `reaction`.

Multi-select with sensible guards (e.g. `single`/`two-shot`/`three-shot`/`group`
are mutually exclusive headcount values rendered as a single-select subgroup,
while `over-the-shoulder`, `point-of-view`, etc. are independent toggles layered
on top). Encode that as a small grouped picker rather than a flat multi-list.

### Section C — Camera Angle / Height + Dutch

Vertical viewpoint is single-select:

`eye-level`, `low-angle`, `high-angle`, `overhead` (bird's-eye/top), plus the
height variants from the mockup that are really eye-line heights:
`shoulder-level`, `hip-level`, `knee-level`, `ground-level`.

Consolidation note: "Camera Height" and "Camera Angle" in the mockup are the same
axis (where the lens sits relative to the subject). Merge them into one
single-select ladder from `ground-level` up to `overhead`, with `eye-level` as the
neutral default.

Dutch tilt is an **independent roll modifier**, rendered as a small
three-state control (`none` / `left` / `right`), because a Dutch frame still has a
shot size and an angle.

### Custom and write-back

- A "Custom framing…" input feeds `cameraDesign.custom.framing` and is appended to
  the derived `framing` string.
- On change, derive the human-readable `shotType` (from shot size),
  `cameraAngle`, and `framing` strings so the existing contract stays populated,
  and persist `cameraDesign` via the write path above.

### Rendered tile assets

Each option uses an approved bundled still asset generated through the
project-local `$generate-assets` skill. The app implementation consumes the
approved outputs; it does not call image/video providers, slice sheets, store
crop boxes, or run asset QA.

Generated assets live under:

```text
packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/
```

`shot-design-vocabulary.ts` maps each option id to its display label, still image
reference, and optional motion preview reference. Source images are color. The
Studio tile treatment applies the black-and-white idle state in CSS, then shows
the original color image on hover and while selected. Do not create duplicate
grayscale files.

## Tab 3 — Camera Motion

Two coordinated halves: a **top-down blocking stage** (the centerpiece) and a
set of **motion selectors**.

### Motion selectors

- **Movement** (what the frame does), single primary value with optional
  secondary: `static`, `pan`, `tilt`, `swish-pan`, `swish-tilt`, `tracking`,
  `push-in`, `pull-out`, `zoom`*, `rack-focus`*. (\* zoom and rack-focus are
  optical/temporal modifiers referenced from Camera Type; show them here as
  read-through chips, not independently editable, per the cross-cutting rule.)
- **Direction** (multi): `forward`, `backward`, `left`, `right`, `up`, `down`.
- **Track** (single): `straight`, `circular`.

### Blocking stage (top-down)

A 2D top-down diagram of the scene where the director positions tokens:

- character tokens (seeded from the shot's `castMemberIds`, labeled by name),
- prop tokens (free-add),
- a camera token with a position and a facing direction, and a motion path when
  the movement is not `static`.

Interaction: drag tokens to place them; rotate the camera to set facing; for
`tracking`/`push-in`/`pull-out` draw a simple path/arrow from start to end. The
relative arrangement (who is left/right of whom, where the camera sits) is the
durable output, stored in `cameraDesign.movement`:

```ts
export interface ShotMovementDesign {
  movement?: ShotMovementId;
  secondary?: ShotMovementId;
  directions?: MoveDirectionId[];
  track?: 'straight' | 'circular';
  blocking?: {
    subjects: BlockingToken[]; // {refId?, label, x, y}
    props: BlockingToken[];
    camera: { x: number; y: number; facingDeg: number;
              path?: { x: number; y: number }[] };
  };
}
```

Coordinates are normalized (0..1) and resolution-independent. The stage is a
plain SVG/canvas surface in feature code; no third-party scene-graph dependency
in v1.

### Phasing (important)

The interactive blocking stage is the most ambitious element. Phase it:

- **Phase A (this plan, required):** motion selectors (movement/direction/track)
  fully working and persisted; a **static** top-down stage that renders seeded
  character tokens and a camera token at sensible defaults, with drag-to-position
  and camera facing. No motion-path drawing yet.
- **Phase B (follow-up, flagged):** motion paths, circular-track visualization,
  prop library, and eye-line/180-degree-line guides.

Do not block the rest of the tab on Phase B.

## Tab 4 — Location

Location is almost always **constant for the whole scene** (the exception is
flashbacks or inserts at a different place). So this tab is scene-scoped with a
per-shot override, not a per-shot picker by default.

- Show the scene's location reference images: the selected
  `location_environment_sheet` composite(s) for the location(s) referenced by the
  scene setting, served read-only through the existing location asset routes.
- Indicate which angle/view of the environment this shot covers. For now this is
  a light annotation (pick a view tile: front/right/back/left from the
  environment sheet view files, or "custom"), stored as a scene-level default
  with optional per-shot override.
- A clearly-labeled affordance to mark a shot as using a **different** location
  (flashback/insert), which then lets the user pick another project location.
- Eventually this becomes a 3D world-model picker; design the tab so the
  reference-image view is a swappable panel that a future 3D viewport replaces
  without reworking selection state.

No new media generation here; this tab reuses location assets already in the
project. The only new persistence is the optional per-shot location/angle
override on `cameraDesign`.

## Tab 5 — Camera Type

Equipment and optics that materially shape the generated image and belong in the
video-gen prompt. Richer than the mockup's flat checklist — grouped, visual
presets:

- **Rig / Mechanism** (single): `sticks` (tripod), `hand-held`, `gimbal`,
  `slider`, `jib`, `drone`, `dolly`, `steadicam`, `crane`. (Shared vocabulary
  with Camera Motion's rig concept — define the list once and reference it from
  both tabs.)
- **Lens** (single, focal-length intent): `ultra-wide`, `wide`, `normal`,
  `short-tele`, `tele`, `macro`, with a custom mm entry. This supersedes the
  free-text `lensIntent` string while continuing to derive it.
- **Focus / DOF** (single) — relocated here from the framing mockup:
  `deep-focus`, `shallow-focus`, `rack-focus`, `tilt-shift`. Camera Motion
  references the rack-focus value read-only.
- Optional **format/look** presets later (film stock, anamorphic) — out of scope
  now; leave room in `ShotEquipmentDesign`.

```ts
export interface ShotEquipmentDesign {
  rig?: RigId;
  lens?: LensId;
  lensMillimeters?: number;
  focus?: FocusId;
  custom?: string;
}
```

Each option uses the same rendered-tile primitive as Camera Framing, with a small
illustration of the rig/lens/DOF effect.

## Shared UI Primitive

All four tabs share one selection-tile system so the visual language is identical
across axes (front-end guidelines: one interaction language, promote to `@/ui`
when reused). Add:

```text
packages/studio/src/ui/option-tile.tsx        (rendered tile: illustration + label + selected state)
packages/studio/src/ui/option-tile-group.tsx  (single|multi selection, grouped subgroups, custom entry)
```

Rules:
- single vs multi is a prop; mutually-exclusive subgroups are supported for the
  Subject Framing headcount case;
- selected tiles use the primary/amber border + ring + low-opacity fill from the
  selection system; hover connects to the same family;
- a "Custom…" tile opens a local input bound to the relevant `custom` field;
- tiles are `Button`-based, keyboard-navigable, with `aria-pressed`.

Feature code composes these with domain vocabulary defined in:

```text
packages/studio/src/features/movie-studio/scenes/shot-design-vocabulary.ts
```

which exports the controlled lists (ids + display labels + illustration refs) for
shot size, subject framing, angle, movement, direction, rig, lens, focus. Keep
labels here, not scattered through JSX.

## Files

```text
packages/core/src/client/scene-shot-list.ts            (add ShotCameraDesign + ids)
packages/core/src/client/scene-shot-list-json-schemas.ts (extend schema, optional)
packages/core/src/server/scene-shot-list-json/validator.ts (validate cameraDesign)
packages/core/src/server/database/access/scene-shot-lists.ts (in-place active update)
packages/core/src/server/commands/scene-shot-list-commands.ts (update-shot command)
packages/core/src/server/resources/scene-storyboard-ui.ts (surface cameraDesign in resource)
packages/studio/server/routes/screenplay.ts            (PATCH shot route)
packages/studio/src/services/studio-screenplay-api.ts  (updateSceneShot)
packages/studio/src/ui/option-tile.tsx
packages/studio/src/ui/option-tile-group.tsx
packages/studio/src/features/movie-studio/scenes/
  scene-shot-detail.tsx                                 (replace placeholders with real tabs)
  scene-shot-camera-framing-tab.tsx
  scene-shot-camera-motion-tab.tsx
  scene-shot-blocking-stage.tsx
  scene-shot-location-tab.tsx
  scene-shot-camera-type-tab.tsx
  shot-design-vocabulary.ts
  shot-design-assets/generated/                         (approved generated tile assets)
  use-shot-camera-design.ts                             (load + debounced autosave)
```

## Resource Refresh

Reuse the scoped keys from `0032`/`0033`. After a shot update, the active shot
list document changes; the Scene Shots tab, the rail label, the Act overview, and
the Sequence cards all listen on `scene:<sceneId>` /
`scene-shot-list:<id>:shot:<shotId>` and reload locally.

## Visual Design Notes

- Tabs sit in the bottom half of the right pane under the video stage; keep each
  tab's content scrollable independently so the video stage stays pinned.
- Maintain the compact, information-dense Studio language: section micro-headings,
  `text-sm` body, quiet borders.
- Rendered tiles use the approved generated asset set consistently across all
  axes. Keep the tile component quiet and let the image, label, and selection
  state carry the interaction.
- Tile images are grayscale by default, color on hover, and color when selected;
  this is a CSS treatment over the color source file.
- Selection feedback is the amber selection system everywhere; no bespoke colors
  per tab.

## Accessibility

- Every tile is a labeled, focusable control with pressed state.
- The blocking stage tokens are keyboard-movable (arrow-key nudge) and labeled;
  provide a text summary of positions for assistive tech ("Camera below Ada,
  facing up").
- Dutch/track/direction controls expose their state, not just visual styling.

## Tests

Core:
- schema accepts a valid `cameraDesign` and rejects unknown ids/fields;
- the update-shot path revalidates the whole document and persists in place
  without creating a history row;
- the resource surfaces `cameraDesign` for the active shot.

Frontend:
- shot-size ladder is single-select and maps each reference label to the right
  rung;
- subject-framing headcount subgroup is mutually exclusive while OTS/POV layer on
  top;
- focus/DOF appears only in Camera Type and is read-only in Camera Motion;
- editing a framing tile derives and persists the `shotType`/`framing` strings;
- the blocking stage seeds character tokens from `castMemberIds` and persists
  normalized positions;
- Location tab renders the scene's environment reference and the flashback
  override affordance;
- autosave debounces and emits the scoped refresh.

Run focused tests, `pnpm test:core`, `pnpm lint`, `pnpm check`.

## Implementation Checklist

- [ ] Settle the persistence contract (route vs CLI; in-place vs history).
- [ ] Add `ShotCameraDesign` types, schema, and validation.
- [ ] Add the shot update path and resource surfacing.
- [ ] Build `OptionTile` / `OptionTileGroup` shared primitives.
- [ ] Define `shot-design-vocabulary.ts` controlled lists + illustration refs.
- [ ] Wire approved generated assets into `shot-design-vocabulary.ts`.
- [ ] Implement tile image treatment: grayscale idle, color hover, color
      selected.
- [ ] Support optional motion preview refs for motion-capable tiles.
- [ ] Build Camera Framing tab (shot size ladder, subject framing, angle, Dutch).
- [ ] Build Camera Motion tab: selectors + Phase-A static blocking stage.
- [ ] Build Location tab (scene-scoped reference + flashback override).
- [ ] Build Camera Type tab (rig, lens, focus/DOF).
- [ ] Add `use-shot-camera-design` load + debounced autosave.
- [ ] Wire scoped refresh and rail-label updates.
- [ ] Add core + frontend tests.
- [ ] Verify desktop interaction manually.

## Resolved Decisions

- Per-shot edits update the **active shot list document in place** via debounced
  autosave, creating **no new history row** per edit; new history rows remain an
  agent/CLI action. This intentionally refines the `0032` "every write is a
  history row" stance for direct UI tuning (confirmed 2026-05-30).
- Camera language is modeled as independent axes, not one flat checklist.
- Shot size is one deduplicated single-select ladder; the mockup's three columns
  map onto it.
- Camera Height and Camera Angle are merged into one viewpoint ladder.
- Subject Framing is multi-select with a mutually-exclusive headcount subgroup.
- Focus / Depth of Field belongs to Camera Type; Camera Motion only references
  rack-focus read-only.
- Structured `cameraDesign` coexists with the existing free-text strings, which
  remain the prompt-facing contract.
- The blocking stage ships static-with-drag (Phase A); motion paths are Phase B.
- Tile illustration source is the approved generated bundled asset set produced
  through the project-local `$generate-assets` skill. The app consumes the
  approved still and optional motion files; generation, slicing, and visual QA
  stay in the skill workflow.

## Open Decisions

- **Write path shape:** a Studio `PATCH` route vs a `renku screenplay shot-list
  update-shot` CLI command invoked by the server. Leaning toward a Studio route
  for direct UI editing, with the CLI command as the agent-facing equivalent.
- **Blocking-stage scope:** confirm Phase A (static + drag) is enough for the
  first release before investing in motion-path authoring.
