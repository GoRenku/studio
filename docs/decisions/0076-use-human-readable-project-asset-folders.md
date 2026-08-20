# 0076 Use Human-Readable Project Asset Folders

Date: 2026-08-09

Status: accepted

Notice: Decision
[0083](0083-use-project-owned-cover-assets-and-conversation-directed-generation.md)
adds the Core-owned `covers/cover-gxxx.<ext>` destination under this naming
contract.

## Context

Durable project media was spread across technical roots and id-based folders
such as `videos/`, `shot-plans/<id>/`, and nested asset-kind directories. Those
paths were difficult for a person to browse and duplicated destination logic
outside the Core storage owner.

Generated filenames also used durable version suffixes even though Asset ids,
ownership, selection, and provenance already provide identity and history.

## Decision

`packages/core/src/server/project-asset-files/` is the sole owner of durable
path allocation, exclusive file creation, hashing, Asset File persistence, and
rollback. Callers provide a focused destination plus one naming mode:

- generated media uses a Core-authored semantic stem and one `gxxx` token;
- external media preserves a normalized source basename and adds `-2`, `-3`,
  and so on only on collision.

The token contains exactly three lowercase Crockford Base32 characters. Core
redraws after a real exclusive-create collision and fails after sixteen
attempts. It stores no token counter, media series, or filename lineage.

Durable project media uses this tree:

```text
screenplay/<safe-source-basename>.<ext>
visual-language/lookbooks/{production,storyboard}/<name>-gxxx.<ext>
cast/<handle>/<name>-gxxx.<ext>
locations/<handle>/<name>-gxxx.<ext>
props/<handle>/<name>-gxxx.<ext>
storyboards/<safe-scene-label>/<NN>-iteration/<name>-gxxx.<ext>
scenes/<safe-scene-label>/dialogues/<name>-gxxx.<ext>
scenes/<safe-scene-label>/<NN>-shot-plan/<plan-media>-gxxx.<ext>
scenes/<safe-scene-label>/<NN>-shot-plan/shot-images/<shot-number>-gxxx.<ext>
```

Storyboard iteration folders remain zero-based and append-only. Shot Plan
media destinations are derived from the exact frozen GenerationSpec or Run
provenance, never from a title, current UI selection, or filename. The focused
`shot-plan.video-reference` purpose creates an explicit Plan reference Asset;
ordinary dependencies are not copied merely because they were inputs.

Semantic segments are lowercase safe kebab-case and bounded. Fixed words such
as `profile`, `hero`, `sheet`, `image`, and `video` belong to Core. Skills may
provide a concise semantic variation name but never calculate folders,
numbers, tokens, or filenames.

The Scene label is a path-only safe representation of the exact stored Scene
number. Core never rewrites or validates `Scene.productionNumber`; it applies
the same bounded safe-segment function only when creating a folder or filename.
If that produces no usable segment, Core falls back to a safe form of the
durable Scene id.

Paths remain labels. Runtime code never parses a path to recover identity,
ownership, selection, production numbers, or provenance.

## Consequences

- CLI, HTTP, React, Engines, and skills cannot construct durable paths.
- Generated files no longer use `vNN`, version folders, or id-based roots.
- Imports remain recognizable by source basename without claiming that the
  basename is identity.
- `tmp/` remains the project-visible scratch area; `research/` and Visual
  Language Inspiration remain user-owned files unless a focused import creates
  a registered Asset.
- Existing development data is rebuilt once. Runtime compatibility readers for
  obsolete roots are not added.
