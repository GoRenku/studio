# Visual Language

Date: 2026-05-26

Status: current

Role: reference

## Purpose

This reference defines the current Inspiration Analysis and Lookbook contracts.

Decision history:

- `../../decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `../../decisions/0019-use-durable-lookbooks-as-project-visual-direction.md`
- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

## Inspiration Folders

Inspiration folders are durable project objects. The files inside each folder
are filesystem content, not registered per-image assets.

Current CLI surface:

```bash
renku inspiration list --json
renku inspiration create --name <name> --json
renku inspiration show --folder <folder-id> --json
renku inspiration rename --folder <folder-id> --name <name> --json
renku inspiration reorder --file <folder-order-json> --json
renku inspiration discard --folder <folder-id> --json
```

`discard` moves the folder into the project Trash ledger without moving the
folder bytes. Restore through `renku trash restore`; do not empty Trash unless
the user explicitly asks for that after reviewing an Empty Trash preview.

`show` returns folder metadata, the project-relative folder path, a resolved
absolute folder path for agent inspection, any existing analysis, and resource
keys. The absolute path is command output only; SQLite stores project-relative
paths.

Renku does not provide per-image folder listings. Agents inspect folder files
with normal shell commands:

```bash
cd "<folder.absolutePath>"
find . -maxdepth 1 -type f
```

## Inspiration Analysis Documents

Current CLI surface:

```bash
renku inspiration analysis show --folder <folder-id> --json
renku inspiration analysis validate --folder <folder-id> --file <analysis-json> --json
renku inspiration analysis write --folder <folder-id> --file <analysis-json> --json
```

The input document is tagged:

```json
{
  "kind": "inspirationAnalysis",
  "analysis": {
    "thesis": {},
    "palette": {},
    "toneMood": {},
    "composition": {},
    "lighting": {},
    "texture": {},
    "inspiredBy": {}
  }
}
```

Rules:

- The folder id comes from `--folder`, not from the JSON document.
- `imageFiles` values are folder-local filenames only.
- Validation checks referenced filenames against files in the folder.
- Unknown fields are rejected for this agent-authored stored JSON format.
- `validate` and `write` use the same parse, schema, and semantic validation
  pipeline.
- `write` appends Studio resource refresh events after a successful mutation.

## Lookbook Documents

Current CLI surface:

```bash
renku lookbook list --json
renku lookbook show --lookbook <lookbook-id> --json
renku lookbook validate --file <lookbook-json> --json
renku lookbook create --name <name> --file <lookbook-json> --json
renku lookbook update --lookbook <lookbook-id> --file <lookbook-json> --json
renku lookbook rename --lookbook <lookbook-id> --name <name> --json
renku lookbook discard --lookbook <lookbook-id> --json
renku lookbook select --type movie --lookbook <lookbook-id> --json
renku lookbook select --type storyboard --lookbook <lookbook-id> --json
renku lookbook clear-selection --type movie --json
renku lookbook clear-selection --type storyboard --json
```

`discard` records a recoverable Trash item for the Lookbook. Restore through
`renku trash restore`; emptying Trash is a separate explicit user-approved
operation.

Movie Lookbooks and Storyboard Lookbooks are different typed documents.
Movie Lookbooks steer cinematic generation. Storyboard Lookbooks steer
storyboard drawing style, panel treatment, notation, and continuity clarity.

Movie Lookbook input:

```json
{
  "kind": "movieLookbook",
  "movieLookbook": {
    "name": "Movie visual language",
    "thesis": { "statement": "", "principles": [] },
    "palette": { "description": "", "colors": [], "observations": [] },
    "toneMood": { "tone": "", "moodTags": [], "description": "" },
    "composition": { "description": "", "patterns": [] },
    "lighting": { "description": "", "patterns": [] },
    "texture": { "description": "", "observations": [] },
    "camera": { "description": "", "movement": [], "motion": [], "framing": [] }
  },
  "sourceInspirationFolderIds": []
}
```

Storyboard Lookbook input:

```json
{
  "kind": "storyboardLookbook",
  "storyboardLookbook": {
    "name": "Storyboard drawing language",
    "styleBrief": { "text": "Graphite storyboard frames with clear staging." },
    "lineAndFinish": { "text": "Loose construction lines with crisp ink accents." },
    "valueAndAccent": { "text": "Soft gray values with restrained warm accents." },
    "guardrails": { "text": "Avoid photoreal stills and decorative text inside panels." }
  },
  "sourceMovieLookbookIds": [],
  "sourceInspirationFolderIds": []
}
```

Rules:

- `sourceInspirationFolderIds` is optional on create and update.
- When `sourceInspirationFolderIds` is present, every folder id must exist and
  duplicates are rejected.
- Omitting `sourceInspirationFolderIds` on update preserves existing source
  relationships.
- Providing an empty array clears source relationships.
- Lookbook JSON must not contain `imageFiles`.
- `lookbook create` does not select the Lookbook by default.
- Use `lookbook select --type movie` for movie/cinematic generation.
- Use `lookbook select --type storyboard` for scene storyboard sheet generation.
- Lookbook image section placement must use section names valid for the owning
  Lookbook type.

## Lookbook Source Inspirations

Source Inspiration folders are durable ordered relationships, not copied
analysis content.

```bash
renku lookbook inspiration list --lookbook <lookbook-id> --json
renku lookbook inspiration set --lookbook <lookbook-id> --file <source-json> --json
```

Input JSON:

```json
{
  "kind": "lookbookSourceInspirations",
  "inspirationFolderIds": ["inspiration_folder_abc"]
}
```

Agents read the current Inspiration analysis from the source folder when they
need it. Lookbooks do not duplicate analysis JSON.

## Lookbook Images

Lookbook images are registered assets attached to a Lookbook. They may be
generated by Renku, generated elsewhere, uploaded, or downloaded.

Import uses the generic media import command:

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source <project-relative-path> \
  --sections palette,lighting \
  --json
```

For a Movie thesis image, use `--sections thesis`. If the same image should
also sit beside a point-level Movie Lookbook pattern or observation, include the
point-owning section and `--anchor`, for example `--sections thesis,texture
--anchor texture-cannon-material-states`.

Editing existing Lookbook image relationships stays Lookbook-specific:

```bash
renku lookbook image set-placement --image <lookbook-image-id> --sections camera,texture --json
renku lookbook image set-placement --image <lookbook-image-id> --sections camera --anchor <lookbook-point-id> --json
renku lookbook image set-placement --image <lookbook-image-id> --sections thesis,texture --anchor <texture-point-id> --json
renku lookbook image discard --image <lookbook-image-id> --json
renku lookbook card-image set --lookbook <lookbook-id> --image <lookbook-image-id> --json
renku lookbook card-image clear --lookbook <lookbook-id> --json
```

Use `image set-placement` to retag or anchor an existing image. `image discard`
is only for intentional removal from the Lookbook, and keeps the underlying
media recoverable until Trash is emptied.

Section placement is stored in `lookbook_image_section`, not in Lookbook JSON.
Point anchors are also stored there. When `--anchor` is present, the owning
section for that point becomes point-level evidence and any additional
`--sections` values remain section-level evidence. For example, `--sections
thesis,texture --anchor texture-cannon-material-states` makes one image appear
under Thesis and beside that Texture point. `thesis` and `toneMood` have no point
ids and use section-level placement only.
`thesis` is a single-image Movie Lookbook slot. Adding a new Thesis placement
replaces the previous Thesis placement without discarding the previous image or
removing its other placements. Other Movie section and point placements append
images until the placement slot has 10 images.
Valid section keys are `thesis`, `palette`, `toneMood`, `composition`,
`lighting`, `texture`, and `camera`.

## Obsolete Shapes

Do not restore these obsolete shapes:

- `renku visual-language inspiration ...`;
- `renku visual-language lookbook ...`;
- `renku lookbook image import`;
- bare-section Inspiration Analysis JSON;
- bare-section Lookbook JSON;
- `imageFiles` in Lookbook JSON;
- per-image Inspiration asset rows or image manifests.
