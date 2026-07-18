# Renku CLI Commands

Status: current

Role: CLI reference

Last reviewed: 2026-06-07

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

## Studio Live Refresh Notifications

Commands that mutate durable project data may return `resourceKeys` in their
JSON output. When Studio is running, the CLI uses the fresh Studio runtime
descriptor to notify the local Studio server about those changed resources. The
server validates the notification, appends the local coordination event, and the
browser polling path refreshes matching visible resources.

If Studio is not running, resource-refresh notification is skipped. The durable
mutation still succeeds, and the next Studio launch reads the latest project
state from SQLite and project files. A `CLI026` warning means Studio appeared to
be running, but the CLI could not deliver the live refresh notification.

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
- Creates a verified pre-migration backup before mutating an existing,
  non-empty project database.
- Reports the project path, database path, and pre-migration backup path in
  human-readable output.
- JSON output includes `preMigrationBackup` with `backupPath`, `metadataPath`,
  `createdAt`, source and target schema generations, and source and backup file
  sizes.
- `preMigrationBackup` is `null` only when there was no existing non-empty
  database to protect, such as the initial migration during project creation.

Backups are stored inside the project folder:

```text
<project-folder>/.renku/project-database-backups/
```

If migration fails after the backup is created, the structured error includes
the backup path. To recover, stop Studio and any CLI process using the project,
move the broken `.renku/project.sqlite` aside, copy the selected backup to
`.renku/project.sqlite`, fix the migration issue, and then re-run the migration.

## `renku director context`

Show a director-readiness projection for the current authoring project.

```bash
renku director context --json
renku director context --selection '{"type":"scene","id":"<scene-id>"}' --json
```

Options:

- `--selection`: optional Studio selection JSON. When omitted, the command reads
  current Studio focus when a live focus is available.
- `--json`: print the full machine-readable projection.

Behavior:

- Requires a current authoring project and fails with `PROJECT_DATA202` when
  none is open.
- Summarizes screenplay, active Screenplay Analysis, Inspiration folders,
  authored Production and Storyboard Lookbooks, selected cast visuals, selected
  location environment sheets, and selected-scene Beat readiness.
- Reports structured director diagnostics for missing screenplay state, missing
  Production or Storyboard Lookbooks, missing selected visual media, missing
  active Beat Sheets, and missing storyboard images.
- Returns ordered `nextSteps` such as `draft-screenplay`, `analyze-screenplay`,
  `author-production-lookbook`, `author-storyboard-lookbook`, `design-cast`,
  `design-production`, `design-beat-sheet`, and `generate-storyboards`.
- Does not mutate project state and does not run paid generation.

## `renku cast`

List, inspect, validate, and mutate Cast Member facts for the current
authoring project.

```bash
renku cast list --json
renku cast show <cast-member-id> --json
renku cast context --cast <cast-member-id> --json
renku cast validate --file <cast-operations-json> --json
renku cast validate --file - --json
renku cast apply --file <cast-operations-json> --json
renku cast apply --file <cast-operations-json> --dry-run --json
```

Options:

- `--cast`: required for `context` and accepted by `show` when the id is not
  passed positionally.
- `--file`: required for `validate` and `apply`. Use `-` to read stdin.
- `--dry-run`: for `apply`, validates and reports planned changes without
  writing.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project.
- `list` and `show` read the canonical Cast Member facts.
- `context` returns the Cast Member, scenes where the Cast Member appears,
  active Cast Design summary, selected cast media, asset role counts, active
  Lookbook summary, and generation readiness signals for `cast.character-sheet`
  and `cast.profile`.
- `validate` checks a tagged `kind: "castOperations"` document without
  writing.
- `apply` creates, updates, deletes, or moves Cast Member facts through the
  canonical cast authoring path.
- Cast handles must stay unique across Cast Members and Locations.
- Delete operations fail when the Cast Member is still referenced by the
  screenplay.
- Successful mutations emit Studio resource keys for cast navigation and the
  affected Cast Member surfaces.

Input JSON shape:

```json
{
  "kind": "castOperations",
  "operations": [
    {
      "operation": "castMember.add",
      "castMember": {
        "key": "ada",
        "handle": "ada",
        "name": "Ada",
        "role": "protagonist"
      }
    },
    {
      "operation": "castMember.update",
      "castMember": {
        "id": "cast_ada",
        "handle": "ada",
        "name": "Ada",
        "role": "protagonist",
        "voiceNotes": "Dry, controlled, and low."
      }
    }
  ]
}
```

New Cast Members use `key`, not `id`. Existing Cast Members use durable `id`.

## `renku cast voice`

List, inspect, validate, attach, and remove durable Cast Voice references for a
Cast Member. Cast Voice records own the Renku reference name, purpose, sample
asset, and sample provenance. Provider-specific reusable voice handles live in
Cast Voice Provider Registrations.

```bash
renku cast voice list --cast <cast-member-id> --json
renku cast voice show --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
renku cast voice validate --file <cast-voice-attachment-json> --json
renku cast voice validate --file - --json
renku cast voice attach --file <cast-voice-attachment-json> --json
renku cast voice attach --file - --json
renku cast voice remove --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
renku cast voice registrations list --voice <cast-voice-id-or-name> --json
renku cast voice registrations show --registration <registration-id> --json
renku cast voice registrations create --voice <cast-voice-id-or-name> --file <registration-json> --json
renku cast voice registrations remove --registration <registration-id> --json
```

Options:

- `--cast`: required for `list`, `show`, and `remove`.
- `--voice`: required for `show` and `remove`; accepts either the durable Cast
  Voice id or the Cast Voice reference name. Provider-registration commands use
  it to scope list/create operations to one Cast Voice.
- `--registration`: required for provider-registration `show` and `remove`.
- `--file`: required for `validate`, `attach`, and provider-registration
  `create`. Use `-` to read stdin.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project.
- Cast Voices are Cast Member-owned editorial voice references, not Cast Design
  JSON fields.
- `attach` copies the sample audio file into the Cast Member voice sample asset
  folder, registers a `cast_voice_sample` audio asset, and creates the Cast
  Voice record with an initial ElevenLabs provider registration.
- `registrations create` attaches an explicit durable provider handle to an
  existing Cast Voice. ElevenLabs registrations require
  `dialogue-audio-tts`.
- Kling `fal-ai/kling-video/create-voice` is not exposed as a Cast Voice
  registration command. Shot-video generation creates or reuses transient Kling
  `voice_id` values internally when selected dialogue audio is bound to a
  supported video-backed Kling element.
- `remove` discards the Cast Voice, its provider registrations, and linked
  sample asset metadata into Trash. The copied audio file remains in place until
  Empty Trash runs.
- Generic asset discard fails for Cast Voice sample assets. Remove the Cast
  Voice instead, then restore through `renku trash restore` if needed.
- The current direct ElevenLabs models are `eleven_v3`,
  `eleven_multilingual_v2`, and `eleven_turbo_v2_5`.
- Successful mutations emit Studio resource keys for the affected Cast Member
  asset rail and surface.

Input JSON shape:

```json
{
  "kind": "castVoiceAttachment",
  "castMemberId": "cast_ada",
  "name": "urban-normal",
  "purpose": "Normal speaking voice for dialogue and testing",
  "provider": "elevenlabs",
  "model": "eleven_v3",
  "voiceId": "21m00Tcm4TlvDq8ikWAM",
  "sample": {
    "sourceProjectRelativePath": "generated/ada-urban-normal.mp3",
    "title": "Ada urban normal voice sample",
    "receipt": {
      "provider": "elevenlabs",
      "model": "eleven_v3"
    }
  }
}
```

Provider registration JSON shape:

```json
{
  "provider": "elevenlabs",
  "registrationModel": "eleven_v3",
  "externalVoiceId": "21m00Tcm4TlvDq8ikWAM",
  "capabilities": ["dialogue-audio-tts"],
  "sourceSampleAssetId": "asset_ada_voice_sample"
}
```

## `renku cast design`

Read, validate, write, and activate durable Cast Design documents for one Cast
Member.

```bash
renku cast design context --cast <cast-member-id> --json
renku cast design list --cast <cast-member-id> --json
renku cast design show --active --cast <cast-member-id> --json
renku cast design show --design <cast-design-id> --json
renku cast design validate --file <cast-design-json> --json
renku cast design validate --file - --json
renku cast design write --file <cast-design-json> --json
renku cast design write --file - --json
renku cast design set-active --cast <cast-member-id> --design <cast-design-id> --json
```

Behavior:

- Requires a current authoring project and an existing Cast Member.
- `context` returns the Cast Member facts, screenplay appearances, active Cast
  Design when present, selected cast media, Production Lookbook summary,
  and media generation readiness.
- `validate` checks a tagged `kind: "castDesign"` document without writing.
- `write` creates a Cast Member-owned design history row and makes it active.
- `set-active` changes only the active Cast Design pointer.
- Unknown fields are rejected.
- Costume variants can be scoped to the project, a sequence, or a scene. They
  are authored design content, not standalone media targets.
- Voice casting notes live under Cast Design. Provider voice ids and generated
  audio samples live in Cast Voice records and are managed with
  `renku cast voice`.

## `renku location`

List, inspect, validate, and mutate Location facts for the current authoring
project.

```bash
renku location list --json
renku location show <location-id> --json
renku location context --location <location-id> --json
renku location validate --file <location-operations-json> --json
renku location validate --file - --json
renku location apply --file <location-operations-json> --json
renku location apply --file <location-operations-json> --dry-run --json
```

Behavior:

- Requires a current authoring project.
- `context` returns the Location, scenes that use it, active Location Design
  summary, selected environment-sheet media, asset role counts, Production
  Lookbook summary, and generation readiness for `location.sheet`.
- `validate` checks a tagged `kind: "locationOperations"` document without
  writing.
- `apply` creates, updates, deletes, or moves Location facts through the
  canonical location authoring path.
- Location handles must stay unique across Cast Members and Locations.
- Delete operations fail when the Location is still referenced by the
  screenplay.
- Successful mutations emit Studio resource keys for location navigation and
  affected Location surfaces.

Input JSON shape:

```json
{
  "kind": "locationOperations",
  "operations": [
    {
      "operation": "location.add",
      "location": {
        "key": "control-room",
        "handle": "control-room",
        "name": "Control Room",
        "timePeriod": "Late 1970s",
        "description": "A cramped civic control room under budget pressure."
      }
    }
  ]
}
```

New Locations use `key`, not `id`. Existing Locations use durable `id`.

## `renku production-design`

Read, validate, write, and activate durable production-design documents for
Locations.

```bash
renku production-design location context --location <location-id> --json
renku production-design location list --location <location-id> --json
renku production-design location show --active --location <location-id> --json
renku production-design location show --design <location-design-id> --json
renku production-design location validate --file <location-design-json> --json
renku production-design location write --file <location-design-json> --json
renku production-design location set-active --location <location-id> --design <location-design-id> --json

```

Behavior:

- Location Design is location-level production design: spatial thesis,
  architecture, set dressing, materials, atmosphere, props, continuity, and
  environment-sheet guidance.
- `context` commands return the relevant screenplay hierarchy, the Production
  Lookbook summary, active design summary when present, selected media, and
  downstream readiness signals.
- `validate` checks tagged `kind: "locationDesign"` documents without writing.
- `write` creates a history row and makes it active.
- `set-active` changes only the active pointer.
- Unknown fields are rejected.

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
- References existing Cast Members and Locations by durable ids in scene
  settings and dialogue blocks.
- Rejects non-empty `cast` or `locations` arrays. Create or update those facts
  first with `renku cast` and `renku location`.
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
- Applies operation documents for screenplay metadata, acts, sequences, scenes,
  and scene blocks.
- Does not create, update, delete, or move Cast Members or Locations. Use
  `renku cast` and `renku location` for those facts.
- Writes a screenplay revision history row when the operation succeeds.
- Reports shot-list impact details for changed scenes that have active shot
  lists.

## `renku screenplay scene revise`

Replace one screenplay scene with a focused scene revision document.

```bash
renku screenplay scene revise --scene <scene-id> --file <scene-revision-json> --json
renku screenplay scene revise --scene <scene-id> --file <scene-revision-json> --dry-run --json
```

Options:

- `--scene`: required durable scene id to revise.
- `--file`: required `kind: "screenplaySceneRevision"` JSON file.
- `--dry-run`: validate and report planned changes without writing.
- `--json`: print the revision report as JSON.

Behavior:

- Requires a current authoring project and existing screenplay data.
- The JSON document must contain a full replacement scene whose `id` matches
  `--scene`.
- Writes a screenplay revision history row when the command succeeds.
- Reports shot-list impact details for the revised scene when an active shot
  list exists.

## `renku screenplay revision`

List, read, and restore durable screenplay revision history.

```bash
renku screenplay revision list --json
renku screenplay revision show --revision <revision-id> --json
renku screenplay revision restore --revision <revision-id> --json
```

Options:

- `--revision`: required for `show` and `restore`.
- `--json`: print machine-readable JSON.

Behavior:

- `list` returns revision summaries ordered newest first.
- `show` returns one stored screenplay revision document.
- `restore` replaces the current screenplay with the stored revision, records a
  new revision history row for the restore operation, and reports shot-list
  impact details for scenes whose narrative changed.

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

## `renku screenplay beat-sheet`

Read, validate, write, and activate durable Scene Beat Sheet documents for one
screenplay scene.

```bash
renku screenplay beat-sheet context --scene <scene-id> --json
renku screenplay beat-sheet context --scene <scene-id> --include-visual-references --json
renku screenplay beat-sheet list --scene <scene-id> --json
renku screenplay beat-sheet show --active --scene <scene-id> --json
renku screenplay beat-sheet show --beat-sheet <beat-sheet-id> --json
renku screenplay beat-sheet validate --file <beat-sheet-json> --json
renku screenplay beat-sheet validate --file - --json
renku screenplay beat-sheet write --file <beat-sheet-json> --json
renku screenplay beat-sheet write --file - --json
renku screenplay beat-sheet validate-operations --file <operations-json> --json
renku screenplay beat-sheet apply --file <operations-json> --json
renku screenplay beat-sheet apply --file <operations-json> --dry-run --json
renku screenplay beat-sheet storyboard status --scene <scene-id> --beat-sheet <beat-sheet-id> --json
renku screenplay beat-sheet set-active --scene <scene-id> --beat-sheet <beat-sheet-id> --json
```

Options:

- `--scene`: required for `context`, `list`, `show --active`,
  `storyboard status`, and `set-active`.
- `--beat-sheet`: required for `show --beat-sheet`, `storyboard status`, and
  `set-active`.
- `--file`: required for `validate`, `write`, `validate-operations`, and
  `apply`. Use `-` to read stdin.
- `--dry-run`: for `apply`, validates and reports planned changes without
  writing a derived Beat Sheet version.
- `--include-visual-references`: opt-in context flag for user-requested visual
  inspection. Default context stays text-only.
- `--active`: shows the active Beat Sheet for a scene. Returns
  `beatSheet: null` when no active Beat Sheet exists.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project and existing screenplay data.
- `context` returns the scene hierarchy, scene blocks, referenced cast and
  locations, Production Lookbook text, and active Beat Sheet summary.
- `validate` checks a tagged `kind: "sceneBeatSheet"` document without writing.
- `write` creates a new scene-owned Beat Sheet history row and makes it active.
- `validate-operations` checks a tagged `kind: "sceneBeatSheetOperations"`
  document without writing.
- `apply` creates a new scene-owned Beat Sheet history row derived from the
  explicit `baseBeatSheetId` in the operations document. It activates the new
  row only when `activate: true`.
- `storyboard status` reports which Beats in a specific Beat Sheet version have
  current storyboard images, missing images, or stale images.
- `set-active` changes only the active Beat Sheet pointer for the scene.
- `write`, `apply`, and `set-active` append Studio resource-change events for
  the scene Beats surface, Beat Sheet collection, specific Beat Sheet, changed
  Beat keys, and the scene.
- Unknown fields are rejected. Beat Sheet JSON must use the exact eight-field
  Beat shape: `id`, `title`, `description`, `narrativeDevelopment`,
  `narrativePurpose`, `castMemberIds`, `locationIds`, and
  `screenplayBlockIndexes`. It must not store camera, framing, lens, movement,
  coverage, generated image, or production-logistics instructions.

Input JSON shape:

```json
{
  "kind": "sceneBeatSheet",
  "sceneId": "scene_control_room",
  "title": "Ada confronts the empty control room",
  "beats": [
    {
      "id": "beat_001",
      "title": "The room is empty",
      "description": "Ada enters expecting the night operator, finds the consoles abandoned, and stops at the threshold.",
      "narrativeDevelopment": "Expectation gives way to unease when Ada discovers the room is empty.",
      "narrativePurpose": "Establish the absence that forces Ada to investigate.",
      "castMemberIds": ["cast_ada"],
      "locationIds": ["location_control_room"],
      "screenplayBlockIndexes": [0, 1]
    }
  ]
}
```

Operation JSON shape:

```json
{
  "kind": "sceneBeatSheetOperations",
  "sceneId": "scene_control_room",
  "baseBeatSheetId": "scene_beat_sheet_control_room_v1",
  "activate": true,
  "title": "Control room Beats, revised",
  "operations": [
    {
      "operation": "beats.replace",
      "beatIds": ["beat_003"],
      "beats": [
        {
          "id": "beat_003a",
          "title": "Ada commits to the search",
          "description": "Ada crosses the room, lifts the abandoned headset, and calls for the operator.",
          "narrativeDevelopment": "Ada turns passive discovery into an active search.",
          "narrativePurpose": "Move the scene from unease into committed investigation.",
          "castMemberIds": ["cast_ada"],
          "locationIds": ["location_control_room"],
          "screenplayBlockIndexes": [2]
        }
      ]
    }
  ]
}
```

## `renku screenplay cast`

Read-only screenplay-oriented Cast Member helpers.

```bash
renku screenplay cast list --json
renku screenplay cast show <cast-member-id> --json
```

Behavior:

- Requires a current authoring project.
- For canonical cast authoring and department context, use `renku cast`.

## `renku screenplay location`

Read-only screenplay-oriented Location helpers.

```bash
renku screenplay location list --json
renku screenplay location show <location-id> --json
```

Behavior:

- Requires a current authoring project.
- For canonical location authoring and production-design context, use
  `renku location` and `renku production-design`.

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
renku inspiration discard --folder <folder-id> --json
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
renku lookbook show --kind production --json
renku lookbook show --kind storyboard --json
renku lookbook validate --file <lookbook-json> --json
renku lookbook apply --file <lookbook-json> --json
```

Production Lookbook input JSON:

```json
{
  "kind": "productionLookbook",
  "productionLookbook": {
    "name": "Project visual language",
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

Storyboard Lookbook input JSON:

```json
{
  "kind": "storyboardLookbook",
  "storyboardLookbook": {
    "name": "Storyboard drawing language",
    "styleBrief": { "text": "Graphite storyboard frames with clear staging." },
    "lineAndFinish": { "text": "Loose pencil construction with crisp ink accents." },
    "valueAndAccent": { "text": "Soft gray values with restrained warm accents." },
    "guardrails": { "text": "Avoid photoreal stills and decorative text inside panels." }
  },
  "sourceInspirationFolderIds": []
}
```

Behavior:

- The input must be a tagged `kind: "productionLookbook"` or
  `kind: "storyboardLookbook"` document with all required sections for that
  role.
- `apply` creates an absent role or updates its existing durable row without
  changing the Lookbook id.
- `sourceInspirationFolderIds` is optional. When present on apply,
  every folder id must exist and duplicates are rejected.
- Lookbook JSON must not contain `imageFiles`; generated examples are attached
  through Lookbook image commands.
- Production and Storyboard are fixed project roles. There is no list,
  selection command, or Storyboard-to-Production source pointer.
- The old `renku visual-language lookbook ...` command surface is not kept as a
  compatibility alias.

## `renku lookbook image`

Edit generated or imported Lookbook image relationships.

```bash
renku lookbook image set-placement --image <lookbook-image-id> --sections camera,texture --json
renku lookbook image set-placement --image <lookbook-image-id> --sections camera --anchor <lookbook-point-id> --json
renku lookbook image set-placement --image <lookbook-image-id> --sections thesis,texture --anchor <texture-point-id> --json
renku lookbook image discard --image <lookbook-image-id> --json
renku lookbook card-image set --lookbook <lookbook-id> --image <lookbook-image-id> --json
renku lookbook card-image clear --lookbook <lookbook-id> --json
```

Behavior:

- `--image` is always a Lookbook image id.
- Use `image set-placement` to retag or anchor an existing image. Do not discard
  and re-import an image just to change its Lookbook section or point placement.
- `--anchor` pins the section that owns the point id. Additional `--sections`
  values remain section-level placements, so `--sections thesis,texture
  --anchor texture-cannon-material-states` shows the same image under Thesis
  and beside that Texture point.
- `thesis` is a single-image Production Lookbook slot. Importing or placing another
  image with `--sections thesis` replaces the previous Thesis placement without
  discarding the previous image or removing its other placements.
- Other Production section and point placements append images until the placement
  slot has 10 images. Move or discard an existing Lookbook image before adding
  another image to a full slot.
- `thesis` and `toneMood` have no point ids; tag them with `--sections` only.
- `image discard` is only for intentional removal from the Lookbook.
- Valid section keys are `thesis`, `palette`, `toneMood`, `composition`,
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

Use the generic Core generation lifecycle for one explicit provider request.
Generation and domain attachment are separate operations.

Current purposes:

```text
image.create
image.edit
lookbook.image
lookbook.video-sheet
lookbook.storyboard-sheet
cast.character-sheet
cast.profile
cast.voice-sample
scene.dialogue-audio
location.sheet
location.hero
scene.storyboard-sheet
```

Target formats are derived from the purpose contract:

```text
project
asset:<asset-id>
lookbook:<lookbook-id>
cast:<cast-member-id>
scene:<scene-id>:dialogue:<scene-dialogue-id>
location:<location-id>
scene:<scene-id>
```

Read the Core-owned context, reusable catalog, and model descriptors:

```bash
renku generation context --purpose <purpose> --target <target> --json
renku generation reference list --media-kind image --json
renku generation model list --purpose <purpose> --json
```

The context report contains fixed and recommended product settings, exact guide
slots and candidates, initial selections, notices, and selectable model
metadata. Fixed settings are applied by Core. Recommendations are guidance and
are authored only when the user or agent explicitly includes the corresponding
provider field in `values`. Untouched provider defaults remain absent.

A generic `GenerationSpec` has this shape:

```json
{
  "executionKind": "renku-managed",
  "purpose": "location.sheet",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "model": { "provider": "fal-ai", "model": "openai/gpt-image-2" },
  "values": {
    "prompt": "A Location Sheet for the sea walls...",
    "image_size": "landscape_16_9",
    "quality": "high",
    "num_images": 1,
    "output_format": "png"
  },
  "references": [],
  "title": "Sea walls Location Sheet"
}
```

Exact references use stable guide placements:

```json
{
  "placement": {
    "kind": "slot",
    "sectionId": "source",
    "slotId": "source-image"
  },
  "reference": {
    "kind": "asset-file",
    "assetId": "asset_source",
    "assetFileId": "asset_file_source"
  }
}
```

Use `{ "kind": "additional" }` only for an extra exact reference. Slot
occupancy is guidance, not a dependency graph. Provider-required fields are
validated against the selected direct endpoint.

Manage specs and Preview:

```bash
renku generation validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec freeze --spec <spec-id> --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose <purpose> --json
renku generation preview show --file <spec-json> --json
renku generation preview show --spec <spec-id> --json
renku generation preview show --file <first-spec-json> --file <second-spec-json> --json
renku generation preview show --spec <first-spec-id> --spec <second-spec-id> --json
```

Estimate and run only the saved current request:

```bash
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --simulate --json
renku generation run show --run <run-id> --json
```

The approval token comes from the exact estimate and becomes invalid when the
request changes. Simulation validates and records the same request without a
paid provider call or freezing the draft. Live managed run freezes the exact
saved revision before provider execution.

Behavior:

- Prompt and generated media contents are opaque to runtime validation.
- Engines owns direct provider fields, schemas, capability metadata, request
  assembly, pricing, execution, outputs, and receipts.
- Core owns purpose settings, exact eligible guide candidates, spec persistence,
  validation, direct estimates, runs, and provenance.
- Estimates cover only the current provider request; they never walk references
  or construct child work.
- `image.create` has Additional References only and no named slot.
- `image.edit` targets the exact source asset and uses the
  `source/source-image` slot plus optional exact Cast, Location, and
  Lookbook candidates.
- `scene.storyboard-sheet` keeps the deterministic 2x2 composite workflow.
  The agent inspects and splits the returned sheet, then uses the focused
  storyboard attachment command.
- Generation output is not attached automatically. Inspect the output, then use
  the focused `renku media import` purpose with the run receipt. Omit the
  receipt for external files. A Codex-generated image can instead retain its
  saved agent-external spec through `--source-spec`.

For Codex image generation, save the exact request before invoking Codex:

```json
{
  "executionKind": "agent-external",
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_..." },
  "model": { "provider": "codex", "model": "<actual-model>" },
  "values": { "prompt": "Exact prompt sent to Codex." },
  "references": []
}
```

Create and preview this spec normally. Preview returns its data in JSON even
when Studio is not running. After approval, show the final saved spec, freeze it
with `generation spec freeze`, and pass the frozen record's exact
`spec.values.prompt` to Codex unchanged. Attach the accepted output with the
frozen id through `--source-spec`. Do not estimate or run an agent-external spec.

## `renku media import`

Attach an inspected project-relative media file through a focused Core-owned
destination. Import is separate from generation.

Supported single-file purposes:

```text
lookbook.image
lookbook.video-sheet
lookbook.storyboard-sheet
cast.character-sheet
cast.profile
location.sheet
location.hero
```

General form:

```bash
renku media import \
  --purpose <purpose> \
  --target <target> \
  --source <project-relative-path> \
  --title <title> \
  --receipt <generation-run-json> \
  --source-spec <agent-external-spec-id> \
  --json
```

`--receipt` and `--source-spec` are alternatives; do not pass both.

Examples:

```bash
renku media import --purpose lookbook.image --target lookbook:<lookbook-id> --source tmp/media/lookbook-image.png --title "Lookbook image" --json
renku media import --purpose lookbook.video-sheet --target lookbook:<lookbook-id> --source tmp/media/video-lookbook-sheet.png --title "Video Lookbook Sheet" --json
renku media import --purpose lookbook.storyboard-sheet --target lookbook:<lookbook-id> --source tmp/media/storyboard-lookbook-sheet.png --title "Storyboard Lookbook Sheet" --json
renku media import --purpose cast.character-sheet --target cast:<cast-member-id> --source tmp/media/character-sheet.png --title "Character Sheet" --json
renku media import --purpose cast.profile --target cast:<cast-member-id> --source tmp/media/profile.png --title "Profile" --json
renku media import --purpose location.sheet --target location:<location-id> --source tmp/media/location-sheet.png --title "Location Sheet" --json
renku media import --purpose location.hero --target location:<location-id> --source tmp/media/location-hero.png --title "Location Hero" --json
```

Pass `--receipt` only for an exact output from a Renku run whose purpose and
target match the focused attachment. Pass `--source-spec` for a Codex-generated
image after saving the matching agent-external request. Omit both for uploaded,
downloaded, manually created, or other external media with no saved generation
request.

Scene Storyboard Sheet uses the focused cropped-image attachment:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --beat-sheet <beat-sheet-id> \
  --file <scene-storyboard-images-import.json> \
  --json

renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --beat-sheet <beat-sheet-id> \
  --beats <beat-id> \
  --source <cropped-beat-image-path> \
  --json
```

Grouped document:

```json
{
  "kind": "sceneStoryboardImagesImport",
  "beatSheetId": "scene_beat_sheet_control_room_v1",
  "title": "Control room storyboard images",
  "beats": [
    {
      "beatId": "beat_001",
      "source": "tmp/media/storyboards/control-room-beat-001.png",
      "sourcePurpose": "scene.storyboard-sheet"
    },
    {
      "beatId": "beat_002",
      "source": "tmp/media/storyboards/control-room-beat-002.png",
      "sourcePurpose": "scene.storyboard-sheet"
    }
  ]
}
```

The agent owns visual inspection and splitting of the deterministic composite;
Core owns Beat and file ownership validation plus durable attachment. No runtime
automatic splitting or creative-content validation occurs.

Every successful import reports Studio resource keys. The CLI appends a Studio
resource-change event so the existing Cast, Location, Lookbook, Scene, dialogue,
and Take surfaces refresh without a browser reload.

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

## `renku trash`

List, restore, preview, and empty recoverable discarded project content.

```bash
renku trash list --project <project-name> --json
renku trash restore --project <project-name> --trash-item <trash-item-id> --json
renku trash empty preview --project <project-name> --json
renku trash empty run --project <project-name> --confirmation-token <token> --json
```

Options:

- `--project`: required project name.
- `--trash-item`: required for `restore`; pass a Trash item id from
  `renku trash list`.
- `--confirmation-token`: required for `empty run`; pass the token returned by
  `renku trash empty preview`.
- `--older-than-iso`: optional ISO timestamp cutoff for Empty Trash preview and
  run.
- `--dry-run`: validate an Empty Trash run and write its report without moving
  files.

Behavior:

- Discard commands keep content recoverable in Trash. Restore with
  `renku trash restore`.
- Empty Trash stages files into `.renku/trash/emptied/<operation-id>/`; ordinary
  discard commands do not move or remove project media files.
- Agents must not run `renku trash empty run` unless the user explicitly asks to
  empty Trash after reviewing the preview.
- Restore can return structured warnings when content is restored but an active
  selected or picked replacement remains in place.

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

## `renku studio server status`

Show the canonical local Studio dev-server status for agents and humans.

```bash
renku studio server status
renku studio server status --json
```

Behavior:

- Reports the canonical browser URL as `http://localhost:5173`.
- Reports whether a fresh Studio runtime descriptor exists and its recorded
  process is still alive.
- Reports whether the runtime descriptor matches the canonical dev server.
- Reports runtime descriptor token presence as a boolean only. It never prints
  the CLI notification token or the browser Studio API token.
- Summarizes the Studio coordination event store with line counts and invalid
  historical event counts instead of dumping every warning.
- The intended agent policy is attach-only: agents should use the existing
  server when the descriptor is fresh and canonical, and should not start a new
  Studio dev server unless the user explicitly changes that policy.
- JSON output includes `agent.browserAccess` so agents know that Browser access
  goes through the in-app Browser client bootstrap, not through a standalone
  browser tool discovered by tool search.

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
