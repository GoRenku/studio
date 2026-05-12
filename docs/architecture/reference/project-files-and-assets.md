# Project Files And Assets

Date: 2026-05-10

Status: current

Role: reference

## Purpose

This document defines Renku Studio asset concepts and the project folder shape.

Decision history:

- `../../decisions/0012-store-project-file-references-as-project-relative-paths.md`
- `../../decisions/0013-use-core-owned-project-assets-and-production-exports.md`

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
- voice samples;
- helper images;
- intermediate media.

Production assets are for editing, export, localization handoff, or composition
tools.

They should contain only assets intended for production use. They should not be
mixed with helper files, unused takes, character design exploration, or random
working notes.

## Folder Shape

For a standalone movie project, current implementation-owned asset roots use
lower-kebab project-relative paths:

```text
<project>/
  .renku/
    project.sqlite
    tmp/

  working-assets/
    base/
      narrative/
      visual-language/
      continuity/
      sequences/

    localization/
      <locale>/
        narrative/
        cast/
        sequences/

  production-assets/
    master/
      sequences/
      shared/

    localized/
      <locale>/
        sequences/
        shared/

    manifest/
      production-export-manifest.json

  Exports/
```

Project creation may create only the folders needed by the current project
contents. Markdown asset writers and production export create additional parent
folders when they write files.

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

## Working Localization

Working localization should not clutter the base working tree.

Base-language work lives under:

```text
working-assets/base/
```

Localized work lives under:

```text
working-assets/localization/<locale>/
```

Clip-specific localized working assets should still mirror the narrative
hierarchy:

```text
working-assets/
  localization/
    tr-TR/
      sequences/
        01-logistics/
          scenes/
            01-foundry-at-night/
              clips/
                001-cannon-inspection/
                  narration/
                    takes/
                    selects/
                  subtitles/
                    takes/
                    selects/
                  karaoke/
                    takes/
                    selects/
                  video/
                    takes/
                    selects/
```

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

Do not infer IDs, owners, languages, selects, clips, or bindings from file names
or folder names.
