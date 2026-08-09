# 0172 Human-Readable Project Asset Organization

Status: superseded by Plan 0174
Date: 2026-08-08

Plan 0174 is the sole implementation plan for the combined numbering,
Scene Beats, durable-path, migration, and Urban Basilica reconstruction
cutover.

## Summary

Renku Studio already keeps durable Asset identity, ownership, selection, and
generation provenance in SQLite, but its files are spread across technical and
historical folder trees. A person cannot reliably open the project in Finder
and locate all media for Scene 1, Shot Plan 1, a Cast Member, or a Location.

This plan changes only the user-visible organization and filename allocation
needed to make the project understandable:

- Scenes use their human production numbers as folders.
- Shot Plans use permanent numbers and folders such as `01-shot-plan`.
- Shot images remain in one `shot-images/` child folder.
- All Shot Plan reference images and videos are flat in the Shot Plan folder.
- Cast, Location, and Prop media are flat in their owner folder.
- Scene Storyboard images retain their existing `NN-iteration/` batch folders
  under the human-readable Scene-number folder. The clean rebuild preserves all
  current image candidates in those folders, and revisions created afterward
  can continue reconnecting to retained images.
- Generated files receive one short collision token such as `g7k3`; they do not
  receive generation directories, counters, versions, or lineage folders.
- Agent-supplied semantic names describe meaningful variations such as
  `palace-robe`, `dusk`, or `burned-down`; Core safely normalizes those names and
  adds the purpose-owned suffix such as `sheet`.
- Existing Asset, Asset File, membership, selection, Trash, and provenance
  models remain intact.

The numbering contract this layout depends on is owned by
[Plan 0173](0173-stable-scene-shot-and-beat-numbering.md). Plan 0173 must be
implemented before this plan converts the real project because Scene, Shot
Plan, Shot, and Beat numbers are destination inputs.

## Requirement Ledger

| Requirement | Accepted behavior | Owner |
| --- | --- | --- |
| Human Scene navigation | `scenes/<display-scene-number>/` and `storyboards/<display-scene-number>/` | Plan 0173 number formatter; Core destinations |
| Human Shot Plan navigation | `scenes/01/01-shot-plan/` | Plan 0173 Shot Plan number; Core destinations |
| Flat plan media | First frame, last frame, video Storyboard, custom references, and videos share the Shot Plan folder | Core Shot Plan destinations |
| Exact Plan association | Shot Plan media resolves `shotPlanId` from exact frozen Spec/run provenance, never from a title or filename | Core generation attachment boundary |
| Separate Shot image collection | Shot images remain under `shot-images/` | Core Shot image destination |
| No generic generation hierarchy | No `generation`, `generations`, or equivalent folders for ordinary generated media; existing Scene Storyboard `NN-iteration/` folders remain | Core destination tests and docs |
| Short generation discriminator | Generated media uses `g` plus three lowercase Crockford-base32 characters | Core name allocator |
| No visible edit versions | No `vNN`, `eNN`, or edit/version suffix | Core name allocator and skill guidance |
| Semantic variations | The agent supplies concise variation text; Core normalizes it and applies the purpose-owned role suffix | `media-producer` plus Core attachment boundary |
| No repeated owner name | Owner folders provide owner context; generated filenames omit Cast, Location, or Prop names | Core destination composition |
| Safe external attachments | External/imported filenames use a normalized safe-kebab basename and no `g` token | Core source-name allocator |
| Shallow continuity folders | Profile, Sheet, Hero, and voice files are flat within the owner folder | Core Cast/Location/Prop destinations |
| Separate Lookbook roles | Production and Storyboard Lookbooks have distinct folders | Core Lookbook destination |
| Revision-safe Storyboard iterations | Storyboard import batches remain under `storyboards/<scene>/<NN>-iteration/` with stable Beat numbers and collision-safe `gxxx` tokens | Existing Core Storyboard destination plus Plan 0173 revision history |
| No multi-file Sheet behavior | Current writers keep producing one Asset with one primary file; stale directional Location files are not carried forward | Current attachment paths and one-time conversion |
| Clean sample rebuild | Archive the complete current `renku-movies` directory and reconstruct only current Urban Basilica state | One-time internal script and verification |
| SQLite remains authoritative | Paths are labels and are never parsed for identity, ownership, selection, or provenance | Core architecture |

## Product Behavior

### Canonical project tree

Only folders with content are created. A representative project is:

```text
<project>/
  .renku/
    project.sqlite

  screenplay/
    urban-basilica.fdx

  visual-language/
    inspiration/
      blade-runner-2049/
        still-000-a7c2.jpg
    lookbooks/
      production/
        warm-stone-at-dawn-g7k3.png
        siege-material-language-sheet-g4p8.png
      storyboard/
        charcoal-pressure-g2n6.png
        action-notation-sheet-g9v5.png

  cast/
    saruca/
      profile-g3m7.png
      palace-robe-sheet-g7k3.png
      armor-sheet-g4p8.png
      whispering-g2n6.mp3

  locations/
    harbor-quarter/
      hero-g3m7.png
      dawn-sheet-g7k3.png
      burned-down-sheet-g4p8.png

  props/
    urbans-great-bombard/
      hero-g3m7.png
      firing-detail-sheet-g7k3.png

  storyboards/
    01/
      00-iteration/
        s01-b01-image-g7k3.png
        s01-b02-image-g4p8.png
      01-iteration/
        s01-b01-image-g2n6.png
      tmp/
        bombardment-storyboard-sheet.png

  scenes/
    01/
      dialogues/
        s01-mara-d01-g7k3.mp3
        s01-mehmed-d02-g4p8.mp3
      01-shot-plan/
        shot-images/
          shot01-g7k3.png
          shot01A-g4p8.png
        first-frame-g3m7.png
        last-frame-g2n6.png
        storyboard-g9v5.png
        reference-g6r2.png
        s01-p01-video-g8c4.mp4

  research/
    <user scratch files>

  tmp/
    <specs, receipts, operations, QA, and temporary media>
```

There is no top-level `videos/`, `audio/`, `scene-dialogue-audio/`,
`shot-plans/`, `shotlist/`, or durable `generated/` root in the new contract.

### Production-number display in paths

Plan 0173 owns the canonical formatter. It preserves the case of production
suffixes and pads only the leading integer to a minimum of two digits:

| Canonical number | Folder or filename form |
| --- | --- |
| `1` | `01` |
| `1A` | `01A` |
| `4aA` | `04aA` |
| `28A` | `28A` |
| `100` | `100` |

Production numbers are deliberately exempt from lowercase kebab conversion.
They are industry references whose case may communicate insertion structure.
All ordinary names and semantic descriptors remain lowercase safe-kebab-case.

Shot Plan numbers are positive integers padded to two digits for display:
`1 -> 01-shot-plan`, `12 -> 12-shot-plan`, `100 -> 100-shot-plan`.

### Safe-kebab names

Core owns one deterministic safe-path-segment function:

- trim surrounding whitespace;
- lowercase ordinary names;
- replace every run outside ASCII `a-z`, `0-9` with one hyphen;
- trim leading and trailing hyphens;
- reject an empty required semantic name instead of silently inventing one;
- limit the normalized semantic part to 32 characters before adding a
  purpose suffix and generation token;
- normalize extensions to lowercase and `.jpeg` to `.jpg`.

Skills should provide at most five short words for a Lookbook image and one or
two words for Cast, Location, Prop, and voice variations. The 32-character
Core limit is a filesystem guard, not creative-content interpretation.

### Generated media token

Every generated durable file ends with `-gxxx`, where `xxx` is exactly three
lowercase Crockford-base32 characters from:

```text
0123456789abcdefghjkmnpqrstvwxyz
```

The alphabet omits visually ambiguous `i`, `l`, `o`, and `u`. Three characters
provide 32,768 values. With 40 existing generations of the same semantic name
and media extension, one random draw has approximately a 0.12% chance of
matching an existing token. Core checks the exact destination and redraws; a
collision never overwrites a file or becomes a user-visible failure under
normal occupancy. Two token characters would have only 1,024 values and
approximately a 3.9% per-draw collision chance at 40 items, so three is the
smallest practical choice.

Allocation rules:

1. Tokens are random and carry no ordering, generation count, Asset id, or
   version meaning.
2. The namespace is the exact destination folder, semantic filename stem, and
   normalized extension: the complete target path.
3. Core attempts an exclusive destination write. An existing candidate causes
   another token draw.
4. Core tries at most 16 independently drawn candidates. At 40 occupied names,
   exhausting all attempts is less than 1 in 10^46.
5. A bounded retry failure returns
   `PROJECT_ASSET_FILE_GENERATION_TOKEN_ALLOCATION_FAILED`; it never overwrites.
6. The token is not stored as a separate database field and is never parsed by
   runtime code. The stored Asset File path is sufficient.
7. An image edit is another generated candidate of the same semantic object and
   receives another `gxxx`. There is no `vNN` or filesystem lineage.
8. Actual edit/source provenance remains in GenerationSpec, GenerationRun, and
   Asset File provenance records.

### External and imported files

Files attached without generation provenance do not receive a generation
token. Core normalizes the source basename to safe-kebab-case and keeps the
media extension. A real collision receives the smallest plain numeric suffix:

```text
reference-photo.png
reference-photo-2.png
reference-photo-3.png
```

The suffix prevents overwrite; it does not claim generation order. Inspiration
folders remain user-owned plain files and retain their existing filenames
during the one-time rebuild. The current `still-000-<short-hash>` convention
remains valid for Inspiration imports.

### Semantic name ownership

Core knows the durable purpose and therefore may add fixed role words such as
`sheet`, `profile`, `hero`, `image`, `first-frame`, and `video`. Core does not
know whether a variation is a palace robe, armor, dusk, morning, or a
burned-down state.

For generated media requiring a variation, the existing GenerationSpec/media
attachment `title` is the semantic input supplied by `media-producer`:

| Purpose | Agent supplies | Core filename stem |
| --- | --- | --- |
| `cast.character-sheet` | `palace robe` | `palace-robe-sheet` |
| `location.sheet` | `burned down` | `burned-down-sheet` |
| `prop.sheet` | `firing detail` | `firing-detail-sheet` |
| `lookbook.image` | `warm stone at dawn` | `warm-stone-at-dawn` |
| Lookbook Sheet purposes | `siege material language` | `siege-material-language-sheet` |
| Cast voice sample | `whispering` | `whispering` |

The owning Cast Member, Location, or Prop name is not repeated:

```text
cast/saruca/palace-robe-sheet-g7k3.png
```

not:

```text
cast/saruca/saruca-palace-robe-sheet-g7k3.png
```

Core requires a non-empty title for generated purposes that need a semantic
variation. This validates the envelope, not the creative meaning. Fixed-name
purposes such as Profile, Hero, Shot image, first frame, and video do not need a
variation merely to satisfy a filename.

### Complete durable Asset filename matrix

| Asset family | Destination | Generated filename |
| --- | --- | --- |
| Screenplay source | `screenplay/` | External safe source basename, such as `urban-basilica.fdx` |
| Production Lookbook image | `visual-language/lookbooks/production/` | `<semantic>-gxxx.<ext>` |
| Production Lookbook Sheet | `visual-language/lookbooks/production/` | `<semantic>-sheet-gxxx.<ext>` |
| Storyboard Lookbook image | `visual-language/lookbooks/storyboard/` | `<semantic>-gxxx.<ext>` |
| Storyboard Lookbook Sheet | `visual-language/lookbooks/storyboard/` | `<semantic>-sheet-gxxx.<ext>` |
| Cast Profile | `cast/<handle>/` | `profile-gxxx.<ext>` |
| Character Sheet | `cast/<handle>/` | `<variation>-sheet-gxxx.<ext>` |
| Cast voice sample | `cast/<handle>/` | `<descriptor>-gxxx.<ext>` |
| Location Hero | `locations/<handle>/` | `hero-gxxx.<ext>` |
| Location Sheet | `locations/<handle>/` | `<variation>-sheet-gxxx.<ext>` |
| Prop Hero | `props/<handle>/` | `hero-gxxx.<ext>` |
| Prop Sheet | `props/<handle>/` | `<variation>-sheet-gxxx.<ext>` |
| Dialogue Audio | `scenes/<scene>/dialogues/` | `s<scene>-<speaker>-d<dialogue>-gxxx.<ext>` |
| Beat Storyboard image | `storyboards/<scene>/<NN>-iteration/` | `s<scene>-b<beat>-image-gxxx.<ext>` |
| Shot image | `scenes/<scene>/<plan>-shot-plan/shot-images/` | `shot<shot>-gxxx.<ext>` |
| Shot Plan first frame | Shot Plan folder | `first-frame-gxxx.<ext>` |
| Shot Plan last frame | Shot Plan folder | `last-frame-gxxx.<ext>` |
| Shot Plan video Storyboard | Shot Plan folder | `storyboard-gxxx.<ext>` |
| Shot Plan custom reference | Shot Plan folder | `reference-gxxx.<ext>` |
| Shot Plan video | Shot Plan folder | `s<scene>-p<plan>-video-gxxx.<ext>` |

For Dialogue Audio, `d01`, `d02`, and so on are the Scene-wide Dialogue Turn
order, not per-speaker counters. This plan does not add screenplay editing or a
Dialogue numbering subsystem.

`shot-plan.video-reference` is the focused purpose for a deliberately attached
custom Plan reference and persists one `shot_plan_video_reference` Asset. It is
not a copy of every Cast, Location, Prop, Lookbook, or arbitrary project-file
dependency selected by a video spec. Those Assets remain in their canonical
owner folders and are referenced by id/path. Generic `image.create` and
`image.edit` outputs remain temporary until one current focused attachment
purpose accepts them; the generic purposes do not create another durable Asset
folder.

### Scene Storyboards

After the clean four-revision baseline, Plan 0173 retains every Scene Beats
revision created during normal runtime and preserves active-selection behavior.
Keep the existing Storyboard batch boundary: one import allocates the next
`NN-iteration/` folder and writes all imported Beat images into it. Each folder
contains that import batch rather than a materialized copy of every selected
image in the revision.

SQLite keeps exact Scene Beats revision context on the import/status workflow
and Asset ownership on `{ sceneId, beatId }`. Selecting an older revision can
therefore reconnect its Beat images without parsing the folder name. Reset,
focused revision creation, and active-revision changes never flatten or delete
older iteration folders. The `gxxx` token still prevents collisions inside a
folder and does not carry revision meaning.

Temporary composite Storyboard sheets live at:

```text
storyboards/<scene>/tmp/
```

They are not Assets. Temporary visual sheets remain under `tmp/`.

### One file per current Asset

Current attachment commands create one Asset and one primary Asset File for
each accepted output. Location Sheets are already documented and implemented
as one opaque image; front/back/left/right slices are not a current feature.

This plan deliberately does not change `Asset.files[]`, the Asset File schema,
Trash internals, or the generic projection into a singular-file API. That
cross-product refactor has no current user value. Instead:

- all current attachment tests continue to prove one file is created for each
  accepted Asset;
- current docs stop presenting Compound or multi-file Assets as a current
  product capability;
- the Urban Basilica rebuild retains each Location Sheet's `primary` file and
  omits its stale directional files and rows;
- no compatibility reader or directional-role diagnostic is added.

### Paths never define business state

Runtime code must not parse a Scene number, Shot Plan number, Shot number,
generation token, variation, filename, or folder to recover identity or
relationships. Core resolves a destination from durable ids, reads the current
number/name metadata, allocates a path, and persists that exact path on the
Asset File. SQLite remains authoritative for all subsequent operations.

## Explicit Non-Goals

- No generation, attempt, take, iteration, or version folders for Shot Plan
  media.
- No `vNN`, `eNN`, monotonically increasing `gNN`, Asset series, bundle, or
  generation-lineage model.
- No automatic semantic interpretation of titles, prompts, images, or media.
- No new multi-file Asset public contract or database constraint.
- No Scene editing, FDX export, screenplay round-trip, re-import merge, or
  screenplay reconciliation.
- No post-production export tree, NLE handoff, render pipeline, Remotion, or
  FFmpeg work.
- No Studio UI for browsing or renaming physical files.
- No compatibility path resolver for the old folder structure.
- No deletion of the archived `renku-movies` directory.

## Context And Evidence

### Current owning implementation

- `packages/core/src/server/project-asset-files/` already owns durable source
  validation, owner-aware destination resolution, exclusive copying, hashing,
  Asset File insertion, rollback, and temporary paths.
- `packages/core/src/server/generation/attachment-destinations.ts` already maps
  each generation purpose to a focused Asset type, owner, and destination.
- The current Shot Plan video/reference destination variants carry only a title
  hint even though their exact frozen GenerationSpec already carries
  `authoredFrom: { kind: 'shotPlan', id }`. Plan-local paths require the
  attachment flow to validate provenance first and pass that exact Plan id and
  reference role into the destination. Title parsing is not acceptable.
- Destination inputs already carry `titleHint` for the semantic title. This
  plan renames that internal concept to `semanticName` and uses the existing
  media attachment `title`; it does not add a second creative label.
- `packages/core/src/server/project-asset-files/path-allocation.ts` already
  centralizes collision-aware allocation, but it currently creates numeric and
  `vNN` suffixes.
- `packages/core/src/server/files/asset-paths.ts` still contains older duplicate
  allocation functions. The implementation must leave one allocator owner.

### Current Urban Basilica Asset audit

Read-only inspection of
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` on 2026-08-08
found 86 active Assets and 94 active Asset Files:

| Asset type | Active Assets | Active Files | Finding |
| --- | ---: | ---: | --- |
| `cast_profile` | 7 | 7 | One file each; role subfolder is unnecessary |
| `character_sheet` | 10 | 10 | One file each; semantic variations already exist in titles/files |
| `cast_voice_sample` | 4 | 4 | One file each |
| `location_hero` | 4 | 4 | One file each |
| `location_sheet` | 5 | 13 | Two Assets contain four stale directional files in addition to `primary` |
| `prop_hero` | 1 | 1 | One file |
| `prop_sheet` | 1 | 1 | One file |
| `lookbook_image` | 7 | 7 | Production and Storyboard roles need separate folders |
| `lookbook_sheet` | 1 | 1 | One file |
| `scene_dialogue_audio` | 5 | 5 | Split across two historical audio roots |
| `scene_storyboard_image` | 37 | 37 | Uses title/id-based Scene folders today |
| `shot_image` | 1 | 1 | Uses opaque Plan and Shot ids in a deep path |
| `shot_plan_video` | 1 | 1 | Separated from its Shot Plan media |
| `shot_plan_video_first_frame` | 1 | 1 | Stored under `videos/references/` |
| `shot_plan_video_last_frame` | 1 | 1 | Stored under `videos/references/` |

The two stale Location Sheet Assets are the only active multi-file Assets. The
accepted Location Sheet decision, current generation purpose, UI tests, skill,
and documentation all use one primary opaque image. The eight directional
files are development leftovers, not product evidence.

The same database currently also contains:

- 4 discarded Assets and 4 discarded Asset Files;
- 11 Trash history rows, including restored Lookbook history and obsolete Take
  history;
- 41 GenerationSpecs and 28 GenerationRuns;
- 22 Runs and 28 distinct Specs connected to active Asset File provenance;
- 6 Runs and 13 Specs with no active Asset File provenance;
- 10 Scenes, all with production numbers;
- 12 historical Beat-revision rows, with each Scene's active pointer selecting its
  latest row; those four active/latest rows become the only four Scene Beats
  revisions in the clean database;
- 1 active Shot Plan containing 1 active Shot.

All 37 active Scene Storyboard Asset Files already live in six retained
iteration folders: two iterations for one Scene and four for another. These
Assets all belong to Beat ids present in the four active revisions, so they are
current image candidates rather than revision-only leftovers. The rebuild
changes only the Scene folder to its human production number; it preserves
every iteration boundary and registered Storyboard file while omitting the
eight inactive Beat revision rows from the clean database.

### Current filesystem audit

The current `renku-movies` root contains the 726 MB Urban Basilica project, a
loose 11 MB MP4, and `.DS_Store`. Urban Basilica contains many old database
backups and retired roots including `generated/`, `shots/`, `videos/`,
`shot-plans/`, duplicate audio roots, old Storyboard title folders, and
temporary data.

The complete directory is therefore the correct recovery boundary. The new
project should not selectively delete history in place and hope that no stale
reference was missed.

### Accepted documents that change

- `docs/architecture/project-asset-storage-conventions.md` currently specifies
  role subfolders, `vNN`, id-based Shot paths, and a top-level `videos/` root.
- `docs/architecture/reference/project-files-and-assets.md` currently presents
  Compound Assets and the old folder tree.
- Decision 0059 already defines a Location Sheet as the one current contract;
  no new directional/slicing decision is needed.
- Plan 0173 supplies the stable production numbers used in paths.

## Right-Sized Change Decision

### Reuse the current Asset model unchanged

Accepted. Asset identity, exclusive ownership, canonical selection,
generation-reference choice, provenance, and Trash already work. Replacing
those contracts would add risk without improving filesystem navigation.

### Refactor the current destination and allocation owner

Accepted. The project-asset-files module already owns every durable write. It
needs a new shallow destination map and two naming modes, not another media
service.

### Add generation lineage or a universal media bundle

Rejected. `gxxx` is only a short collision discriminator. GenerationSpec,
GenerationRun, and Asset File provenance already record the relationships that
matter inside Renku. This rejection does not remove the existing Scene
Storyboard `NN-iteration/` batch folders; those preserve revision-recoverable
Storyboard work and are not a new generic generation-lineage system.

### Make Asset singular-file everywhere

Rejected for this slice. Current writers already create one file per Asset and
the only contrary rows are stale sample data. A public/schema refactor would
touch many consumers without changing user behavior.

## Architecture Shape Gate

### Owning boundary

`packages/core/src/server/project-asset-files/` remains the only runtime owner
of durable Asset File destinations, filename normalization, collision
allocation, file copying, hashing, and rollback.

CLI, Studio routes, React, Engines, and skills must not construct durable
paths. Skills supply concise semantic titles and call the existing focused
generation/media commands.

### Intended module layout

```text
packages/core/src/server/project-asset-files/
  index.ts                         # thin public server entrypoint
  types.ts                         # destination and naming-mode contracts
  persistence.ts                   # validate, resolve, copy, hash, insert
  path-allocation.ts               # filesystem-safe exclusive allocation
  naming/
    safe-segments.ts               # ordinary safe-kebab normalization
    generation-tokens.ts           # three-character token draw/retry
    source-file-names.ts           # external basename and numeric collision
  destinations/
    registry.ts                    # bounded typed destination dispatch only
    screenplay-source.ts
    cast.ts
    location.ts
    prop.ts
    lookbook.ts
    scene-dialogue-audio.ts
    scene-storyboard.ts
    shot.ts
    shot-plan-video.ts
    shot-plan-video-reference-image.ts
```

The broad current generation attachment mapper is split while this plan adds
the custom reference purpose and exact Shot Plan association:

```text
packages/core/src/server/generation/attachment-destinations/
  index.ts                         # thin bounded module entrypoint
  registry.ts                      # purpose-to-focused-resolver dispatch only
  continuity.ts                    # Cast, Location, and Prop details
  lookbooks.ts                     # Lookbook details
  shots.ts                         # Shot image details
  shot-plan.ts                     # exact provenance context and Plan roles
```

`attachments.ts` validates generation provenance before resolving the final
destination. It remains transaction orchestration and does not compose paths.

The existing domain destination files remain focused. The plan does not merge
all destinations into a single `asset-paths.ts` switch. The `naming/` files are
internal and imported directly; no unnecessary barrel is added.

`packages/core/src/server/files/asset-paths.ts` shrinks to any genuinely shared
root constants still needed outside project-asset-files, or disappears after
callers move to the owning module. Its duplicate allocation functions do not
survive.

### Public and internal entrypoints

- Runtime callers continue through
  `packages/core/src/server/project-asset-files/index.ts`.
- `PersistProjectAssetFileInput` gains a required internal naming mode:
  `{ kind: 'generated' }` or `{ kind: 'external' }`.
- Destination variants that currently use `titleHint` use the deliberate name
  `semanticName`.
- Generated attachment resolution maps the existing attachment `title` into
  `semanticName`; no second CLI field or GenerationSpec property is added.
- Shot Plan destinations change directly to:

  ```ts
  | { kind: 'shotPlan.video'; shotPlanId: string }
  | {
      kind: 'shotPlan.videoReferenceImage';
      shotPlanId: string;
      role: 'firstFrame' | 'lastFrame' | 'storyboard' | 'customReference';
    }
  ```

- `shot-plan.video-reference` is added as the current focused image purpose and
  persists Asset type `shot_plan_video_reference` with exact frozen Spec/run
  provenance. Like the other Shot Plan video attachments, it requires
  `authoredFrom.kind === 'shotPlan'` and does not accept provenance-free upload.
- The attachment command validates the frozen Spec/run first, obtains the exact
  `shotPlanId`, verifies that Plan exists or is in supported Trash state, and
  only then asks the focused resolver for its destination.
- Plan 0173's public production-number formatter is the only formatter used by
  Studio labels and filesystem destinations.

### Domain branching

The existing typed destination registry may dispatch by
`ProjectAssetFileDestination.kind`. It may only select the focused domain
resolver. Filename composition stays inside the corresponding destination
file; token allocation and safe-name mechanics stay inside `naming/` and
`path-allocation.ts`.

### Forbidden implementation shapes

- No path construction in CLI, Studio server handlers, React, Engines, or
  skills.
- No one-file switch that builds every domain path and performs persistence.
- No source-text architecture test listing private helper names.
- No filename parsing to infer purpose, owner, generation, or selection.
- No title parsing or current UI selection to infer Shot Plan association.
- No `Date.now()`, full Asset id, UUID, content hash, or long provider id in
  user-visible generated filenames.
- No generation counter table, Asset-series table, bundle table, or version
  field.
- No flattening of Scene Storyboard Asset Files out of their existing
  `NN-iteration/` batch folders.
- No runtime fallback that recognizes old roots.
- No semantic validation of variation words or generated media contents.

### Stop conditions

Stop and revise the implementation if:

- `persistence.ts`, `registry.ts`, or an attachment resolver begins composing
  several unrelated domain filenames;
- the three-character token requires durable counter or lineage state;
- a caller outside Core must know a canonical directory to complete a write;
- a Shot Plan attachment can reach persistence without an exact frozen
  `authoredFrom` Plan id;
- the one-time Urban Basilica rebuild becomes a user-facing migration mode;
- Storyboard import stops allocating one `NN-iteration/` folder per batch, or
  the rebuild collapses historical Storyboard iterations into one flat folder;
- a multi-file Asset refactor is introduced to remove eight stale files;
- path tests can pass only by duplicating production-number formatting.

## Contracts

### Naming mode

```ts
type ProjectAssetFileNamingMode =
  | { kind: 'generated' }
  | { kind: 'external' };
```

This is an internal Core persistence contract. The focused owning Core command
chooses it from the accepted operation; persistence does not guess from an
open-ended origin string and adapters do not choose it:

- `generated` covers exact Spec/run attachments, provider-created Dialogue or
  voice audio, and a copied generated Shot candidate written into a new Plan;
- `external` covers retained FDX, user/Internet attachments without generation
  provenance, and other source-preserving imports.

An imported Storyboard image uses `generated` only when its accepted source
Spec/run proves generation provenance; otherwise it uses `external` source-name
allocation. The filename never creates or upgrades provenance.

### Semantic destination input

Purpose-specific destination types use `semanticName?: string`. Core requires
it only for generated purposes whose filenames need an agent-authored semantic
variation. Fixed-name destinations ignore it for filename composition while
retaining the full Asset title in SQLite.

### Structured diagnostics

| Code | Condition |
| --- | --- |
| `PROJECT_ASSET_FILE_SEMANTIC_NAME_REQUIRED` | A generated purpose requiring a semantic variation has no usable normalized name |
| `PROJECT_ASSET_FILE_GENERATION_TOKEN_ALLOCATION_FAILED` | Bounded exclusive retries cannot allocate a generated filename |
| `PROJECT_ASSET_FILE_SOURCE_NAME_ALLOCATION_FAILED` | An external basename cannot be normalized or allocated safely |
| Existing path/source diagnostics | Source missing, unsafe path, destination escape, copy, hash, and persistence failures remain under their current owners |

### One-time rebuild manifest

`scripts/rebuild-urban-basilica-asset-layout.mjs` supports dry-run by default
and `--apply` explicitly. Its JSON manifest records:

- archive source and clean destination roots;
- source database hash and destination database hash;
- every retained Asset/File id, old path, new path, media kind, size, and
  SHA-256;
- every omitted stale directional Asset File id and path;
- every removed discarded/Trash row family;
- every retained and removed GenerationSpec/Run id;
- copied Inspiration and Research files with hashes;
- collision and missing-file diagnostics;
- final row counts, byte counts, `quick_check`, and `foreign_key_check`.

The script refuses `--apply` if the destination is non-empty, the archive root
is not explicit, any retained active file is missing, any target path collides,
or any preflight integrity check fails.

## Implementation Slices

### Slice 1 — Complete Plan 0173 numbering prerequisites

Implement and verify Scene, Shot Plan, Shot, and Beat numbers
before changing durable destinations. Exit when Core can resolve every current
Asset owner to the exact display numbers required by this plan.

### Slice 2 — Replace durable name allocation

- Add the safe-segment, generation-token, and external-source naming modules.
- Replace `vNN` and generic version allocation for durable Assets.
- Use exclusive writes and bounded redraw for `gxxx`.
- Remove duplicate allocation code from `files/asset-paths.ts`.
- Keep temporary-file allocation separate; temporary inspection files do not
  need the durable `gxxx` contract.

Exit when generated and external names follow their distinct contracts without
new database state.

### Slice 3 — Cut every durable destination to the new tree

Update the focused destination modules and tests for:

- Screenplay source;
- Production and Storyboard Lookbooks;
- Cast Profile, Character Sheet, and voice sample;
- Location Sheet and Hero;
- Prop Sheet and Hero;
- Scene Dialogue Audio;
- Scene Beat Storyboard image and temporary Storyboard sheet;
- Shot image;
- Shot Plan video, first frame, last frame, video Storyboard, and custom
  reference. Validate exact provenance before destination resolution, pass the
  authoritative Plan id/role, and add the focused custom-reference purpose.

Update current callers directly and remove obsolete root constants and old
path assumptions. Exit when no new durable Asset File can be written under an
old root.

### Slice 4 — Align media-producer semantic titles

In `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- update `media-producer/SKILL.md` attachment guidance;
- update Cast Character Sheet, Location Sheet, Prop Sheet, Lookbook, voice,
  Shot image, Storyboard, and Shot Plan video references and samples where
  titles are authored;
- tell the agent to supply only the variation/semantic portion when Core owns
  the owner folder and role suffix;
- keep full creative titles available as Asset metadata where appropriate;
- add eval cases for `palace robe`, `burned down`, and two independently
  generated candidates of the same semantic object;
- keep external attachments free of fabricated generation provenance or
  `gxxx` values.

Skills never calculate the token or final path.

### Slice 5 — Record the accepted storage decision

- Add `docs/decisions/0076-use-human-readable-asset-folders.md`.
- Replace the current canonical tree in
  `docs/architecture/project-asset-storage-conventions.md`.
- Update `docs/architecture/reference/project-files-and-assets.md`,
  `docs/architecture/data-model-and-storage.md`, and current CLI/media docs.
- Remove Compound Asset as a current product capability while leaving the
  generic `Asset.files[]` implementation unchanged in this slice.
- Preserve old ADR history; add concise supersession notices only where an old
  accepted decision explicitly mandates `vNN` or an obsolete root.

### Slice 6 — Dry-run the complete Urban Basilica rebuild

With Studio stopped:

1. Inventory and hash the current directory and database.
2. Produce a dry-run manifest from the current project.
3. Verify the manifest retains all 86 active Assets but exactly 86 active Asset
   Files after omitting the eight stale directional Location files.
4. Verify it retains the active-provenance generation records and identifies
   unattached generation history for removal.
5. Verify Plan 0173 converts only the four active Beat revisions, clears their
   old base links, and omits the other eight revision rows.
6. Verify every new path is unique and every active owner resolves to a human
   folder.
7. Run the rebuild against a temporary copy and open it through Core and Studio.

No live directory is moved until the disposable rebuild passes.

### Slice 7 — Archive and reconstruct `renku-movies`

After explicit final confirmation at implementation time:

1. Move the complete `/Users/keremk/renku-movies` directory to a timestamped
   sibling such as
   `/Users/keremk/renku-movies-archive-20260808-153000`.
2. Recreate `/Users/keremk/renku-movies/urban-basilica` as an empty destination.
3. Copy the current project database into the clean destination, apply the
   accepted Plan 0173 schema migration, and perform the one-time cleanup in the
   copied database.
4. Copy only current registered Asset Files into their new paths.
5. Copy user-owned `visual-language/inspiration/` and `research/` contents
   losslessly.
6. Do not copy old `tmp/`, `.renku` backups, review evidence, discarded files,
   Trash files, stale directional Location files, retired `generated/`,
   unregistered `shots/`, or the loose root MP4.
7. Retain only GenerationSpecs and GenerationRuns required by active Asset File
   provenance; do not rewrite immutable retained snapshots merely because they
   contain historical paths.
8. Retain only the four formerly active Beat revisions as clean baselines;
   preserve their revision/Beat ids, clear their base links, and leave the other
   eight rows only in the archived database.
9. Empty Trash history in the reconstructed database and remove discarded
   Asset/File rows after referential verification.
10. Write the final manifest inside the new `.renku/` review evidence area and a
   second copy outside the project.

The archive is never deleted by this plan and remains the recovery source.

## Tests And Guardrails

### Core owning-layer tests

- Test the complete destination matrix for generated and external attachments.
- Test all Shot Plan media requires exact frozen Spec/run provenance, uses its
  `authoredFrom` Plan id, and rejects a title/current-selection mismatch.
- Test the custom Plan-reference purpose without copying unrelated dependency
  Assets into the Plan folder.
- Test production labels `1`, `1A`, `4aA`, `28A`, and `100` in folders and
  filenames.
- Test Shot Plan folder names and Shot image names beyond 99.
- Test semantic-name normalization, empty required names, 32-character bounds,
  extension normalization, and owner omission.
- Test `gxxx` alphabet, exact length, collision redraw, bounded failure, and
  exclusive no-overwrite behavior.
- Test two concurrent allocations for the same semantic stem.
- Test external source collisions use `-2`, `-3` without `g` or `v`.
- Test image edits allocate another `gxxx` while provenance remains intact.
- Test Scene Storyboard `NN-iteration/` paths, batch grouping, historical-folder
  preservation, and Beat insertion labels supplied by Plan 0173.
- Test every attachment still inserts one Asset File and preserves rollback.
- Test no current Location Sheet attachment creates directional roles.

### Adapter and skill coverage

- CLI/media tests prove adapters pass title/source intent and never construct a
  durable path.
- Existing Studio resource tests prove changed stored paths still resolve media;
  no duplicate path matrix is added to React.
- `media-producer` evals prove concise variations are supplied, owner names are
  omitted from semantic filename intent, and the skill never invents tokens.

### One-time rebuild tests

- Dry-run never writes.
- Apply refuses a non-empty destination and an implicit/broad archive source.
- Missing files, hash mismatches, path collisions, and database integrity
  failures stop before the live move.
- A temporary Urban Basilica rebuild preserves all current active owner,
  selection, Lookbook, Storyboard, Dialogue, Shot, generation-provenance, and
  screenplay-source relationships.
- The manifest accounts for every copied, omitted, and database-removed item.

### Architecture guardrails

- Import-boundary checks continue to prevent Studio/CLI from importing Core
  database or filesystem internals.
- Runtime tests prove invalid destinations fail before Asset File insertion.
- Architecture tests protect capabilities and package boundaries, not private
  function-name inventories.
- Search current production code and docs for durable old-root allocation and
  `-vNN` generation; historical plans and old ADR bodies are excluded.

## Documentation

Update:

- `docs/decisions/0076-use-human-readable-asset-folders.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/media-generation.md`;
- `docs/cli/commands.md` where attachment title/source behavior is described;
- the exact `studio-skills/skills/media-producer` files named in Slice 4.

The final current docs must show one tree and one filename matrix. They must not
retain the rejected generation-folder, version-suffix, owner-repetition, or
directional Location Sheet models as current alternatives.

## Final Verification

### Automated

Run at minimum:

```bash
pnpm --dir packages/core test
pnpm test:cli
pnpm check
pnpm build
```

Run the media-producer image and video guide validators after skill edits.

### Disposable project

Create generated and external examples for every destination family. Inspect
the actual tree in Finder or with `find`, confirm no ids or old roots appear,
then exercise selection, generation references, Trash/restore, Shot Plan copy,
Storyboard import, Dialogue Audio, and video attachment.

### Urban Basilica

Before the live move, preserve the dry-run manifest and confirm the archive
target is a timestamped sibling, not a broad or unresolved path. After rebuild:

- `sqlite3 ... 'pragma quick_check'` returns `ok`;
- `pragma foreign_key_check` returns no rows;
- there are 86 active Assets and 86 active Asset Files for the audited snapshot;
- every active Asset has exactly one active file and one exclusive membership;
- the two affected Location Sheets retain only their primary images;
- Trash contains no rows and discarded Assets/Files contain no rows;
- Scene Beats contains exactly four baseline revisions and four active pointers,
  with no base link to omitted development history;
- only active-provenance generation records remain;
- every registered file exists and matches its stored hash and size;
- no registered path begins with an obsolete durable root;
- Project, Screenplay, Cast, Locations, Props, Lookbooks, Storyboards, Dialogue,
  Shot Plans, Shots, images, videos, and generation context open normally;
- the archive still exists unchanged and contains the former root-level loose
  MP4 and historical project data.

### Architecture and diff inspection

- Inspect `git diff --stat` and the complete diff.
- Inspect every new or heavily modified project-asset-files module.
- Confirm `index.ts` remains a thin entrypoint.
- Confirm `registry.ts` only dispatches to focused destinations.
- Confirm no naming module owns domain persistence or creative interpretation.
- Confirm no checklist item was satisfied by moving all logic into a god file.

## Completion Checklist

### Review Area

- [ ] Confirm every accepted folder and filename in the requirement ledger is implemented.
- [ ] Confirm generated filenames use `g` plus exactly three human-distinguishable characters.
- [ ] Confirm Shot images remain in `shot-images/` and all plan-level references/videos remain flat.
- [ ] Confirm no generic generation/version folders, `vNN`, Asset series, or lineage model was introduced, while preserving the existing Scene Storyboard `NN-iteration/` folders.
- [ ] Confirm the implementation preserves existing Asset ownership, selection, provenance, and Trash architecture.
- [ ] Confirm the final module shape matches the Architecture Shape Gate and contains no god file.

### Architecture And Contracts

- [ ] Keep durable path construction solely in Core project-asset-files.
- [ ] Replace `titleHint` with the deliberate internal `semanticName` contract without a compatibility alias.
- [ ] Add generated/external naming mode at the Core persistence boundary.
- [ ] Resolve every Shot Plan media destination from exact frozen provenance.
- [ ] Reuse the existing attachment title rather than adding another creative-name field.
- [ ] Keep production-number formatting owned by Plan 0173.
- [ ] Keep paths non-authoritative and unparsed.
- [ ] Keep prompts and generated media opaque.
- [ ] Keep package-boundary failures structured.
- [ ] Leave `Asset.files[]` and the generic Asset File schema unchanged.

### Naming And Allocation

- [ ] Implement one safe-kebab normalizer with the accepted length and extension rules.
- [ ] Implement Crockford-base32 `gxxx` allocation with at most 16 exclusive collision retries.
- [ ] Ensure generation tokens carry no ordering or lineage meaning and are not persisted separately.
- [ ] Implement safe external basename allocation with plain numeric collision suffixes.
- [ ] Remove durable `vNN` allocation and duplicate allocation functions.
- [ ] Cover concurrency and rollback without overwriting a file.

### Destination Implementation

- [ ] Move Screenplay sources to `screenplay/` with safe source names.
- [ ] Split Production and Storyboard media under `visual-language/lookbooks/`.
- [ ] Flatten Cast Profile, Character Sheet, and voice media under each Cast handle.
- [ ] Flatten Location Sheet/Hero and Prop Sheet/Hero media under each owner handle.
- [ ] Keep Inspiration folders under `visual-language/inspiration/`.
- [ ] Place Dialogue Audio under `scenes/<scene>/dialogues/` with Scene-wide dialogue numbers.
- [ ] Place each Beat Storyboard import batch under `storyboards/<scene>/<NN>-iteration/` and temporary visual sheets under the Scene-level `tmp/` folder.
- [ ] Place Shot images under `scenes/<scene>/<plan>-shot-plan/shot-images/`.
- [ ] Place first frame, last frame, video Storyboard, custom references, and video flat in the Shot Plan folder.
- [ ] Add the focused custom Shot Plan reference purpose without copying ordinary dependency Assets.
- [ ] Remove obsolete durable root constants and update callers directly.

### CLI And Agent Skills

- [ ] Keep CLI handlers thin and free of path construction.
- [ ] Require a semantic title only for generated purposes that need a variation.
- [ ] Update media-producer guidance for concise semantic variation titles.
- [ ] Update exact Cast, Location, Prop, Lookbook, voice, Storyboard, Shot image, and Shot Plan video references/samples.
- [ ] Add evals proving owner omission, semantic variation naming, repeated generation, and external attachment behavior.
- [ ] Confirm skills never calculate final filenames or generation tokens.

### Tests And Guardrails

- [ ] Cover the full destination matrix at the Core owning layer.
- [ ] Cover Scene/Shot/Beat insertion labels in paths without duplicating Plan 0173's allocator matrix.
- [ ] Cover required semantic names, normalization, length, collision, concurrency, and rollback.
- [ ] Prove every current attachment creates one Asset File.
- [ ] Prove no Location Sheet writer creates directional files.
- [ ] Keep adapter tests limited to delegation and serialization.
- [ ] Keep architecture checks based on stable boundaries, not helper-name needles.

### Urban Basilica Rebuild

- [ ] Produce a complete read-only inventory and dry-run manifest.
- [ ] Verify a disposable rebuild before touching the live directory.
- [ ] Archive the entire `renku-movies` root to an explicit timestamped sibling.
- [ ] Recreate an empty `renku-movies/urban-basilica` destination.
- [ ] Copy all active registered assets to canonical paths with verified hashes.
- [ ] Preserve all 37 registered Scene Storyboard files and their six current
      iteration boundaries while changing only the enclosing Scene path.
- [ ] Keep only the four formerly active Beat revisions, clear their base links,
      and verify the other eight rows exist only in the archived database.
- [ ] Copy Inspiration and Research files losslessly.
- [ ] Omit eight stale directional Location Sheet files and rows while retaining both primary files.
- [ ] Remove discarded Asset/File rows and empty Trash history in the rebuilt database.
- [ ] Retain only generation records connected to active Asset File provenance.
- [ ] Do not copy obsolete temporary, generated, retired Shot, backup, review-evidence, or loose root media.
- [ ] Preserve final manifests inside and outside the rebuilt project.
- [ ] Keep the archive unchanged and recoverable.

### Documentation And ADRs

- [ ] Add ADR 0076 for the accepted human-readable storage contract, including
      the retained Scene Storyboard iteration folders.
- [ ] Update the canonical storage and Asset reference docs to one current tree.
- [ ] Remove Compound/multi-file Assets as a current documented capability without refactoring the generic API.
- [ ] Update current generation and CLI docs.
- [ ] Add concise notices to older accepted decisions only where needed; do not rewrite their history.
- [ ] Leave historical plans unchanged.

### Final Verification

- [ ] Run focused Core and CLI tests.
- [ ] Run skill guide validators and evals.
- [ ] Run `pnpm check` and `pnpm build`.
- [ ] Inspect a complete disposable filesystem tree.
- [ ] Run database, file-existence, hash, membership, selection, and provenance checks on rebuilt Urban Basilica.
- [ ] Open the rebuilt project and exercise representative desktop workflows.
- [ ] Review `git diff --stat` and all large or heavily modified files.
- [ ] Confirm `index.ts` files remain thin and no broad dispatcher or catch-all helper was added.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [ ] Only then mark this plan complete.
