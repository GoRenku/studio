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
- Reports the project path and database path.

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
  Lookbooks, selected cast visuals, selected location environment sheets, and
  selected-scene shot readiness.
- Reports structured director diagnostics for missing screenplay state, missing
  active Lookbook, missing selected visual media, missing active shot lists, and
  missing storyboard images.
- Returns ordered `nextSteps` such as `draft-screenplay`, `analyze-screenplay`,
  `create-lookbook`, `design-cast`, `design-production`, `design-shot-list`,
  `generate-storyboards`, and `generate-shot-video`.
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
renku cast voice kling-registration estimate --file <kling-registration-spec-json> --json
renku cast voice kling-registration run --file <kling-registration-spec-json> --approval-token <token> --json
```

Options:

- `--cast`: required for `list`, `show`, and `remove`.
- `--voice`: required for `show` and `remove`; accepts either the durable Cast
  Voice id or the Cast Voice reference name. Provider-registration commands use
  it to scope list/create operations to one Cast Voice.
- `--registration`: required for provider-registration `show` and `remove`.
- `--file`: required for `validate`, `attach`, provider-registration `create`,
  and Kling registration estimate/run. Use `-` to read stdin.
- `--approval-token`: required when running a real Kling provider registration
  unless `--simulate` is used.
- `--simulate`: run the Kling registration through the shared generation
  simulation path and store a simulated provider voice id.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project.
- Cast Voices are Cast Member-owned editorial voice references, not Cast Design
  JSON fields.
- `attach` copies the sample audio file into the Cast Member voice sample asset
  folder, registers a `cast_voice_sample` audio asset, and creates the Cast
  Voice record with an initial ElevenLabs provider registration.
- `registrations create` attaches an explicit provider handle to an existing
  Cast Voice. ElevenLabs registrations require `dialogue-audio-tts`; Kling
  registrations require `kling-video-voice-control`.
- `kling-registration run` sends the Cast Voice sample to
  `fal-ai/kling-video/create-voice`, reads the returned provider `voice_id`,
  and stores it as a `fal-ai` provider registration.
- `remove` deletes the Cast Voice, its provider registrations, the linked
  sample asset record, its asset file records, and the copied audio file.
- Generic asset deletion fails for Cast Voice sample assets. Remove the Cast
  Voice instead.
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
  "provider": "fal-ai",
  "registrationModel": "kling-video/create-voice",
  "externalVoiceId": "829877809978941442",
  "capabilities": ["kling-video-voice-control"],
  "sourceSampleAssetId": "asset_ada_voice_sample"
}
```

Kling registration spec JSON shape:

```json
{
  "purpose": "klingVoiceRegistration",
  "castVoiceId": "cast_voice_ada_normal",
  "sourceProjectRelativePath": "cast/ada/voice-samples/clean-sample.wav",
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
  Design when present, selected cast media, active Lookbook summary, and media
  generation readiness.
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
  summary, selected environment-sheet media, asset role counts, active Lookbook
  summary, and generation readiness for `location.environment-sheet`.
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
- `context` commands return the relevant screenplay hierarchy, active Lookbook
  summary, active design summary when present, selected media, and
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
renku screenplay shot-list validate-operations --file <operations-json> --json
renku screenplay shot-list apply --file <operations-json> --json
renku screenplay shot-list apply --file <operations-json> --dry-run --json
renku screenplay shot-list storyboard status --scene <scene-id> --shot-list <shot-list-id> --json
renku screenplay shot-list set-active --scene <scene-id> --shot-list <shot-list-id> --json
```

Options:

- `--scene`: required for `context`, `list`, `show --active`,
  `storyboard status`, and `set-active`.
- `--shot-list`: required for `show --shot-list`, `storyboard status`, and
  `set-active`.
- `--file`: required for `validate`, `write`, `validate-operations`, and
  `apply`. Use `-` to read stdin.
- `--dry-run`: for `apply`, validates and reports planned changes without
  writing a derived shot-list version.
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
- `validate-operations` checks a tagged `kind: "sceneShotListOperations"`
  document without writing.
- `apply` creates a new scene-owned shot-list history row derived from the
  explicit `baseShotListId` in the operations document. It activates the new
  row only when `activate: true`.
- `storyboard status` reports which shots in a specific shot-list version have
  current storyboard images, missing images, or stale images.
- `set-active` changes only the active shot-list pointer for the scene.
- `write`, `apply`, and `set-active` append Studio resource-change events for
  the scene Shots surface, the shot-list collection, the specific shot list,
  changed shot keys, and the scene.
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

Operation JSON shape:

```json
{
  "kind": "sceneShotListOperations",
  "sceneId": "scene_control_room",
  "baseShotListId": "scene_shot_list_control_room_v1",
  "activate": true,
  "title": "Control room coverage, revised",
  "operations": [
    {
      "operation": "shots.replace",
      "shotIds": ["shot_003"],
      "shots": [
        {
          "shotId": "shot_003a",
          "title": "Ada enters the dark room",
          "summary": "A wider reveal that re-establishes the space.",
          "coveredBlockIndexes": [2],
          "castMemberIds": ["cast_ada"],
          "locationIds": ["location_control_room"],
          "dialogue": []
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
cast.voice-sample
location.environment-sheet
scene.storyboard-sheet
shot.first-frame
shot.last-frame
shot.reference-image
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
renku generation context --purpose cast.voice-sample --target cast:<cast-member-id> --json
renku generation model list --purpose cast.voice-sample --target cast:<cast-member-id> --json
renku generation context --purpose location.environment-sheet --target location:<location-id> --json
renku generation model list --purpose location.environment-sheet --target location:<location-id> --json
renku generation context --purpose scene.storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --json
renku generation model list --purpose scene.storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --json
renku generation context --purpose shot.first-frame --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation model list --purpose shot.first-frame --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation context --purpose shot.last-frame --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation model list --purpose shot.last-frame --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation context --purpose shot.reference-image --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation model list --purpose shot.reference-image --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation context --purpose shot.multi-shot-storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation model list --purpose shot.multi-shot-storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation context --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation model list --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --intent <input-mode-id> --json
```

Shot video take production planning:

```bash
renku generation production update --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --production-group <production-group-id> --file <shot-video-production-json> --json
renku generation preflight --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --production-group <production-group-id> --file <shot-video-production-json> --json
renku generation input list --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --production-group <production-group-id> --json
renku generation input select --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --production-group <production-group-id> --input <input-id> --json
renku generation input clear --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --production-group <production-group-id> --kind <input-kind> --subject-kind <subject-kind> --subject-id <subject-id> --json
```

`generation preflight` is the agent-facing dependency checklist before final
video generation. Read `inputsToCreate`, `inputPlanItems`,
`plan.dependencyMap`, `prompts`, and `finalTake.canCreateSpec`.

Generated shot dependency drafts must be authored by the agent in
`videoTakeProduction.agentProposal.dependencyDrafts[]`. The preflight report
blocks missing authored dependency drafts with structured diagnostics and does
not synthesize generic image prompts for first frames, last frames, ad hoc
reference images, or multi-shot storyboard sheets.

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
renku generation spec list --purpose shot.first-frame --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation spec list --purpose shot.last-frame --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation spec list --purpose shot.reference-image --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation spec list --purpose shot.multi-shot-storyboard-sheet --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation spec list --purpose shot.video-take --target scene:<scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
```

Estimate and run:

```bash
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
renku generation run --spec <spec-id> --simulate --json
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
  selected `shotIds`. The media-producer agent inspects that composite, slices
  one image per selected shot, and imports only the cropped shot images after
  scene-shot-designer has supplied the Scene Shot List.
- Shot first frames, last frames, ad hoc reference images, and multi-shot
  storyboard sheets are generated as shot video take inputs. Their specs must
  use authored prompts; `shot.reference-image` also requires a title that names
  the reference intent.
- The Studio shot References tab displays imported/generated `first-frame`,
  `last-frame`, `reference-image`, and `multi-shot-storyboard-sheet` inputs
  relevant to the selected shot or production group.

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
shot.reference-image
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

Cast Character Sheet import:

```bash
renku media import \
  --purpose cast.character-sheet \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --reference-name <renku-reference-name> \
  --reference-purpose <purpose> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Cast Profile import:

```bash
renku media import \
  --purpose cast.profile \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Cast Voice samples are attached with `renku cast voice attach`, not
`renku media import`, because the durable Cast Voice record stores provider,
model, provider voice id, reference name, and purpose.

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

Scene Storyboard Sheet image import:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --file scene-storyboard-images-import.json \
  --json

renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id> \
  --source <cropped-shot-image-path> \
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
  --purpose shot.reference-image \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --source <project-relative-path> \
  --title <reference-intent-title> \
  --selection select \
  --receipt <generation-run-json> \
  --json

renku media import \
  --purpose shot.multi-shot-storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --source <project-relative-path> \
  --title <group-sheet-title> \
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

The import JSON lists cropped shot image files from a temporary generated
storyboard sheet. It does not include the composite sheet file:

```json
{
  "kind": "sceneStoryboardImagesImport",
  "shotListId": "scene_shot_list_control_room_v1",
  "title": "Control room storyboard images",
  "shots": [
    {
      "shotId": "shot_001",
      "source": "generated/media/storyboards/control-room-shot-001.png",
      "title": "Shot 1",
      "sourcePurpose": "scene.storyboard-sheet"
    },
    {
      "shotId": "shot_002",
      "source": "generated/media/storyboards/control-room-shot-002.png"
    }
  ]
}
```

Options:

- `--purpose`: required media purpose. Current supported values are
  `lookbook.image`, `lookbook.sheet`, `cast.character-sheet`, `cast.profile`,
  `location.environment-sheet`, `scene.storyboard-sheet`, `shot.first-frame`,
  `shot.last-frame`, `shot.reference-image`,
  `shot.multi-shot-storyboard-sheet`, and `shot.video-take`.
- `--target`: required target. Current supported shapes are
  `lookbook:<lookbook-id>`, `cast:<cast-member-id>`,
  `location:<location-id>`, and `scene:<scene-id>`.
- `--source`: required project-relative media source path for single-file
  imports. For `scene.storyboard-sheet`, this imports one cropped shot image
  and must be paired with exactly one `--shots` id.
- `--file`: grouped import JSON for `location.environment-sheet` and
  multi-shot `scene.storyboard-sheet` image imports.
- `--shot-list`: required when importing `scene.storyboard-sheet` and shot
  media purposes.
- `--shots`: comma-separated shot ids for shot media purposes. For single-file
  `scene.storyboard-sheet` imports, it must contain exactly one shot id.
- `--selection`: optional shot image import selection, either `select` or
  `take`.
- `--sections`: optional comma-separated Lookbook section keys.
- `--reference-name`: required for `cast.character-sheet`; a stable
  relationship-scoped Renku reference name such as `standard-sheet`.
- `--reference-purpose`: required for `cast.character-sheet`; the purpose for
  the reference, such as `default costume and face reference`.
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
- For Scene Storyboard Sheets, import registers one `scene_storyboard_image`
  asset per shot, copies only cropped shot images under
  `screenplay/storyboards/<scene-label>/<import-title>/`, attaches each image to
  the Scene with role `storyboard_image`, and writes direct
  `scene_shot_storyboard_image` rows keyed by scene, shot list, and shot id. The
  temporary composite sheet is not copied into the project asset graph.
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
