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

## `renku screenplay analyze`

Read, validate, write, and activate durable Screenplay Analysis documents.

```bash
renku screenplay analyze context --json
renku screenplay analyze list --json
renku screenplay analyze show --active --json
renku screenplay analyze show --analysis <analysis-id> --json
renku screenplay analyze validate --file <analysis-json> --json
renku screenplay analyze validate --file - --json
renku screenplay analyze write --file <analysis-json> --json
renku screenplay analyze write --file - --json
renku screenplay analyze set-active --analysis <analysis-id> --json
```

Options:

- `--file`: required for `validate` and `write`. Use `-` to read stdin.
- `--analysis`: required for `show` by id and `set-active`.
- `--active`: shows the active analysis. Returns `analysis: null` when no
  active analysis exists.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project and existing screenplay data.
- `context` returns the screenplay text, ordered acts/sequences/scenes, cast and
  location labels, default criteria, and active analysis summary for an agent.
- `validate` checks a tagged `kind: "screenplayAnalysis"` document without
  writing.
- `write` creates a new analysis history row and makes it active.
- `set-active` changes only the active analysis pointer.
- `write` and `set-active` append Studio resource-change events for
  `surface:story-arc`, `screenplay-analysis`, and the specific analysis id.
- The command uses US spelling only: `analyze`. There is no `analyse` alias.

Input JSON shape:

```json
{
  "kind": "screenplayAnalysis",
  "structureModel": "threeAct",
  "title": "Three-act screenplay analysis",
  "summary": "Short critique summary.",
  "criteria": [
    {
      "key": "dramaticEnergy",
      "label": "Dramatic Energy",
      "description": "How strongly the moment pulls the audience forward."
    },
    {
      "key": "stakes",
      "label": "Stakes",
      "description": "How clearly the audience understands what can be lost or gained."
    },
    {
      "key": "characterAgency",
      "label": "Character Agency",
      "description": "How clearly a character's choice drives the story."
    }
  ],
  "acts": [],
  "keyBeats": [],
  "sequences": [],
  "scenes": [],
  "suggestedSceneAdditions": []
}
```

Validation rules:

- The current v1 structure model is `threeAct`.
- Three-act documents must analyze exactly three current screenplay acts in
  screenplay order.
- Default criteria `dramaticEnergy`, `stakes`, and `characterAgency` are
  required. Additional criteria are allowed.
- Scores must be integers from `0` to `100` and must reference declared
  criteria.
- Act, sequence, and scene ids must match the current screenplay graph.
- Suggested scene additions are critique only. They do not create scene rows.
- Unknown fields are rejected for this agent-authored JSON format.

## `renku screenplay shot-list`

Read, validate, write, and activate durable Scene Shot List documents for one
screenplay scene.

```bash
renku screenplay shot-list context --scene <scene-id> --json
renku screenplay shot-list context --scene <scene-id> --include-visual-references --json
renku screenplay shot-list list --scene <scene-id> --json
renku screenplay shot-list show --active --scene <scene-id> --json
renku screenplay shot-list show --shot-list <shot-list-id> --json
renku screenplay shot-list validate --file <shot-list-json> --json
renku screenplay shot-list validate --file - --json
renku screenplay shot-list write --file <shot-list-json> --json
renku screenplay shot-list write --file - --json
renku screenplay shot-list set-active --scene <scene-id> --shot-list <shot-list-id> --json
```

Options:

- `--scene`: required for `context`, `list`, `show --active`, and
  `set-active`.
- `--shot-list`: required for `show --shot-list` and `set-active`.
- `--file`: required for `validate` and `write`. Use `-` to read stdin.
- `--include-visual-references`: opt-in context flag for user-requested visual
  inspection. Default context stays text-only.
- `--active`: shows the active shot list for a scene. Returns
  `shotList: null` when no active shot list exists.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project and existing screenplay data.
- `context` returns the scene hierarchy, scene blocks, referenced cast and
  locations, project default aspect ratio, active Lookbook text, and active shot
  list summary.
- `validate` checks a tagged `kind: "sceneShotList"` document without writing.
- `write` creates a new scene-owned shot-list history row and makes it active.
- `set-active` changes only the active shot-list pointer for the scene.
- `write` and `set-active` append Studio resource-change events for the scene
  Shots surface, the shot-list collection, the specific shot list, and the
  scene.
- Shot-level `aspectRatio` is optional. When omitted, the shot inherits the
  project aspect ratio.
- Unknown fields are rejected. Shot-list JSON must not store absolute paths,
  generated image paths, setup minutes, crew assignments, call-sheet timing, or
  other analog shooting logistics.

Input JSON shape:

```json
{
  "kind": "sceneShotList",
  "sceneId": "scene_control_room",
  "title": "Ada confronts the empty control room",
  "summary": "A restrained coverage plan that starts wide and ends intimate.",
  "coverageStrategy": "Open with geography, then tighten toward Ada's face and hands.",
  "lookbookInfluence": "Use cold practical light and centered institutional framing.",
  "shots": [
    {
      "shotId": "shot_001",
      "title": "Empty room establishes the absence",
      "storyBeat": "Ada enters expecting someone and finds the room abandoned.",
      "narrativePurpose": "Establish geography, absence, and emotional distance.",
      "description": "Wide static frame from the doorway with Ada small against the consoles.",
      "shotType": "wide",
      "cameraAngle": "eye level",
      "cameraMovement": "static",
      "framing": "centered doorway frame with deep background symmetry",
      "lensIntent": "moderate wide lens feel; keep room geometry legible",
      "subject": "Ada and the empty control room",
      "action": "Ada pauses in the doorway before stepping inside.",
      "dialogue": [],
      "coveredBlockIndexes": [0, 1],
      "castMemberIds": ["cast_ada"],
      "locationIds": ["location_control_room"],
      "audioNotes": "Let room tone and distant machinery carry the silence.",
      "productionNotes": "Avoid warm fill; the absence should feel institutional."
    }
  ],
  "openQuestions": []
}
```

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
      "movement": [
        {
          "name": "Controlled drift",
          "description": "Move slowly when unease merges with desire."
        }
      ],
      "motion": [
        {
          "name": "Sudden rupture",
          "description": "Reserve abrupt motion for collapse."
        }
      ],
      "framing": [
        {
          "name": "Body as diagram",
          "description": "Frame bodies like evidence without losing empathy."
        }
      ]
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

Edit generated or imported Lookbook image relationships.

```bash
renku lookbook image set-sections --image <lookbook-image-id> --sections camera,texture --json
renku lookbook image delete --image <lookbook-image-id> --json
renku lookbook card-image set --lookbook <lookbook-id> --image <lookbook-image-id> --json
renku lookbook card-image clear --lookbook <lookbook-id> --json
```

Behavior:

- `--image` is always a Lookbook image id.
- Valid section keys are `thesis`, `palette`, `tone_mood`, `composition`,
  `lighting`, `texture`, and `camera`.
- Section placement is stored in `lookbook_image_section`, not in Lookbook JSON.
- Use `renku media import --purpose lookbook.image` to attach a new generated,
  uploaded, or downloaded file to a Lookbook.

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

## `renku generation`

Create, estimate, and run persisted media generation specs.

Current implemented purposes:

```text
lookbook.image
lookbook.sheet
cast.character-sheet
cast.profile
location.environment-sheet
scene.storyboard-sheet
shot.first-frame
shot.last-frame
shot.reference-sheet
shot.multi-shot-storyboard-sheet
shot.video-take
```

Current target formats:

```text
lookbook:<lookbook-id>
cast:<cast-member-id>
location:<location-id>
scene:<scene-id>
scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]>
```

Read context and available model choices:

```bash
renku generation context --purpose lookbook.image --target lookbook:<lookbook-id> --json
renku generation model list --purpose lookbook.image --target lookbook:<lookbook-id> --json
renku generation context --purpose lookbook.sheet --target lookbook:<lookbook-id> --json
renku generation model list --purpose lookbook.sheet --target lookbook:<lookbook-id> --json
renku generation context --purpose cast.character-sheet --target cast:<cast-member-id> --json
renku generation model list --purpose cast.character-sheet --target cast:<cast-member-id> --json
renku generation context --purpose cast.profile --target cast:<cast-member-id> --json
renku generation model list --purpose cast.profile --target cast:<cast-member-id> --json
renku generation context --purpose location.environment-sheet --target location:<location-id> --json
renku generation model list --purpose location.environment-sheet --target location:<location-id> --json
renku generation context --purpose scene.storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --json
renku generation model list --purpose scene.storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --json
renku generation context --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation model list --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --intent <input-mode-id> --json
```

Manage persisted specs:

```bash
renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose lookbook.image --target lookbook:<lookbook-id> --json
renku generation spec list --purpose lookbook.sheet --target lookbook:<lookbook-id> --json
renku generation spec list --purpose location.environment-sheet --target location:<location-id> --json
renku generation spec list --purpose scene.storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --json
renku generation spec list --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
```

Estimate and run:

```bash
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
renku generation run --spec <spec-id> --simulate --json
renku generation plan --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --production-group <production-group-id> --intent <input-mode-id> --model <model-choice> --json
```

Lookbook Image spec shape:

```json
{
  "purpose": "lookbook.image",
  "target": { "kind": "lookbook", "id": "lookbook_abc" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A horror hallway showing the Lookbook palette under dread lighting.",
  "focusSections": ["palette", "lighting"],
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Horror palette hallway"
}
```

Location Environment Sheet spec shape:

```json
{
  "purpose": "location.environment-sheet",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A four-view environment sheet for the sea walls location...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "viewFrame": "16:9",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Sea walls environment sheet"
}
```

Scene Storyboard Sheet spec shape:

```json
{
  "purpose": "scene.storyboard-sheet",
  "target": { "kind": "scene", "id": "scene_control_room" },
  "shotListId": "scene_shot_list_control_room_v1",
  "shotIds": ["shot_001", "shot_002", "shot_003", "shot_004"],
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A complete charcoal pencil storyboard sheet laid out as a clean grid...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "shotFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Control room storyboard sheet"
}
```

Behavior:

- The persisted spec is the source of truth for estimate and run.
- Agents must not override user-selected model choice, take count, seed, image
  frames, selected shot ids, detail, or output format.
- Final provider payloads are validated against the provider model JSON Schema
  before estimate or execution.
- Live generation requires an approval token from `generation estimate`.
- `generation run --simulate` validates and records a simulated run without a
  paid provider call.
- Generation creates staged outputs and run records. It does not attach files
  to the target asset relationship. Use `renku media import` after inspecting
  the output.
- Location environment sheet runs create one composite image. The
  media-producer agent inspects that composite with vision, writes the four
  sliced scenic views locally, and imports the grouped files only when the
  generated sheet is clean enough to slice.
- Scene storyboard sheet runs create one composite storyboard grid for the
  selected `shotIds`. The scene-shot-designer agent inspects that composite,
  slices one image per selected shot, and imports the original sheet plus all
  slices together.

## `renku media import`

Attach an existing media file to a project domain purpose.

Current implemented purposes:

```text
lookbook.image
lookbook.sheet
cast.character-sheet
cast.profile
location.environment-sheet
scene.storyboard-sheet
shot.first-frame
shot.last-frame
shot.reference-sheet
shot.multi-shot-storyboard-sheet
shot.video-take
```

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source <project-relative-path> \
  --sections palette,lighting \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Lookbook Sheet import:

```bash
renku media import \
  --purpose lookbook.sheet \
  --target lookbook:<lookbook-id> \
  --source <project-relative-path> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Location Environment Sheet import:

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --file location-environment-sheet-import.json \
  --title <title> \
  --summary <one-line-summary> \
  --json
```

The import JSON must explicitly list the composite and four sliced view files:

```json
{
  "title": "Sea walls environment sheet",
  "files": {
    "composite": "generated/media/sea-walls-sheet.png",
    "view_front": "generated/media/sea-walls-front.png",
    "view_right": "generated/media/sea-walls-right.png",
    "view_back": "generated/media/sea-walls-back.png",
    "view_left": "generated/media/sea-walls-left.png"
  }
}
```

Scene Storyboard Sheet import:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --file scene-storyboard-sheet-import.json \
  --json
```

Shot media import:

```bash
renku media import \
  --purpose shot.first-frame \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --source <project-relative-path> \
  --selection select \
  --receipt <generation-run-json> \
  --json

renku media import \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --source <project-relative-path> \
  --receipt <generation-run-json> \
  --json
```

The import JSON lists one or more generated sheets in one semantic storyboard
package, with one sliced file for every imported shot in each sheet:

```json
{
  "kind": "sceneStoryboardSheetImport",
  "title": "Control room storyboard package",
  "sheets": [
    {
      "source": "generated/media/storyboards/control-room-sheet-1.png",
      "title": "Control room shots 1-4",
      "shots": [
        {
          "shotId": "shot_001",
          "source": "generated/media/storyboards/control-room-shot-001.png",
          "title": "Shot 1"
        }
      ]
    },
    {
      "source": "generated/media/storyboards/control-room-sheet-2.png",
      "title": "Control room shots 5-8",
      "shots": [
        {
          "shotId": "shot_005",
          "source": "generated/media/storyboards/control-room-shot-005.png",
          "title": "Shot 5"
        }
      ]
    }
  ]
}
```

Options:

- `--purpose`: required media purpose. Current supported values are
  `lookbook.image`, `lookbook.sheet`, `cast.character-sheet`, `cast.profile`,
  `location.environment-sheet`, `scene.storyboard-sheet`, `shot.first-frame`,
  `shot.last-frame`, `shot.reference-sheet`,
  `shot.multi-shot-storyboard-sheet`, and `shot.video-take`.
- `--target`: required target. Current supported shapes are
  `lookbook:<lookbook-id>`, `cast:<cast-member-id>`,
  `location:<location-id>`, and `scene:<scene-id>`.
- `--source`: required project-relative media source path for single-file
  imports. Location environment sheet and scene storyboard sheet imports use
  `--file` instead.
- `--file`: grouped import JSON for `location.environment-sheet` and
  `scene.storyboard-sheet`.
- `--shot-list`: required when importing `scene.storyboard-sheet` and shot
  media purposes.
- `--shots`: comma-separated shot ids for shot media purposes.
- `--selection`: optional shot image import selection, either `select` or
  `take`.
- `--sections`: optional comma-separated Lookbook section keys.
- `--title`: optional title for the imported media.
- `--summary`: optional one-line summary.
- `--receipt`: optional generation run or receipt JSON for single-file imports.
  Location environment sheet import does not accept receipts.

Behavior:

- Import is separate from generation. A generated file is not attached to a
  Lookbook until this command succeeds.
- The file may come from Renku generation, another tool, a manual upload, or a
  download.
- For Lookbook Images, import registers an asset, creates the Lookbook image
  relationship, stores section placement, and appends Studio resource refresh
  events.
- For Lookbook Sheets, import registers a Lookbook sheet asset, stores it under
  `visual-language/lookbook/`, and appends Studio resource refresh events.
- For Location Environment Sheets, import registers one grouped asset, copies
  the composite plus `view_front`, `view_right`, `view_back`, and `view_left`
  files under `locations/<handle>/environment-sheets/<sheet-slug>/`, and stores
  only the grouped asset and azimuth relationships. It does not accept or store
  crop coordinates, extraction methods, extraction confidence, or extraction
  diagnostics.
- For Scene Storyboard Sheets, import registers one compound asset, copies the
  original sheet plus one sliced file per shot under
  `screenplay/storyboards/<scene-label>/<sheet-slug>/`, attaches the asset to
  the Scene with role `storyboard_sheet`, and stores only the sheet and
  per-shot image relationships. It does not accept or store crop coordinates,
  grid cell metadata, extraction methods, extraction confidence, or extraction
  diagnostics.
- Agents should inspect generated images before import and tag only the
  sections the image visibly demonstrates. Do not blindly copy
  `focusSections` into `--sections`.

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
