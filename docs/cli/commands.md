# Renku CLI Commands

Status: current

Role: CLI reference

Last reviewed: 2026-05-22

This file is the living reference for the `renku` command-line surface. Keep it
updated whenever a command, flag, output shape, or expected error changes.

The CLI is implemented in `packages/cli` and follows the human-first CLI
guidelines accepted in `docs/decisions/0004-use-human-first-cli-guidelines.md`.
Human-readable output is the default. Commands that support automation should
also support `--json`.

## Important Project Contexts

Renku currently has two different "current project" concepts:

- **Current authoring project**: the persisted project used by screenplay
  authoring commands. It is managed by `renku project open`,
  `renku project current`, and `renku project close`.
- **Current Studio selection**: the most recent active project and surface in a
  running Studio browser session. It is inspected with `renku studio current`
  and can be requested with `renku project select`.

Screenplay authoring commands require a current authoring project. If none is
open, they fail with structured error `PROJECT_DATA202` and suggest:

```text
Open an existing project with `renku project open <project-name>`, or create a new project with `renku create <project-name> --title <title>`.
```

There is no top-level `renku show` command. The current show commands are
`renku screenplay show` and `renku info show`.

## Global Usage

```bash
renku <command> [options]
```

Common options:

- `--json`: print machine-readable JSON.
- `--help`, `-h`, or `renku help`: show top-level help.
- `--version`: show the CLI package version.

## `renku init`

Create or inspect the global Renku config.

```bash
renku init <storage-root>
renku init <storage-root> --json
```

Arguments:

- `<storage-root>`: absolute or shell-expanded path where Renku projects are
  stored.

Behavior:

- Creates `~/.config/renku/config.yaml` if it does not exist.
- Leaves an existing config in place and reports its current storage root.
- Fails when the storage root argument is missing.

## `renku create`

Create a clean movie project.

```bash
renku create <project-name> --title <title>
renku create <project-name> --title <title> --logline <text> --summary <text>
renku create <project-name> --title <title> --aspect-ratio 16:9 --json
```

Arguments:

- `<project-name>`: project folder name inside the configured storage root.

Options:

- `--title`: required human-readable movie title.
- `--aspect-ratio`: optional project aspect ratio.
- `--logline`: optional short project logline.
- `--summary`: optional project summary.
- `--storage-root`: override the configured storage root for this command.
- `--json`: print the creation report as JSON.

Behavior:

- Creates the project folder and project SQLite database.
- Opens the created project as the current authoring project after creation
  succeeds.
- The JSON output includes a `currentProject` descriptor for the project that
  was just opened.

## `renku about`

Show CLI package information.

```bash
renku about
```

Behavior:

- Prints JSON containing the CLI package name, binary name, and linked core
  package information.

## `renku project current`

Show the current authoring project.

```bash
renku project current
renku project current --json
```

Behavior:

- Prints the persisted current authoring project descriptor when one is open.
- Prints a clear "not set" message when no current authoring project exists.
- The JSON shape is `{ "project": null }` when no project is open.

## `renku project open`

Set the current authoring project.

```bash
renku project open <project-name>
renku project open <project-name> --json
```

Arguments:

- `<project-name>`: existing project folder name inside the configured storage
  root.

Behavior:

- Opens the project database, reads the project record, and writes
  `current-project.json` in the Renku config directory.
- Closes the SQLite handle after recording the descriptor. The current project
  is persisted as a descriptor, not as a long-lived CLI database session.
- Returns status `set` when the current project changes and `unchanged` when
  the same project was already current.

## `renku project close`

Clear the current authoring project.

```bash
renku project close
renku project close --json
```

Behavior:

- Removes the persisted current authoring project descriptor.
- Does not delete the project.
- Reports when no current authoring project was set.

## `renku project select`

Request Studio to select a project.

```bash
renku project select <project-name>
renku project select <project-name> --json
```

Behavior:

- Appends a Studio focus request for the project.
- This affects Studio coordination state, not the current authoring project used
  by screenplay commands.

## `renku project migrate`

Apply pending project database migrations.

```bash
renku project migrate <project-name>
renku project migrate <project-name> --json
```

Behavior:

- Opens the named project database and applies pending migrations.
- Reports the project path and database path.

## `renku screenplay status`

Inspect whether the current authoring project has screenplay data.

```bash
renku screenplay status --json
```

Behavior:

- Requires a current authoring project.
- Reports whether screenplay data exists and returns counts for cast members,
  locations, acts, sequences, scenes, and blocks.

Expected no-project failure:

- Error code: `PROJECT_DATA202`
- Suggestion: open an existing project with `renku project open <project-name>`,
  or create a new project with `renku create <project-name> --title <title>`.

## `renku screenplay show`

Show the current screenplay document.

```bash
renku screenplay show --json
```

Behavior:

- Requires a current authoring project.
- Fails with `PROJECT_DATA202` when no current authoring project is open.
- Fails with `PROJECT_DATA205` when a project is open but no screenplay data
  exists yet.
- Prints the canonical screenplay JSON document when screenplay data exists.

## `renku screenplay validate`

Validate screenplay JSON without writing project changes.

```bash
renku screenplay validate --file <screenplay-json> --json
renku screenplay validate --file - --json
```

Options:

- `--file`: optional JSON input file. Use `-` to read stdin.
- `--json`: print the validation report as JSON.

Behavior:

- Accepts screenplay create documents, full screenplay documents, and operation
  documents.
- Reports unknown fields as warnings when the schema allows them to be ignored.
- Reports invalid required fields as structured errors.

## `renku screenplay create`

Create screenplay data for the current authoring project.

```bash
renku screenplay create --file <screenplay-json> --json
renku screenplay create --file <screenplay-json> --dry-run --json
```

Options:

- `--file`: required JSON input file. Use `-` to read stdin.
- `--dry-run`: validate and report planned changes without writing.
- `--json`: print the create report as JSON.

Behavior:

- Requires a current authoring project.
- Creates the initial screenplay graph.
- Fails when screenplay data already exists and points callers to
  `renku screenplay apply`.

## `renku screenplay apply`

Apply focused screenplay operations.

```bash
renku screenplay apply --file <operations-json> --json
renku screenplay apply --file <operations-json> --dry-run --json
```

Options:

- `--file`: required JSON input file. Use `-` to read stdin.
- `--dry-run`: validate and report planned changes without writing.
- `--json`: print the operation report as JSON.

Behavior:

- Requires a current authoring project.
- Applies operation documents such as screenplay, act, sequence, scene, cast, or
  location revisions.

## `renku screenplay cast`

List or show cast members from the current authoring project's screenplay.

```bash
renku screenplay cast list --json
renku screenplay cast show <cast-member-id> --json
```

Behavior:

- Requires a current authoring project.

## `renku screenplay location`

List or show locations from the current authoring project's screenplay.

```bash
renku screenplay location list --json
renku screenplay location show <location-id> --json
```

Behavior:

- Requires a current authoring project.

## `renku screenplay act`

List or show acts from the current authoring project's screenplay.

```bash
renku screenplay act list --json
renku screenplay act show <act-id> --json
```

Behavior:

- Requires a current authoring project.

## `renku screenplay sequence`

List sequences for an act or show one sequence.

```bash
renku screenplay sequence list --act <act-id> --json
renku screenplay sequence show <sequence-id> --json
```

Options:

- `--act`: required for `sequence list`.

Behavior:

- Requires a current authoring project.

## `renku screenplay scene`

List scenes for a sequence or show one scene.

```bash
renku screenplay scene list --sequence <sequence-id> --json
renku screenplay scene show <scene-id> --json
```

Options:

- `--sequence`: required for `scene list`.

Behavior:

- Requires a current authoring project.

## `renku info show`

Show project information.

```bash
renku info show --project <project-name>
renku info show --project <project-name> --json
```

Options:

- `--project`: explicit project name. If omitted, the command uses the current
  Studio selection.

Behavior:

- Shows project title, aspect ratio, logline, summary, and languages.
- If `--project` is omitted and no current Studio project exists, fails with
  `CLI022`.

## `renku info set`

Update project information fields.

```bash
renku info set --project <project-name> --title <title>
renku info set --project <project-name> --logline <text> --summary <text>
renku info set --project <project-name> --aspect-ratio 16:9 --json
```

Options:

- `--project`: explicit project name. If omitted, the command uses the current
  Studio selection.
- `--title`: set the title.
- `--aspect-ratio`: set the aspect ratio.
- `--logline`: set the logline.
- `--summary`: set the summary.

Behavior:

- Requires at least one field flag.
- Appends Studio refresh and focus events after a successful mutation.

## `renku info clear`

Clear optional project information fields.

```bash
renku info clear --project <project-name> --logline
renku info clear --project <project-name> --summary --json
```

Options:

- `--project`: explicit project name. If omitted, the command uses the current
  Studio selection.
- `--aspect-ratio`: clear the aspect ratio.
- `--logline`: clear the logline.
- `--summary`: clear the summary.

Behavior:

- Requires at least one clearable field flag.
- Does not clear the required title.

## `renku info language`

Add, update, remove, or set the base language for project information.

```bash
renku info language add <locale-tag> --project <project-name> --display-name <name>
renku info language update <locale-tag> --project <project-name> --display-name <name>
renku info language remove <locale-tag> --project <project-name>
renku info language set-base <locale-tag> --project <project-name>
```

Options:

- `--display-name`: human-readable language label for add/update.
- `--base`: mark the language as base when adding or updating.
- `--audio`, `--no-audio`: set audio support.
- `--subtitles`, `--no-subtitles`: set subtitle support.
- `--json`: print the updated project information as JSON.

Behavior:

- Uses the current Studio selection when `--project` is omitted.
- Appends Studio refresh and focus events after a successful mutation.

## `renku inspiration`

Manage Visual Language Inspiration folders for the current authoring project.

```bash
renku inspiration list --json
renku inspiration create --name <name> --json
renku inspiration show --folder <folder-id> --json
renku inspiration rename --folder <folder-id> --name <name> --json
renku inspiration reorder --file <folder-order-json> --json
renku inspiration delete --folder <folder-id> --json
```

Options:

- `--project`: optional explicit project name. If omitted, the command uses the
  current authoring project.
- `--folder`: Inspiration folder ID for commands that target one folder.
- `--name`: folder name for create and rename.
- `--file`: JSON file for reorder. The file may be either an array of folder IDs
  or an object with `folderIds`.

Behavior:

- `show` returns folder metadata, the project-relative folder path, the absolute
  folder path for agent filesystem inspection, any existing analysis, and
  Studio resource keys.
- Renku does not return per-image listings from this CLI surface. Agents should
  inspect folder files with normal filesystem commands such as `cd`, `ls`, and
  `find`.
- Inspiration images are not registered as assets or tracked as per-image
  SQLite rows.

## `renku inspiration analysis`

Validate, write, and show schema-validated Inspiration Analysis JSON.

```bash
renku inspiration analysis show --folder <folder-id> --json
renku inspiration analysis validate --folder <folder-id> --file <analysis-json> --json
renku inspiration analysis write --folder <folder-id> --file <analysis-json> --json
renku inspiration analysis validate --folder <folder-id> --file - --json
renku inspiration analysis write --folder <folder-id> --file - --json
```

Input JSON:

```json
{
  "kind": "inspirationAnalysis",
  "analysis": {
    "thesis": {
      "statement": "Visual-language thesis.",
      "principles": ["Repeatable cinematography principle."],
      "imageFiles": ["frame-001.png"]
    },
    "palette": {
      "description": "Muted blues with restrained practical warmth.",
      "colors": [
        {
          "hex": "#334455",
          "name": "Siege steel",
          "meaning": "Controlled pressure and distance."
        }
      ],
      "observations": [
        {
          "text": "Cool shadows dominate the frame.",
          "imageFiles": ["frame-001.png"]
        }
      ]
    },
    "toneMood": {
      "tone": "controlled dread",
      "moodTags": ["restrained"],
      "description": "Low saturation and soft contrast keep the images subdued.",
      "imageFiles": ["frame-001.png"]
    },
    "composition": {
      "description": "Frames use stillness and negative space as pressure.",
      "patterns": [
        {
          "name": "Centered pressure",
          "description": "Subjects hold center while empty space bears down.",
          "imageFiles": ["frame-001.png"]
        }
      ]
    },
    "lighting": {
      "description": "Light is motivated, directional, and quick to fall off.",
      "patterns": [
        {
          "name": "Practical falloff",
          "description": "Faces fall away quickly from practical sources.",
          "imageFiles": ["frame-001.png"]
        }
      ]
    },
    "texture": {
      "description": "Surfaces feel tactile and worn.",
      "observations": [
        {
          "text": "Fine grain supports worn metal and stone.",
          "imageFiles": ["frame-001.png"]
        }
      ]
    },
    "inspiredBy": {
      "description": "Visual lineage is treated as affinity, not confirmed influence.",
      "items": [
        {
          "category": "cinematographer",
          "name": "Roger Deakins",
          "confidence": "medium",
          "why": "Disciplined contrast and negative space are visible affinities.",
          "imageFiles": ["frame-001.png"]
        }
      ]
    }
  }
}
```

Behavior:

- The input must be a tagged `kind: "inspirationAnalysis"` document with all
  required analysis sections.
- `imageFiles` values are folder-local filenames only.
- Validation checks referenced filenames against files in the Inspiration
  folder, but Renku still does not store per-image rows.
- `write` appends Studio resource refresh events after a successful mutation.
- The old `renku visual-language inspiration ...` command surface is not kept
  as a compatibility alias.

## `renku lookbook`

Manage Visual Language Lookbooks for the current authoring project.

```bash
renku lookbook list --json
renku lookbook show --lookbook <lookbook-id> --json
renku lookbook validate --file <lookbook-json> --json
renku lookbook create --name <name> --file <lookbook-json> --json
renku lookbook update --lookbook <lookbook-id> --file <lookbook-json> --json
renku lookbook rename --lookbook <lookbook-id> --name <name> --json
renku lookbook delete --lookbook <lookbook-id> --json
renku lookbook set-active --lookbook <lookbook-id> --json
renku lookbook clear-active --json
```

Input JSON:

```json
{
  "kind": "lookbook",
  "lookbook": {
    "thesis": {
      "statement": "Project visual-language thesis.",
      "principles": ["Repeatable visual principle."]
    },
    "palette": {
      "description": "How color works in this movie.",
      "colors": [
        {
          "hex": "#39FF75",
          "name": "Acid tenderness",
          "meaning": "Care that has become unstable."
        }
      ],
      "observations": [{ "text": "Green should feel alive, not decorative." }]
    },
    "toneMood": {
      "tone": "surgical intimacy",
      "moodTags": ["charged", "bodily"],
      "description": "Clean surfaces feel too bright and too close."
    },
    "composition": {
      "description": "Overall composition strategy.",
      "patterns": [
        {
          "name": "Clinical symmetry",
          "description": "Use centered frames when a body becomes an argument."
        }
      ]
    },
    "lighting": {
      "description": "Overall lighting strategy.",
      "patterns": [
        {
          "name": "Contaminated practicals",
          "description": "Let green sources corrupt clean environments."
        }
      ]
    },
    "texture": {
      "description": "Surface, grain, and material strategy.",
      "observations": [{ "text": "Clean rooms should feel biological." }]
    },
    "camera": {
      "description": "Movement, motion, and framing strategy.",
      "movement": [{ "name": "Controlled drift", "description": "Move slowly when unease merges with desire." }],
      "motion": [{ "name": "Sudden rupture", "description": "Reserve abrupt motion for collapse." }],
      "framing": [{ "name": "Body as diagram", "description": "Frame bodies like evidence without losing empathy." }]
    }
  },
  "sourceInspirationFolderIds": ["inspiration_folder_abc"]
}
```

Behavior:

- The input must be a tagged `kind: "lookbook"` document with all required
  Lookbook sections.
- `sourceInspirationFolderIds` is optional. When present on create or update,
  every folder id must exist and duplicates are rejected.
- Lookbook JSON must not contain `imageFiles`; generated examples are attached
  through Lookbook image commands.
- `lookbook create` does not set the Lookbook active by default. Use
  `lookbook set-active` when the new Lookbook should become project direction.
- The old `renku visual-language lookbook ...` command surface is not kept as a
  compatibility alias.

## `renku lookbook image`

Attach generated example images to Lookbook sections.

```bash
renku lookbook image import --lookbook <lookbook-id> --file <project-relative-path> --sections palette,lighting --json
renku lookbook image set-sections --image <lookbook-image-id> --sections camera,texture --json
renku lookbook image delete --image <lookbook-image-id> --json
renku lookbook card-image set --lookbook <lookbook-id> --image <lookbook-image-id> --json
renku lookbook card-image clear --lookbook <lookbook-id> --json
```

Behavior:

- `--file` is a project-relative source file only for `image import`.
- `--image` is always a Lookbook image id.
- Valid section keys are `thesis`, `palette`, `tone_mood`, `composition`,
  `lighting`, `texture`, and `camera`.
- Section placement is stored in `lookbook_image_section`, not in Lookbook JSON.

## `renku lookbook inspiration`

Read or replace the durable source Inspiration folders for a Lookbook.

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

Behavior:

- Source Inspiration relationships are ordered and durable.
- The CLI stores relationships only. It does not copy Inspiration analysis into
  the Lookbook.
- To inspect Inspiration images, use `renku inspiration show` to get the folder
  path, then use normal shell commands such as `find` or `ls`.

## `renku asset register`

Register a project asset.

```bash
renku asset register \
  --project <project-name> \
  --target <target> \
  --type <type> \
  --media-kind <media-kind> \
  --role <role> \
  --file-role <file-role> \
  --file <project-relative-path> \
  --title <title> \
  --json
```

Options:

- `--project`: required project name.
- `--target`: required asset target.
- `--type`: required asset type.
- `--media-kind`: required media kind.
- `--role`: required relationship role.
- `--file-role`: required asset file role.
- `--file`: required project-relative file path.
- `--title`: required asset title.
- `--summary`: optional one-line asset summary.
- `--locale`: optional locale id.

Target syntax:

- `project`
- `visual-language:<id>`
- `cast:<id>`
- `location:<id>`
- `sequence:<id>`
- `scene:<id>`

Behavior:

- Registers the asset and appends Studio resource-changed events for affected
  surfaces when possible.

## `renku asset list`

List assets for a target.

```bash
renku asset list --project <project-name> --target <target>
renku asset list --project <project-name> --target <target> --json
```

Options:

- `--project`: required project name.
- `--target`: required asset target.
- `--locale`: optional locale id.

## `renku asset select`

Promote an asset to a select.

```bash
renku asset select <asset-id> --project <project-name> --target <target>
renku asset select <asset-id> --project <project-name> --target <target> --order 10 --json
```

Options:

- `--project`: required project name.
- `--target`: required asset target.
- `--order`: optional selection order.

Behavior:

- Marks the asset as selected for the target.
- Appends Studio resource-changed events for affected surfaces when possible.

## `renku asset select-update`

Update the order of an existing select.

```bash
renku asset select-update <asset-id> --project <project-name> --target <target> --order 20
```

Options:

- `--project`: required project name.
- `--target`: required asset target.
- `--order`: required selection order.

## `renku asset select-remove`

Remove an asset from the selected set.

```bash
renku asset select-remove <asset-id> --project <project-name> --target <target>
```

Options:

- `--project`: required project name.
- `--target`: required asset target.

Behavior:

- Changes the asset back to a normal take.

## `renku asset selects`

List selected assets for a target.

```bash
renku asset selects --project <project-name> --target <target>
renku asset selects --project <project-name> --target <target> --json
```

Options:

- `--project`: required project name.
- `--target`: required asset target.
- `--locale`: optional locale id.

## `renku production export`

Export selected production assets.

```bash
renku production export --project <project-name>
renku production export --project <project-name> --locale <locale-id>
renku production export --project <project-name> --all-locales
renku production export --project <project-name> --dry-run --fresh --json
```

Options:

- `--project`: required project name.
- `--locale`: export master plus one localized variant.
- `--all-locales`: export all locales with selected production assets.
- `--dry-run`: report export operations without writing.
- `--fresh`: rebuild the production export manifest.
- `--json`: print the export summary as JSON.

Behavior:

- Fails with `CLI061` when `--locale` and `--all-locales` are both provided.
- Fails with `CLI062` when `--project` is missing.

## `renku studio current`

Show current Studio focus and context.

```bash
renku studio current
renku studio current --json
```

Behavior:

- Reads the latest active Studio coordination state.
- Reports "No active Studio selection is available" when Studio has no active
  project selection.

## Maintenance Checklist

When adding or changing a CLI command:

- Update this file in the same change as the command implementation.
- Add or update tests for help text, success output, failure output, and JSON
  output when the command supports `--json`.
- Use structured diagnostics for package-boundary failures.
- Document whether the command uses the current authoring project, the current
  Studio selection, an explicit `--project`, or a positional project name.
- Keep obsolete command names out of this file unless the document is explicitly
  explaining a historical decision.
