# Renku CLI Commands

Status: current

Role: CLI reference

Last reviewed: 2026-08-10

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

- Creates the platform config file if it does not exist:
  - macOS: `$HOME/.config/renku/config.yaml`;
  - Windows: `%LOCALAPPDATA%\Renku\Studio\config.yaml`;
  - Linux/Unix: `${XDG_CONFIG_HOME:-$HOME/.config}/renku/config.yaml`.
- Leaves an existing config in place and reports its current storage root.
- Fails when the storage root argument is missing.

Studio can create its recommended Project Library during first-run setup. Run
this command before completing onboarding when a custom Project Library is
required; Studio does not offer a folder picker or relocate an existing library.

## `renku create`

Create a clean movie project.

```bash
renku create <project-name> --title <title>
renku create <project-name> --title <title> --logline <text> --synopsis <text>
renku create <project-name> --title <title> --aspect-ratio 16:9 --json
```

Arguments:

- `<project-name>`: project folder name inside the configured storage root.

Options:

- `--title`: required human-readable movie title.
- `--aspect-ratio`: optional project aspect ratio.
- `--logline`: optional short project logline.
- `--synopsis`: optional project synopsis.
- `--storage-root`: override the configured storage root for this command.
- `--json`: print the creation report as JSON.

Behavior:

- Creates the project folder and project SQLite database.
- Opens the created project as the current authoring project after creation
  succeeds.
- The JSON output includes a `currentProject` descriptor for the project that
  was just opened.

## `renku about`

Show released Studio product and CLI package information.

```bash
renku about
```

Behavior:

- Prints JSON containing the synchronized Studio product `version`, CLI package
  name, binary name, and linked core package information.

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
  Location Sheets, and selected-scene Beat readiness.
- Reports structured director diagnostics for missing screenplay state, missing
  Production or Storyboard Lookbooks, missing selected visual media, missing
  active Scene Beats revisions, and missing storyboard images.
- Returns ordered `nextSteps` such as `draft-screenplay`, `analyze-screenplay`,
  `author-production-lookbook`, `author-storyboard-lookbook`, `design-cast`,
  `design-production`, `design-scene-beats`, and `generate-storyboards`.
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
Asset, sample provenance, default state, and optional opaque provider-owned
voice identity. Core does not interpret provider/model fields in that identity.

```bash
renku cast voice list --cast <cast-member-id> --json
renku cast voice show --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
renku cast voice validate --file <cast-voice-attachment-json> --json
renku cast voice validate --file - --json
renku cast voice attach --file <cast-voice-attachment-json> --json
renku cast voice attach --file - --json
renku cast voice remove --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
```

Options:

- `--cast`: required for `list`, `show`, and `remove`.
- `--voice`: required for `show` and `remove`; accepts either the durable Cast
  Voice id or the Cast Voice reference name.
- `--file`: required for `validate` and `attach`. Use `-` to read stdin.
- `--json`: print machine-readable JSON.

Behavior:

- Requires a current authoring project.
- Cast Voices are Cast Member-owned editorial voice references, not Cast Design
  JSON fields.
- `attach` copies the sample audio file into the Cast Member voice sample asset
  folder, registers a `cast_voice_sample` audio asset, and creates the Cast
  Voice record. The first attached voice becomes that Cast Member's default;
  Studio lets the user select another default in Cast Assets.
- `voiceIdentity` is optional bounded JSON owned by the provider Skill. A
  file-backed Seed Audio sample needs no extra identity; an ElevenLabs sample
  may carry `{"provider":"elevenlabs","voiceId":"<exact-id>"}`.
- `remove` discards the Cast Voice and linked
  sample asset metadata into Trash. The copied audio file remains in place until
  Empty Trash runs.
- Generic asset discard fails for Cast Voice sample assets. Remove the Cast
  Voice instead, then restore through `renku trash restore` if needed.
- Successful mutations emit Studio resource keys for the affected Cast Member
  asset rail and surface.

Input JSON shape:

```json
{
  "kind": "castVoiceFileAttachment",
  "castMemberId": "cast_ada",
  "name": "urban-normal",
  "purpose": "Normal speaking voice for dialogue and testing",
  "voiceIdentity": {
    "provider": "elevenlabs",
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
  },
  "sample": {
    "sourceProjectRelativePath": "generated/ada-urban-normal.mp3",
    "title": "Ada urban normal voice sample",
    "generationProvenance": {
      "provider": "elevenlabs",
      "model": "voice-sample-audio",
      "mediaKind": "audio",
      "prompt": null,
      "request": { "voiceId": "21m00Tcm4TlvDq8ikWAM" }
    }
  }
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
renku location world generate --file <location-world-generation-json> --json
renku location world show --location <location-id> --json
```

Behavior:

- Requires a current authoring project.
- `context` returns the Location, scenes that use it, active Location Design
  summary, selected Location Sheet media, asset role counts, Production
  Lookbook summary, and generation readiness for `location.sheet`.
- `validate` checks a tagged `kind: "locationOperations"` document without
  writing.
- `apply` creates, updates, deletes, or moves Location facts through the
  canonical location authoring path.
- `world generate` validates either one temporary panorama path or two to eight
  temporary reconstruction image paths. Panorama input is sent directly with
  `is_pano: true`; multi-image input uses reconstruction without directional
  azimuths. Both preserve an authored prompt without provider recaptioning,
  download the full-resolution SPZ once, persist a Location-owned
  `location_world` Asset, and select it. Renku does not persist the provider's
  panorama asset.
- `world show` returns the Location and its currently selected World Asset.
- Location handles must stay unique across Cast Members and Locations.
- Delete operations fail when the Location is still referenced by the
  screenplay.
- Successful mutations emit Studio resource keys for location navigation and
  affected Location surfaces.

Panorama World input:

```json
{
  "kind": "locationWorldGeneration",
  "version": 1,
  "locationId": "location_...",
  "prompt": "Exact optional World prompt.",
  "source": {
    "kind": "panorama",
    "projectRelativePath": "tmp/media/location-world/example/panorama.png"
  }
}
```

Retained multi-image reconstruction input uses:

```json
{
  "kind": "locationWorldGeneration",
  "version": 1,
  "locationId": "location_...",
  "source": {
    "kind": "multiImage",
    "images": [
      { "projectRelativePath": "tmp/media/location-world/example/view-01.png" },
      { "projectRelativePath": "tmp/media/location-world/example/view-02.png" }
    ]
  }
}
```

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

## `renku prop`

List, inspect, validate, and mutate ordered Prop facts for the current
authoring project.

```bash
renku prop list --json
renku prop show <prop-id> --json
renku prop context --prop <prop-id> --json
renku prop validate --file <prop-operations-json> --json
renku prop apply --file <prop-operations-json> --dry-run --json
renku prop apply --file <prop-operations-json> --json
```

`kind: "propOperations"` documents add, update, delete, or move Props. Adds use
a request-local `key`; existing Props use their durable `id`. Handles are
unique across Cast Members, Locations, and Props. Delete fails while Prop
Assets or Prop Design history depends on the Prop.

## `renku production-design`

Read, validate, write, and activate durable production-design documents for
Locations and Props.

```bash
renku production-design location context --location <location-id> --json
renku production-design location list --location <location-id> --json
renku production-design location show --active --location <location-id> --json
renku production-design location show --design <location-design-id> --json
renku production-design location validate --file <location-design-json> --json
renku production-design location write --file <location-design-json> --json
renku production-design location set-active --location <location-id> --design <location-design-id> --json
renku production-design prop context --prop <prop-id> --json
renku production-design prop list --prop <prop-id> --json
renku production-design prop show --active --prop <prop-id> --json
renku production-design prop show --design <prop-design-id> --json
renku production-design prop validate --file <prop-design-json> --json
renku production-design prop write --file <prop-design-json> --json
renku production-design prop set-active --prop <prop-id> --design <prop-design-id> --json
```

Behavior:

- Location Design is location-level production design: spatial thesis,
  architecture, set dressing, materials, atmosphere, recurring objects, continuity, and
  Location Sheet guidance in `locationSheetGuidance`.
- Prop Design is Prop-level production design: form, materials, construction,
  scale and handling, states, continuity, Prop Sheet guidance, and generation
  guidance.
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
- Returns counts for opening elements, Sections (including Act/Sequence type
  counts), Scenes, Blocks, and references. An all-zero result is an empty
  Screenplay.
- Returns `sourceOwnership: renku|fdx`. Agents must check it before authoring:
  FDX ownership permits source refresh through `import-fdx` but blocks every
  generic Screenplay mutation, including organization and references.

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
- Prints the canonical Scene-first Screenplay with `opening`, `scenes`,
  optional `sections`, `structure`, and `references`.

## `renku screenplay create`

Create screenplay data for the current authoring project.

```bash
renku screenplay create --file <screenplay-json> --json
```

Options:

- `--file`: required JSON input file. Use `-` to read stdin.
- `--json`: print the create report as JSON.

Behavior:

- Requires a current authoring project.
- Fails with `SCREENPLAY_FDX_BACKED_READ_ONLY` when the Screenplay is backed by
  an FDX import.
- Creates the initial Screenplay only when its current aggregate is empty.
- Accepts a complete `opening`, `scenes`, `sections`, `structure`, and
  `references` object without a redundant `kind` envelope.
- References existing Cast Members, Locations, and Props through separate
  reference objects; it never creates Project subjects or requires handle
  tokens in screenplay text.
- Returns `generatedIdentities` for request-local keys and records a Screenplay
  revision.

## `renku screenplay import-fdx`

Import or refresh the supported semantic subset of a Final Draft XML screenplay.

```bash
renku screenplay import-fdx --file /absolute/path/to/script.fdx
renku screenplay import-fdx --file /absolute/path/to/script.fdx --json
```

Options:

- `--file`: required readable `.fdx` file path; stdin is not supported.
- `--json`: return retained source IDs, SHA-256, counts, resource keys, and
  character-cue/Scene-heading/tag candidates.

Behavior:

- An empty Renku-owned Screenplay performs the initial import. An existing
  FDX-backed Screenplay performs an unchanged check or refresh. A populated
  Renku-authored Screenplay cannot be converted.
- Hashes and retains the exact source as the Project-owned
  `screenplay_source` Asset at
  `screenplay/<safe-source-basename>[-<collision-number>].fdx`.
- Imports opening text, Scenes, supported text blocks, complete Dialogue and
  Parentheticals, cue extensions, Dual Dialogue, and optional Scene numbers.
- Always creates a flat source-ordered Scene list. Final Draft New Act, End of
  Act, Sequence, Summary, Outline, Note, ScriptNote, and editor metadata remain
  only in the retained source and never create Renku Sections.
- Preserves exact supported FDX Scene numbers without inventing missing values.
- Makes the imported Screenplay read-only to Renku Screenplay authoring
  commands. Downstream production workflows remain available.
- Creates no Cast Member, Location, Prop, or identity binding. Report
  candidates are evidence for later user/agent reconciliation.
- Fails atomically on malformed/unsafe XML, unsupported visible screenplay
  content, invalid dialogue, a destination conflict, or persistence
  failure.
- Returns `status: imported`, `refreshed`, or `unchanged`. An unchanged source
  writes nothing. Every valid changed source is accepted automatically; an
  equal canonical projection updates only retained-source state, while a
  canonical change replaces the complete aggregate and creates one revision.
- Has no partial merge, FDX export, or Renku-to-FDX conversion mode.

Formatting, ScriptNotes, Title Page layout, revision presentation, pagination,
and editor state remain only in the retained source. They are intentionally not
reported as omissions. See
[`screenplay-fdx-import.md`](../architecture/screenplay-fdx-import.md) for the
exact supported subset.

## `renku screenplay supporting-material import`

Import one opaque source file for later screenplay, Cast Member, Location, or
Prop authoring. Import itself does not change the Screenplay.

```bash
renku screenplay supporting-material import \
  --file /absolute/path/to/research.pdf \
  --json
```

Options:

- `--file`: required path to any readable regular file.
- `--project`: optional Project name; otherwise the current Project is used.
- `--json`: return the typed Project-owned Asset and exact retained path.

Behavior:

- Works in every Renku Project, whether its Screenplay is empty,
  Renku-authored, or FDX-backed.
- Applies no extension, MIME, media-format, content, or byte-size allowlist.
- Stores exact bytes as a `screenplay_supporting_material` Asset with neutral
  media kind `file`, role `source`, and `application/octet-stream` MIME type
  under `screenplay/`.
- Preserves recognized and unknown extensions. An extensionless source is
  retained with `.bin`.
- Returns `imported` for a new byte identity and `unchanged` when an active
  exact-byte Asset already exists. Same-name changed bytes allocate `-2`, `-3`,
  and so on as a new immutable Asset.
- Does not parse, summarize, index, update descriptions, mutate screenplay
  content, or supply raw source files to downstream generation and planning
  contexts.

List active imports with the existing Asset command:

```bash
renku asset list \
  --project <project-name> \
  --owner project \
  --type screenplay_supporting_material \
  --limit 200 \
  --json
```

Asset listing is paginated. When `nextCursor` is not `null`, repeat the same
command with `--cursor <nextCursor>` and accumulate `items` until the response
returns `nextCursor: null`. Reading every active supporting-material source
requires exhausting all pages.

## `renku screenplay apply`

Apply focused screenplay operations.

```bash
renku screenplay apply --file <operations-json> --json
```

Options:

- `--file`: required JSON input file. Use `-` to read stdin.
- `--json`: print the operation report as JSON.

Behavior:

- Requires a current authoring project.
- Fails with `SCREENPLAY_FDX_BACKED_READ_ONLY` when the Screenplay is backed by
  an FDX import.
- Applies the closed `opening.replace`, `scene.*`, `section.*`, and
  `reference.*` operation union atomically.
- Scene and Section add operations use request-local keys plus explicit
  structure-entry keys. Incremental placement uses optional `parentSection`
  and exactly one of `at`, `beforeEntry`, or `afterEntry`.
- Does not create, update, delete, or move Cast Members, Locations, or Props.
- Validates the final Screenplay and writes one revision history row only after
  the complete batch succeeds.

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
- `restore` fails with `SCREENPLAY_FDX_BACKED_READ_ONLY` when the Screenplay is
  backed by an FDX import. Listing and reading revisions remain available.

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
- `context` returns `analysisMethod`, direct Project story metadata, opening content, canonical
  ordered Scenes and stable Blocks, Cast Member/Location/Prop references,
  default criteria, and the active analysis summary.
- `validate` checks a hierarchy-independent Screenplay Analysis without writing.
- `write` creates a new analysis history row and makes it active.
- Zero source Acts use analysis-owned three-act segments. Every FDX-backed
  Screenplay takes this flat path; retained Final Draft planning markers are not
  analysis context. Exactly three canonical Renku-authored Acts must be
  reflected by those segments; boundary criticism belongs in critique
  suggestions. Any other positive Act count is rejected before model work with
  `SCREENPLAY_ANALYSIS_THREE_ACT_UNSUPPORTED`.
- Read responses compute `freshness` from existing Screenplay revision and
  analysis timestamps. `needsRefresh` keeps the analysis readable and uses the
  help text “Screenplay changed since this analysis.”
- `set-active` changes only the active analysis pointer.
- `write` and `set-active` append Studio resource-change events for
  `surface:story-arc`, `screenplay-analysis`, and the specific analysis id.
- The command uses US spelling only: `analyze`. There is no `analyse` alias.

Input JSON shape:

```json
{
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
  "actSegments": [],
  "keyBeats": [],
  "sceneGroups": [],
  "sceneAnalyses": [],
  "suggestedScenes": []
}
```

Validation rules:

These current-context rules apply to `validate` and `write`. `list` and `show`
validate stored Analysis schema without requiring its historical Scene ids or
order to match the current Screenplay.

- The current v1 structure model is `threeAct`.
- Three-act documents contain exactly three `actSegments` with
  roles `actOne`, `actTwo`, and `actThree`. Their Scene ids partition every
  current Scene exactly once in canonical order and never store screenplay
  Section ids. With exactly three source Acts, each segment must match the
  source Act's returned Scene membership.
- Default criteria `dramaticEnergy`, `stakes`, and `characterAgency` are
  required. Additional criteria are allowed.
- Scores must be integers from `0` to `100` and must reference declared
  criteria.
- `keyBeats` contains every accepted role exactly once; `sceneId` is optional
  for a missing or weak beat.
- `sceneAnalyses` contains every current Scene exactly once in order. Optional
  `sceneGroups` form another complete ordered Scene partition.
- Suggested Scenes are critique only, use exactly one current Scene anchor,
  and do not create Scene rows.
- Unknown fields are rejected for this agent-authored JSON format.

## `renku screenplay beats`

Read, validate, create, reset, revise, and activate durable Scene Beats
revisions for one Scene.

```bash
renku screenplay beats context --scene <scene-id> --json
renku screenplay beats context --scene <scene-id> --include-visual-references --json
renku screenplay beats list --scene <scene-id> --json
renku screenplay beats show --active --scene <scene-id> --json
renku screenplay beats show --revision <revision-id> --json
renku screenplay beats validate --file <scene-beats-json> --json
renku screenplay beats create --file <scene-beats-json> --json
renku screenplay beats reset --file <scene-beats-json> --json
renku screenplay beats validate-operations --file <operations-json> --json
renku screenplay beats apply --file <operations-json> [--dry-run] --json
renku screenplay beats storyboard status --scene <scene-id> --revision <revision-id> --json
renku screenplay beats set-active --scene <scene-id> --revision <revision-id> --json
```

`create` requires no existing revision. `reset` requires an active revision and
creates a fresh active revision whose new Core-authored Beat ids and numbers
start at `1..N`. Neither operation deletes history. `set-active` changes only
the active revision pointer, so selecting an earlier or later revision is the
restore workflow.

Input JSON contains `sceneId` and ordered creative Beat inputs. Callers do not
provide Beat ids or numbers:

```json
{
  "sceneId": "scene_control_room",
  "beats": [
    {
      "title": "The room is empty",
      "description": "Ada enters expecting the night operator and finds the consoles abandoned.",
      "narrativeDevelopment": "Expectation gives way to unease.",
      "narrativePurpose": "Establish the absence that forces Ada to investigate.",
      "castMemberIds": ["cast_ada"],
      "locationIds": ["location_control_room"],
      "propIds": ["prop_status_key"],
      "screenplayBlockIds": ["screenplay_block_entry"]
    }
  ]
}
```

Focused operations carry an exact `baseRevisionId`. Inserted Beats also omit
ids and numbers; Core allocates both. Updates preserve id and number, deletes
carry the retired number forward in the derived revision's reservation set,
and `activate` controls whether the new immutable revision becomes active.

Current-context mismatches in Screenplay Block, Cast Member, Location, and Prop
ids are warnings. Stored revisions remain readable after upstream context
changes. Creative Beat text remains opaque and must not carry camera, framing,
lens, movement, coverage, generated-image, or production-logistics contracts.
Obvious absolute Unix or Windows filesystem paths in those reference-id arrays
are invalid; Renku does not rewrite them into ids.

## `renku screenplay structure`, `section`, and `scene`

Read canonical Scene order, optional organization, or one focused value.

```bash
renku screenplay structure --json
renku screenplay section show <section-id> --json
renku screenplay scene show <scene-id> --json
```

Behavior:

- `structure` returns the complete Screenplay plus canonical ordered Scene ids.
- `section show` returns one Act/Sequence Section, its direct structure entries,
  and the ordered Scene ids inside that subtree.
- `scene show` returns one Scene and its exact Screenplay references.
- Scenes are canonical and need no Section ancestry. Acts and Sequences are
  optional non-owning organization.

## `renku screenplay scene-number`

List current Production Scene Numbers or resolve a user-facing number to its
durable Scene id.

```bash
renku screenplay scene-number list --json
renku screenplay scene-number resolve --number 22A --json
```

Options:

- `--number`: required for `scene-number resolve`. The exact non-empty authored
  value is used; it is not normalized or treated as identity.

Behavior:

- Requires a current authoring project.
- List output follows current screenplay order and includes each authored
  production number, durable Scene id, heading, and optional title.
- Resolution returns the same three references for one current Scene.
- Production numbers live directly on current Scenes; there is no separate
  reservation or omitted-number registry.
- `screenplay scene show` and all `--scene` options use durable Scene ids.

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

- Shows immutable `projectName`, durable `id`, title, aspect ratio, all direct
  story/development fields, and languages. There is no nested identity or
  duplicate Screenplay metadata object.
- If `--project` is omitted and no current Studio project exists, fails with
  `CLI022`.

## `renku info set`

Update project information fields.

```bash
renku info set --project <project-name> --title <title>
renku info set --project <project-name> --logline <text> --synopsis <text>
renku info set --project <project-name> --premise <text> --target-runtime-minutes 112 --themes responsibility,craft
renku info set --project <project-name> --aspect-ratio 16:9 --json
```

Options:

- `--project`: explicit project name. If omitted, the command uses the current
  Studio selection.
- `--title`: set the title.
- `--aspect-ratio`: set the aspect ratio.
- `--logline`: set the logline.
- `--synopsis`: set the synopsis.
- Story/development flags also include `--premise`, `--intended-audience`,
  `--format`, `--target-runtime-minutes`, `--primary-genre`,
  `--secondary-genres`, `--tones`, `--content-rating-intent`,
  `--creative-boundaries`, `--central-conflict`, `--dramatic-question`,
  `--themes`, `--historical-basis`, `--dramatized-elements`,
  `--screenplay-draft-status`, `--research-sources`, `--assumptions`,
  `--open-questions`, and `--next-steps`. List values are comma-separated.

Behavior:

- Requires at least one field flag.
- Appends Studio refresh and focus events after a successful mutation.

## `renku info clear`

Clear optional project information fields.

```bash
renku info clear --project <project-name> --logline
renku info clear --project <project-name> --synopsis clear --json
```

Options:

- `--project`: explicit project name. If omitted, the command uses the current
  Studio selection.
- `--aspect-ratio`: clear the aspect ratio.
- `--logline`: clear the logline.
- `--synopsis`: clear the synopsis.
- Every optional direct Project story/development flag accepted by `set` can be
  cleared; the supplied flag value is ignored by the clear command.

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
    "name": "Naturalistic storyboard language",
    "styleBrief": { "text": "Naturalistic full-color story visualization." },
    "lineAndFinish": { "text": "Continuous tonal forms without visible linework." },
    "valueAndAccent": { "text": "Restrained contrast with selective color emphasis." },
    "guardrails": { "text": "Keep action and geography immediately legible." }
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

Edit generated or imported Lookbook image placement and lifecycle.

```bash
renku lookbook image set-placement --image <lookbook-image-id> --sections camera,texture --json
renku lookbook image set-placement --image <lookbook-image-id> --sections camera --anchor <lookbook-point-id> --json
renku lookbook image set-placement --image <lookbook-image-id> --sections thesis,texture --anchor <texture-point-id> --json
renku lookbook image discard --image <lookbook-image-id> --json
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
  uploaded, or downloaded file to a Lookbook. Add `--select` when that same
  accepted intent should also make it the Lookbook's canonical image.
- To choose an existing candidate, use `renku asset list --owner
  lookbook:<lookbook-id>` followed by `renku asset select --target
  lookbook:<lookbook-id> --asset <asset-id>`. Use `asset clear-selection` to
  clear the canonical image.

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

## `renku shot-plan`

Shot Plans are mutable Scene-owned camera plans. JSON authoring files are
temporary tagged inputs; SQLite remains the durable source of truth.

Read:

```bash
renku shot-plan list --scene <scene-id> --json
renku shot-plan show --shot-plan <shot-plan-id> --json
```

Create or update plan details:

```bash
renku shot-plan validate --file <shot-plan-create-or-update.json> --json
renku shot-plan create --file <shot-plan-create.json> --json
renku shot-plan update --shot-plan <shot-plan-id> --file <shot-plan-update.json> --json
renku shot-plan copy --shot-plan <shot-plan-id> --json
renku shot-plan delete --shot-plan <shot-plan-id> --json
```

Iterate one Shot:

```bash
renku shot-plan shot add --shot-plan <shot-plan-id> --file <shot.json> --json
renku shot-plan shot add --shot-plan <shot-plan-id> --file <shot.json> --placement start --json
renku shot-plan shot add --shot-plan <shot-plan-id> --file <shot.json> --placement before --shot <anchor-shot-id> --json
renku shot-plan shot update --shot-plan <shot-plan-id> --shot <shot-id> --file <shot.json> --json
renku shot-plan shot move --shot-plan <shot-plan-id> --shot <shot-id> --position <one-based-position> --json
renku shot-plan shot remove --shot-plan <shot-plan-id> --shot <shot-id> --json
```

`--position 1` means the first Shot. Core stores zero-based positions and
rejects negative, zero, fractional, and out-of-range requested positions.
For `shot add`, `--placement` accepts `start`, `end`, `before`, or `after`;
`before` and `after` require the anchor Shot id in `--shot`. Core allocates the
stable Shot number. Plan and Shot numbers are returned in read/mutation reports
and never come from JSON authoring documents.

Shot image selection remains explicit:

```bash
renku asset list --project <project> --owner shot:<shot-id> --json
renku asset select --project <project> --target shot:<shot-id> --asset <asset-id> --json
renku asset clear-selection --project <project> --target shot:<shot-id> --json
renku shot-plan shot image discard --shot-plan <plan-id> --shot <shot-id> --asset <asset-id> --json
```

Importing a `shot.image` candidate with `--select` persists import and selection
as one accepted intent. Use `asset select` only when choosing an existing
candidate. Discarding the selected candidate clears that Shot's selection.

Current document tags are `shotPlanCreate`, `shotPlanUpdate`, and `shot`. Shot
documents contain only `title`, exact Markdown `description`, and `brief`.
Brief subjects are Framing, Camera, Motion, Optics, Lighting, plus optional
positive `durationSeconds`. No document contains ids, position, status, media
paths, prompts, or provider settings.

`optics.focalLengthMm` is a positive numeric millimeter value without a unit
suffix in JSON. Optional `optics.depthOfField` accepts only `"shallow"` or
`"deep"`; `rack-focus` is a Motion value, not depth of field. Description,
Optics intent, focus target, and Lighting intent remain exact opaque strings.
Agents may use relevant Markdown sections, canonical screenplay `@handle`
references, and deliberate strong emphasis in descriptions, but the CLI and
Core do not interpret those creative conventions. Agent-authored
`optics.focusTarget` names one primary optical subject, plane, or distance;
shared deep-focus legibility belongs in `optics.intent`.

## `renku generation`

Read the complete current Core-owned Project briefing for one media purpose and
target before authoring a provider request:

```bash
renku generation context \
  --purpose <purpose> \
  --target <target> \
  --json

renku generation context \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --revision <scene-beats-revision-id> \
  --beat <beat-id> \
  --beat <beat-id> \
  --json
```

The report contains current Project and target facts, workflow policy,
purpose-level output guidance, relevant Lookbooks and domain relationships, and
exact relationship-derived AssetFile suggestions. Suggestions are advisory and
non-exhaustive: they are not selection, priority, readiness, provider-field
assignment, or permission. Missing creative context returns warnings rather
than preventing a later generation. Invalid purpose/target identity, a revision
from another Scene, or Beats outside the requested revision fail with structured
diagnostics. `context` is read-only and emits no Studio mutation event.

Provider Skills write one temporary review document under
`tmp/operations/media-generation/`. The document contains only provider, model,
media kind, prompt, and opaque provider-native request JSON. Local project media
uses exact recursive
`{ "$file": "path", "mimeType": "...", "reviewLabel": "meaning", "promptMention": "exact token" }`
markers. `reviewLabel` is required for Renku review; `promptMention` is optional
and is never derived from media kind.

Inspect the selected provider/model's current raw input schema before authoring
its native request. `--output` atomically saves the same unmodified JSON for the
generation configuration visualization cache:

```bash
renku generation schema show \
  --provider <provider> \
  --model <exact-provider-api-id> \
  --output tmp/scratch/current-input-schema.json \
  --json
```

This command supplies technical fields and constraints only. Retained model
prompt guides remain the editorial authority for writing an effective prompt.
The provider Skill's canonical model-guide key is not accepted as a substitute
for the exact provider API id.

In the Codex inline-configuration flow, inspect the Core-owned system cache
before calling `schema show`:

```bash
renku generation configuration-visualization inspect \
  --file tmp/scratch/generation-configuration-visualization-descriptor.json \
  --json
```

The descriptor names the exact provider, executable model, operation, and input
mode, and fingerprints the route catalogs, installed Visualize Skill, and
template contract. A `fresh` result returns absolute `schemaPath` and
`templatePath` values and requires no live schema request. Entries expire
exactly 24 hours after the manifest's `checkedAt`, regardless of file
modification times.

After obtaining one current schema for an expired entry, refresh it:

```bash
renku generation configuration-visualization refresh \
  --file tmp/scratch/generation-configuration-visualization-descriptor.json \
  --schema tmp/scratch/current-input-schema.json \
  --json
```

An unchanged semantic schema returns `refreshed` and keeps the existing
template. `schema-changed`, `miss`, `invalid`, or `incompatible` requires a new
request-independent template, stored with:

```bash
renku generation configuration-visualization store \
  --file tmp/scratch/generation-configuration-visualization-descriptor.json \
  --schema tmp/scratch/current-input-schema.json \
  --template tmp/scratch/generation-configuration-template.html \
  --json
```

The cache lives under the Core-resolved Renku platform config directory, not a
Project. Templates contain one Renku request-payload placeholder; prompts,
targets, references, selections, credentials, and browser state stay in fresh
task-local instances. An expired entry is never used when refresh fails.

If final live provider validation rejects a cached-schema value, expire that
exact entry before rebuilding it:

```bash
renku generation configuration-visualization invalidate \
  --file tmp/scratch/generation-configuration-visualization-descriptor.json \
  --json
```

For example, a Pika image-to-video request first inspects the exact operation:

```bash
renku generation schema show \
  --provider pika \
  --model minimax/h3/image-to-video \
  --json
```

Its temporary review JSON keeps the provider-native field and annotated local
marker intact for Preview and provenance:

```json
{
  "provider": "pika",
  "model": "minimax/h3/image-to-video",
  "mediaKind": "video",
  "prompt": "Slow forward movement through soft changing light.",
  "request": {
    "prompt": "Slow forward movement through soft changing light.",
    "first_frame_image": {
      "$file": "tmp/scratch/first-frame.png",
      "mimeType": "image/png",
      "reviewLabel": "Reviewed opening frame"
    }
  }
}
```

The Pika Skill uses the current schema for all remaining native fields and values;
the CLI adds no Pika-specific command or request interpretation.

Validate an Engines-owned provider request:

```bash
renku generation validate \\
  --file tmp/operations/media-generation/request.json \\
  --json
```

Show one or more review files in Studio in command-line order:

```bash
renku generation preview show \\
  --file tmp/operations/media-generation/first.json \\
  --file tmp/operations/media-generation/second.json \\
  --json
```

Preview accepts a `codex` review document. It returns promptly after delivery and
never executes generation. Studio may update only the top-level prompt; the Skill
rereads the document and rebuilds provider-native request JSON conversationally.

Execute through the selected standalone Engines provider and download artifacts
under a Project-relative output directory:

```bash
renku generation execute \\
  --file tmp/operations/media-generation/request.json \\
  --output tmp/operations/media-generation/output \\
  --json
```

Recover a provider job when that provider supports stateless recovery:

```bash
renku generation recover \\
  --file tmp/operations/media-generation/request.json \\
  --request-id <provider-job-id> \\
  --output tmp/operations/media-generation/output \\
  --json
```

Validate, execute, and recover reject `codex`; Codex built-in image generation is
harness-gated and invoked directly by Media Producer. World Labs Location World
generation remains under `renku location world generate`.

Successful execute/recover JSON contains downloaded `artifacts`, optional
`requestId`, and exact safe `provenance` ready to save and pass to attachment.
There is no Spec, Run, estimate, approval token, freeze, or simulation command.

## `renku media import`

Attach an inspected Project-relative media file through its focused Core owner.
Generation and attachment remain separate.

For `shot-plan.video-generation`, optional `--previs-revision <revision-id>`
associates the take with an exact registered revision of the target Previs plan.
Copy the id from `renku shot-plan previs show`; Core never infers the latest
revision. This is weak source context, not Asset ownership or canonical selection.
Keep the id when the provider input is a derivative of that revision. `video.edit`
inherits the source Asset's revision context without an override flag.

General form:

```bash
renku media import \\
  --purpose <purpose> \\
  --target <target> \\
  --source <project-relative-path> \\
  --title <title> \\
  --summary <one-line-summary> \\
  --reference-name <name> \\
  --tag <tag> \\
  --provenance <media-generation-provenance-json> \\
  --turns <N-or-N-M> \\
  --select \\
  --json
```

`--provenance` is optional for purposes that accept ordinary external media and
required for purposes whose domain contract requires generated media. Its JSON is
preserved exactly on the attached Asset after Core safety and relationship
validation. `--tag` is repeatable. Summary, reference name, tags, provenance,
and attachment are persisted atomically.

Supported focused purposes include Project cover; Lookbook image/video/storyboard
sheets; Cast character sheet/profile/voice sample; Location and Prop sheets/heroes;
Scene storyboard images; Shot images; Shot Plan video and its supporting image
roles; image create/edit; source-derived video edit; and Shot Plan Dialogue Audio.
Each purpose accepts only its Core-owned target kind.

Examples:

```bash
renku media import --purpose cast.profile --target cast:<cast-member-id> \\
  --source tmp/operations/media-generation/output/profile.png \\
  --provenance tmp/operations/media-generation/provenance.json \\
  --title "Profile" --select --json

renku media import --purpose lookbook.image --target lookbook:<lookbook-id> \\
  --source media/lookbook-reference.png --title "Lookbook image" --select --json

renku media import --purpose image.create --target shot-plan:<shot-plan-id> \\
  --source tmp/operations/media-generation/output/reference.png \\
  --provenance tmp/operations/media-generation/provenance.json --json

renku media import --purpose image.edit --target asset:<source-asset-id> \\
  --source tmp/operations/media-generation/output/edited.png \\
  --provenance tmp/operations/media-generation/provenance.json --json

renku media import --purpose video.edit --target asset:<source-asset-id> \\
  --source tmp/operations/media-generation/output/edited.mp4 \\
  --provenance tmp/operations/media-generation/provenance.json --json

renku media import --purpose shot-plan.dialogue-audio \\
  --target shot-plan:<shot-plan-id> --turns 2-4 \\
  --source tmp/operations/media-generation/output/dialogue.mp3 \\
  --provenance tmp/operations/media-generation/provenance.json --json
```

`--turns` is required only for `shot-plan.dialogue-audio`. It accepts one
positive Turn number or one ascending consecutive inclusive range. It does not
accept lists or create durable Dialogue Turn relations.

`image.create` becomes an unselected generic Reference Image beside that exact
Shot Plan. `image.edit` accepts no destination flag: Core verifies that
provenance references a current source file and derives the new unselected
candidate's same-place owner, type, canonical path, and surface from the source
Asset's durable relationships.

`video.edit` accepts any active registered Asset with a current video file,
regardless of type or owner. Core requires that exact source path once in safe
video provenance and creates a separate unselected Asset beside it with an
`edited-video-gxxx` name. The source remains unchanged.

Scene Storyboard Sheet keeps its focused grouped attachment document:

```bash
renku media import \\
  --purpose scene.storyboard-sheet \\
  --target scene:<scene-id> \\
  --revision <scene-beats-revision-id> \\
  --file <scene-storyboard-images-import.json> \\
  --json
```

Each grouped Beat entry may contain `generationProvenance`. A single Beat may use
`--beats <beat-id> --source <path> --provenance <file>`. Core validates the
current Scene Beats revision and writes all accepted images atomically.

## `renku asset`

List or update Assets, and select or clear canonical owner-scoped imagery.

```bash
renku asset list --project <project-name> --owner <owner> --json
renku asset update <asset-id> --project <project-name> --title <title> --summary <summary> --reference-name <name> --tag <tag> --tag <tag> --locale <locale-id> --json
renku asset update <asset-id> --project <project-name> --clear-tags --json
renku asset select --project <project-name> --target <selection-target> --asset <asset-id> --json
renku asset clear-selection --project <project-name> --target <selection-target> --json
```

Options:

- `--project`: required project name.
- `--owner`: Asset listing owner. Supported forms are `project`, `cast:<id>`,
  `location:<id>`, `sequence:<id>`, `scene:<id>`, `lookbook:<id>`,
  `shot:<id>`, and `beat:<scene-id>:<beat-id>`.
- `--target`: selection target for `select` and `clear-selection`. Supported
  forms are Cast, Location, Lookbook, Shot, and Scene Beat only.
- `--asset`: required by `select`.
- `--type`, `--media-kind`, and `--locale`: optional listing filters.
- `--limit`: optional listing page size. Core accepts at most 200 Assets per
  page and defaults to 60.
- `--cursor`: optional opaque `nextCursor` returned by the previous listing
  page. Keep all other listing filters unchanged when requesting the next page.
- `--title`, `--summary`, `--reference-name`, and `--locale`: Asset-owned
  metadata updates.
- repeated `--tag` replaces the complete ordered tag list. `--clear-tags`
  stores `[]`; it cannot be combined with `--tag`. Omitting both leaves tags
  unchanged. Core trims, rejects empty entries, and removes exact duplicates
  without interpreting tag meaning.

Character Sheets, Location Sheets, Lookbook Sheets, and Dialogue Audio Takes
have no global selection command. Their exact choices belong to the consuming
provider request inputs.

JSON listing returns an `AssetPage` with `items`, `nextCursor`, and
`selectedAssetId`, so callers receive the owner’s current canonical choice with
the candidate collection. Callers that require the complete collection must
request pages until `nextCursor` is `null`.

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

## `renku studio start`

Start the local browser Studio in the foreground.

```bash
renku studio start
renku studio start --no-browser
```

The default command binds the canonical local Studio URL at
`http://localhost:5173`, opens the system browser, and remains attached until
the user stops it. `--no-browser` starts the same server without opening a
browser. Renku does not install or launch an Electron/native desktop app.

## `renku studio stop`

Stop the local Studio server started by `renku studio start` or the canonical
Studio development server. The command waits for the server to release its
runtime descriptor before reporting success. It reports when no server is
running. Closing the browser tab does not stop the server.

```bash
renku studio stop
renku studio stop --json
```

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
- JSON output includes `agent.serverPolicy: "foreground"` and
  `agent.browserUrl`. Reuse a fresh canonical server. When the user asks to start
  Studio and none is running, run `renku studio start` in a dedicated visible
  terminal window that remains open independently of the agent task.
- Verify the server status and browser page after launching. The terminal can
  be minimized; stopping its command or closing its session stops Studio.
  Browser interaction depends on the tools available in the active agent host.

## `renku update [skills]`

Run from an interactive Terminal or PowerShell window:

```bash
renku update
renku update skills
```

`renku update` downloads and checksum-verifies the latest beta runtime, activates
it, and installs the latest Renku skills into the agents selected in setup.
Stop Studio with `renku studio stop` or Ctrl+C first; `UPDATE004` reports a
running Studio instance.
When that runtime version is already active, it is retained and skills setup
still runs. Previous version folders, configuration, and Projects are preserved.

`renku update skills` only runs Renku skills setup using the installed private
Node, skills installer, and Git tools. It does not download or replace the runtime, and Studio
may remain open. Restart the agent and start a new conversation afterward.
Neither command updates unrelated skill repositories or requires a system npm.

These commands operate on the installed application, not a Project or Studio
selection. They do not support `--json` because skills setup is interactive.
`UPDATE001` reports missing installation metadata or updater files; `UPDATE002`
reports an unsupported OS; `UPDATE003` reports an installer failure. A skills
failure may occur after a successful runtime update and can be retried with
`renku update skills`.

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

### Manual FDX Refresh Versus Studio Detection

`renku screenplay import-fdx --file /absolute/path/to/script.fdx --json` remains
an explicit immediate import. It has no review flag or approval token and may
replace an affected Scene and all its nested identities even for a punctuation
edit. Historical production work stays attached to old identities.

For the interactive Studio workflow, export to the exact path shown by
**External screenplay**: `<project>/screenplay/edit/script.fdx`. Studio detects,
reviews, and confirms that version. Do not automatically invoke the CLI to
bypass a pending Studio review, and never overwrite a retained source Asset.

### Previs timeline documents

`shot-plan previs register` validates a supplied candidate `playback.json` before
writing a revision. `shot-plan previs show --json` projects the same typed timeline:
`frameRate: {numerator, denominator}`, `frameCount`, `segments: [{id, startFrame,
label}]`, `subjects: [{key, label, color}]`, and `cues`.
Dialogue cues use `{id, kind: "dialogue", startFrame, endFrame?, speaker, text,
audio?}`. Action cues use `{id, kind: "action", startFrame, subject?, text}`;
Camera cues use `{id, kind: "camera", startFrame, text}`. Exact optional audio is
`{assetId, assetFileId, offsetSeconds?}`. Positions are zero-based integer frames;
ends are exclusive. First segment starts at zero; later starts are cuts.
See ADR 0096. No additional commands or flags are required. Missing playback is
valid; malformed supplied timelines report `CORE_PREVIS_PLAYBACK_INVALID`.

## Personal media models

These commands are global and work without a Project, credentials, or running Studio:

```bash
renku generation models list [--route-index <bundled-index> ...] [--provider <id>] --json
renku generation models show --provider <id> --model <exact-api-id> [--route-index <bundled-index> ...] --json
renku generation models import --file <route.json> --if-revision <sha256-or-absent> --json
renku generation models remove --provider <id> --model <exact-api-id> --if-revision <sha256-or-absent> --json
```

Import JSON contains exactly `provider`, `apiId`, and `name`. Read the library
first and pass its revision, or `absent` for null. The installed media engine
supplies accepted provider identities. No guide or authenticated request is needed.

`list` returns `{ revision, libraryPath, routeCatalogSha256, routes }`; each route
has the three fields plus `source` and `hasBundledEntry`. Repeated route indexes
supply bundled choices; omission lists personal entries only. The digest covers
the complete effective list before filtering by provider.

`show` returns `{ revision, libraryPath, route, personalGuidePath }`; `route` is
null for an unlisted identity. The Markdown path does not imply a file exists.
Mutations return `{ revision, libraryPath, provider, apiId }`. Removal affects
only personal discovery and preserves notes. Stale revisions and busy locks fail
with structured errors; see [library recovery](../architecture/media-model-library.md).
