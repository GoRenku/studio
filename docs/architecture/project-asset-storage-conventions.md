# Project Asset Storage Conventions

Previs revision candidates may include `description.md` and `playback.json`.
Registration retains their exact bytes under `previs/revisions/rNNN/`; authoring
copies live under `previs/source/`. Core reads only these fixed display filenames
with project-relative and realpath guards. The optional `PrevisPlayback` envelope
contains rational `frameRate`, `frameCount`, ordered `segments`, explicit subjects
and identified Dialogue/Action/Camera cues. See ADR 0096 for the contract.
Supplied invalid timelines fail before registration writes; read failures remain
localized warnings. Optional Dialogue audio names exact
`{assetId,assetFileId,offsetSeconds?}` references. Missing/unavailable audio preserves
visual rehearsal. Missing optional files are normal.
Description is exact Markdown. No source-directory browser route is exposed.

Date: 2026-08-09

Status: current

Role: architecture contract

Decision history: `../decisions/0076-use-human-readable-project-asset-folders.md`

## Purpose

This document defines the current project-visible folder and filename contract
for durable Renku Studio media. It does not define Asset identity, ownership,
selection, or provenance; SQLite owns those relationships.

## Canonical Project Tree

Projects create only the folders needed by their current content.

```text
<project>/
  .renku/
    project.sqlite

  screenplay/

  covers/

  visual-language/
    inspiration/
    lookbooks/
      production/
      storyboard/

  cast/
    <cast-handle>/

  locations/
    <location-handle>/

  props/
    <prop-handle>/

  storyboards/
    <safe-scene-label>/
      tmp/
      00-iteration/
      01-iteration/

  scenes/
    <safe-scene-label>/
      <NN>-shot-plan/
        audio/
        shot-images/
        previs/
          source/
          revisions/rNNN/
          renders/

  research/

  tmp/
    media/
    specs/
    receipts/
    operations/
    qa/
    scratch/
```

The Scene folder uses a bounded, lowercase safe path label derived from the
exact stored Scene number. This transformation happens only at the filesystem
boundary: `Scene.productionNumber` is never parsed, validated, or rewritten.
When a number has no usable path characters, Core falls back to a safe form of
the durable Scene id. Shot Plan folders use a zero-padded Scene-local integer
such as `01-shot-plan`. All of these values remain labels; callers must use
durable ids for reads and mutations.

## Destination Matrix

| Media | Durable folder | Generated filename stem |
| --- | --- | --- |
| Screenplay source | `screenplay/` | external basename only |
| Screenplay supporting material | `screenplay/` | external basename only |
| Project Cover | `covers/` | `cover-gxxx` |
| Production Lookbook media | `visual-language/lookbooks/production/` | `<semantic>[-sheet]-gxxx` |
| Storyboard Lookbook media | `visual-language/lookbooks/storyboard/` | `<semantic>[-sheet]-gxxx` |
| Cast Profile | `cast/<handle>/` | `profile-gxxx` |
| Cast Character Sheet | `cast/<handle>/` | `<variation>-sheet-gxxx` |
| Cast Voice Sample | `cast/<handle>/` | `<descriptor>-gxxx` |
| Location Hero | `locations/<handle>/` | `hero-gxxx` |
| Location Sheet | `locations/<handle>/` | `<variation>-sheet-gxxx` |
| Prop Hero | `props/<handle>/` | `hero-gxxx` |
| Prop Sheet | `props/<handle>/` | `<variation>-sheet-gxxx` |
| Dialogue Audio | `scenes/<scene>/<NN>-shot-plan/dialogues/` | `turn-<NN>-gxxx` / `turns-<NN>-<NN>-gxxx` |
| Beat Storyboard | `storyboards/<scene>/<NN>-iteration/` | `s<scene>-b<beat>-image-gxxx` |
| Shot image | `scenes/<scene>/<NN>-shot-plan/shot-images/` | `shot<shot>-gxxx` |
| Plan first/last frame | `scenes/<scene>/<NN>-shot-plan/` | `first-frame-gxxx` / `last-frame-gxxx` |
| Plan Storyboard/reference | `scenes/<scene>/<NN>-shot-plan/` | `storyboard-gxxx` / `reference-gxxx` |
| Plan video | `scenes/<scene>/<NN>-shot-plan/` | `s<scene>-p<plan>-video-gxxx` |
| Edited video | exact source file parent | `edited-video-gxxx` |

All files retain a normalized extension. Core owns fixed role words such as
`profile`, `hero`, `sheet`, `image`, and `video`. A skill may supply a concise
semantic variation name where the purpose needs one; it does not construct the
resulting filename.

### Storyboard iterations

Core allocates the next unused zero-based `NN-iteration` folder once for a
Storyboard import batch. Every Beat image in that batch uses the same folder.
An iteration contains only the candidate files created in that import; it is
not a materialized snapshot of every selected image.

Temporary Storyboard source sheets live in
`storyboards/<safe-scene-label>/tmp/` and never create Asset File rows.

### Shot Plan provenance

A generated Shot Plan video or reference image carries an exact weak
`authoredFrom` Shot Plan id through the focused attachment boundary before Core
allocates a destination. A title, current Studio selection, or path never
chooses the Plan.

`shot-plan.video-reference` is the focused purpose for a durable reference
image authored for a Plan. Generic `image.create` uses the same reference-image
destination for its exact Shot Plan and is shown in that Plan's Assets tab.
Ordinary input dependencies remain references and are not copied into the Plan
folder.

Prepared image, video and audio references are registered with
`renku shot-plan reference import --shot-plan <id> --source <path>
--media-kind <image|video|audio> --title <title>`. Previs requires the exact
`--previs-revision`. Core copies the bytes into this same Plan root using the
external filename allocator, persists a Project-owned reference Asset, and
returns its canonical AssetFile path. The request uses that returned path.
The existing summary retains authored extraction facts; deterministic local
extraction has no generation provenance. The Assets tab's References group
supports all three media kinds. See decision 0099.

An accepted `image.edit` never chooses a folder from its output path or a caller
destination flag. Core resolves the source Asset's exact current type and owner,
then reuses the matching row in this matrix. Beat edits allocate a new
Storyboard iteration; Lookbook edits create the corresponding new detail row;
Plan-role edits preserve exact weak authorship. Every result is a separate
unselected candidate beside its source.

An accepted `video.edit` applies to any active registered video Asset. Core
uses the exact current source AssetFile parent only as the destination root and
allocates `edited-video-gxxx.<ext>`. Owner, Asset type, locale, metadata, weak
authorship, and selection behavior come from SQLite, never from the filename or
directory. The result is a separate unselected candidate and the source remains
unchanged.

## Filename Allocation

### Safe segments

Semantic segments are lowercase safe kebab-case and bounded to keep complete
filenames readable. Normalization is presentation and path safety only; Studio
does not inspect or validate the creative meaning of a semantic name.

Scene numbers follow the same path-safety rule only when used in a destination
folder or generated filename. For example, the stored number `12/A` stays
`12/A` in Screenplay data while its path label is `12-a`.

### Generated files

Generated files receive one suffix consisting of `g` plus exactly three
lowercase Crockford Base32 characters, for example `profile-g8t9.png`.

Core attempts exclusive file creation. On a real collision it draws another
token, for at most sixteen attempts, and then returns a structured allocation
failure. There is no persisted generation counter, `vNN` suffix, media series,
or filename lineage.

### External files

Imported files keep a normalized safe source basename. The first collision
adds `-2`, then `-3`, and so on. For example:

```text
screenplay/urban-basilica.fdx
screenplay/urban-basilica-2.fdx
screenplay/research-notes.pdf
screenplay/research-notes-2.pdf
```

External files do not receive `gxxx`. A basename is a human-readable label,
not identity or provenance. Supporting material preserves any source extension;
an extensionless source receives `.bin`. Characters in an arbitrary extension
that could change project-path structure are encoded into the filename segment;
for example, the POSIX filename `notes.foo\bar` is retained as
`notes.foo%5cbar`, not as a nested folder. This is filename safety rather than
a content-type allowlist. The retained bytes are otherwise unchanged.

Active AssetFile paths remain reserved even if their physical files are
missing. A new external file with the same normalized name receives the next
numeric suffix instead of reusing a path whose recorded content identity
belongs to another AssetFile.

For Project Cover imports this means generated media uses
`covers/cover-gxxx.<ext>`, while an external source keeps its normalized
basename beneath `covers/`. Neither path is parsed to determine active cover
selection.

## Temporary And User-Owned Files

Generated media staging, review/provenance documents, provider receipts,
operation documents, QA images, and scratch files belong under top-level
`tmp/`. Review documents are temporary operation artifacts; durable generation
facts live only on an attached Asset's provenance.

`.renku/tmp/` is reserved for hidden operational state. Runtime media staging
must not use it as normal project-visible storage.

`research/` and `visual-language/inspiration/` are user-owned filesystem
content. They may be generation inputs without Asset rows. When a focused
import turns one of those files into a durable Asset, Core copies it to the
appropriate canonical owner folder and registers the destination.

## Ownership Boundary

`packages/core/src/server/project-asset-files/` is the sole durable path and
file owner. It owns:

- focused owner-aware destination resolution;
- generated versus external naming;
- exclusive collision allocation;
- path containment and source validation;
- copying, size and hash calculation, and Asset File persistence;
- Storyboard iteration allocation; and
- rollback cleanup if a later database write fails.

`index.ts` is the thin public entrypoint. Destination modules are split by
domain family, naming modules own safe segments/tokens/source names,
`path-allocation.ts` owns generic allocation, and `persistence.ts` owns the
copy/hash/insert transaction boundary.

CLI handlers, Studio HTTP routes, React components, Engines, and skills provide
user intent and durable ids. They must not construct a durable folder,
production number, collision token, or filename.

Paths are never parsed to recover Asset identity, membership, canonical
selection, Scene/Plan/Shot/Beat identity, or generation provenance.

## Superseded Paths

Current runtime code must not create durable media beneath the retired root-level
paths `generated/`, `audio/`, `scene-dialogue-audio/`, `shot-plans/`, `shots/`,
or `videos/`. This does not prohibit an owning destination's deliberate nested
segment, such as `scenes/<scene>/<NN>-shot-plan/dialogues/`.
It must not use nested `character-sheets/`, `profiles/`, `voice-samples/`,
`heroes/`, `location-sheets/`, or `prop-sheets/` directories.

No runtime compatibility reader translates those retired paths. The one-time
Urban Basilica reconstruction is owned by Plan 0174 and its explicit rebuild
tool; the archive remains the recovery source.


## Previs Shot Plans

Shot Plans have type `shot-list` (Shot List) or `previs` (Previs). Both use the
same Scene-local numbered plan root. Editable Previs Python and directing
parameters live in `previs/source/`. A completed source snapshot, built `.blend`
and optional `playback.json` live in `previs/revisions/rNNN/`.

`readShotPlanPrevis` / `renku shot-plan previs show` returns the canonical editable
source directory and retained revisions. `registerShotPlanPrevis` / `renku
shot-plan previs register --shot-plan <id> --file tmp/operations/previs/register.json`
accepts project-relative `sourceDirectory`, `renderPath` and optional `title`.
The source directory is a stable candidate snapshot prepared by the agent, not a
frame cache. Registration copies exact bytes exclusively and records source/render
hashes for retry identity. Changed source or video creates the next revision;
identical retries reuse the existing revision only when its render Asset and
primary video file are active and the retained file is available. Otherwise core
returns `CORE_PREVIS_REVISION_RENDER_UNAVAILABLE` with recovery guidance; it does
not create a replacement revision or report success. Failed registration rolls
back its new files and database writes.

Core allocates `previs/renders/previs-gxxx.mp4` and persists a Project video Asset
of type `shot_plan_previs`, origin `rendered`, with exact Shot Plan authorship and
revision association. AI takes remain `shot_plan_video` at the existing plan root,
with normal generation provenance. Procedural renders do not appear as AI takes.
`shot_plan_previs_revision` associates source directory and render Asset; it does
not interpret animation, Cast, Beats or creative text. Core validates the retained
timeline envelope separately, without duplicating it in SQL.

The agent authors sparse direction points and shot segments in `playback.json`
from explicit directing choices. Animation holds and review captions are not
automatically cues. Studio owns display; MP4s contain no burned review overlays.
Playback annotations are optional, but supplied documents must be structurally valid.

PNG frames, logs, QA and encoding intermediates remain under top-level Project
`tmp/`. Frames can support resume/re-encoding and verified unchanged intervals;
they do not accelerate rerendering changed frames. Project Settings' explicit
cleanup action clears only top-level `tmp/` contents after confirmation. It has
no automatic retention heuristic or active-operation coordinator. Core protects
registered AssetFile paths, including their resolved filesystem locations, before
deleting anything. Cleanup unlinks symlinks inside `tmp/` without following them.
Registration rejects retained render and source-revision destinations that resolve
into `tmp/`. Retained source, revisions, `.blend` files and registered media remain
outside that directory.

For a retimed AI input, the agent records the Previs revision and exact time map
in the take's existing Asset summary, alongside its normal safe provenance. This
keeps the relationship readable after temporary derivative/request cleanup without
a new file hierarchy or provider request field.
