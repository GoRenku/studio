# Project Files And Assets

Date: 2026-05-10

Status: current

Role: reference

## Purpose

This document defines Renku Studio asset concepts and the project folder shape.

Decision history:

- `../../decisions/0012-store-project-file-references-as-project-relative-paths.md`
- `../../decisions/0013-use-core-owned-project-assets-and-production-exports.md`
- `../../decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `../../decisions/0019-use-durable-lookbooks-as-project-visual-direction.md`
- `../../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../../decisions/0036-use-unsliced-location-sheets.md`
- `../../decisions/0064-use-exclusive-asset-membership-and-scoped-selection.md`
- `../project-asset-storage-conventions.md`

## Asset Vocabulary

An **Asset** is a registered content item in Renku Studio metadata.

An **Asset File** is a concrete file on disk that belongs to an asset.

A **Compound Asset** is an asset represented by a folder because several files
belong together, such as a video plus thumbnail and captions.

A **Take** is a persisted generated or imported candidate only in a focused
domain that explicitly defines Take behavior. The current example is a Scene
Dialogue Audio Take. Common Asset membership does not carry Take state.

An **Asset Owner** is the one Project, Cast Member, Location, Prop, Sequence, Scene,
logical Scene Beat, Lookbook, or Shot that exclusively owns an Asset.

A **canonical selection** chooses at most one ready candidate for a Project
Cover, Cast Profile, Location Hero, Location World, Lookbook card image, Shot
image, or Scene Beat Storyboard surface. It does not affect generation
references.

A **Project Cover** is a Project-owned image Asset with canonical type
`project_cover` and exactly one active primary image Asset File. Common
selection chooses the image used by Project Library and Studio sidebar
projections. Candidate files live beneath `covers/`; ownership and selection
come from SQLite rather than their path.

A **Visual Language Asset** is an asset attached to a project Visual Language
entry. Initial roles include `guidance`, `prompt`, `reference`, and
`anti_reference`.

A **Continuity Reference Asset** is an asset attached to a recurring subject
that must remain consistent across the movie, such as a location, prop, costume,
architecture, ship, vehicle, symbol, or group. Initial roles include
`description`, `reference`, `anti_reference`, and `sheet`.

An **Inspiration folder image** is not an asset by default. It is plain
filesystem content inside a Visual Language Inspiration folder. Agents inspect
these files directly and cite them by folder-local filename in Inspiration
Analysis JSON.

A **Lookbook Image** is an Asset exclusively owned by a Lookbook. Section
placement belongs in
`lookbook_image_section`, not in Lookbook JSON.

A **Cast Character Sheet** is a Cast Member-owned image Asset with canonical
type `character_sheet`. Imported/generated character sheets are stored
directly under `cast/<handle>/`.

A **Cast Profile** is a Cast Member-owned image Asset with canonical type
`cast_profile`. Imported/generated profile images are stored directly under
`cast/<handle>/`.

A **Cast Voice Sample** is a Cast Member-owned audio Asset with canonical type
`cast_voice_sample` and is linked from exactly one Cast Voice record. Custom audio
files, generated `cast.voice-sample` outputs, and existing ElevenLabs provider
samples are all stored directly under `cast/<handle>/` after attachment.
The Cast Voice record, not the filename, supplies the provider voice identity,
reference name, purpose, and structured `sampleSource` provenance.

A **Location Sheet** is a full-image production reference board owned by a
Location with canonical type `location_sheet`. It has one primary image file and a
persisted description. A Location can have many Location Sheets; future Shot
workflows may reference specific sheet assets.

A **Location Hero Image** is a compact overview image owned by a Location. It
uses canonical type `location_hero` and one primary image file. Common
selection drives overview and detail display only; it is not a generation
reference default.

A **Location World** is a navigable Gaussian splat owned by a Location. It uses
canonical type `location_world`, media kind `model`, and one primary
full-resolution SPZ file. Common selection chooses the World shown in Studio;
older candidates remain available for rollback.

A **Prop Sheet** is a Prop-owned image Asset with canonical type
`prop_sheet`. Its selection is request-scoped to an exact GenerationSpec.

A **Prop Hero** is a Prop-owned image Asset with canonical type `prop_hero`.
One Hero may be selected as the Prop's compact Studio image.

A **Scene Storyboard Image** is an image Asset owned by one logical Scene Beat.
Durable storyboard images are stored under
top-level `storyboards/<scene-display-number>/<NN>-iteration>/`.
Temporary storyboard sheets generated for slicing or review live under that
scene storyboard folder's `tmp/` subfolder and are not assets.

A **Shot Plan Video** is a Project-owned Asset stored under the exact frozen
Plan provenance folder
`scenes/<scene-display-number>/<NN>-shot-plan/`. Its primary Asset File records
exact managed-Run or frozen agent-external-Spec provenance. The Plan remains
authoring context rather than Asset membership.

A **Shot Image Candidate** is an image Asset exclusively owned by one Shot with
canonical type `shot_image`. A Shot may own several candidates and explicitly
select zero or one. Import can atomically select when requested. Candidate
files live under
`scenes/<scene-display-number>/<NN>-shot-plan/shot-images/`; SQLite
membership, not path segments, defines ownership.

The **Research folder** is user-owned scratch space for external references.
Files in `research/` are not asset files. A generation spec may reference a
`research/` file as a one-off input when the file is only evidence for that
generation. When a research file becomes a durable project asset, Core copies
it into the relevant owner folder and registers that destination path.

Durable asset-file persistence is centralized in
`packages/core/src/server/project-asset-files/`. Runtime callers import public
APIs from `packages/core/src/server/project-asset-files/index.ts`, pass a source
project-relative path and an owner-aware destination such as a Project Cover,
Cast Character Sheet, Cast Voice Sample, Location Sheet, Location Hero, Location World,
Lookbook Image,
Lookbook Sheet, Scene Dialogue Audio take, or Shot image. The
destination and generation-output submodules are private
implementation details that own path allocation by domain family and purpose
family.

Scene Storyboard imports use a batch storage API so one import writes one shared
iteration folder for all imported Beat files. Callers must not precompute
durable destination folders or insert `asset_file` rows for new durable media
directly. Temporary project files use the module's temporary destination
contract and never become SQLite asset files unless a domain import command
later materializes them into an owner folder.

Scene-owned Dialogue Audio paths use:

```text
scenes/<scene-display-number>/dialogues/s<scene>-<speaker>-d<turn>-gxxx.<ext>
```

The stable Dialogue Turn id and its Core-validated speaker reference determine
the filename prefix. File allocation never depends on optional Section ancestry
or the Dialogue Turn's current array index.

## Working Assets Versus Production Assets

Working assets are for development and iteration.

They include:

- notes;
- briefs;
- references;
- generated takes;
- selected working options;
- localization working files;
- character sheets;
- Lookbook images;
- voice samples;
- helper images;
- intermediate media.

Production assets are for editing, export, localization handoff, or composition
tools.

They should contain only assets intended for production use. They should not be
mixed with helper files, unused takes, character design exploration, or random
working notes.

## Folder Shape

For a standalone movie project, project files live under feature-owned folders
at the project root. There is no `working-assets/` root and no
`working-assets/base/` root.

```text
<project>/
  .renku/
    project.sqlite

  tmp/
    media/
    specs/
    receipts/
    operations/
    qa/
    scratch/

  screenplay/

  cast/
    <cast-handle>/

  locations/

  props/

  visual-language/
    inspiration/
    lookbooks/
      production/
      storyboard/

  storyboards/
    <scene-display-number>/
      tmp/
      00-iteration/

  scenes/
    <scene-display-number>/
      dialogues/
      <NN>-shot-plan/
        shot-images/

  research/

  production-assets/
    master/
      shot-plans/
      shared/

    localized/
      <locale>/
        sequences/
        shared/

    manifest/
      production-export-manifest.json

```

Folder responsibilities:

- `screenplay/` contains authored screenplay source files.
- `cast/`, `locations/`, `props/`, and `visual-language/` contain
  feature-owned definitions, reference material, and working files.
- `cast/<handle>/` contains imported or generated character sheets, profiles,
  and Cast Voice sample files. These
  files may have entered the project as custom local files, generated voice
  sample outputs, or existing ElevenLabs provider samples fetched during
  `renku cast voice attach`.
- `locations/<handle>/` contains Location Sheets, Hero Images, and generated
  Location World files directly. World files use `world-gxxx.spz`; SQLite
  Asset identity and selection, not the collision token, define history.
- `props/<handle>/` contains Prop Sheets and Hero Images directly.
- `visual-language/inspiration/` contains Inspiration folder content. Images in
  those folders are not per-image assets unless a future command explicitly
  registers one.
- `visual-language/lookbooks/{production,storyboard}/` contains imported or
  generated Lookbook media for that exact Lookbook role.
- `storyboards/<scene-display-number>/` contains durable storyboard
  image iteration folders and a scene-local `tmp/` folder for temporary
  storyboard sheets.
- `scenes/<scene-display-number>/<NN>-shot-plan/` contains Shot images, Plan
  video-reference images, and Plan video Assets resolved from exact provenance.
- `research/` contains user-owned scratch references. Renku may read these
  files when instructed, and generation specs may use them as one-off reference
  inputs. Renku must not register them as SQLite asset files.
- `tmp/media/` contains temporary generated, downloaded, transformed, or
  cropped media.
- `tmp/specs/` contains temporary Generation Spec JSON exports.
- `tmp/receipts/` contains temporary provider receipt exports.
- `tmp/operations/` contains CLI authoring and import documents.
- `tmp/qa/` contains review evidence, and `tmp/scratch/` contains other
  non-durable agent/debug files.
- `production-assets/` contains clean post-production handoff files.

Project creation may create only the folders needed by the current project
contents. Feature writers create additional parent folders when they write
files.

Current runtime code must not create `generated/` as a project asset or
temporary output folder. Historical plans and old development data may still
mention `generated/media/`; the current decision is
`../project-asset-storage-conventions.md`.

## Production Asset Hierarchy

Production `production-assets/master/` and
`production-assets/localized/<locale>/` should use the same narrative
hierarchy for clip-specific assets.

This is important because an editor or agent must be able to correlate localized
assets with the master edit without guessing from filenames.

Example:

```text
production-assets/
  master/
    sequences/
      01-logistics/
        scenes/
          01-foundry-at-night/
            clips/
              001-cannon-inspection/
                video.mp4
                narration.wav
                still.png

    shared/
      music/
        main-theme.wav
      sound-effects/
        cannon-impact.wav
      graphics/
      audio/

  localized/
    tr-TR/
      sequences/
        01-logistics/
          scenes/
            01-foundry-at-night/
              clips/
                001-cannon-inspection/
                  narration.wav
                  subtitles.vtt
                  word-timing.json
                  video-override.mp4

      shared/
        music/
        sound-effects/
        audio/
        subtitles/
        graphics/
        video-overrides/

  manifest/
    production-export-manifest.json
```

`shared/` exists in both `master/` and each localized version.

Use `production-assets/master/shared/` for base production assets that are not
naturally owned by one clip, such as music, sound effects, shared graphics, or
shared audio beds.

Use `production-assets/localized/<locale>/shared/` for locale-specific assets
that are not naturally owned by one clip, such as localized reusable graphics, a
language-pack subtitle file, or a shared dubbed intro.

`production-assets/manifest/production-export-manifest.json` is the generated
handoff manifest. SQLite remains the internal source of truth.

## Localization

Localization work should live with the feature or production area that owns it.
Do not create a separate `working-assets/localization/` root.

Locale-specific production handoff files live under:

```text
production-assets/
  localized/
    <locale>/
      sequences/
      shared/
```

Feature-owned localized working files may use feature-local subfolders when the
feature defines them. SQLite still owns locale context and relationships; the
folder structure must not be parsed to infer locale ownership.

## Production Export Materialization

Production export is copy-based. Working media stays in place; export copies
focused picked-Take video and included Dialogue Audio rows into the handoff
tree, skips unchanged files, and prunes stale managed files according to the
manifest. Storyboards, Lookbooks, Cast/Location design media, canonical selected
images, Take frames, and Video Prompt images are excluded.

## Files Do Not Define Ownership

The folder structure is for humans.

SQLite owns identity, exclusive Asset membership, focused domain links, and
canonical selection.

Do not infer IDs, owners, languages, selects, clips, bindings, or
grouped asset membership from file names or folder names.

For Location Sheets, paths such as `sheet.png` are readable storage names only.
Runtime code must use Asset membership, canonical Asset type, and the `primary`
AssetFile role instead of parsing names or inferring meaning from folders.

The same rule applies to Visual Language folders. A folder name may be a useful
creative hint for an agent, but Renku ownership and focused domain links come
from SQLite rows and Core commands, not parsed names or paths.

The Scene Generations projection follows the same rule. It includes only active
Project-owned `shot_plan_video` Assets whose exact managed run snapshot or
frozen external source spec identifies a Shot Plan video request. A restorable
trashed plan supplies Scene context for `Miscellaneous`; a permanently
collected plan supplies none.
