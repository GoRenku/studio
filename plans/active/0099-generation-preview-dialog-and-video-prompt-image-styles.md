# 0099 Generation Preview Dialog And Video Prompt Image Styles

Status: completed
Date: 2026-07-02

Supersession note: ADR 0041 and
`plans/active/0103-opaque-ai-artifacts-and-prompts.md` supersede this plan's
structured prompt-sheet contract. Current runtime code treats
`shot.video-prompt-sheet` as an opaque image artifact with
`promptSheetVisualStyleId` and `promptSheetNotationModeId` metadata.

## Summary

Video prompt images need to become a richer, style-aware control surface for AI
video generation.

The current `shot.video-prompt-sheet` guidance assumes one panel per ordered
Shot Video Take shot. That is no longer sufficient. For choreography, action,
stunts, complex camera movement, singing while dancing, or other tightly timed
motion, the prompt image may need many control panels even when the Scene Shot
List has only one or two durable shots and only one or two storyboard images.

This plan adds two connected capabilities:

- a structured video prompt image plan with style-specific guidance, a maximum
  of 12 video prompt panels, camera/lens metadata, motion annotations, and
  explicit realistic versus hand-drawn control;
- a Generation Preview Dialog that agents can open and update through a Renku
  CLI command before generating a video prompt image or a final video.

The preview dialog is read-only. It lets the agent show exactly what will be
sent to the generator: model, final prompt, references, provider token order,
audio/video/image inputs, configuration, diagnostics, and generated panel plan.
The user reviews the dialog in Studio and gives feedback in the agent harness.
When the agent revises the preview, Studio updates the existing dialog in place
instead of closing and relaunching it.

## Relationship To Existing Plans

This plan builds on:

- `plans/active/0093-agent-take-video-prompt-routing-and-codex-image-defaults.md`
- `plans/active/0094-shot-video-prompt-sheet-guidance.md`
- `plans/active/0095-shot-video-input-reference-conditioning.md`
- `plans/active/0097-seedance-prompt-sheet-skill-remediation.md`
- `plans/active/0098-shot-video-take-video-visibility-and-regeneration.md`

This plan changes one important assumption from `0094`: a video prompt sheet is
no longer always one panel per ordered take shot. It is now one prompt image
with 2 to 12 **Video Prompt Panels**. A panel can map to a durable Scene Shot
List shot, but it can also be a finer control beat inside one durable shot.

This plan keeps the `0095` reference-conditioning decision:

- ordinary cinematic prompt images use `referenceMode: "movie-lookbook"`;
- hand-drawn, sketch, storyboard, or animatic prompt images use
  `referenceMode: "storyboard-lookbook"`;
- selected Location Sheets and Character Sheets remain continuity references
  resolved by Core, not by filenames, visual guessing, or agent-local rules.

This plan complements `0097`: final Seedance prompt-sheet video prompts still
need provider-token roles, panel-order instructions, sheet-artifact suppression,
and contradiction checks. The new preview dialog gives the user and agent a
visible place to inspect that handoff before generation.

This plan does not depend on `0098`, but it should reuse any take video file URL
route added there when a final-video preview includes source video references.

## Problem Statement

There are two product gaps.

First, video prompt images are too loosely defined. A prompt sheet for a simple
dialogue or establishing shot can be realistic and sparse. A prompt sheet for
live choreography or an action sequence needs a different visual language:

- extra control panels that subdivide one durable shot into timed beats;
- color-coded body, camera, framing, light, impact, and timing arrows;
- camera body, lens, focal length, rig, and movement details;
- explicit plant/payoff continuity, such as a horse planted in panel 5 before a
  panel 7 jump;
- hand-drawn or monochrome previs when realism gets in the way of motion
  comprehension;
- selected Character Sheets as actual image references when hand-drawn control
  still needs identity continuity.

Second, agents need a better collaboration surface before generation. Today an
agent can prepare a prompt, references, model choice, and config, but the user
cannot inspect the full generation plan in Studio before the agent calls the
image or video generator. For expensive or hard-to-control generation, that
creates avoidable churn.

The preview cannot be a Studio-local guess. It must show the same information
the agent is about to submit. It must also update in place when the user gives
feedback and the agent revises the plan.

## Goals

- Make `shot.video-prompt-sheet` support style-specific video prompt image
  generation.
- Default video prompt image generation to GPT-Image-2.
- Support realistic cinematic prompt images and hand-drawn prompt images.
- Support complex motion/choreography prompt images with color-coded
  annotations.
- Allow prompt images to contain 2 to 12 Video Prompt Panels, independent of the
  number of durable Scene Shot List shots.
- Keep Scene Shot List shots and Video Prompt Panels distinct concepts.
- Include camera type, lens, focal length, rig, camera movement, subject action,
  timing, and beat purpose in the panel plan.
- Let users hand-author some panels while the agent fills missing panels before
  generation.
- Require the agent to show a Generation Preview Dialog before generating
  `shot.video-prompt-sheet` images and before final `shot.video-take` runs.
- Show complete generator-bound information in the dialog: model, final prompt,
  references, config, provider token order, diagnostics, and plan metadata.
- Reuse the rich image cards from the Shot References tab and audio rows from
  the Dialogs tab where possible.
- Update the open preview dialog in place when the same preview is revised.
- Reopen the dialog when the user has dismissed it and a later preview update
  arrives.
- Keep Studio server handlers thin and Core-owned validation authoritative.
- Update the sister Studio Skills repo so agents follow the new workflow.

## Non-Goals

- Do not mutate Scene Shot Lists when creating Video Prompt Panels.
- Do not store generated video prompt image paths in Scene Shot List JSON.
- Do not make Studio React decide whether a generation preview is valid.
- Do not add raw browser controls in `packages/studio` feature code.
- Do not add a Studio text field for user feedback in this slice. Feedback stays
  in the agent harness.
- Do not create a generic arbitrary UI-message bus.
- Do not create a Codex image provider inside `packages/engines`.
- Do not preserve old prompt-sheet contracts as compatibility aliases. Update
  callers, tests, samples, docs, and skills directly.
- Do not run paid provider generation as part of implementation verification.
- Do not test or optimize mobile behavior.

## Naming Decision

Use **Video Prompt Panel** for the dense control units inside a video prompt
image.

Do not call these units `Shot` in public contracts. Renku already uses `Shot`
for durable Scene Shot List coverage. A Video Prompt Panel can refer to a shot,
but it is not itself a Scene Shot List shot.

The distinction should be visible in every contract:

```text
Scene Shot List Shot
  durable coverage unit, may have storyboard image, belongs to scene shot list

Video Prompt Panel
  generation-control beat inside one prompt image, belongs to a
  shot.video-prompt-sheet generation spec or dependency draft
```

## Video Prompt Image Styles

Add a concrete style id for `shot.video-prompt-sheet` work:

```ts
export type VideoPromptImageStyleId =
  | 'cinematic-realistic'
  | 'handdrawn-storyboard'
  | 'motion-annotation';
```

### `cinematic-realistic`

Use for ordinary cinematic prompt images where the sheet should resemble the
movie's visual language.

Rules:

- default `referenceMode` is `movie-lookbook`;
- selected Movie Lookbook sheet is the primary style reference;
- selected Location Sheets and Character Sheets are continuity references;
- panels may include concise camera and motion labels, but the image should not
  become a technical diagram unless the user asked for one.

### `handdrawn-storyboard`

Use when the user asks for hand-drawn, sketch, animatic, previs, pencil,
graphite, storyboard, or non-realistic control images.

Rules:

- default `referenceMode` is `storyboard-lookbook`;
- selected Storyboard Lookbook sheet is the primary line/finish reference;
- selected Character Sheets are still continuity references for identity,
  wardrobe, silhouette, and key props;
- selected Location Sheets remain continuity references for spatial geography;
- the prompt may describe monochrome pencil, minimal shading, strong
  silhouettes, loose confident hand-drawn lines, unfinished previs energy, and
  clean captions under panels.

### `motion-annotation`

Use for choreography, stunt, chase, battle, dance, live singing plus movement,
complex physical performance, complex camera moves, or shots where motion
control matters more than realism.

Rules:

- default `referenceMode` is `storyboard-lookbook` unless the user explicitly
  asks for a realistic annotated sheet;
- selected Character Sheets are required for non-voiceover cast members that
  appear in the panels;
- selected Location Sheets are used when geography or floor path matters;
- each panel can include color-coded hand-drawn arrows and short annotations:
  - red: body movement;
  - blue: camera movement;
  - green: framing or composition;
  - orange: light, energy, impact, or emphasis;
  - purple: timing, pause, or sync point;
- panel captions should include shot, camera, action, and beat;
- a timeline bar or tempo ruler is allowed when the video depends on rising
  tempo, exact timing, or clear phase changes.

## GPT-Image-2 Default

For `shot.video-prompt-sheet`, GPT-Image-2 is the default image model.

Core already defaults shot input image dependencies to:

```ts
imageDependencyModelChoice: 'fal-ai/openai/gpt-image-2'
```

This plan strengthens that default specifically for video prompt images:

- Renku-managed prompt-sheet specs default to
  `modelChoice: "fal-ai/openai/gpt-image-2"`.
- Provider payloads with reference images continue to route to
  `openai/gpt-image-2/edit`.
- Codex/external prompt-sheet generation should use `codex.gpt-image-2` when
  the agent surface supports it and the returned `agentMedia` policy allows
  external built-in image generation.
- Nano Banana 2, Grok Imagine Image, or any other image model may be used only
  when the user explicitly chooses that model or when a future accepted plan
  changes the default.
- The Generation Preview Dialog must show when the image path is external
  Codex GPT-Image-2 versus Renku-managed GPT-Image-2, because estimate,
  receipt, and run behavior differ.

If GPT-Image-2 cannot receive the required references in the active execution
path, the agent must disclose that before generation and either switch to a
reference-capable Renku-managed GPT-Image-2 path or ask the user to accept a
weaker text-only path.

## Core Contract Changes

Extend the current shot input generation contract with prompt-sheet-specific
metadata.

```ts
export interface VideoPromptImagePlan {
  styleId: VideoPromptImageStyleId;
  sheetAspectRatio: '16:9' | '9:16' | '4:3' | '1:1';
  referenceMode: ShotVideoInputReferenceMode;
  panels: VideoPromptPanel[];
  annotationKey?: VideoPromptAnnotationKey;
  continuityNotes: string[];
  hardConstraints: string[];
}
```

`sheetAspectRatio` should be chosen from project/video intent when known. A
vertical 9:16 prompt sheet is valid for vertical video work. A landscape 16:9
sheet is valid for normal cinematic Studio work. This is not a mobile UI
optimization.

```ts
export interface VideoPromptPanel {
  panelId: string;
  panelNumber: number;
  sourceShotId?: string;
  authorship: 'user-authored' | 'agent-authored' | 'derived-from-shot';
  timing?: {
    startSeconds?: number;
    endSeconds?: number;
    beatLabel?: string;
  };
  shot: {
    shotType?: string;
    framing?: string;
    cameraAngle?: string;
    subject?: string;
  };
  camera: {
    cameraType?: string;
    rig?: string;
    lensType?: string;
    focalLengthMm?: number;
    movement?: string;
  };
  action: {
    subjectMovement?: string;
    choreography?: string;
    cameraMovement?: string;
    beatPurpose: string;
  };
  annotations?: {
    bodyMovement?: string;
    cameraMovement?: string;
    framing?: string;
    lightOrImpact?: string;
    timingOrPause?: string;
  };
  continuity: {
    requiredReferences: string[];
    plantedElements: string[];
    forbiddenElements: string[];
  };
  caption: string;
}
```

Validation rules:

- `videoPromptImagePlan` is required for
  `purpose: "shot.video-prompt-sheet"`.
- `videoPromptImagePlan` is forbidden for `shot.first-frame`,
  `shot.last-frame`, and `shot.reference-image`.
- `panels.length` must be between 2 and 12.
- `panelNumber` must be contiguous and start at 1.
- each `panelId` must be stable, non-empty, and unique within the plan.
- `sourceShotId`, when present, must be in the take's ordered `shotIds`.
- at least one panel must be associated with every durable take shot unless the
  user explicitly marked that shot as intentionally skipped in the plan.
- skipped durable shots must be represented in a plan-level note, not silently
  omitted.
- `styleId: "handdrawn-storyboard"` and `styleId: "motion-annotation"` should
  use `referenceMode: "storyboard-lookbook"` unless the user explicitly chose
  a realistic annotated sheet.
- `styleId: "cinematic-realistic"` should use
  `referenceMode: "movie-lookbook"`.
- Core validates selected reference ownership exactly as it does today.
- Core does not invent panel content. Missing panel content is an agent/workflow
  issue surfaced before generation.

Update these current contracts directly:

- `ShotVideoTakeInputGenerationSpec`
- `ShotVideoTakeDependencyDraft`
- `scene-shot-list-json-schemas.ts` for authoring documents
- shot input spec validation
- provider payload preview reports
- dependency draft spec creation
- generated samples in the Skills repo

Remove the current validation rule that
`shot.video-prompt-sheet requires a multi-shot take`. A single durable take shot
can still need a multi-panel prompt image. The new validity rule is based on
`videoPromptImagePlan.panels.length`, not on `target.shotIds.length`.

## Generation Preview Contract

Add a Core-owned preview snapshot contract:

```ts
export type GenerationPreviewPurpose =
  | 'shot.video-prompt-sheet'
  | 'shot.video-take';

export interface GenerationPreviewSnapshot {
  kind: 'generationPreview';
  previewId: string;
  purpose: GenerationPreviewPurpose;
  project: {
    id: string;
    name: string;
    title?: string;
  };
  target: SceneShotVideoTakeTarget;
  title: string;
  model: GenerationPreviewModel;
  finalPrompt: GenerationPreviewPrompt;
  references: GenerationPreviewReference[];
  configuration: GenerationPreviewConfigurationItem[];
  videoPromptImagePlan?: VideoPromptImagePlan;
  providerPreview?: GenerationPreviewProviderPreview;
  estimate?: GenerationPreviewEstimate;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}
```

Reference entries must be logical project references, not raw provider URLs and
not absolute local file paths:

```ts
export type GenerationPreviewReference =
  | {
      kind: 'image';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      sourcePurpose?: string;
      selected: boolean;
    }
  | {
      kind: 'audio';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      dialogueId?: string;
      selected: boolean;
    }
  | {
      kind: 'video';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      selected: boolean;
    };
```

The Studio server resolves these logical references to browser-safe URLs. The
CLI and skills must not embed local file paths or provider upload URLs in the
preview snapshot.

## CLI Surface

Add one initial command:

```bash
renku generation preview show --file <generation-preview-json> --json
```

Behavior:

1. CLI parses the JSON file.
2. Core validates and normalizes the `GenerationPreviewSnapshot`.
3. CLI resolves the project through Core.
4. CLI sends the preview to the running Studio server through the existing
   local notification-token trust path.
5. Studio server appends a preview coordination event.
6. Browser opens or updates the Generation Preview Dialog.
7. CLI prints a JSON report with `previewId`, `purpose`, `project`, and
   delivery status.

`generation preview show` is different from resource refresh:

- when Studio is not running, this command should fail with a structured error
  or clear structured warning, because the requested result is a visible dialog;
- it should not append an offline preview event backlog;
- it should not mutate project data.

Expected report shape:

```json
{
  "valid": true,
  "previewId": "generation_preview_...",
  "purpose": "shot.video-prompt-sheet",
  "project": {
    "id": "project_...",
    "name": "urban-basilica"
  },
  "studio": {
    "delivery": "delivered"
  }
}
```

Future commands such as `renku generation preview validate` can be added only
when there is real duplication. The initial command validates before delivery.

## Studio Coordination Event

Add a UI coordination event:

```ts
export interface StudioGenerationPreviewRequestedEvent
  extends StudioEventBase {
  type: 'studio.generationPreviewRequested';
  projectRef: StudioProjectRef;
  preview: GenerationPreviewSnapshot;
}
```

Rules:

- This is a UI coordination event, not durable project history.
- It is server-owned. CLI posts to the running Studio server, and the Studio
  server appends the event.
- The event may include generator-bound prompt/config/reference information
  because its purpose is local UI review.
- The event must not be consumed by project data services.
- The event must not be used to reconstruct generation history.
- The event must not include provider upload URLs, local absolute paths, or
  secrets.

Browser behavior:

- ignore preview events for other projects;
- when the same `previewId` is already open, replace the dialog content in
  place without closing the dialog;
- preserve the selected tab and scroll position when practical;
- show a subtle updated timestamp or revision indicator;
- when the dialog was dismissed, a later event with the same `previewId` opens
  it again;
- when a different `previewId` arrives, replace the current preview and open
  the dialog.

## Studio Server

Add a notification route under the Studio events route:

```text
POST /studio-api/studio/events/generation-previews
```

The route uses the same local notification-token middleware as
`project-resources-changed`.

Responsibilities:

- read the posted preview snapshot;
- call Core validation;
- resolve project identity;
- resolve preview reference URLs or return enough logical data for the browser
  service layer to resolve URLs consistently;
- append `studio.generationPreviewRequested`;
- return the appended event id and preview id.

The Studio server must stay thin. It does not decide whether a model, prompt,
panel plan, reference, or parameter is correct. Core validates those contracts.

## Studio Browser UI

Add a `GenerationPreviewDialogHost` mounted once under the app shell.

The dialog uses local shadcn-style components from `packages/studio/src/ui`:

- `Dialog`
- `Tabs`
- `Button`
- `Badge`
- `Alert`
- existing image reference cards where possible
- existing audio take rows where possible
- existing video preview/player components where possible

The dialog is a dense desktop review surface, not a landing page.

Suggested layout:

- Header:
  - preview title;
  - purpose badge;
  - model/provider badge;
  - target take and ordered shot ids;
  - revision/update indicator.
- Prompt tab:
  - final prompt exactly as it will be submitted;
  - negative prompt or embedded negative constraints when relevant;
  - provider-reference token mapping.
- Plan tab:
  - Video Prompt Image style;
  - 2 to 12 panel table/grid;
  - panel timing, action, camera, lens, focal length, rig, movement, beat,
    annotations, plant/payoff notes, and forbidden elements.
- References tab:
  - images in provider order with rich previews;
  - audio references with playback controls;
  - video references with video preview where supported;
  - selected/included state is informational in this dialog.
- Config tab:
  - provider, model id, route, image size/aspect, duration, resolution,
    native-audio settings, seeds, quality, and all other generator settings.
- Issues tab:
  - structured diagnostics, warnings, and prompt-quality gates.

The dialog should avoid visible filler text. It should show meaningful
generation data and concise section labels only.

## Agent Workflow

For `shot.video-prompt-sheet`:

1. Resolve the working take with the current-take gate.
2. Read `renku take authoring context --take <take-id> --json`.
3. Build a `videoPromptImagePlan`.
4. Fill missing panels before generation. If user-authored panels leave gaps,
   the agent may fill those gaps, but the preview must show which panels are
   user-authored versus agent-authored.
5. Choose style:
   - `motion-annotation` for choreography/action/control-heavy requests;
   - `handdrawn-storyboard` for explicit sketch/storyboard/previs requests;
   - `cinematic-realistic` for ordinary cinematic prompt images.
6. Use GPT-Image-2 by default.
7. Create a `GenerationPreviewSnapshot`.
8. Run `renku generation preview show --file <preview-json> --json`.
9. Wait for user feedback in the agent harness.
10. Revise the preview in place when feedback arrives.
11. Generate only after the user indicates the plan is ready.

For final `shot.video-take`:

1. Re-read persisted take authoring context immediately before generation.
2. Build the final provider prompt from current prompt sheet, references, model
   route, provider token order, and known audio timing.
3. Create and show a Generation Preview Dialog before estimate/run approval.
4. Apply the route-specific prompt-quality gate, especially for Seedance prompt
   sheets.
5. Proceed to estimate and generation only after the user approves in the agent
   harness.

## Skills Repo Updates

Update the sister repo:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

Primary files:

- `skills/media-producer/SKILL.md`
- `skills/media-producer/references/shot-video-prompt-sheet.md`
- `skills/media-producer/references/shot-video-take.md`
- `skills/media-producer/samples/shot-video-prompt-sheet-spec.json`
- `skills/media-producer/samples/shot-video-take-final-spec.json`
- `skills/media-producer/samples/shot-video-take-production-group.json`
- `skills/movie-director/SKILL.md`
- `skills/movie-director/references/workflow-playbooks.md`
- `README.md`

Required skill guidance changes:

- `shot.video-prompt-sheet` always defaults to GPT-Image-2.
- Video Prompt Panels are not Scene Shot List shots.
- Prompt images can contain 2 to 12 Video Prompt Panels.
- Choreography/action/control-heavy requests should use
  `motion-annotation`.
- Hand-drawn/sketch/storyboard requests should use `handdrawn-storyboard`.
- Ordinary cinematic prompt images should use `cinematic-realistic`.
- Hand-drawn and motion-annotation prompt images must use selected Character
  Sheets as continuity references for visible cast when available.
- Prompt image plans must include camera type, rig, lens, focal length,
  movement, subject action, beat timing, and annotation intent when known.
- Agents may fill missing panels, but the preview must show which panels were
  filled by the agent.
- Agents must show the Generation Preview Dialog before generating prompt
  images and before final video generation.
- Subsequent feedback should update the same `previewId` through
  `renku generation preview show`, not create unrelated previews.

## Documentation Updates

Update this repository:

- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/studio-coordination-events.md`

Documentation must explain:

- Video Prompt Panels versus Scene Shot List shots;
- prompt image styles and GPT-Image-2 default;
- Generation Preview Dialog command and event contract;
- preview events as live UI coordination, not durable project history;
- no offline backlog for preview dialogs;
- Skills repo contract updates.

## Implementation Slices

### Slice 1: Core Contracts

- Add `VideoPromptImageStyleId`.
- Add `VideoPromptImagePlan`.
- Add `VideoPromptPanel`.
- Extend `ShotVideoTakeInputGenerationSpec`.
- Extend `ShotVideoTakeDependencyDraft`.
- Update authoring JSON schema.
- Update shot input spec validation.
- Replace the multi-shot-only prompt-sheet rule with the 2 to 12 panel rule.
- Keep GPT-Image-2 as the default model for prompt-sheet dependencies.

### Slice 2: Generation Preview Core Contract

- Add `GenerationPreviewSnapshot`.
- Add reference, model, prompt, config, provider-preview, and estimate preview
  types.
- Add validation that rejects missing project, target, model, prompt, invalid
  references, invalid panel plans, unsupported purpose, and raw local paths.
- Add structured diagnostics for preview contract failures.

### Slice 3: CLI Command And Notification Client

- Add `renku generation preview show --file <generation-preview-json> --json`.
- Add a preview notification client or generalize the existing Studio
  notification client without creating a broad arbitrary message API.
- Fail clearly when Studio is not running.
- Do not append preview events directly from CLI.
- Do not mutate project data.

### Slice 4: Studio Server Event Route

- Add `POST /studio-api/studio/events/generation-previews`.
- Validate notification token.
- Validate preview through Core.
- Append `studio.generationPreviewRequested`.
- Add route tests for valid preview, missing token, wrong project, invalid
  reference, invalid panel plan, and no secret/path leakage.

### Slice 5: Browser Event Handling

- Add the event type to browser contracts.
- Teach `use-studio-coordination` to publish generation preview events for the
  active project.
- Add a global preview dialog host.
- Preserve in-place updates for the same `previewId`.
- Reopen when dismissed and a later preview event arrives.

### Slice 6: Dialog UI

- Build the dialog with shadcn-style local primitives.
- Reuse image reference card visuals.
- Reuse dialogue audio playback rows.
- Add provider token and config views.
- Add panel plan view with camera/lens/action/annotation data.
- Add structured issues view.
- Keep the surface desktop-first and dense.

### Slice 7: Skills Repo

- Update `media-producer` and `movie-director` guidance.
- Update samples to include `videoPromptImagePlan`.
- Add a sample `generationPreview` JSON for a motion-annotation prompt image.
- Add a sample final `shot.video-take` preview with prompt-sheet references.
- Remove or rewrite any guidance that says prompt sheets are always one panel
  per ordered take shot.

### Slice 8: Docs And Verification

- Update architecture references.
- Add focused unit tests.
- Add Studio component tests.
- Add CLI tests.
- Add a desktop Playwright verification for open/update/dismiss/reopen behavior.
- Run focused package checks, then root checks if the slice touches shared
  contracts across packages.

## Completion Checklist

### Review Area

- [x] Confirm the plan preserves Core ownership of generation validation.
- [x] Confirm the plan does not add React-local generation business rules.
- [x] Confirm the plan does not add a broad arbitrary UI-message bus.
- [x] Confirm the plan does not add compatibility aliases for old prompt-sheet
      behavior.
- [x] Confirm the plan does not use the stale in-repository sample project.

### Core Contracts

- [x] Add `VideoPromptImageStyleId`.
- [x] Add `VideoPromptImagePlan`.
- [x] Add `VideoPromptPanel`.
- [x] Add `VideoPromptAnnotationKey`.
- [x] Extend `ShotVideoTakeInputGenerationSpec`.
- [x] Extend `ShotVideoTakeDependencyDraft`.
- [x] Update `scene-shot-list-json-schemas.ts`.
- [x] Require `videoPromptImagePlan` for `shot.video-prompt-sheet`.
- [x] Forbid `videoPromptImagePlan` for other shot input purposes.
- [x] Enforce 2 to 12 panels.
- [x] Enforce contiguous panel numbering.
- [x] Validate `sourceShotId` values against the take.
- [x] Remove the multi-shot-only prompt-sheet validation rule.
- [x] Keep GPT-Image-2 as the default prompt-sheet image model.
- [x] Add structured diagnostics for missing or invalid prompt image plans.

### Generation Preview Contracts

- [x] Add `GenerationPreviewPurpose`.
- [x] Add `GenerationPreviewSnapshot`.
- [x] Add `GenerationPreviewReference`.
- [x] Add `GenerationPreviewModel`.
- [x] Add `GenerationPreviewPrompt`.
- [x] Add `GenerationPreviewConfigurationItem`.
- [x] Add `GenerationPreviewProviderPreview`.
- [x] Reject absolute local paths in preview references.
- [x] Reject provider upload URLs in preview references.
- [x] Validate preview project identity and non-empty take target data.
- [x] Require preview references to be logical asset/file references instead of
      provider URLs or local paths. The first implementation keeps browser URL
      resolution optional so Studio can render media when a future server
      resolver supplies safe URLs.

### CLI

- [x] Add `renku generation preview show --file <file> --json`.
- [x] Parse JSON through a focused command handler.
- [x] Call Core validation before notification.
- [x] Use the running Studio server notification token.
- [x] Fail clearly when Studio is not running.
- [x] Avoid direct event-store writes from CLI.
- [x] Add CLI tests for delivered preview.
- [x] Add CLI tests for Studio-not-running behavior.
- [x] Add CLI tests for invalid preview payloads.
- [x] Verify the command result does not expose the notification token.

### Studio Server

- [x] Add `studio.generationPreviewRequested` event type.
- [x] Add event validation.
- [x] Cover event validation through route append tests.
- [x] Add `POST /studio-api/studio/events/generation-previews`.
- [x] Validate notification token.
- [x] Validate preview through Core.
- [x] Validate `projectRef` identity against the preview project.
- [x] Append the event through the coordination service.
- [x] Add route tests for valid and invalid previews.

### Studio Browser

- [x] Add browser contract type for `studio.generationPreviewRequested`.
- [x] Update event polling handling.
- [x] Add a `renku:generation-preview-requested` browser event for app-level
      state handoff.
- [x] Add `GenerationPreviewDialogHost`.
- [x] Open the dialog for a new preview.
- [x] Update content in place for the same `previewId`.
- [x] Preserve selected tab during in-place updates.
- [x] Reopen after dismissal when a new event arrives.
- [x] Ignore preview events for other projects.

### Dialog UI

- [x] Use `Dialog` from `packages/studio/src/ui/dialog.tsx`.
- [x] Use local shadcn-style controls only.
- [x] Add Prompt tab.
- [x] Add Plan tab.
- [x] Add References tab with image/video rendering when a browser-safe URL
      exists.
- [x] Represent audio references as logical rows without adding raw browser
      audio controls before URL resolution exists.
- [x] Add video preview support where a browser-safe URL exists.
- [x] Add Config tab.
- [x] Add Issues tab.
- [x] Show provider token order.
- [x] Show model/provider/route identity.
- [x] Show camera type, lens, focal length, rig, and motion for panels.
- [x] Show color annotation key for `motion-annotation`.
- [x] Avoid raw filenames, ids, or generated role names as visible card labels
      unless they are the only meaningful project data available.

### Skills Repo

- [x] Update `media-producer/SKILL.md`.
- [x] Update `media-producer/references/shot-video-prompt-sheet.md`.
- [x] Update `media-producer/references/shot-video-take.md`.
- [x] Update prompt-sheet samples with `videoPromptImagePlan`.
- [x] Add a motion-annotation sample based on generic action/choreography, not
      Urban Basilica-specific facts.
- [x] Add a final `shot.video-take` preview sample with prompt-sheet and audio
      references.
- [x] Update `movie-director` routing guidance.
- [x] Update Skills repo README.
- [x] Remove one-panel-per-take-shot wording where it is now wrong.
- [x] Add the Generation Preview Dialog workflow before image/video generation.

### Documentation

- [x] Update media-generation architecture reference.
- [x] Update Studio coordination events reference.
- [x] Update Studio Skills reference.
- [x] Document preview command usage.
- [x] Document preview event as live UI coordination.
- [x] Document no offline preview backlog.
- [x] Document GPT-Image-2 default for video prompt images.

### Verification

- [x] Run focused Core tests.
- [x] Run focused CLI tests.
- [x] Run focused Studio server route tests.
- [x] Run focused Studio component test for dialog open/update/dismiss/reopen.
- [x] Run `pnpm --dir packages/core test` after Core contracts changed.
- [x] Run focused CLI tests after CLI changed.
- [x] Run focused Studio tests after Studio changed.
- [x] Run root `pnpm check` before marking the implementation complete.
- [x] Run `pnpm build`.
- [x] Verify no paid generation was invoked during tests.

Desktop browser behavior for open/update/dismiss/reopen is covered by
`packages/studio/src/features/generation-preview/generation-preview-dialog-host.test.tsx`.
No paid provider generation, no sample-project data, and no mobile viewport
verification were used for this implementation.
