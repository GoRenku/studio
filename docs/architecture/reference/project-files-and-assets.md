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

## Asset Vocabulary

An **Asset** is a registered content item in Renku Studio metadata.

An **Asset File** is a concrete file on disk that belongs to an asset.

A **Compound Asset** is an asset represented by a folder because several files
belong together, such as a video plus thumbnail and captions.

A **Take** is a persisted generated or imported candidate option.

A **Select** is the current project choice from persisted takes or imported
options. Users can change selects later, but the current take/select value
belongs in project metadata, not ephemeral UI state.

In SQLite, an attached asset's take/select classification belongs on the domain
asset relationship row. A relationship with `selection = 'take'` is a persisted
candidate. A relationship with `selection = 'select'` is currently selected.

A **Production Asset** is a selected asset that has been exported into the
clean production handoff tree.

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

A **Lookbook Image** is an asset. It is registered and attached to a Lookbook
through Lookbook image relationships. Section placement belongs in
`lookbook_image_section`, not in Lookbook JSON.

A **Cast Character Sheet** is an image asset attached to a cast member with the
`character_sheet` role. Imported/generated character sheets are stored under
`cast/<handle>/character-sheets/`.

A **Cast Profile** is an image asset attached to a cast member with the
`profile` role. Imported/generated profile images are stored under
`cast/<handle>/profiles/`.

A **Cast Voice Sample** is an audio asset attached to a cast member with the
`voice_sample` role and linked from exactly one Cast Voice record. Custom audio
files, generated `cast.voice-sample` outputs, and existing ElevenLabs provider
samples are all stored under `cast/<handle>/voice-samples/` after attachment.
The Cast Voice record, not the filename, supplies the provider voice identity,
reference name, purpose, and structured `sampleSource` provenance.

A **Location Sheet** is a full-image production reference board attached to a
location with the `environment_sheet` role. It has one primary image file and a
persisted description. A Location can have many Location Sheets; shot/take
workflows reference the specific sheet assets they need.

A **Location Hero Image** is a compact representative image attached to a
location with the `hero` role. It uses asset type `location_hero` and one
primary image file. The current selected hero image drives overview and detail
display only; it is not a hidden default shot reference.

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

  screenplay/
    acts/

  cast/
    <cast-handle>/
      character-sheets/
      profiles/
      voice-samples/

  locations/

  props/

  visual-language/
    inspiration/
    lookbook/

  shotlist/

  production-assets/
    master/
      shotlist/
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
- `cast/<handle>/character-sheets/` contains imported or generated cast
  character sheet image assets.
- `cast/<handle>/profiles/` contains imported or generated cast profile image
  assets.
- `cast/<handle>/voice-samples/` contains Cast Voice sample audio files. These
  files may have entered the project as custom local files, generated voice
  sample outputs, or existing ElevenLabs provider samples fetched during
  `renku cast voice attach`.
- `locations/<handle>/environment-sheets/<sheet-slug>/` contains imported or
  generated Location Sheets as one full primary image file per sheet.
- `locations/<handle>/heroes/<hero-slug>/` contains imported or generated
  Location Hero Images as one primary image file per hero.
- `visual-language/inspiration/` contains Inspiration folder content. Images in
  those folders are not per-image assets unless a future command explicitly
  registers one.
- `visual-language/lookbook/` contains imported or generated Lookbook image
  assets.
- `shotlist/` contains shot planning files and shot-owned assets.
- `production-assets/` contains clean post-production handoff files.

Project creation may create only the folders needed by the current project
contents. Feature writers and production export create additional parent folders
when they write files.

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

## Select Materialization

Selects are project choices stored in SQLite.

Exporting a select into `production-assets/` is copy-based. Working assets stay
in place; production export copies selected files into the handoff tree, skips
unchanged files, and can prune unmanaged files according to the export manifest.

The current production export path exports selected project, sequence, scene,
and clip assets. Cast and visual-language assets are part of the registered
asset graph, but they are not production-exportable targets until a product
decision gives them production handoff semantics.

## Files Do Not Define Relationships

The folder structure is for humans.

SQLite owns identity and relationships.

Do not infer IDs, owners, languages, selects, clips, bindings, or
grouped asset membership from file names or folder names.

For Location Sheets, paths such as `sheet.png` are readable storage names only.
Runtime code must use the asset relationship, asset type, and `primary` asset
file role instead of parsing names or inferring meaning from folders.

The same rule applies to Visual Language folders. A folder name may be a useful
creative hint for an agent, but Renku relationships come from SQLite rows and
CLI commands, not parsed names or paths.
