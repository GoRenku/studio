# Renku Studio Domain Vocabulary

Date: 2026-08-06

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
- `../../decisions/0036-use-unsliced-location-sheets.md`

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

## Project Workflow Settings

| Canonical term | Use for | Notes |
| --- | --- | --- |
| Project Settings | The complete versioned Project-local document containing screenplay-import and generation workflow preferences. | Core owns the schema, defaults, validation, persistence, and full replacement. Do not call individual fields preferences records or global agent-media configuration. |
| Generation Workflow Policy | The effective execution guidance Core derives from Project Settings for one output media kind. | Exposed in Generation Context; it covers Preview display, preferred path, additional confirmation, and effective lane concurrency. It is not a provider policy or execution queue. |

## Narrative Structure

Renku Studio uses Scenes as the canonical Screenplay units:

```text
Standalone movie project
  -> Screenplay
    -> Scene
      -> Scene Beat Sheet -> Beat
      -> Shot Plan -> Shot
    -> optional Act / Sequence Sections (organization only)

Series project
  -> Episode
    -> Screenplay
      -> Scene
        -> Scene Beat Sheet -> Beat
        -> Shot Plan -> Shot
      -> optional Act / Sequence Sections
```

`Act` and `Sequence` are optional `ScreenplaySection` types. They organize
canonical Scene order but own no Scenes, Assets, designs, or production state.
A flat Screenplay with no Sections is valid.

Related terms:

- **Screenplay** is the Project's semantic screenplay content: opening elements,
  canonical Scenes, optional Sections/structure, and Project-subject references.
- **Scene** is canonical and does not require Section ancestry.
- **Chapter** can be a friendly display label for documentaries, courses,
  serialized web videos, or exports. It should not be the canonical schema term.
- **Scene Beat Sheet** is a scene-owned narrative breakdown document. It is
  stored as validated project data with history and one active Beat Sheet per
  scene. Its Scene and Block ids preserve authoring context and may become
  unresolved after later Screenplay edits.
- **Production Scene Number** is an optional exact human-facing value on a
  current Scene, such as `1` or `22A`. It is separate from the durable Scene id
  and does not define canonical order.
- **Beat** is one non-camera narrative unit inside a Scene Beat Sheet. Beats
  are ordered by their array position and contain exactly the accepted
  nine-field Beat shape with Cast Member, Location, Prop, and stable Screenplay
  Block ids.
- **Shot Plan** is one mutable Scene-owned camera plan containing ordered Shots
  and optional Beat coverage. Generation and Asset history never freeze the
  plan. Its Shots own planning image Assets but no generated video.
- **Shot** is one ordered camera-authored unit inside a Shot Plan. It has an
  authored title, opaque description, structured glanceable brief, image
  candidates, and zero or one explicitly selected image. It is
  deliberately separate from narrative Beats. Its optional Optics facts keep
  focal length as a positive number, depth of field as `shallow | deep`, and
  focus target as exact creative text describing one primary optical subject,
  plane, or distance when authored. `Shallow Focus` and `Deep Focus` are
  display labels; shared deep-focus legibility belongs in Optics intent, and
  `rack-focus` is a Motion transition.
- **Clip** is not the current Shot authoring or final-video model.

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
| Screenplay Analysis           | A validated critique of canonical ordered Scenes with analysis-owned Act segments, optional Scene groups, evidence, and suggested Scenes. | Stored as history through `renku screenplay analyze`; it never depends on optional screenplay Sections.      |
| Scene Beat Sheet              | A validated scene-context narrative breakdown made of ordered Beats.                                                                       | Stored as history through `renku screenplay beat-sheet`; its Scene id may become obsolete without invalidating or deleting the history. |
| Beat                          | One non-camera narrative unit inside a Scene Beat Sheet.                                                                                   | Stores a stable `id` plus narrative fields and weak historical Cast Member/Location/Prop/Screenplay Block context ids. |
| Shot Plan                     | One mutable Scene-owned plan for ordered Shots and optional Beat coverage.                                                                | Remains editable regardless of Run or Asset history. Its Shots own planning-image Assets, never generated video. |
| Shot                          | One ordered camera-authored unit inside a Shot Plan.                                                                                       | Stores title, opaque `description`, strict glanceable `brief`, candidate images, and an optional selected image; Beat coverage belongs to the plan. |
| Lookbook                      | One of the two project-owned visual direction roles.                                                                                       | A project has at most one Production Lookbook and one Storyboard Lookbook. The role is permanent and cannot be discarded. |
| Production Lookbook           | The project Lookbook for final-video visual language: palette, lighting, texture, composition, camera, and tone/mood.                      | Read directly for movie, cast, location, and future Shot visual-language guidance; it is never selected from alternatives. |
| Storyboard Lookbook           | The project Lookbook for storyboard drawing language: style brief, line/finish, value/accent, notation, continuity, and guardrails.        | Read directly for `scene.storyboard-sheet`; it has no stored pointer to the Production Lookbook. |
| Source Inspiration            | An ordered relationship between a Lookbook and an Inspiration Folder.                                                                    | Do not copy Inspiration Analysis JSON into the Lookbook.                                                    |
| Lookbook Image                | A registered image Asset owned by a Lookbook.                                                                                            | Section placement is stored in focused detail rows, not in Lookbook JSON.                                   |
| Continuity Reference          | A reusable subject that must stay visually consistent, such as a location, prop, costume, architecture, vehicle, ship, symbol, or group. | Do not hide these under Visual Language or a vague "world" bucket.                                          |
| Location Sheet                | A full-image production reference board for one Location.                                                                               | Location-owned Asset type `location_sheet`; one Asset can show maps, elevations, material references, annotated context, or other location-specific visual guidance. |
| Location Hero Image           | A compact overview image for a Location in overview and detail surfaces.                                                                | Location-owned Asset type `location_hero`, file role `primary`; common selection chooses it and it is not a generation-reference default. |
| Scene Storyboard Image        | One image candidate owned by a logical Scene Beat.                                                                                       | Asset type `scene_storyboard_image`; common selection chooses the Beat's current image. Composite sheets are temporary import orchestration. |
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
| Voice Casting        | Casting-owned voice identity, delivery, accent, tempo, texture, emotional range, and locale guidance for a Cast Member. | Lives under Cast Design as creative direction. Durable provider handles and playable sample assets live in Cast Voice records and Cast Voice Provider Registrations. Transient Kling voice IDs are shot-video run artifacts, not Cast Voice data. |
| Cast Voice           | A Cast Member-owned editorial voice reference with a Renku reference name, purpose, linked sample asset, and `sampleSource` provenance. | Stored in `cast_voice`. Attach custom files or existing ElevenLabs provider samples through `renku cast voice attach`; remove through `renku cast voice remove`. |
| Cast Voice Provider Registration | A provider-specific reusable voice handle for one Cast Voice, such as an ElevenLabs TTS voice id. | Stored in `cast_voice_provider_registration` with provider, registration model, external provider voice id, capabilities, and source sample asset. Do not store Kling `fal-ai/kling-video/create-voice` results here unless provider documentation later establishes a durable reusable handle contract. |
| Cast Voice Sample    | The playable audio Asset linked to one Cast Voice. | Cast Member-owned Asset type `cast_voice_sample`, stored under `cast/<handle>/voice-samples/`. Sources are custom files, generated samples, or existing ElevenLabs provider samples. |
| ElevenLabs Provider Voice Sample | An existing sample owned by ElevenLabs for a provider voice, identified by `voiceId + sampleId`. | Renku resolves `sampleId` from the supplied `voiceId`, fetches the MP3, stores it as a Cast Voice Sample, and records `sampleSource.kind = 'elevenlabs_voice_sample'`. |
| Casting Director     | The specialist agent role that owns Cast Member fact authoring, Cast Design, costume notes, voice casting notes, and cast media handoff. | Uses `renku cast` and `renku cast design`; hands media generation to `media-producer`. |
| Cast Asset           | A registered Asset exclusively owned by a Cast Member.                      | Examples: portrait, character sheet, costume reference, voice sample, research note. Asset-owned `referenceName` and `purpose` describe named references without showing filenames or ids in UI. |
| Cast Character Sheet | A Cast Member-owned image Asset used as a reusable design reference.        | Asset type `character_sheet`; generated by `cast.character-sheet` and chosen only through the consuming GenerationSpec. |
| Cast Profile         | A Cast Member-owned image Asset used as the compact profile portrait.       | Asset type `cast_profile`; common selection chooses the current Profile.                              |
| Reference Set        | A named set of cast assets intended to be used together.                    | Example: "Mehmed II / Campaign armor" containing portrait, character sheet, and costume references.  |
| Pin                  | A cast-level curated favorite or useful asset.                              | Pins help the cast UI. They are not the same as clip usage.                                          |
| Binding              | An explicit relationship between two domain objects.                        | Example: a clip binds to a cast member through a reference set.                                      |

Use **selection** for one canonical owner-scoped current Asset or for an exact
request-scoped GenerationSpec reference, and name the scope explicitly. Use
**Pin** for cast favorites and **Binding** for other scoped usage relationships.

## Production Design

| Canonical term       | Use for                                                                                                                        | Notes                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Location             | A reusable screenplay location fact such as name, handle, time period, description, and visual notes.                          | Use `location` in schema names. Author facts through `renku location`, not screenplay mutation operations.                             |
| Location Design      | A validated location-owned production-design document covering spatial thesis, architecture, set dressing, materials, atmosphere, recurring objects, continuity, and Location Sheet guidance. | Stored as tagged JSON history in `location_design`; location-local objects use `recurringObjects`. It is not a shot list. |
| Location Recurring Object | A location-local set-dressing object without independent project identity. | Keep it in Location Design when it does not need its own design history, media, generation, or Studio surface. |
| Prop | A reusable production continuity subject with durable facts and identity. | Stored in `prop`; author through `renku prop`. It is independent from screenplay scenes and Location recurring objects. |
| Prop Design | A validated Prop-owned design document covering form, materials, construction, scale, states, continuity, Prop Sheet guidance, and generation guidance. | Stored as tagged JSON history in `prop_design`, with one active design per Prop. |
| Prop Sheet | A Prop-owned request-scoped image reference. | Asset type `prop_sheet`; generated by `prop.sheet`; never globally selected. |
| Prop Hero | A Prop-owned compact canonical image. | Asset type `prop_hero`; generated by `prop.hero`; one may be selected per Prop. |
| Production Designer  | The specialist agent role that owns Location and Prop facts, Location Design, Prop Design, and media handoff. | Uses `renku location`, `renku prop`, and `renku production-design`; hands media generation to `media-producer`. |

## Assets And Files

| Canonical term        | Use for                                                                                                   | Notes                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset                 | A registered content item in Renku Studio metadata.                                                       | The `asset` row owns identity, canonical type, media kind, title, summary, reference name, purpose, locale, origin, availability, and timestamps. |
| Asset File            | A concrete file on disk that belongs to an asset.                                                         | One asset can have one file or several files.                                                                                                             |
| Asset Membership      | The one exclusive owner of an Asset.                                                                      | `asset_membership` maps each Asset to one Project, Cast Member, Location, Prop, Sequence, Scene, logical Scene Beat, Lookbook, or Shot. Internal owner keys are not public vocabulary. |
| Canonical Selection   | The optional current image for one selectable owner surface.                                              | Applies only to Cast Profile, Location Hero, Prop Hero, Lookbook card image, Shot image, and Scene Beat Storyboard. Stored separately from membership. |
| Generation Reference  | One exact file choice saved in a consuming Generation Spec.                                               | Character Sheets, Location Sheets, Prop Sheets, Lookbook Sheets, and Dialogue Audio Takes are request-scoped and have no canonical selection. |
| Compound Asset        | An asset that needs a folder because several files belong together.                                       | Example: a video take folder with `video.mp4`, `thumbnail.png`, and captions.                                                                             |
| Take                  | A persisted generated or imported candidate in a focused domain that defines Take behavior.              | The current example is a Scene Dialogue Audio Take; ordinary Asset candidates are not generically called Takes. |
| Select                | The explicit act of choosing either one canonical Asset or one exact request reference.                   | Name the scope. A canonical selection and a GenerationSpec reference are different durable facts. |
| Project Relative Path | A normalized path from the project folder to a project-owned file or folder.                              | SQLite stores these paths for asset files. Runtime code resolves them against the project folder. Do not store absolute paths in project metadata.        |

## Generation

| Canonical term        | Use for                                                                             | Notes                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media Purpose         | The project-facing reason media is being made or imported.                          | Example: `lookbook.image`. The purpose supplies context and import behavior; it does not replace persisted generation choices.                                                                                   |
| Media Purpose Key     | The stable key identifying a media purpose.                                         | Example: `lookbook.image`. A purpose key does not imply a generic registry or adapter framework.                                                                                                                 |
| Generation Type       | A category of generation work, such as `cast.character-sheet` or `scene.storyboard-sheet`. | Use Media Purpose when the work is about producing or importing media for a domain object.                                                                                                                  |
| Generation Definition | The code-owned setup for reusable generation guidance.                              | Owns purpose guidance and prompt templates. Provider/model selection and user-facing parameters are persisted in a `Generation Spec`. It is not a project-local editable folder.                                 |
| Generation Key        | The stable key identifying a generation type.                                       | Prefer Media Purpose Key for media-producing commands.                                                                                                                                                           |
| Generation Spec       | The persisted, user-editable generation choices for a concrete target.              | Agents must not override binding fields such as model choice, take count, seed, frame, detail, or output format. Current implemented media specs include Lookbook Image, Cast Character Sheet, Cast Profile, Location Sheet, Location Hero Image, and Scene Storyboard Sheet. |
| Task                  | A queued or running unit of work.                                                   | Example: generate a character sheet for one cast member.                                                                                                                                                         |
| Generation Run        | A durable execution record created from a generation spec.                          | Stores the spec snapshot, provider payload, estimate snapshot, simulation flag, status, diagnostics, and outputs.                                                                                                   |
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
| Selection            | Name the scope: canonical owner-scoped selection for Profile, Hero, Lookbook, Shot, or Scene Beat imagery; request-scoped selection for exact GenerationSpec references. Use Pin for cast favorites and Binding for other usage relationships. |
| Lineage / Provenance | Avoid for the v1 data model. Use Generation Run for persisted media-generation execution history and Generation Packet for a resolved execution snapshot when that distinction is needed.                                             |
| Mandatory Act/Sequence hierarchy | Do not require organizational Sections for Scene identity or ownership.                                                                                                                                                           |
