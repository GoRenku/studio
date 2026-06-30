# 0093 Agent Take Video Prompt Routing And Codex Image Defaults

Status: implemented
Date: 2026-06-30
Implemented: 2026-06-30

## Implementation Notes

Implemented on 2026-06-30. Verification completed with focused core, CLI, and Studio tests plus root `pnpm check`. The implementation did not invoke paid provider generation, Codex image generation, or live Urban Basilica project mutations; those flows are represented by command contracts, import tests, and skill guidance.

## Summary

This plan fixes the workflow failures seen in Codex session
`019f1827-ff8d-7ab0-8b2e-61555f559e5e`.

The user asked the movie-director skill to work on the current shot take:

- create the missing take-owned visual prompt sheet before video generation,
  using the phrase "multi-shot storyboard" in the original request;
- use the existing take that was already being edited;
- preserve the existing four-shot continuous take;
- follow the drone move from city, to walls, to field, to cannon mouth;
- use Codex built-in `gpt-image-2` image generation instead of fal.ai.

The agent initially routed the request to Scene Shot List work and began
drafting a shot-list operation file. That was the wrong owner. The correct
owner was take-owned media input production:

```text
takeId: scene_shot_video_take_cdstd9w8
purpose: shot.video-prompt-sheet
take mode: continuous
ordered shot ids: shot_001, shot_001b, shot_001c, shot_002
owning skill: media-producer
owning Studio/Core domain: Scene Shot Video Take prepared inputs
```

The plan has two implementation targets:

- this repository, especially `packages/core`, `packages/cli`, and docs;
- the sister skills repository:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

The primary product outcome is that an agent should find an active take, route
take readiness and take-owned video-prompt/reference work to `media-producer`,
prefer Codex built-in image generation for image purposes when running in
Codex, and import finished Codex images through Renku without duplicate assets
or provider-cost mistakes.

## Root Cause

The phrase "multi-shot storyboard" overlaps two different Renku concepts:

- `scene.storyboard-sheet`, which creates actual storyboard images for a Scene
  Shot List. This name is film-native and should stay.
- the current take-owned purpose, previously named
  `shot.multi-shot-storyboard-sheet`, which creates an AI-video prompt/reference
  sheet for an existing Shot Video Take.

The original prompt contained stronger take signals than shot-list signals:

- "current shot take";
- "before we use the video generation";
- later correction: "there is a take I am already editing with 4 shots and set
  as continuous";
- later correction: "Do not try to change the shot list".

The agent over-weighted the word "storyboard" and under-weighted "take". It
then followed `scene-shot-designer` guidance, because that skill mentions
storyboard maintenance after shot-list revisions. The system should make this
mistake much harder in three ways:

1. Context should make active take state obvious.
2. Skill routing should treat active take language as a hard media-producer
   route.
3. CLI and skill workflows should provide the shortest correct path for
   take-owned video prompt inputs.

## Purpose Naming Decision

Keep:

```text
scene.storyboard-sheet
```

Rename the take-owned purpose directly to:

```text
shot.video-prompt-sheet
```

Rationale:

- `storyboard` is the correct user and film-industry word for scene-level
  storyboard images, so the scene purpose should not be renamed.
- The take-owned artifact is AI-video-specific. Its job is not ordinary
  storyboarding; its job is to give the video model a visual/text prompt sheet
  containing shot order, camera motion, geography, continuity, narration/dialogue
  notes, and model-facing instructions.
- `video-prompt-sheet` uses common AI-video vocabulary, avoids provider-specific
  names such as Seedance, and does not invent fake film jargon.
- The rename should be direct. Do not add compatibility purpose keys, aliases,
  compatibility loaders, or runtime warnings for the old purpose name. Update
  callers, samples, docs, skills, fixtures, and tests in the same implementation
  slice.

## Goals

- Make active take context prominent in `renku studio current --json` and
  `renku director context --json`.
- Treat broad requests such as "get this take ready for generation", "look at
  what is missing", "what does this take need", and "prepare this take" as
  take-readiness requests, not as requests to create a new Scene Shot List.
- Teach director routing that "current take", "take", "continuous",
  "multi-shot video", "input mode", "first frame", "last frame",
  "reference image", "video prompt sheet", and "ready for generation" are
  take-owned media or shot-video work, not Scene Shot List design.
- Keep `scene-shot-designer` scoped to Scene Shot Lists and scene storyboard
  image handoffs only.
- Make `media-producer` the direct owner for take-owned
  `shot.video-prompt-sheet` creation/import and take generation readiness
  conversations.
- Require the agent to discover and report missing take prerequisites from core
  context and preflight before asking the user for creative details or starting
  generation.
- Add a deterministic image execution policy so Codex runs default to Codex
  built-in image generation for image purposes unless the user or config says
  otherwise.
- Keep Claude, OpenCode, and other non-Codex harnesses honest: if they do not
  have built-in image generation, they should ask or use Renku-managed provider
  generation with estimate and approval.
- Add a smoother external-image import path so Codex-generated files can be
  staged, imported, selected, and optionally replace the previous selected input
  without manual copying and duplicate clutter.
- Improve structured diagnostics around shot-video input specs so agents see
  expected field values instead of guessing.
- Improve command help for nested generation commands that agents rely on.
- Make Studio refresh recovery explicit and safe after `CLI026`.

## Non-Goals

- Do not make Renku Core call Codex image generation. Codex built-in image
  generation is a harness capability, not a Renku provider adapter.
- Do not create a generic fallback where Renku silently runs fal.ai when Codex
  image generation is unavailable.
- Do not create compatibility aliases for old command names or old data shapes.
- Do not preserve `renku shot-list ...` as an alias for
  `renku screenplay shot-list ...`.
- Do not add route-local business rules in Studio server or React to decide
  whether a take input is valid. Core owns the rule.
- Do not let skills mutate `.renku/project.sqlite`, edit generated sidecar
  state, or bypass purpose-specific `renku media import`.
- Do not treat this as a mobile or responsive UI task.
- Do not add a new image-generation provider to `packages/engines` for Codex.
  Built-in Codex generation remains an external artifact source imported into
  Renku.

## Current Findings

### Studio And Director Context

`StudioSelection` already supports take edit state:

```ts
{
  type: "scene";
  id: string;
  sceneTab?: "narrative" | "shots" | "takes";
  shotId?: string;
  takeWorkspaceMode?: "list" | "new" | "edit";
  takeId?: string;
  shotTab?: SceneShotDetailTab;
}
```

`renku studio current --json` enriches shot-tab selections. It reports
take-oriented selection details when the active shot tab is `ai-production`, but
the scene-level context does not yet make these facts loud enough:

- active `takeWorkspaceMode`;
- active `takeId`;
- take structure mode, such as `continuous`;
- ordered take shot ids;
- missing prepared inputs;
- recommended next command.

`renku director context --json` currently reports selected-scene shot-list and
storyboard readiness more prominently than active take readiness. The next step
for a selected scene can say:

```text
renku take authoring context --take <take-id> --json
```

but the report does not yet resolve the visible take id or summarize why
take-owned media work should go to `media-producer`.

### Take Authoring Context

`renku take authoring context --take <take-id> --json` already exists and is
the right authoritative read contract for shot-video work. It returns:

- a `SceneShotVideoTakeAuthoringDocument`;
- ordered shot ids;
- take structure;
- production plan;
- preflight;
- provider payload preview;
- resource keys.

This plan should strengthen the routing and summary around that command rather
than adding a parallel command that duplicates business rules.

### Target Parsing

Generation and media import commands currently use:

```bash
--target scene:<scene-id> --take <take-id>
```

for shot-video take media.

That is valid at the core target level because the concrete target is a
`sceneShotVideoTake` with both `sceneId` and `takeId`. It is still confusing for
agents because the conceptual object is a take. In the incident, trying
`--target take:<take-id>` led to a generic "must use scene:<id>" failure.

The CLI can make this clearer without changing the core target kind:

- accept `--target take:<take-id>` for shot-video media commands;
- resolve the take through core to its owning scene;
- require `--take` to be absent or match when `target` is `take:<id>`;
- return the same core `sceneShotVideoTake` target shape.

### Input Spec Diagnostics

`packages/core/src/server/media-generation/shot-video-take/input-specs.ts`
currently rejects mismatched shot input specs with:

```text
Shot video take input spec purpose, dependencyKind, and outputInputKind do not match.
```

The message is directionally correct but too vague for agent repair. For
`shot.video-prompt-sheet`, the diagnostic should include the expected values:

```json
{
  "purpose": "shot.video-prompt-sheet",
  "dependencyKind": "video-prompt-sheet",
  "outputInputKind": "video-prompt-sheet",
  "subjectKind": "take",
  "subjectId": "<take-id>"
}
```

This should be a structured diagnostic or structured error suggestion, not a
loose prose string that agents must reverse-engineer.

### Media Import

Codex built-in image generation currently produces files outside the Renku
project, such as:

```text
~/.codex/generated_images/<session-id>/<image>.png
```

Renku media import currently expects a project-relative `--source`, so the
agent has to:

1. generate the image through Codex;
2. manually copy it to `generated/media/...`;
3. call `renku media import --purpose ... --source generated/media/...`;
4. omit `--receipt`;
5. read back state.

This works, but it is too manual and caused friction. It also encourages
duplicate prepared inputs when the user asks for a corrected v2 image.

### Studio Refresh Recovery

The CLI already has notification plumbing through
`appendStudioResourceChangedEvent`, and failed localhost delivery reports
`CLI026`.

There is no obvious public command for agents to replay a safe resource refresh
notification after the mutation has already succeeded. The postmortem suggested
`renku studio notify-refresh --resource ...`. This plan should add a small
public command over the existing notification client rather than asking agents
to rerun imports.

### Skills

The source `media-producer` skill already supports Codex built-in image
generation when the user explicitly requests it. It does not yet make Codex the
default for image purposes when the active harness is Codex.

The source skills partially support take readiness, but not as a first-class
conversation:

- `movie-director` reads director readiness for broad "current", "continue",
  and "what next" requests, but it does not yet say that "get this take ready
  for generation" means active-take readiness and should route to
  `media-producer`.
- `media-producer/references/shot-video-take.md` tells agents to read
  `renku take authoring context`, validate/apply authoring documents, and stop
  when preflight reports missing dependency drafts or a missing final prompt
  draft. That is the right primitive, but the reference assumes the agent is
  already inside shot-video production work.
- The skills do not yet require a user-facing readiness report that separates
  hard blockers from optional improvements and next creative questions.
- Dialogue, narration, and audio should be reported as required only when the
  selected route/core preflight says they are required. The skill should not
  invent a universal audio requirement.

The source `movie-director` skill still has broad routing language. It does not
make active-take language a hard override before scene-shot-designer routing.

The source `scene-shot-designer` skill correctly says it does not own generated
media paths, but its "storyboard maintenance" language can still pull an agent
toward shot-list work when the user says "multi-shot storyboard" for a take.

## Image Execution Policy Alternatives

### Alternative A: Skill-Only Default

Update `media-producer` so it simply says:

```text
If you are Codex and the purpose is an image, use built-in image generation
unless the user asks for Renku-managed generation.
```

Benefits:

- fastest implementation;
- no core or CLI config work;
- immediately helps installed Codex skills.

Problems:

- nondeterministic across harnesses;
- not visible in `renku generation context`;
- hard to test in this repository;
- Claude/OpenCode instructions would need separate wording;
- agents can still miss the rule when they read purpose-specific references
  instead of the main workflow reference.

This is useful as a short-term skill patch, but it is not reliable enough as the
only fix.

### Alternative B: Harness Auto-Detection In Skills

Teach skills to infer whether the current harness is Codex by checking for
Codex-specific tool availability or file paths.

Benefits:

- no user configuration;
- follows the actual runtime.

Problems:

- skill instructions cannot reliably introspect all harness capabilities;
- behavior becomes brittle and tool-list dependent;
- tests become mostly prose reviews;
- "Codex-like" environments could be misclassified;
- unavailable built-in image generation would fail late.

Do not choose this as the architecture. It may be used only as a best-effort
fallback in instructions after a deterministic policy has been read.

### Alternative C: Deterministic Renku Config Default

Extend `~/.config/renku/config.yaml` with an agent media execution policy.

Decision: selected.

Proposed shape:

```yaml
version: 0.1.0
storageRoot: /Users/keremk/renku-movies
agentMedia:
  imageGeneration:
    defaultExecutionPath: codexBuiltInWhenAvailable
```

Allowed values:

```text
codexBuiltInWhenAvailable
renkuManaged
ask
```

Meaning:

- `codexBuiltInWhenAvailable`: for image purposes, use Codex built-in image
  generation when the active harness has it; if the active harness does not,
  ask before creating a Renku-managed spec.
- `renkuManaged`: use Renku-managed generation unless the user asks for Codex or
  another external source.
- `ask`: ask before choosing an image execution path.

Benefits:

- deterministic and reviewable;
- works for Codex, Claude, OpenCode, and future agents;
- can be surfaced in CLI context reports;
- avoids hard-coding harness assumptions into every skill paragraph;
- easy to test in `renku-config` validation.

Problems:

- requires a config schema change;
- needs docs and a way to inspect the effective value;
- config cannot guarantee that Codex image generation is actually available in
  the current harness.

This is the selected architecture.

Implementation consequence:

- Core owns the persisted policy shape, validation, and effective defaulting.
- CLI context reports expose the effective policy.
- Skills obey the exposed policy, but they do not invent their own default and
  do not infer the policy from harness heuristics.
- Codex-oriented local setups should set
  `agentMedia.imageGeneration.defaultExecutionPath` to
  `codexBuiltInWhenAvailable`.

### Alternative D: Per-Command Execution Flag

Add flags such as:

```bash
renku generation context --purpose shot.video-prompt-sheet \
  --target scene:<scene-id> \
  --take <take-id> \
  --image-execution codex-built-in
```

Benefits:

- explicit per task;
- easy to override.

Problems:

- noisy for agents;
- does not solve the default behavior;
- Renku cannot execute the Codex image generation itself;
- too easy to forget.

This can be useful as an override later, but it should not be the main solution.

### Alternative E: Hybrid Config Plus Skills

Use a deterministic config default, surface it in CLI context, and teach skills
to obey it.

These remain implementation requirements under Alternative C:

1. Core reads the config and exposes `agentMedia.imageGeneration` in relevant
   context reports.
2. Skills read the context report and follow the policy.
3. In Codex, the default config can be `codexBuiltInWhenAvailable`.
4. In Claude/OpenCode, the same config means "ask if built-in image generation
   is unavailable; do not silently use fal.ai".
5. Explicit user instructions override config for the current task.
6. Renku-managed image generation still requires spec, estimate, provider
   context approval, and run approval.

Do not choose this as a separate architecture. The selected architecture is
Alternative C. Skills must still obey the policy surfaced by Core/CLI, but they
are consumers of the deterministic config value rather than a second policy
source.

## Proposed Architecture

### 1. Add Agent Media Defaults To Renku Config

Extend `RenkuConfig` in `packages/core/src/server/renku-config.ts`.

Proposed TypeScript shape:

```ts
export type ImageGenerationExecutionPath =
  | "codexBuiltInWhenAvailable"
  | "renkuManaged"
  | "ask";

export interface RenkuConfig {
  version: typeof RENKU_CONFIG_VERSION;
  storageRoot: string;
  agentMedia?: {
    imageGeneration?: {
      defaultExecutionPath?: ImageGenerationExecutionPath;
    };
  };
}
```

Effective default:

```text
ask
```

Project-local default for this machine can be set separately by editing config
or a future config command. The source code should not silently assume all users
are Codex users.

Validation rules:

- unknown config keys remain errors because current config validation is strict;
- all new keys use camelCase;
- invalid execution path values produce `CONFIG0xx` structured errors;
- missing `agentMedia` falls back to `ask`;
- no fallback branches for old field names.

Add a small read helper:

```ts
readAgentMediaExecutionPolicy(options): Promise<AgentMediaExecutionPolicy>
```

The helper should return the effective policy with defaults applied, so callers
do not need to duplicate defaulting logic.

### 2. Surface Policy In Context Reports

Expose the effective image execution policy in agent-facing reports where image
generation choices happen:

- `renku generation context --purpose <image-purpose> ... --json`;
- `renku generation model list --purpose <image-purpose> ... --json`;
- `renku take authoring context --take <take-id> --json`;
- `renku director context --json`.

Suggested report field:

```ts
agentMedia: {
  imageGeneration: {
    defaultExecutionPath: "codexBuiltInWhenAvailable" | "renkuManaged" | "ask";
    appliesToPurpose: boolean;
    renkuManagedAvailable: boolean;
    externalBuiltInGeneration: {
      preferred: "codex.gpt-image-2" | null;
      availableInRenku: false;
      requiresHarnessTool: true;
    };
  };
}
```

Important naming rule:

- Do not call this a provider.
- Do not put it in `packages/engines`.
- Do not represent Codex built-in image generation as a Renku model choice.

The report is a decision aid for agents. The actual Codex image generation
happens through the Codex harness, and the actual Renku metadata attachment
happens through media import.

### 3. Make Active Take State Loud In Studio Current

Extend `StudioCurrentContext` for scene selections with a take summary whenever
the selection includes `takeWorkspaceMode` or `takeId`.

Suggested field:

```ts
takeWorkspace?: {
  mode: "list" | "new" | "edit";
  takeId?: string;
  takeMode?: "continuous" | "multi-cut";
  sourceShotListId?: string;
  shotIds: string[];
  selectedShotId?: string;
  recommendedReadCommand?: string;
}
```

For an edit-mode take, `recommendedReadCommand` should be:

```bash
renku take authoring context --take <take-id> --json
```

If the take cannot be loaded, return a structured warning and keep the rest of
the scene context usable.

Do not make React responsible for deriving this. `studio current` context is a
core-owned projection.

### 4. Add Active Take Readiness To Director Context

Extend `DirectorSceneReadiness.shotVideo` with active take state from Studio
focus when available:

```ts
shotVideo: {
  preflightAvailable: boolean;
  selectedTakeId: string | null;
  selectedTakeMode: "continuous" | "multi-cut" | null;
  selectedTakeShotIds: string[];
  missingPreparedInputKinds: ShotVideoTakeInputKind[];
  selectedInputCount: number;
  selectedTakeCount: number;
  recommendedSpecialist: "media-producer" | null;
  recommendedCommand: string | null;
}
```

When `studioCurrent.selection.takeId` is present, director context should:

- read the take through core;
- summarize the ordered shot ids and structure mode;
- inspect take authoring context or production plan enough to report missing
  prepared image inputs;
- put a media-producer next step ahead of scene-shot-designer when the user is
  asking for take-owned inputs or shot-video work.

Do not let a scene storyboard warning outrank a visible current take for a
take-specific request. Scene readiness can still report missing storyboard
images, but routing language must distinguish scene storyboard images from
take-owned video prompt sheets.

### 5. Add Take Generation Readiness Reporting

Add a core-owned take readiness summary to the authoring/director context used
by agents.

This should support broad user prompts such as:

```text
I want you to get this take ready for generation. Look at what is missing.
```

The report should be derived from the selected take, selected model/input mode,
production proposal, dependency drafts, selected prepared inputs, and preflight.
Skills should not hard-code their own list of required inputs.

Suggested report shape:

```ts
takeGenerationReadiness: {
  status: "blocked" | "needs-user-direction" | "ready-to-estimate" | "ready-to-run";
  requiredBlockers: Array<{
    kind:
      | "missing-input-mode"
      | "missing-model"
      | "missing-video-prompt-sheet"
      | "missing-first-frame"
      | "missing-last-frame"
      | "missing-reference-image"
      | "missing-dialogue-audio"
      | "missing-final-prompt"
      | "missing-dependency-draft";
    message: string;
    recommendedSpecialist: "media-producer" | "casting-director" | null;
    recommendedCommand?: string;
  }>;
  userDirectionNeeded: Array<{
    topic:
      | "camera-motion"
      | "geography"
      | "action-continuity"
      | "narration-or-dialogue"
      | "visual-reference"
      | "model-choice";
    question: string;
  }>;
  optionalImprovements: Array<{
    kind: string;
    message: string;
  }>;
}
```

The exact TypeScript can be refined during implementation, but the public
concepts must be deliberate:

- required blockers are things preflight or the selected route needs before
  estimate/run;
- user direction is creative information the agent needs before authoring a
  prompt, dependency draft, or Codex image;
- optional improvements are useful but not blocking.

For dialogue and narration audio, report a blocker only when the chosen route
or preflight requires a selected logical audio input. If the user merely wants
spoken narration written into the prompt and the route does not require audio,
ask for the words/timing as user direction instead of inventing an audio
asset requirement.

### 6. Support `take:<take-id>` CLI Target Shorthand

Add parsing support for `take:<take-id>` in shot-video generation and media
import command handlers.

Applies to:

- `renku generation context --purpose shot.first-frame`;
- `renku generation context --purpose shot.last-frame`;
- `renku generation context --purpose shot.reference-image`;
- `renku generation context --purpose shot.video-prompt-sheet`;
- `renku generation context --purpose shot.video-take`;
- `renku generation model list` for the same purposes;
- `renku generation spec list` for the same purposes;
- `renku generation input list/select/clear/delete`;
- `renku media import` for shot-video take inputs and final take video.

Behavior:

- `--target take:<take-id>` resolves the take through core and fills
  `{ sceneId, takeId }`;
- if `--take` is also supplied, it must match the target take id;
- if `--target scene:<scene-id> --take <take-id>` is supplied, keep existing
  behavior;
- wrong-scene or missing-take errors must be structured.

This is not a compatibility alias for an old command. It is a current,
conceptual target shorthand for a current domain object.

### 7. Improve Shot Input Spec Diagnostics

Change the `PROJECT_DATA366` error path to include expected values from
`PURPOSE_CONFIG`.

Suggested structured suggestion:

```text
For purpose shot.video-prompt-sheet, use dependencyKind
"video-prompt-sheet" and outputInputKind "video-prompt-sheet". Video prompt
sheet inputs are take-scoped, so use subjectKind "take" and subjectId
"<take-id>" when authoring dependency drafts or inspecting preflight output.
```

Add equivalent suggestions for:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-image`;
- `shot.video-prompt-sheet`.

If subject validation fails elsewhere, collect it with the same report so agents
can fix the full shape in one pass.

### 8. Add Replace-Selected Input Semantics

Add core-owned replacement behavior for prepared shot-video inputs.

Recommended CLI:

```bash
renku media import \
  --purpose shot.video-prompt-sheet \
  --target take:<take-id> \
  --source generated/media/<image.png> \
  --selection select \
  --replace-selected \
  --json
```

Core behavior:

- identify the slot by `takeId`, `inputKind`, `subjectKind`, and `subjectId`;
- import the new file and select it;
- discard or delete the previously selected input for the same slot according
  to the accepted recoverable deletion model;
- do this in a single core-owned mutation so agents do not manually sequence
  import, select, and delete;
- return resource keys for both the new input and the replaced input.

Do not implement this by adding React cleanup or CLI-side database edits.

### 10. Add Safe Studio Refresh Command

Expose the existing notification client as a public Studio command:

```bash
renku studio notify-refresh \
  --project <project-name> \
  --resource scene-shot-video-take:<take-id> \
  --resource scene-shot-video-take-input:<input-id> \
  --json
```

Open question for implementation naming:

- use `notify-refresh`;
- or use `resource changed`.

The command should:

- only send a resource-change event;
- never mutate project metadata;
- require explicit resource keys;
- report `CLI026` if delivery fails;
- support JSON output.

Skills should use this after `CLI026` only when they have local network
permission. They should not rerun imports or shot-list writes to refresh Studio.

### 11. Improve Nested CLI Help

Current help is broad and top-level. Agents need command-specific help for:

- `renku generation spec validate --help`;
- `renku generation spec create --help`;
- `renku generation input clear --help`;
- `renku media import --help`;
- `renku take authoring context --help`.

Add a focused command-help registry in the CLI adapter layer.

Keep it thin:

- no business logic in help;
- no duplicated validation rules beyond examples;
- examples should call current commands only;
- do not mention obsolete command names.

For `shot.video-prompt-sheet`, help should show the current expected shape at a
high level and point to `take authoring context`, not to Scene Shot List
commands.

## Skills Repository Plan

Update source skills in:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

### `movie-director`

Files:

- `skills/movie-director/SKILL.md`;
- `skills/movie-director/references/department-map.md`;
- `skills/movie-director/references/workflow-playbooks.md`;
- `skills/movie-director/references/specialist-handoff-checklists.md`;
- `skills/movie-director/references/cli-coverage-and-gaps.md`.

Required changes:

- Add a hard routing rule: when the current Studio selection includes
  `takeWorkspaceMode: "edit"` or a `takeId`, take-owned media and shot-video
  requests route to `media-producer`.
- Treat these phrases as take-routing triggers when an active take exists:
  "current take", "shot take", "this take", "continuous", "multi-cut",
  "input mode", "before video generation", "first frame", "last frame",
  "reference image", "video prompt sheet", "ready for generation", "what is
  missing", "prepare this take", and "video take".
- Tell agents to run `renku studio current --json`, then
  `renku take authoring context --take <take-id> --json` before deciding that
  shot-list design is needed.
- Split the storyboard vocabulary:
  - Scene storyboard images: Scene Shot List media, `scene.storyboard-sheet`;
  - Video prompt sheet: Shot Video Take prepared input,
    `shot.video-prompt-sheet`.
- In handoffs, pass take id, ordered shot ids, structure mode, input mode, and
  missing prepared inputs to `media-producer`.
- Add a "Take Generation Readiness" playbook. It should start from Studio focus
  and take authoring context, then report blockers and user-direction questions
  before dispatching any generation.
- Update workflow playbooks so "Storyboard References To Shot Video Take" is
  renamed or reframed around shot-video take readiness and starts from authoring
  context when a take id is visible.
- Add a short incident example from session `019f1827...` as a routing test.

### `media-producer`

Files:

- `skills/media-producer/SKILL.md`;
- `skills/media-producer/references/workflow.md`;
- `skills/media-producer/references/shot-video-take.md`;
- `skills/media-producer/references/shot-video-prompt-sheet.md`;
- `skills/media-producer/references/shot-first-last-frame.md`;
- `skills/media-producer/references/shot-reference-images.md`;
- `skills/media-producer/references/scene-storyboard-sheet.md`.

Required changes:

- Read the new agent media execution policy from Renku context reports when it
  is available.
- Default Codex image purposes to Codex built-in generation when policy is
  `codexBuiltInWhenAvailable` and the active harness has the imagegen tool.
- For non-Codex harnesses with the same policy, ask before using Renku-managed
  generation.
- Preserve explicit user instructions above config.
- Never create a Renku-managed spec for an image purpose before checking the
  execution policy.
- For Codex image generation, stage the selected image under project
  `generated/media`, then use the existing `media import` command without a
  receipt.
- Use `--replace-selected` when the user is correcting a prior selected take
  input and wants the new image to supersede it.
- Add a take readiness consultation workflow to `shot-video-take.md`:
  - read `renku studio current --json` and `renku take authoring context`;
  - inspect selected model/input mode, production proposal, preflight, selected
    prepared inputs, and missing dependency drafts;
  - report required blockers separately from optional improvements;
  - ask the next smallest set of user questions needed to make progress;
  - do not create a generation spec until the missing authored requirements are
    resolved.
- Rename and strengthen `shot-video-prompt-sheet.md` with:
  - geography constraints;
  - continuity direction constraints;
  - a `perPanelNarration` block;
  - panel-order checks;
  - a rule to use selected Location Sheet or storyboard references when
    geography is critical.
- Describe `shot.video-prompt-sheet` as a take-scoped visual/text prompt sheet
  for AI video generation, not as a scene storyboard.
- In final responses after Codex image generation, show the imported file, not
  only the staging file.

### `scene-shot-designer`

Files:

- `skills/scene-shot-designer/SKILL.md`;
- `skills/scene-shot-designer/references/shot-list-cli-workflow.md`;
- possibly `skills/scene-shot-designer/references/shot-design-guidelines.md`.

Required changes:

- Add a hard exclusion:

```text
Do not handle shot.video-prompt-sheet for an existing Shot Video Take.
Route that to media-producer.
```

- Clarify that "storyboard maintenance" means scene storyboard images for a
  saved Scene Shot List, not take-owned video prompt sheet inputs.
- If `renku studio current --json` shows an active take edit, stop and hand
  off to `media-producer` unless the user explicitly asks to revise Scene Shot
  List coverage.
- Do not read or write shot-list operations just because a take-owned prompt
  mentions "storyboard".

### Skill Validation

Add a lightweight source-skills validation fixture or prose smoke test for the
incident:

Input:

```text
take a look at the current shot take I have. I want you to create me the
multi-shot storyboard for me to review before we use the video generation.
```

Expected route:

```text
movie-director -> media-producer -> shot.video-prompt-sheet
```

Forbidden route:

```text
movie-director -> scene-shot-designer -> screenplay shot-list apply/write
```

Add a second readiness smoke case:

Input:

```text
I want you to get this take ready for generation. Look at what is missing.
```

Expected behavior:

```text
movie-director -> media-producer -> take generation readiness report
```

The report should name missing required blockers from core/preflight, such as a
missing video prompt sheet, final prompt draft, model/input-mode choice, or
required dialogue/audio input. It should ask for creative direction only after
the missing technical and authored prerequisites are clear.

## Documentation Plan

Update current docs after implementation:

- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/studio-skills.md`, if present or added by the
  implementation;
- `docs/architecture/data-model-and-storage.md`, only if config or import
  provenance changes accepted architecture;
- `docs/cli/commands.md`;
- source skills docs in `studio-skills`.

Add an ADR for the selected deterministic config policy. A suitable ADR title:

```text
Use agent media execution policy for external built-in image generation
```

## Tests

### Core Tests

Add or update tests for:

- Renku config accepts `agentMedia.imageGeneration.defaultExecutionPath`;
- Renku config rejects invalid execution path values;
- effective policy defaults to `ask`;
- generation context reports the effective policy for image purposes;
- take authoring context reports the effective policy;
- director context reports active take id, structure mode, ordered shot ids,
  missing prepared inputs, and media-producer recommendation when Studio focus
  includes a take id;
- take readiness report separates required blockers, user-direction questions,
  and optional improvements;
- dialogue or narration audio appears as required only when core/preflight
  requires a selected logical audio input;
- studio current scene context includes `takeWorkspace` when focus has a take
  id or take edit mode;
- shot input spec validation suggestions include expected `dependencyKind`,
  `outputInputKind`, and take-scoped subject values;
- replace-selected import replaces the prior selected input in the same slot;
- replace-selected import is atomic when the new import fails.

### CLI Tests

Add or update tests for:

- `renku generation context --purpose shot.video-prompt-sheet --target take:<take-id>`;
- `renku generation model list` with `--target take:<take-id>`;
- `renku generation input list/select/clear/delete` with `--target take:<take-id>`;
- `renku media import` with `--target take:<take-id>`;
- mismatched `--target take:<id-a> --take <id-b>` fails with a structured error;
- `renku media import --replace-selected` updates the selected prepared input
  without leaving the old one selected;
- `renku studio notify-refresh --resource ... --json` sends only a refresh
  event and does not mutate project state;
- nested `--help` for generation spec and media import commands shows focused
  examples.

### Studio Server And UI Tests

Only add Studio tests if UI-visible contracts change.

Likely focused coverage:

- `studio current` service test for take edit mode context;
- director context route/resource test if exposed through Studio server;
- existing References tab tests should still pass after replace-selected input
  behavior.

Do not add mobile viewport tests.

### Skills Tests

In `studio-skills`, add validation through whatever lightweight mechanism the
repo supports. If there is no runner, add a checked fixture document or
repository README section that can be manually reviewed.

Required skill smoke cases:

- current take plus "multi-shot storyboard" routes to `media-producer`;
- current take plus "get this take ready for generation" routes to
  `media-producer` and produces a readiness report before generation;
- scene with no active shot list routes to `scene-shot-designer`;
- scene storyboard images route to `media-producer` with
  `scene.storyboard-sheet`;
- take-owned first/last/reference images route to `media-producer`;
- Codex harness plus image purpose defaults to Codex built-in path;
- non-Codex harness plus `codexBuiltInWhenAvailable` asks before using
  Renku-managed generation.

## Manual Verification

Use the real sample project:

```text
/Users/keremk/renku-movies/urban-basilica
```

Do not use stale in-repository sample project paths.

Manual workflow:

1. Open the Urban Basilica scene take in Studio.
2. Confirm `renku studio current --json` reports take edit mode and take id.
3. Confirm `renku director context --json` recommends `media-producer` for the
   active take.
4. Confirm `renku take authoring context --take <take-id> --json` shows ordered
   shot ids and missing video prompt sheet input.
5. Generate a test image through Codex built-in image generation.
6. Stage it under project `generated/media/` and import it with
   `renku media import --target take:<take-id> --source generated/media/<image>`.
7. Correct it with a second image and import with `--replace-selected`.
8. Confirm only the corrected input is selected.
9. Confirm Studio refresh can be delivered through the normal mutation or
   through `renku studio notify-refresh`.
10. Confirm no Scene Shot List row was created or changed.

## Completion Checklist

### Review Area

- [x] Confirm this plan is accepted before implementation begins.
- [x] Confirm Alternative C, deterministic Renku config default, remains the
      selected image execution policy architecture.
- [x] Confirm the active-take routing rule is a hard boundary, not a skill
      preference.
- [x] Confirm `codexBuiltInWhenAvailable` is the accepted default policy value
      for Codex-oriented local setups.
- [x] Confirm the source code default remains `ask` unless config says
      otherwise.
- [x] Confirm `take:<take-id>` is accepted as a current conceptual target
      shorthand, not an obsolete compatibility alias.
- [x] Confirm replace-selected should discard/delete the old selected input, not
      merely deselect it.
- [x] Confirm Studio refresh command naming: `notify-refresh` or
      `resource changed`.
- [x] Confirm no `packages/engines` Codex provider is being added.
- [x] Confirm `shot.video-prompt-sheet` is the accepted replacement name for
      the current take-owned multi-shot storyboard purpose.
- [x] Confirm `scene.storyboard-sheet` remains the accepted name for
      scene-level storyboard images.
- [x] Confirm take readiness reporting must come from core/preflight state, not
      skill-local guesses.

### Architecture And Contracts

- [x] Extend `RenkuConfig` with `agentMedia.imageGeneration`.
- [x] Add `ImageGenerationExecutionPath` values.
- [x] Add effective policy helper with default `ask`.
- [x] Validate config keys and values with structured `CONFIG0xx` errors.
- [x] Expose image execution policy in image-purpose generation context.
- [x] Expose image execution policy in model-list reports.
- [x] Expose image execution policy in take authoring context.
- [x] Expose image execution policy in director context.
- [x] Add active take summary to `StudioCurrentContext`.
- [x] Add active take readiness to `DirectorSceneReadiness.shotVideo`.
- [x] Add take generation readiness report fields for required blockers,
      user-direction questions, and optional improvements.
- [x] Keep take readiness projection in core.
- [x] Keep CLI and Studio server as adapters over core.
- [x] Do not duplicate take-input validity rules in skills, CLI parsing, or
      React.

### Core Implementation

- [x] Add active-take read helper used by studio current and director context.
- [x] Summarize take mode as `continuous` or `multi-cut`.
- [x] Summarize ordered take shot ids.
- [x] Summarize selected and missing prepared input kinds.
- [x] Summarize take generation readiness from selected model/input mode,
      production proposal, dependency drafts, selected inputs, and preflight.
- [x] Ensure audio/dialogue blockers are reported only when the selected route
      requires logical audio input.
- [x] Return media-producer recommendation for active take media work.
- [x] Improve `PROJECT_DATA366` with purpose-specific expected values.
- [x] Ensure purpose-specific import still allocates canonical asset paths.
- [x] Add replace-selected mutation behavior in core.
- [x] Use the existing recoverable deletion/trash approach for replaced inputs
      if that is the accepted deletion policy.
- [x] Return resource keys for new and replaced prepared inputs.
- [x] Ensure failed replacement leaves the old selected input unchanged.

### CLI Implementation

- [x] Add parsing for `take:<take-id>` targets.
- [x] Resolve `take:<take-id>` through core before building generation target.
- [x] Reject mismatched `--target take:<id>` and `--take <other-id>`.
- [x] Use `take:<take-id>` in generation context.
- [x] Use `take:<take-id>` in generation model list.
- [x] Use `take:<take-id>` in generation spec list.
- [x] Use `take:<take-id>` in generation input list/select/clear/delete.
- [x] Use `take:<take-id>` in shot input media import.
- [x] Add `--replace-selected` to relevant media import commands.
- [x] Add `renku studio notify-refresh` or accepted equivalent.
- [x] Add focused nested help for generation, media, take, and studio commands.
- [x] Keep command handlers focused and shallow.
- [x] Update top-level help without turning it into the only documentation.

### Skills Repository

- [x] Update `movie-director/SKILL.md` with active-take hard routing.
- [x] Update `movie-director/references/department-map.md`.
- [x] Update `movie-director/references/workflow-playbooks.md`.
- [x] Update `movie-director/references/specialist-handoff-checklists.md`.
- [x] Update `movie-director/references/cli-coverage-and-gaps.md`.
- [x] Update `media-producer/SKILL.md` with policy-first image path selection.
- [x] Update `media-producer/references/workflow.md`.
- [x] Update `media-producer/references/shot-video-take.md`.
- [x] Rename/update `media-producer/references/shot-video-prompt-sheet.md`.
- [x] Update `media-producer/references/shot-first-last-frame.md`.
- [x] Update `media-producer/references/shot-reference-images.md`.
- [x] Update `media-producer/references/scene-storyboard-sheet.md`.
- [x] Update `scene-shot-designer/SKILL.md` with take-owned video prompt
      exclusion.
- [x] Update `scene-shot-designer` references if needed.
- [x] Add or document a skill smoke fixture for the June 30 incident.
- [x] Add or document a skill smoke fixture for "get this take ready for
      generation".
- [x] Confirm installed plugin/cache refresh workflow after source skill edits.

### Documentation

- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/cli/commands.md`.
- [x] Add or update `docs/architecture/reference/studio-skills.md` if the
      implementation needs a source-skill architecture reference.
- [x] Add an ADR for deterministic Renku config media execution policy.
- [x] Avoid updating historical plans solely for naming sweeps.
- [x] Do not mention obsolete command aliases in new runtime docs.

### Tests

- [x] Add core config tests.
- [x] Add core studio-current active-take context tests.
- [x] Add core director-context active-take routing tests.
- [x] Add core take readiness report tests.
- [x] Add core shot input spec diagnostic tests.
- [x] Add core replace-selected input tests.
- [x] Add CLI `take:<take-id>` target tests.
- [x] Add CLI replace-selected tests.
- [x] Add CLI studio notify-refresh tests.
- [x] Add CLI nested help tests.
- [x] Add skills smoke validation or manually reviewable fixtures.

### Final Verification

- [x] Run focused core tests.
- [x] Run focused CLI tests.
- [x] Run focused Studio tests only if Studio contracts changed.
- [x] Run root `pnpm check` or the smallest accepted workspace verification
      that covers touched packages.
- [x] Verify the active-take workflow with automated core/CLI/Studio coverage; no live Urban Basilica mutation or paid generation was run.
- [x] Confirm no Scene Shot List mutation happens for take-owned video prompt
      requests.
- [x] Confirm "get this take ready for generation" produces a readiness report
      before asking for drone moves, dialogue, narration, or image generation.
- [x] Confirm Codex built-in image flow creates no Renku generation spec, run,
      estimate, approval token, or receipt through command/docs/skill coverage; no live image generation was invoked.
- [x] Confirm Renku-managed image flow still requires spec, estimate, approval,
      run, inspection, and import.
- [x] Confirm Claude/OpenCode guidance does not claim built-in Codex image
      generation is available.
- [x] Confirm `CLI026` recovery does not duplicate imports.
- [x] Confirm no raw Studio UI controls or mobile-specific work were added.

## Success Criteria

This plan succeeds when a Codex agent receiving the original June 30 prompt
does the following without user correction:

1. Reads current Studio focus.
2. Notices the active edit-mode Shot Video Take.
3. Reads take authoring context.
4. Identifies the missing `shot.video-prompt-sheet`.
5. Routes to `media-producer`, not `scene-shot-designer`.
6. Uses Codex built-in image generation by default because the configured image
   execution policy allows it and the harness supports it.
7. Imports the image through Renku without a receipt.
8. Uses replace-selected behavior for corrected versions.
9. Safely refreshes Studio without rerunning non-idempotent mutations.
10. Leaves the existing Scene Shot List untouched.

This plan also succeeds when a Codex agent receiving the more natural prompt
"get this take ready for generation, look at what is missing" does the
following:

1. Reads current Studio focus and the take authoring context.
2. Produces a take generation readiness report.
3. Names required blockers from core/preflight, such as missing
   `shot.video-prompt-sheet`, missing final prompt draft, missing selected
   model/input mode, or missing required logical audio.
4. Separates optional improvements from hard blockers.
5. Asks focused creative questions only after the missing prerequisites are
   clear.
