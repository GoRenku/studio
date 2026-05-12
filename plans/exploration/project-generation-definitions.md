# Project Generation Definitions

Date: 2026-05-10

Status: exploration

Role: future architecture exploration

## Purpose

This document explores a high-level direction for generation setup in Renku
Studio projects. It is not accepted current architecture.

Decision history:

- `../../docs/decisions/0002-use-engines-for-ai-integrations.md`

Generation definition, recipe, task, queue, and catalog contracts remain
undecided until implementation proves them.

## Explored Direction

Generation behavior is code-owned in the current architecture.

The project folder should not contain editable generation definition folders.

That means the project folder should not have user-editable folders such as:

```text
Generation Recipes/
Recipe Overrides/
```

Generated outputs, user-authored context, and selected assets still live in the
project. The generation logic itself lives in code or system-owned bundled
resources.

## Generation Key

A **Generation Key** identifies what kind of generation happened.

Examples:

```text
cast.character-sheet
cast.portrait
cast.voice
clip.video-take
clip.reference-image
localization.standard-subtitles
localization.timed-transcript
localization.karaoke-captions
localization.dubbed-audio
localization.lipsync-clip
visual-language.style-sheet
```

SQLite may record generation keys on tasks, generation records, estimates, and
provider runs.

## Inputs

Generation definitions should declare required project inputs explicitly.

Possible inputs include:

- cast member records;
- visual language records and bindings;
- registered reference assets;
- clip briefs;
- narration assets;
- subtitle tracks;
- timed transcripts;
- supported language records;
- localization level;
- selected takes or assets;
- cost approvals.

If required context is missing, validation should fail with structured
diagnostics.

No generation definition should infer relationships from folder names.

## Outputs

Generation outputs should be registered as assets.

Generated candidates are takes. Useful chosen outputs can be marked as selects.

Production-ready selects can later be exported into `production-assets/`.

## Catalog Placement

The exact source layout for system-owned generation definitions is not decided
in this architecture document.

The important accepted rule is the ownership boundary:

- project assets are user/project content;
- generation definitions are system-owned behavior;
- SQLite records which generation key/version produced an output;
- project folders do not become editable generation-definition repositories.

Detailed catalog placement and runtime packaging belong in exploration until the
implementation needs a concrete layout.
