# 0032 Scene Shot List CLI, Skill, And Data Model

Date: 2026-05-29

Status: implemented

## Goal

Add durable, agent-authored shot lists for individual screenplay scenes.

The first implementation should let a Codex agent:

1. read a scene-specific shot-design context through the Renku CLI;
2. inspect the scene screenplay blocks, dialogue, referenced cast, referenced
   locations, selected cast/location visual references, and the active Lookbook;
3. incorporate additional user direction such as "make the coverage feel like
   Wes Anderson" or "give me more reaction shots";
4. author a structured `kind: "sceneShotList"` JSON document;
5. validate the document against the current scene, cast, locations, and active
   Lookbook context;
6. persist the shot list as scene-owned project state;
7. mark the written shot list as the active shot list for that scene;
8. optionally generate one storyboard sheet for the full shot list through the
   existing persisted media-generation workflow;
9. preserve the original storyboard sheet and attach imported sliced storyboard
   images to the relevant shots in the relevant shot list;
10. notify any running Studio UI through scoped Studio resource events.

The user-facing workflow is a creative conversation. The CLI and JSON contracts
exist so the agent can persist the agreed scene coverage instead of leaving it
only in chat.

This plan intentionally does not implement the Studio UI. Browser rendering is
planned separately in
`plans/active/0033-scene-shot-list-ui.md`.

## References

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/json-storage-validation.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/cli/commands.md`
- `docs/decisions/0024-keep-media-slicing-out-of-app-state.md`
- `plans/active/0015-screenplay-cast-location-database-schema.md`
- `plans/active/0016-screenplay-json-cli-commands.md`
- `plans/active/0023-visual-language-lookbook-cli-and-skill.md`
- `plans/active/0025-generation-options-and-persisted-specs.md`
- `plans/active/0030-screenplay-analysis-cli-and-skill.md`
- `https://www.studiobinder.com/blog/what-is-a-shot-list-example/`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/lookbook-designer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-analyst/SKILL.md`

The StudioBinder reference is used as a current filmmaking reference for common
shot-list fields: shot description, scene and shot numbers, shot type, camera
angle, movement, equipment, framing, location, setup time, audio notes, and prop
notes. Renku does not need to copy that exact worksheet shape. The
agent-authored document should preserve the same shot-design intent while
omitting analog crew logistics that do not apply to AI-generated production.

## Product Scope

The feature is for scene coverage design and storyboard visualization.

Supported user intents:

- "Split this scene into shots."
- "Create a shot list for the selected scene."
- "Make this scene feel more symmetrical and deadpan, like Wes Anderson."
- "Give me a more anxious handheld version of the same scene."
- "Generate a storyboard sheet for this scene's active shot list."
- "Regenerate the storyboard sheet as realistic frames instead of charcoal
  pencil."
- "Use the active Lookbook unless I override it."

The first implementation should support scene-level shot planning, not final
editing. A Shot List says what coverage should be captured or generated. It is
not the final cut order and not a rendered timeline.

The agent should be able to iterate conversationally before persistence. It
should only call `write` when the user asks for a durable shot list or the
conversation clearly implies saving the result to the project.

## Resolved Product Decisions

The first implementation follows these user-reviewed decisions:

1. **Shot is the canonical term.** Shot is the industry term and should replace
   the old production-unit term in current documentation. This plan must not
   introduce new references to that old term, and the implementation
   documentation pass should retire remaining current-document references where
   they conflict with the Shot direction.

2. **Shot lists are history entries.** Every `write` creates a new scene-owned
   shot-list history row. Each scene has one active shot list so users and
   agents can roll back by setting an earlier shot list active.

3. **Default Lookbook context is text only.** The shot-list context includes the
   active Lookbook's text sections by default. Agents may inspect visual
   references only when the user asks for that interaction through the skill and
   CLI workflow.

4. **Storyboard images attach to shot ids.** Per-shot storyboard images belong
   to a specific `shotId` inside a specific shot list. Studio should be able to
   display those images under the intended Shot.

5. **Storyboard generation is one compound sheet per shot list.** All shots in a scene
   shot list should be storyboarded with a single image-model provider call that
   produces a structured storyboard grid for the whole shot list. The skill owns
   all grid prompting, visual inspection, crop decisions, and slicing. The import
   should follow the intended Location Environment Sheet ownership pattern: one
   compound storyboard sheet Asset owns the original sheet file and all sliced
   shot files. Core and Studio must not store crop boxes, extraction confidence,
   extraction methods, grid cell coordinates, or other slicing mechanics.

6. **Charcoal pencil is the default visualization style.** The default style is
   charcoal pencil storyboard illustration. The app and core contracts store
   only the selected style and factual context; the detailed prompt structure
   for producing that style belongs in the skill references.

7. **Shot labels are derived by the app.** The shot-list JSON stores stable
   `shotId` values and relies on array order for display labels. Studio can
   derive labels such as `Shot 1`, `Shot 2`, or a later display convention
   without storing duplicate label text.

8. **Analog setup logistics are out of scope.** The v1 document should not
   model setup minutes, equipment checkout, crew assignment, company moves,
   call-sheet timing, or other physical-production logistics. Those fields are
   useful for live-action production worksheets, but they add noise for the
   current AI-generated production workflow.

9. **Aspect ratio follows the project by default.** Shots inherit the project
   aspect ratio unless a director intentionally specifies a different aspect
   ratio for a shot-specific visual effect. The shot-list JSON should store only
   deliberate per-shot aspect-ratio overrides, not duplicate the project default
   on every shot.

## Naming

Use **Scene Shot List** for the durable scene-owned planning document.

Use **Shot** for one planned camera unit inside that document.

Reasons:

- the user asked for "shots" and "shot list";
- the object belongs to a Scene;
- "Shot List" is the standard filmmaking term for the planning document;
- the name keeps camera planning aligned with common production language.

Do not use:

- `Storyboard` as the main durable document name, because storyboard images are
  optional outputs of a shot list;
- `Coverage Plan` as the schema or command name, because it is less familiar to
  users and less aligned with the cited shot-list reference;
- `ShotPlan`, `ShotDesignData`, `SceneShotManager`, or other placeholder names.

Use US English in commands and contracts. Do not add British-English aliases.

## Product Workflow

The standard agent workflow:

1. The user asks Codex to design shots for a scene.
2. Codex uses the `scene-shot-designer` skill.
3. The skill resolves the current project and the target scene.
4. The skill calls:

   ```bash
   renku screenplay shot-list context --scene <scene-id> --json
   ```

5. Codex reads:

   - screenplay title and scene hierarchy;
   - scene setting and story function;
   - ordered scene blocks, including dialogue;
   - referenced cast and location records;
   - active Lookbook text sections;
   - previous or active shot list summary when one exists.

   By default, this is text context only. If the user explicitly asks the agent
   to use visual references, the skill may request visual reference metadata
   through the CLI and inspect those project-owned files before revising the
   shot list.

6. Codex asks clarifying questions only when the missing choice changes the
   coverage strategy.
7. Codex authors a complete `kind: "sceneShotList"` document.
8. The skill validates:

   ```bash
   renku screenplay shot-list validate --file <shot-list-json> --json
   ```

9. The skill fixes validation issues until valid.
10. The skill writes:

    ```bash
    renku screenplay shot-list write --file <shot-list-json> --json
    ```

11. Core validates references, stores a new history row, marks it active for the
    scene, and emits Studio resource keys.
12. Studio refreshes the scene Shots tab.

Storyboard generation remains a separate, optional step:

1. The user asks for storyboard images for the scene shot list.
2. The skill uses the `media-producer` workflow with the new
   `scene.storyboard-sheet` purpose.
3. The generation spec describes the whole shot-list grid and is persisted,
   estimated, approved, and run.
4. The generated storyboard sheet is inspected by the agent.
5. The skill slices the sheet into one file per shot, preserving the original
   sheet file.
6. The sheet and per-shot files are imported together. Core attaches the sheet
   to the shot list and each sliced image to the intended `shotId`.

## Shot Design Guidance

The skill should include concise original guidance in
`references/shot-design-guidelines.md`. The guidance should be practical enough
for directors, screenwriters, and generation agents.

The guidance should cover:

- **Dramatic beat first.** Split shots around changes in objective, power,
  reveal, emotion, or information, not around arbitrary dialogue chunks.
- **Coverage as options.** Include establishing geography, primary action,
  dialogue coverage, reactions, inserts, and transitions only where they serve
  the scene.
- **Audience attention.** Identify what the viewer should notice in each shot:
  a face, a hand, a prop, a doorway, a silence, a status shift, or a threat.
- **Dialogue and reaction.** Dialogue shots should note who speaks, who listens,
  and which reactions matter. Not every line needs its own shot.
- **Screen direction and geography.** Maintain eye lines, crossing behavior,
  subject position, and location orientation unless breaking them is an
  intentional creative choice.
- **Visual language translation.** Translate named references and Lookbook
  guidance into usable decisions: framing, symmetry, movement, distance,
  palette, light behavior, texture, and lens feel.
- **Editorial usefulness.** A good shot list should give future editing or
  generation enough coverage to vary rhythm without inventing new story beats.
- **Restraint.** Avoid bloated shot counts when a long take, tableau, or
  controlled master better serves the scene.
- **Storyboard defaults.** Use charcoal pencil storyboard images by default and
  arrange all shots in one clearly segmented grid. The detailed wording for
  charcoal technique, grid prompting, cell labels, and slicing instructions
  belongs in the skill references, not in Studio app or core code.

If the user names a filmmaker or visual reference, the skill should translate
that reference into concrete mechanics without claiming unsupported facts. For
example, a user request for Wes Anderson-style framing may become centered
blocking, planimetric compositions, symmetrical object placement, restrained
lateral movement, and deliberate color separation when that matches the active
Lookbook and scene.

## Scene Shot List JSON Document

Add a browser-safe contract in:

```text
packages/core/src/client/scene-shot-list.ts
packages/core/src/client/scene-shot-list-json-schemas.ts
```

Suggested v1 shape:

```json
{
  "kind": "sceneShotList",
  "sceneId": "scene_abc",
  "title": "Ada confronts the empty control room",
  "summary": "A restrained coverage plan that starts with institutional distance and ends in intimate uncertainty.",
  "coverageStrategy": "Begin with the room geometry, then tighten toward Ada's face and hands as the silence becomes evidence.",
  "lookbookInfluence": "Use the active Lookbook's cold practical light and centered institutional framing.",
  "shots": [
    {
      "shotId": "shot_001",
      "title": "Empty room establishes the absence",
      "storyBeat": "Ada enters expecting a person and finds the room abandoned.",
      "narrativePurpose": "Establish geography, absence, and emotional distance.",
      "description": "Wide static frame from the doorway with Ada small against the control consoles.",
      "shotType": "wide",
      "cameraAngle": "eyeLevel",
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
  "openQuestions": [
    "Should the final reaction be held as a long close-up or broken by an insert?"
  ]
}
```

Rules:

- `kind` must be `sceneShotList`.
- `sceneId` must reference an existing current scene.
- `shots` must contain at least one shot.
- `shotId` values are durable within the shot list and must be unique.
- Shot display labels are derived by Studio from array order and are not stored
  in the JSON document.
- `coveredBlockIndexes` reference indexes in the current scene's ordered blocks.
- `castMemberIds` and `locationIds` must reference existing current project
  records.
- Every `castMemberId` should either appear in the scene's references or be
  deliberately justified in `productionNotes`.
- Every `locationId` should either appear in the scene setting/block references
  or be deliberately justified in `productionNotes`.
- `aspectRatio` is optional. When omitted, the shot uses the project aspect
  ratio. Include it only for a deliberate shot-level aspect-ratio effect.
- Unknown fields are rejected.
- The document must not store absolute local paths.
- The document must not store generated image paths. Storyboard images are
  attached through media import and relationship tables.
- The document must not store analog setup logistics such as setup minutes,
  equipment lists, crew assignments, call-sheet timing, or company moves.

Keep shot-detail fields as strings for v1 rather than over-enumerating camera
language too early. The first version should accept useful director language
such as "locked-off symmetrical wide" or "slow push toward the unopened letter"
without forcing every term into a closed taxonomy.

Future camera controls can later introduce structured placement, motion,
framing, lens, and coverage fields. Do not add placeholder fields for those
future controls in v1, and do not add physical-production logistics unless the
product direction expands beyond AI-generated production.

## Semantic Validation

Add server-side parsing and semantic validation under a precise module name,
for example:

```text
packages/core/src/server/scene-shot-list-json/validator.ts
```

Validation should collect all actionable issues before failing.

Required checks:

- JSON Schema validation passes.
- `kind` is exactly `sceneShotList`.
- `sceneId` exists.
- Every `coveredBlockIndexes` entry is an integer within the current scene
  block range.
- `shotId` is unique within the document.
- Every referenced cast member exists.
- Every referenced location exists.
- Referenced cast/location records are present in the context report.
- The shot order is the array order.
- Required text fields are non-empty.
- `aspectRatio`, when present, is non-empty.
- The document does not contain image file paths or absolute paths.

Recommended warnings:

- a shot references no screenplay block;
- the full shot list leaves one or more dialogue blocks uncovered;
- a shot has dialogue text but does not cite a dialogue block index;
- a shot references a cast member or location outside the scene's current
  references without a note explaining why;
- no active Lookbook exists, so the agent used only screenplay/cast/location
  context.

Do not treat warnings as write blockers.

## Data Model Addition

Add two tables for shot-list history and active state.

```text
scene_shot_list
  id text primary key
  scene_id text not null references scene(id) on delete cascade
  title text not null
  document text not null
  created_at text not null
  updated_at text not null

scene_shot_list_state
  scene_id text primary key references scene(id) on delete cascade
  active_shot_list_id text references scene_shot_list(id) on delete set null
  created_at text not null
  updated_at text not null
```

Notes:

- `document` stores the validated `kind: "sceneShotList"` JSON document.
- `title` is duplicated as a small queryable summary and should match the
  document title.
- A scene can have many historical shot lists.
- Each scene can have zero or one active shot list.
- Deleting a scene cascades its shot lists and active state.
- Deleting an active shot list sets the scene's active pointer to null.
- No JSON document may be written without AJV validation before persistence and
  after reads.

Add one table for preserved storyboard sheets and one table for the sliced
per-shot image files that belong to individual shots.

This should follow the intended ownership pattern for compound sheet assets:

- one compound Asset represents the whole sheet;
- the original generated sheet and every slice are Asset Files under that one
  Asset;
- the sheet table points to the compound Asset and original sheet Asset File;
- the per-shot table points to the sliced Asset File for each Shot.
- cropping and slicing are agent responsibilities and are not represented in
  Studio schema.

Do not copy existing or historical Location Environment Sheet crop/extraction
metadata into this model. If such fields exist in current location code, treat
that as a separate cleanup issue, not as a precedent for Shot List storage.

```text
scene_shot_storyboard_sheet
  id text primary key
  shot_list_id text not null references scene_shot_list(id) on delete cascade
  asset_id text not null references asset(id) on delete cascade
  sheet_file_id text not null references asset_file(id)
  created_at text not null
  updated_at text not null

scene_shot_storyboard_image
  id text primary key
  storyboard_sheet_id text not null references scene_shot_storyboard_sheet(id) on delete cascade
  shot_id text not null
  asset_file_id text not null references asset_file(id)
  position integer not null
  created_at text not null
  updated_at text not null
```

Suggested constraints:

- unique `scene_shot_storyboard_sheet.asset_id`;
- index `(shot_list_id, created_at, id)` for storyboard sheets;
- unique `(storyboard_sheet_id, shot_id)`;
- unique `scene_shot_storyboard_image.asset_file_id`;
- index `(storyboard_sheet_id, position, id)`.

The `shot_id` column references a value inside the validated shot-list JSON, so
it cannot be a database foreign key. Core validation must check that the
`shot_id` exists in the target shot list before inserting a storyboard image
relationship.

Storyboard sheet and sliced shot image files should be registered as one
compound Asset through the shared asset tables and attached to the Scene asset
target:

```ts
{ kind: 'scene', sceneId: '<scene-id>' }
```

Use Asset and Asset File roles such as:

```text
asset.type = scene_storyboard_sheet
scene_asset.role = storyboard_sheet
asset_file.role = sheet
asset_file.role = shot
```

Do not add a generic shot asset target in v1. The shot id is scoped to one
validated shot-list JSON document, and the database relationship table records
the connection between a sliced Asset File and that scoped shot id.

Migration rules:

- Edit the Drizzle schema in `packages/core/src/server/schema/`.
- Generate the SQL migration with Drizzle Kit from `packages/core`.
- Do not hand-write a TypeScript migration registry.
- Do not copy generated SQL into TypeScript files.
- Decide during implementation whether the new tables require a project-store
  schema-generation increment under
  `docs/architecture/reference/drizzle-migrations.md`.
- Do not add compatibility readers for old shot-list shapes, because no
  previous shape exists.

## Core Contract Additions

Add client contracts:

```text
packages/core/src/client/scene-shot-list.ts
packages/core/src/client/scene-shot-list-json-schemas.ts
```

Suggested types:

```ts
export interface SceneShotListDocument {
  kind: 'sceneShotList';
  sceneId: string;
  title: string;
  summary: string;
  coverageStrategy: string;
  lookbookInfluence?: string;
  shots: SceneShot[];
  openQuestions?: string[];
}

export interface SceneShot {
  shotId: string;
  title: string;
  storyBeat: string;
  narrativePurpose: string;
  description: string;
  shotType: string;
  cameraAngle?: string;
  cameraMovement?: string;
  framing?: string;
  lensIntent?: string;
  aspectRatio?: string;
  subject: string;
  action: string;
  dialogue: SceneShotDialogueReference[];
  coveredBlockIndexes: number[];
  castMemberIds: string[];
  locationIds: string[];
  audioNotes?: string;
  productionNotes?: string;
}

export interface SceneShotDialogueReference {
  blockIndex: number;
  lineIndexes?: number[];
  castMemberId?: string;
  purpose: string;
}
```

Add command report types:

```ts
export interface SceneShotListContextReport
export interface SceneShotListListReport
export interface SceneShotListReadReport
export interface SceneShotListValidationReport
export interface SceneShotListWriteReport
export interface SceneStoryboardSheetImportReport
```

The context report should include:

- project identity;
- project default aspect ratio;
- screenplay title and scene hierarchy;
- scene narrative blocks;
- scene setting and story function;
- referenced cast member details;
- referenced location details;
- active Lookbook text sections, or `null`;
- active shot list summary, or `null`;
- resource keys.

It should not include:

- absolute paths inside authored JSON;
- visual asset references by default;
- unrelated cast or location records;
- full generated media history;
- UI state beyond the current authoring project;
- future camera-control placeholder structures.

When the user explicitly asks the agent to use visual references, the context
command may accept:

```bash
renku screenplay shot-list context \
  --scene <scene-id> \
  --include-visual-references \
  --json
```

With that flag, the report may include selected cast image references, selected
location environment sheet references, and active Lookbook image references.
The default must remain text-only so ordinary shot-list design is not coupled to
image inspection.

## CLI Command Surface

Add a concise command group under `screenplay`, because shot lists belong to
screenplay scenes:

```bash
renku screenplay shot-list context --scene <scene-id> --json
renku screenplay shot-list list --scene <scene-id> --json
renku screenplay shot-list show --active --scene <scene-id> --json
renku screenplay shot-list show --shot-list <shot-list-id> --json
renku screenplay shot-list validate --file <shot-list-json> --json
renku screenplay shot-list validate --file - --json
renku screenplay shot-list write --file <shot-list-json> --json
renku screenplay shot-list write --file - --json
renku screenplay shot-list set-active --scene <scene-id> --shot-list <shot-list-id> --json
```

Behavior:

- All commands require a current authoring project.
- Commands that need screenplay content fail with the existing no-screenplay
  structured diagnostic.
- Commands that need a scene fail when the scene id does not exist.
- `validate` does not write.
- `write` creates a new shot-list history row and makes it active for its
  scene.
- `show --active --scene <scene-id>` returns `{ "shotList": null }` when no
  active shot list exists.
- `show --shot-list <id>` fails when the id does not exist.
- `set-active` requires the shot list to belong to the scene.
- No command alias is added.

Add flags:

```text
--scene
--shot-list
--file
--include-visual-references
--json
```

Use `--shot-list`, not `--list`, because `list` is already a command action and
the flag should name the domain object.

Update:

```text
docs/cli/commands.md
packages/cli/src/cli.ts
packages/cli/src/commands/screenplay-command.ts
packages/cli/src/cli.test.ts
```

## Studio Coordination

After `write`, `set-active`, and storyboard sheet import, append scoped
resource-change events.

Suggested resource keys:

```text
surface:scene:<scene-id>:shots
scene-shot-list
scene-shot-list:<shot-list-id>
scene-shot-list:<shot-list-id>:storyboard-sheet:<sheet-id>
scene-shot-list:<shot-list-id>:shot:<shot-id>
scene:<scene-id>
```

The event is a Studio UI coordination signal only. It is not durable project
history; the durable shot list, storyboard sheet, and per-shot storyboard image
relationships are already stored in SQLite.

If event append fails after the SQLite write, the command should report the
mutation success and the coordination warning using the existing command-report
pattern. Do not roll back SQLite writes because Studio event append failed.

## Storyboard Sheet Generation Purpose

Add a new media purpose:

```text
scene.storyboard-sheet
```

Target format:

```text
scene:<scene-id>
```

The purpose generates one structured storyboard grid for all shots inside one
scene shot list. It does not generate one provider request per shot.

Suggested context command:

```bash
renku generation context \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --json
```

Suggested model list command:

```bash
renku generation model list \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --json
```

Add CLI flags:

```text
--shot-list
```

This flag is required for `context` and `model list` for this purpose. The
persisted spec should include `shotListId` so estimate and run commands can
resolve the active shot-list context from the spec id. It should not include
grid cell coordinates or crop instructions; those belong in the skill-authored
prompt and slicing workflow.

Suggested spec shape:

```json
{
  "purpose": "scene.storyboard-sheet",
  "target": { "kind": "scene", "id": "scene_abc" },
  "shotListId": "scene_shot_list_abc",
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A complete charcoal pencil storyboard sheet laid out as a clean grid...",
  "visualizationStyle": "charcoalPencil",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Scene storyboard sheet"
}
```

Allowed `visualizationStyle` values:

```text
charcoalPencil
lookbookIllustration
realistic
custom
```

Rules:

- `charcoalPencil` is the default when the user does not specify a style.
- The detailed prompt structure for charcoal pencil style, grid clarity, panel
  ordering, and cell boundaries lives in the `scene-shot-designer` skill
  references, not in Studio app code or core generation code.
- `lookbookIllustration` should still read as storyboard visualization while
  borrowing active Lookbook palette, light, texture, and framing.
- `realistic` should be used only when the user asks for realistic frames.
- `custom` requires the prompt to include the custom style instruction.
- The prompt should instruct the provider to create one clean panel per shot in
  the shot-list order. The skill owns the exact wording.
- `takeCount` is fixed to `1` for v1 so one generation run produces one
  storyboard sheet to slice and import.
- User-selected model, seed, frame, detail, and output format remain binding.
- The final provider payload must still validate against the provider model's
  JSON Schema before estimate or execution.

Suggested import command:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --file <storyboard-sheet-import-json> \
  --json
```

Import document shape:

```json
{
  "kind": "sceneStoryboardSheetImport",
  "sheet": {
    "source": "generated/media/storyboards/scene_abc-sheet.png",
    "title": "Scene storyboard sheet"
  },
  "shots": [
    {
      "shotId": "shot_001",
      "source": "generated/media/storyboards/scene_abc-shot_001.png",
      "title": "Shot 1"
    }
  ]
}
```

Import behavior:

- every source file must be a project-relative path inside the project;
- the import requires the original generated sheet file and one sliced image
  file for every shot in the shot list;
- core copies the files to a project-owned storyboard folder;
- core registers one compound `asset` with type `scene_storyboard_sheet`;
- core registers the original sheet and every sliced shot image as `asset_file`
  rows under that one Asset;
- core attaches the compound Asset to the Scene with role `storyboard_sheet`;
- core inserts one `scene_shot_storyboard_sheet` row that points to the compound
  Asset and original sheet Asset File;
- core inserts one `scene_shot_storyboard_image` row per sliced shot image that
  points to the sliced Asset File;
- the import report returns the imported compound sheet Asset, per-shot Asset
  File mappings, shot-list id, scene id, and resource keys.

Suggested durable file layout:

```text
<project>/
  screenplay/
    storyboards/
     <scene-label>/
        <storyboard-sheet-file>
        <shot-image-file>
```

The folder label is for human readability only. SQLite owns identity and
relationships.

## Core Service Implementation

Add project data service contracts for shot lists:

```ts
readSceneShotListContext(input)
listSceneShotLists(input)
readSceneShotList(input)
validateSceneShotList(input)
writeSceneShotList(input)
setActiveSceneShotList(input)
importSceneStoryboardSheetMedia(input)
```

Add media generation contracts for storyboard sheets:

```ts
buildSceneStoryboardSheetContext(input)
listSceneStoryboardSheetModels(input)
validateSceneStoryboardSheetSpec(input)
createSceneStoryboardSheetSpec(input)
updateSceneStoryboardSheetSpec(input)
readSceneStoryboardSheetSpec(input)
listSceneStoryboardSheetSpecs(input)
prepareSceneStoryboardSheetSpec(input)
estimateSceneStoryboardSheetSpec(input)
runSceneStoryboardSheetSpec(input)
recordSceneStoryboardSheetRun(input)
```

Implementation files likely touched:

```text
packages/core/src/client/index.ts
packages/core/src/client/media-generation.ts
packages/core/src/client/scene-shot-list.ts
packages/core/src/client/scene-shot-list-json-schemas.ts
packages/core/src/server/schema/
packages/core/src/server/database/access/scene-shot-lists.ts
packages/core/src/server/database/access/media-generation.ts
packages/core/src/server/scene-shot-list-json/validator.ts
packages/core/src/server/commands/scene-shot-list-commands.ts
packages/core/src/server/media-generation/scene-storyboard-sheet.ts
packages/core/src/server/project-data-service-contracts.ts
packages/core/src/server/project-data-service-wiring/
packages/cli/src/commands/generation-command.ts
packages/cli/src/commands/media-command.ts
packages/cli/src/commands/screenplay-command.ts
```

Use the exact local folder structure found at implementation time.

Do not add a generic media-purpose registry or adapter layer. Follow the current
direct `switch` pattern in `generation-command.ts` and `media-command.ts` until
there is real duplication that justifies a shared abstraction.

## Skill Project

Add a new skill under the external Studio Skills project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/scene-shot-designer
```

Recommended structure:

```text
scene-shot-designer/
  SKILL.md
  agents/
    openai.yaml
  references/
    shot-list-cli-workflow.md
    scene-shot-list-json-contract.md
    shot-design-guidelines.md
    storyboard-sheet-generation-workflow.md
  scripts/
    slice_storyboard_grid.py
  samples/
    scene-shot-list.json
    storyboard-sheet-spec.json
    storyboard-sheet-import.json
```

Follow `skill-creator` guidance:

- keep `SKILL.md` short and operational;
- put the JSON contract, CLI workflow, generation workflow, and craft guidance
  in references;
- do not add a README or auxiliary docs;
- generate or update `agents/openai.yaml` so the skill appears correctly in the
  Studio Skills UI;
- keep samples valid against the current schema.

Suggested skill description:

```yaml
name: scene-shot-designer
description: Design and persist Renku Studio Scene Shot Lists by reading scene screenplay context, referenced cast and locations, active Lookbook guidance, and user direction, then optionally generate one storyboard sheet for the shot list and slice it into per-shot images through Renku media generation.
```

Skill workflow:

1. Resolve or open the current project.
2. Resolve the target scene from the user's explicit scene id, selected Studio
   scene, or a single clear scene match.
3. Read shot-list context:

   ```bash
   renku screenplay shot-list context --scene <scene-id> --json
   ```

4. Inspect the scene's blocks, dialogue, referenced cast, referenced locations,
   and active Lookbook text. Inspect visual references only when the user asks
   the agent to use them.
5. When visual references are explicitly requested, rerun context with
   `--include-visual-references` and inspect the returned project-owned files.
6. Ask only for missing creative choices that materially change coverage.
7. Decide a coverage strategy.
8. Author a complete `kind: "sceneShotList"` JSON document.
9. Validate.
10. Fix validation issues.
11. Write.
12. Read back the active shot list and summarize the coverage.

Storyboard sheet workflow:

1. Read the active shot list.
2. Confirm the user wants a storyboard sheet for the full shot list.
3. Use `renku generation context` and `renku generation model list` for
   `scene.storyboard-sheet`.
4. Choose a grid that fits every shot in the active shot list.
5. Write one persisted generation spec for the full shot-list grid.
6. Estimate and get approval before paid generation.
7. Run with `--simulate` for dry validation or with the approval token for paid
   generation.
8. Inspect the generated storyboard sheet.
9. Slice the sheet into one project-relative image file per shot, using
   `scripts/slice_storyboard_grid.py` or the documented equivalent workflow.
10. Inspect the sliced images and confirm each cell represents the intended
   shot.
11. Import the original sheet and sliced shot images with
   `renku media import --purpose scene.storyboard-sheet`.

Skill non-negotiables:

- do not write directly to `.renku/project.sqlite`;
- do not mutate the screenplay scene while designing shots;
- do not invent cast, location, scene, shot-list, or shot ids;
- do not store generated image paths in shot-list JSON;
- do not add analog production logistics such as setup minutes, equipment
  checkout, crew assignments, call-sheet timing, or company moves;
- use the project aspect ratio by default and write a shot-level `aspectRatio`
  only when the user or coverage design intentionally calls for a different
  ratio;
- do not run paid generation without estimate and approval;
- validate before write;
- use the active Lookbook when present unless the user overrides it;
- use charcoal pencil storyboard visualization by default unless the user asks
  for another style;
- generate one storyboard sheet for the full shot list, then slice it into
  per-shot files before import;
- preserve the original storyboard sheet file during import;
- keep charcoal-pencil prompt structure, grid-prompting rules, and slicing
  procedure in the skill references and scripts, not in Studio app or core code;
- translate named references into concrete framing, movement, blocking, light,
  and texture decisions.

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/README.md
docs/architecture/reference/studio-skills.md
```

## Documentation

Update:

```text
docs/cli/commands.md
docs/architecture/data-model-and-storage.md
docs/architecture/reference/domain-vocabulary.md
docs/architecture/reference/studio-skills.md
```

The documentation pass must also retire conflicting current-document references
to the old production-unit term and align the narrative hierarchy around Shots.
Do not keep old-term aliases or compatibility language.

Add a decision record only after implementation direction is accepted. Suggested
ADR topic:

```text
Use scene-owned Shot Lists for agent-authored coverage design.
```

## Tests

Add core tests covering:

- schema validation succeeds for a valid `kind: "sceneShotList"` document;
- missing required fields produce structured diagnostics;
- unknown fields are rejected;
- unknown scene id is rejected;
- duplicate `shotId` values are rejected;
- invalid block indexes are rejected;
- unknown cast member references are rejected;
- unknown location references are rejected;
- dialogue references must point at dialogue blocks when line indexes are
  present;
- write persists a new shot-list row;
- write sets the new row active for the scene;
- previous shot lists remain in history;
- set-active changes the active shot list;
- set-active rejects a shot list from another scene;
- stored JSON is validated after database read;
- validation failure performs no database mutation;
- storyboard sheet import rejects an unknown shot-list id;
- storyboard sheet import rejects missing sliced files for any shot in the shot
  list;
- storyboard sheet import rejects a shot id not present in the shot list;
- storyboard sheet import registers one compound Asset with original and sliced
  Asset Files;
- storyboard sheet import inserts a sheet row pointing to the original sheet
  Asset File;
- storyboard sheet import inserts shot-image rows pointing to sliced Asset
  Files.

Add media generation tests covering:

- `scene.storyboard-sheet` context includes scene, active shot list, relevant
  cast/location context, active Lookbook text guidance, and defaults;
- model list returns supported image models;
- spec validation rejects unsupported styles;
- provider payload validation runs before estimate/run;
- `charcoalPencil` is preserved as a style value without app/core-owned prompt
  wording;
- user-selected binding options are preserved, with storyboard-sheet
  `takeCount` fixed to `1`.

Add CLI tests covering:

- `renku screenplay shot-list context --scene <id> --json`;
- `renku screenplay shot-list context --scene <id> --include-visual-references --json`;
- `renku screenplay shot-list validate --file <path> --json`;
- `renku screenplay shot-list validate --file - --json`;
- `renku screenplay shot-list write --file <path> --json`;
- `renku screenplay shot-list write --file - --json`;
- `renku screenplay shot-list list --scene <id> --json`;
- `renku screenplay shot-list show --active --scene <id> --json`;
- `renku screenplay shot-list show --shot-list <id> --json`;
- `renku screenplay shot-list set-active --scene <id> --shot-list <id> --json`;
- no-project failure;
- no-screenplay failure;
- missing scene flag failure;
- missing shot-list flag failure;
- invalid JSON diagnostics;
- invalid reference diagnostics;
- Studio resource keys returned after write and set-active;
- `renku generation context --purpose scene.storyboard-sheet ...`;
- `renku generation model list --purpose scene.storyboard-sheet ...`;
- `renku media import --purpose scene.storyboard-sheet ...`;
- no obsolete aliases.

Add skill validation by running through a sample project:

- open a project with screenplay, cast, locations, and an active Lookbook;
- run the skill workflow manually with the sample scene;
- confirm validation catches an intentionally broken block index;
- confirm validation catches an intentionally broken cast id;
- confirm a valid sample writes and becomes active;
- confirm a simulated storyboard sheet generation spec validates;
- confirm the skill can slice a generated grid into one file per shot;
- confirm storyboard sheet import preserves the original sheet and attaches each
  sliced image to the intended shot.

## Implementation Checklist

- [x] Confirm this revised plan is accepted for implementation.
- [x] Add browser-safe Scene Shot List contract types.
- [x] Add browser-safe Scene Shot List JSON Schema constants.
- [x] Add Drizzle schema tables for `scene_shot_list`,
      `scene_shot_list_state`, `scene_shot_storyboard_sheet`, and
      `scene_shot_storyboard_image`.
- [x] Generate the SQL migration with Drizzle Kit.
- [x] Decide and apply any required project schema generation change.
- [x] Add server-side AJV parser and validator for `kind: "sceneShotList"`.
- [x] Add semantic validation against the current scene, cast, and locations.
- [x] Add database access functions for shot-list history, active state,
      storyboard sheet relationships, and per-shot storyboard image
      relationships.
- [x] Add core command handlers for context, list, show, validate, write, and
      set-active.
- [x] Keep shot-list context text-only by default and add explicit
      `--include-visual-references` behavior for user-requested visual
      inspection.
- [x] Add project-data-service contract and wiring entries.
- [x] Add CLI parsing for `renku screenplay shot-list`.
- [x] Ensure `write` creates a new history row and sets it active for the
      scene.
- [x] Append scoped Studio resource-change events after successful writes and
      active changes.
- [x] Add `scene.storyboard-sheet` to media-generation client contracts.
- [x] Add Scene Storyboard Sheet generation context, model list, validation,
      spec persistence, estimate, run, and record functions.
- [x] Add CLI parsing for `scene.storyboard-sheet` generation context/model
      list/spec/estimate/run behavior.
- [x] Add Scene Storyboard Sheet media import behavior for the original sheet
      plus per-shot sliced files using one compound Asset, without storing crop
      boxes, grid cells, or extraction metadata.
- [x] Append scoped Studio resource-change events after storyboard sheet import.
- [x] Return consistent JSON command reports and structured diagnostics.
- [x] Update `docs/cli/commands.md`.
- [x] Update architecture references after the contract is accepted.
- [x] Add the `scene-shot-designer` skill in the external Studio Skills
      project.
- [x] Add skill reference files and valid samples.
- [x] Add skill-owned storyboard sheet prompt guidance and slicing workflow.
- [x] Add or wire a skill script for slicing storyboard grids into per-shot
      files.
- [x] Add or regenerate `agents/openai.yaml`.
- [x] Update the Studio Skills README and architecture reference.
- [x] Add core tests for schema, semantic validation, persistence, active state,
      media generation, and storyboard sheet import.
- [x] Add CLI tests for all new commands and purpose behavior.
- [x] Run focused core and CLI tests.
- [x] Verify the skill can read context, validate output, write a shot list,
      create a simulated storyboard sheet spec, slice a grid, import the sheet
      and shot-image files as one compound Asset, and leave Studio ready to
      refresh.

## Resolved Decisions

- The CLI namespace is `renku screenplay shot-list`.
- The durable noun is Scene Shot List.
- The skill name is `scene-shot-designer`.
- The storyboard media purpose key is `scene.storyboard-sheet`.
- Shot lists belong to scenes and create history entries.
- One shot list can be active per scene.
- One storyboard provider call generates a full shot-list sheet.
- The skill slices the generated sheet into per-shot files before import.
- Storyboard import follows the intended compound-asset sheet pattern.
- The original storyboard sheet is preserved as an Asset File on the compound
  sheet Asset.
- Per-shot storyboard images attach to a `shotId` inside a specific shot list by
  pointing at sliced Asset Files.
- Core and Studio do not store crop boxes, grid cells, extraction confidence, or
  extraction methods; the skill owns visual inspection and slicing.
- Default storyboard visualization style is `charcoalPencil`.
- Charcoal-pencil prompt structure and grid/slicing guidance live in the skill
  references, not Studio app or core code.
- Shot labels are derived by Studio from shot order and are not stored in the
  shot-list JSON.
- The v1 shot document uses flexible director-language strings rather than
  closed camera-control enums.
- Implementation is split into this data/CLI/skill plan and the separate UI
  plan.
