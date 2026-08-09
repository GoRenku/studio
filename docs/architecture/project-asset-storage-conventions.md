# Project Asset Storage Conventions

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
      dialogues/
      <NN>-shot-plan/
        shot-images/

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
| Production Lookbook media | `visual-language/lookbooks/production/` | `<semantic>[-sheet]-gxxx` |
| Storyboard Lookbook media | `visual-language/lookbooks/storyboard/` | `<semantic>[-sheet]-gxxx` |
| Cast Profile | `cast/<handle>/` | `profile-gxxx` |
| Cast Character Sheet | `cast/<handle>/` | `<variation>-sheet-gxxx` |
| Cast Voice Sample | `cast/<handle>/` | `<descriptor>-gxxx` |
| Location Hero | `locations/<handle>/` | `hero-gxxx` |
| Location Sheet | `locations/<handle>/` | `<variation>-sheet-gxxx` |
| Prop Hero | `props/<handle>/` | `hero-gxxx` |
| Prop Sheet | `props/<handle>/` | `<variation>-sheet-gxxx` |
| Dialogue Audio | `scenes/<scene>/dialogues/` | `s<scene>-<speaker>-d<turn>-gxxx` |
| Beat Storyboard | `storyboards/<scene>/<NN>-iteration/` | `s<scene>-b<beat>-image-gxxx` |
| Shot image | `scenes/<scene>/<NN>-shot-plan/shot-images/` | `shot<shot>-gxxx` |
| Plan first/last frame | `scenes/<scene>/<NN>-shot-plan/` | `first-frame-gxxx` / `last-frame-gxxx` |
| Plan Storyboard/reference | `scenes/<scene>/<NN>-shot-plan/` | `storyboard-gxxx` / `reference-gxxx` |
| Plan video | `scenes/<scene>/<NN>-shot-plan/` | `s<scene>-p<plan>-video-gxxx` |

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

A generated Shot Plan video or reference image resolves its Plan from exact
frozen GenerationSpec or Run provenance before Core allocates a destination.
A title, current Studio selection, or path never chooses the Plan.

`shot-plan.video-reference` is the focused purpose for a durable reference
image authored for a Plan. Ordinary input dependencies remain references and
are not copied into the Plan folder.

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
```

External files do not receive `gxxx`. A basename is a human-readable label,
not identity or provenance.

## Temporary And User-Owned Files

Generated media staging, draft specs, receipts, operation documents, QA
images, and scratch files belong under top-level `tmp/`. Media Generation Specs
and Runs remain durable SQLite records; temporary JSON exports are inspection
artifacts only.

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

Current runtime code must not create durable media beneath `generated/`,
`audio/`, `scene-dialogue-audio/`, `shot-plans/`, `shots/`, or `videos/`.
It must not use nested `character-sheets/`, `profiles/`, `voice-samples/`,
`heroes/`, `location-sheets/`, or `prop-sheets/` directories.

No runtime compatibility reader translates those retired paths. The one-time
Urban Basilica reconstruction is owned by Plan 0174 and its explicit rebuild
tool; the archive remains the recovery source.
