# Renku Studio Domain Vocabulary

Date: 2026-05-10

Status: current

Role: reference

## Purpose

Renku Studio needs one shared vocabulary across documentation, database schema,
core APIs, CLI commands, and UI copy.

The rule:

> Use the same domain word for the same concept everywhere.

Implementation-specific file names can exist, but they should not create
competing product terms.

Decision history:

- `../../decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`
- `../../decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `../../decisions/0019-use-durable-lookbooks-as-project-visual-direction.md`
- `../../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../../decisions/0024-keep-media-slicing-out-of-app-state.md`
- `../../decisions/0025-use-shared-media-generation-purpose-architecture.md`

## Naming Rules

- Use **Generation Definition** for code-owned generation behavior.
- Use **Generation Key** for the stable key identifying a generation type.
- Avoid using "workflow", "blueprint", "preset", "style", "lineage", or
  "provenance" as casual synonyms for core Renku Studio concepts.
- UI labels may be adapted later for a production template, but the model,
  commands, documentation, and core APIs should keep the canonical domain term.
- File and folder names are user-facing labels. They are not IDs and must never
  be parsed to recover relationships.

## Production Structure

| Canonical term       | Use for                                                                                    | Notes                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project              | The top-level local Renku Studio project folder and its project-local database.            | Code and UI should generally say "project".                                                                                                            |
| Production workspace | An architectural description of what a project database represents.                        | Useful when explaining that one project can contain a standalone movie or a future series. It does not need to be a separate user-facing object in v1. |
| Standalone movie     | A project shape with one movie-like production unit.                                       | This can be the only project type implemented in the first slice.                                                                                      |
| Series               | A project shape with multiple episodes sharing cast, visual language, and reusable assets. | A future feature, but the schema should not block it.                                                                                                  |
| Episode              | A movie-like production unit inside a series project.                                      | Episodes can have their own sequences, scenes, clips, exports, tasks, and takes while sharing project-level cast and visual language.                  |

## Narrative Structure

Renku Studio should use this canonical hierarchy for v1:

```text
Standalone movie project
  -> Sequence
    -> Scene
      -> Clip
      -> Scene Shot List
        -> Shot

Series project
  -> Episode
    -> Sequence
      -> Scene
        -> Clip
        -> Scene Shot List
          -> Shot
```

`Sequence` is a film and screenwriting term for a meaningful group of scenes
that form a larger dramatic or production beat.

Related terms:

- **Act** is a higher-level story structure. It can be added later if Studio
  needs screenplay-style act planning, but it should not replace `Sequence` in
  the v1 hierarchy.
- **Chapter** can be a friendly display label for documentaries, courses,
  serialized web videos, or exports. It should not be the canonical schema term.
- **Scene Shot List** is a scene-owned coverage planning document. It is stored
  as validated project data with history and one active shot list per scene.
- **Shot** is one planned camera unit inside a Scene Shot List. Shots are
  ordered by their array position in the shot-list JSON. They are not final edit
  timeline entries.
- **Clip** remains a structural unit in the existing project hierarchy. Do not
  use Clip as a synonym for Shot when describing scene coverage.

## Creative Direction

| Canonical term                | Use for                                                                                                                                  | Avoid                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Visual Language               | The top-level creative direction system for AI generation.                                                                               | Do not use "style" as the top-level domain name.                                                            |
| Visual Language Category      | A project-owned grouping for visual language entries, such as Color, Lighting, Camera, Texture, or a custom category.                    | Do not bake the category list as a closed taxonomy.                                                         |
| Visual Language Entry         | A reusable project decision inside a category, backed by Markdown guidance, prompt text, and optional references.                        | Do not call this a style profile in schema, code, or docs.                                                  |
| Visual Language Asset         | A registered asset attached to a visual language entry.                                                                                  | The asset type can still be `style_sheet`, `look_reference`, etc.                                           |
| Visual Language Catalog Entry | A system-owned option shown in Studio and readable by agents. Choosing one creates an editable project Visual Language entry.            | Do not store catalog entries in project SQLite.                                                             |
| Inspiration Folder            | A project Visual Language folder containing user-provided reference images.                                                              | Folder metadata is stored in SQLite. Images inside the folder are filesystem content, not per-image assets. |
| Inspiration Analysis          | A validated visual study of one Inspiration Folder.                                                                                      | Stored as tagged JSON through `renku inspiration analysis`; image citations use folder-local filenames.     |
| Screenplay Analysis           | A validated critique of the current screenplay structure, scene energy, evidence, and suggested additions.                               | Stored as history through `renku screenplay analyze`; suggestions do not mutate screenplay rows.            |
| Scene Shot List               | A validated scene-owned coverage plan made of ordered Shots.                                                                             | Stored as history through `renku screenplay shot-list`; one active shot list can be selected per Scene.     |
| Shot                          | One planned camera unit inside a Scene Shot List.                                                                                       | Stores stable `shotId` values scoped to one shot list. Shot labels are derived from order.                  |
| Lookbook                      | A durable project visual direction made from user direction, Inspiration sources, screenplay context, or named references.               | Stored as tagged JSON plus relationships. It is not a neutral reference summary.                            |
| Source Inspiration            | An ordered relationship between a Lookbook and an Inspiration Folder.                                                                    | Do not copy Inspiration Analysis JSON into the Lookbook.                                                    |
| Lookbook Image                | A registered image asset attached to a Lookbook.                                                                                         | Section placement is stored in relationship rows, not in Lookbook JSON.                                     |
| Continuity Reference          | A reusable subject that must stay visually consistent, such as a location, prop, costume, architecture, vehicle, ship, symbol, or group. | Do not hide these under Visual Language or a vague "world" bucket.                                          |
| Location Environment Sheet    | A grouped location image asset with one composite sheet and four extracted directional views.                                            | Attached to a Location with role `environment_sheet`; SQLite stores grouping, azimuth ownership, and order, not crop or extraction metadata. |
| Azimuth View                  | One direction-specific image extracted from a Location Environment Sheet.                                                                | Current azimuths are 0 front, 90 right, 180 back, and 270 left.                                             |
| Scene Storyboard Sheet        | A compound storyboard image asset generated for one Scene Shot List.                                                                     | The original sheet and all sliced shot files are Asset Files under one Asset. SQLite stores shot ownership, not crop or grid metadata. |
| Style Sheet                   | A visual language asset type, usually an image or board that demonstrates a desired look.                                                | This is an asset type, not the name of the whole creative-direction system.                                 |

## Language And Localization

Language support is a core Renku Studio value proposition, not an export-only
feature.

Product copy can usually say **Language** because it is friendly. The stored
technical value should be a **Locale Tag**, preferably a BCP 47 tag such as
`en-US`, `tr-TR`, `es-MX`, or `pt-BR`.

| Canonical term        | Use for                                                                                                                        | Notes                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Language              | The user-facing language target.                                                                                               | Example: Turkish, Mexican Spanish, Brazilian Portuguese.                                                                       |
| Locale Tag            | The precise stored language/region/script identifier.                                                                          | Use BCP 47-style values. Do not parse meaning from display names.                                                              |
| Base Locale           | The primary locale for the movie or episode.                                                                                   | Used for original narration, dialog, voice design, and first-pass subtitles. It must be explicit.                              |
| Project Locale        | A locale configured for the project.                                                                                           | This is the preferred schema and TypeScript name for rows such as `project_locale`. One project locale can be the base locale. |
| Supported Locale      | User-facing phrase meaning a project locale enabled for production.                                                            | Useful in copy, but avoid it as a vague schema/foreign-key name such as `supported_locale_id`.                                 |
| Localization Level    | The production depth for a project locale.                                                                                     | Initial levels: `standard_subtitles`, `dubbed_audio`, `localized_lipsync`.                                                     |
| Localized Version     | A deliverable version of a movie, episode, clip, audio track, or subtitle track for one project locale and localization level. | Example: Turkish subtitle-only export, Spanish dubbed export, Japanese lip-sync export.                                        |
| Subtitle Track        | A first-class timed text asset.                                                                                                | Cue-level timing, may be in a different language than the audio.                                                               |
| Karaoke Caption Track | A word-synced subtitle/caption track where text appears or highlights word by word.                                            | Requires audio language and subtitle language to match. Requires word-level timing.                                            |
| Timed Transcript      | A transcript of an audio asset with timestamps.                                                                                | Segment-level timing can support standard subtitles. Word-level timing is required for karaoke captions.                       |
| Dubbed Audio Track    | A localized narration or dialog audio asset.                                                                                   | Same visual clip, different language audio.                                                                                    |
| Lip-Sync Take         | A localized video take where mouth movement matches the target-language audio.                                                 | Expensive level; usually clip-specific.                                                                                        |
| Voice Variant         | A cast voice profile or sample for a specific project locale.                                                                  | Lets a cast member keep the same voice identity across locales when the provider supports it.                                  |

The important distinction:

- **Standard subtitles** are translated timed text. They can be in a different
  language from the audio, and cue timing can be approximate.
- **Karaoke caption tracks** are audio-synchronized text. The text language must
  match the audio language, and word-level timing is required.

## Casting

| Canonical term       | Use for                                                                     | Notes                                                                                                |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Cast                 | The workspace section and collection of reusable production subjects.       | This stays broad enough for characters, narrators, locations, objects, groups, or recurring emblems. |
| Cast Member          | One reusable production subject.                                            | Use `cast_member` in schema names.                                                                   |
| Cast Design          | A validated cast-member-owned department design document covering interpretation, appearance, performance, costume, voice casting notes, continuity, and generation guidance. | Stored as tagged JSON history in `cast_design`, with one active design per Cast Member. Do not put costume variants or voice casting notes into screenplay prose just to make them durable. |
| Costume Variant      | A scoped wardrobe direction inside a Cast Design.                           | Can be project-, sequence-, or scene-scoped. It is not a standalone media target until a later contract gives variants durable identity. |
| Voice Casting        | Casting-owned voice identity, delivery, accent, tempo, texture, emotional range, and locale guidance for a Cast Member. | Lives under Cast Design in the current architecture. Voice sample generation is future work, not a current media purpose. |
| Casting Director     | The specialist agent role that owns Cast Member fact authoring, Cast Design, costume notes, voice casting notes, and cast media handoff. | Uses `renku cast` and `renku cast design`; hands media generation to `media-producer`. |
| Cast Asset           | A registered asset associated with a cast member.                           | Examples: portrait, character sheet, costume reference, voice sample, research note.                 |
| Cast Character Sheet | A cast image asset used as a reusable design reference for the cast member. | Attached with role `character_sheet`; generated by media purpose `cast.character-sheet`.             |
| Cast Profile         | A cast image asset used as the cast member's compact profile portrait.      | Attached with role `profile`; generated by media purpose `cast.profile`.                             |
| Reference Set        | A named set of cast assets intended to be used together.                    | Example: "Mehmed II / Campaign armor" containing portrait, character sheet, and costume references.  |
| Pin                  | A cast-level curated favorite or useful asset.                              | Pins help the cast UI. They are not the same as clip usage.                                          |
| Binding              | An explicit relationship between two domain objects.                        | Example: a clip binds to a cast member through a reference set.                                      |

Use **selection** for the take/select classification on an asset relationship.
Use **Select** for a currently chosen asset, **Pin** for cast favorites, and
**Binding** for scoped usage relationships.

## Production Design

| Canonical term       | Use for                                                                                                                        | Notes                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Location             | A reusable screenplay location fact such as name, handle, time period, description, and visual notes.                          | Use `location` in schema names. Author facts through `renku location`, not screenplay mutation operations.                             |
| Location Design      | A validated location-owned production-design document covering spatial thesis, architecture, set dressing, materials, atmosphere, props, continuity, and environment-sheet guidance. | Stored as tagged JSON history in `location_design`, with one active design per Location. It is not a shot list.                       |
| Production Design Prop | A named prop or recurring object defined inside Location Design.                                                              | Keep prop names clear enough for downstream references. Rich prop media targets are future work until props have durable identity.     |
| Production Designer  | The specialist agent role that owns Location fact authoring, Location Design, and environment-sheet handoff. | Uses `renku location` and `renku production-design`; hands media generation to `media-producer`. |

## Assets And Files

| Canonical term        | Use for                                                                                                   | Notes                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset                 | A registered content item in Renku Studio metadata.                                                       | The `asset` row owns identity, type, origin, and availability. Domain relationship rows own where and why the asset is used.                              |
| Asset File            | A concrete file on disk that belongs to an asset.                                                         | One asset can have one file or several files.                                                                                                             |
| Asset Relationship    | A row that attaches one asset to a real domain object with a role, order, optional locale, and selection. | Examples: `clip_asset`, `cast_asset`, `project_asset`. These are relationship tables, not separate asset stores.                                          |
| Compound Asset        | An asset that needs a folder because several files belong together.                                       | Example: a video take folder with `video.mp4`, `thumbnail.png`, and captions.                                                                             |
| Take                  | A persisted generated or imported candidate option.                                                       | Candidates are takes until the user chooses one or more.                                                                                                  |
| Select                | The current project choice from persisted takes or imported options.                                      | Use for current chosen asset(s), including intermediary references such as character sheets. Selects are changeable, but they are not ephemeral UI state. |
| Production Asset      | A selected asset that has been exported into the clean production handoff tree.                           | Current export is copy-based: working/take files remain in place, and editing/export tools see intended assets under `production-assets/`.                |
| Project Relative Path | A normalized path from the project folder to a project-owned file or folder.                              | SQLite stores these paths for asset files. Runtime code resolves them against the project folder. Do not store absolute paths in project metadata.        |

## Generation

| Canonical term        | Use for                                                                             | Notes                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media Purpose         | The project-facing reason media is being made or imported.                          | Example: `lookbook.image`. The purpose supplies context and import behavior; it does not replace persisted generation choices.                                                                                   |
| Media Purpose Key     | The stable key identifying a media purpose.                                         | Example: `lookbook.image`. A purpose key does not imply a generic registry or adapter framework.                                                                                                                 |
| Generation Type       | A category of generation work, such as `cast.character-sheet` or `clip.video-take`. | Use Media Purpose when the work is about producing or importing media for a domain object.                                                                                                                       |
| Generation Definition | The code-owned setup for reusable generation guidance.                              | Owns purpose guidance and prompt templates. Provider/model selection and user-facing parameters are persisted in a `Generation Spec`. It is not a project-local editable folder.                                 |
| Generation Key        | The stable key identifying a generation type.                                       | Prefer Media Purpose Key for media-producing commands.                                                                                                                                                           |
| Generation Spec       | The persisted, user-editable generation choices for a concrete target.              | Agents must not override binding fields such as model choice, take count, seed, frame, detail, or output format. Current implemented media specs include Lookbook Image, Cast Character Sheet, Cast Profile, Location Environment Sheet, and Scene Storyboard Sheet. |
| Task                  | A queued or running unit of work.                                                   | Example: generate a character sheet for one cast member.                                                                                                                                                         |
| Generation Run        | A durable execution record created from a generation spec.                          | Stores the spec snapshot, provider payload, estimate snapshot, approval token, simulation flag, status, diagnostics, and outputs.                                                                                |
| Generation Packet     | A system-generated execution snapshot of resolved inputs for one task.              | Useful for debugging and execution repeatability, but not the user-facing generation history model. Prefer Generation Run for persisted media-generation execution history.                                      |
| Provider Run          | A lower-level record of a call to an external or local generation provider.         | Useful for diagnostics, cost, retries, and error reporting.                                                                                                                                                      |

## Budget And Cost

| Canonical term         | Use for                                                                                   | Notes                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Budget                 | A user-defined planned spending limit for a scope.                                        | Example scopes: project, episode, sequence, clip, cast member, project locale, localization level, generation definition. |
| Cost Estimate          | The predicted cost before a generation task runs.                                         | This is not the same as actual cost. It can be a range when provider pricing is approximate.                              |
| Actual Cost            | The provider-reported final cost after work runs.                                         | If the provider does not report actual cost, do not silently substitute the estimate.                                     |
| Accrued Cost           | The sum of actual cost events for a scope.                                                | Used by UI projections such as "spent so far".                                                                            |
| Pending Estimated Cost | The sum of estimates for queued/running work that has not produced actual cost yet.       | Helps users understand likely near-term spend.                                                                            |
| Cost Event             | A durable record of an actual charge, refund, adjustment, or unknown final cost.          | The event log is the source for accrued cost rollups.                                                                     |
| Cost Rollup            | A query/projection that summarizes cost estimates and cost events by scope.               | Useful for UI, but should be recomputable from estimate and event records.                                                |
| Cost Approval          | A user or agent decision allowing a task to run when it has a non-trivial estimated cost. | Especially important for expensive localization levels such as lip-sync.                                                  |

Money storage rules:

- store currency explicitly, such as `USD`;
- store amounts as integer micros or another fixed-precision integer unit;
- do not store money as floating point values;
- keep estimates and actual costs as separate records.

## Catalog And Models

| Canonical term        | Use for                                                         | Notes                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog               | System-level definitions bundled with Renku or Renku Studio.    | Includes providers, models, model schemas, media purpose guidance, and generation definitions.                                                                  |
| Provider              | A service or runtime that supplies a model.                     | Example: OpenAI, Replicate, ElevenLabs, local runtime.                                                                                                          |
| Model                 | A provider-specific generation model.                           | When a `Generation Spec` is present, the model choice is binding and overrides agent preference.                                                                |
| Model Schema          | A JSON Schema describing valid parameters for a provider model. | Lives in the catalog. Code-owned generation code builds provider payloads, and engines validate those payloads against the schema before estimate or execution. |
| Model Capability YAML | Avoid for current media generation.                             | Do not add capability YAML or schema overlays; validate final provider payloads against real model schemas.                                                     |

## Terms To Avoid Or Scope Carefully

| Term                 | Recommendation                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow             | Do not use as the user-facing name for generation setup. Use Generation Definition for code-owned generation behavior. Generic phrases like "Git workflow" are fine when not naming a Renku Studio domain object.                     |
| Blueprint            | Avoid for Renku Studio product vocabulary. It can remain a legacy/current Renku or Viewer term where that system already uses it, but Renku Studio should say Generation Definition when referring to code-owned generation behavior. |
| Preset               | Avoid because it is vague. Use Generation Definition or a more specific domain name.                                                                                                                                                  |
| Style                | Avoid as the top-level domain concept. Use Visual Language. `style_sheet` is acceptable as a visual language asset type.                                                                                                              |
| Selection            | Use only for the take/select classification on an asset relationship. Use Select for currently chosen assets, Pin for cast favorites, and Binding for scoped usage relationships.                                                     |
| Lineage / Provenance | Avoid for the v1 data model. Use Generation Run for persisted media-generation execution history and Generation Packet for a resolved execution snapshot when that distinction is needed.                                             |
| Act / Chapter        | Do not use as canonical v1 schema terms. Use Sequence for the movie hierarchy, with future display labels if needed.                                                                                                                  |
