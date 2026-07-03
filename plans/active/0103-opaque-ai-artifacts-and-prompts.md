# 0103 Opaque AI Artifacts And Prompts

Status: completed
Date: 2026-07-03

## Summary

Remove Studio-owned knowledge of AI artifact contents from media generation
contracts.

The immediate trigger is `shot.video-prompt-sheet`. The current implementation
requires a structured `videoPromptImagePlan` with style metadata, aspect ratio,
panels, panel numbers, captions, continuity notes, hard constraints, and
source-shot coverage checks. The style choice itself is valid deterministic
metadata, but bundling it inside a required image-content plan is the wrong
product model.

A video prompt sheet is an image artifact. Studio should know how the artifact
is attached to the project, which generation purpose produced it, which take it
belongs to, which provider/model/parameters were used, which deterministic
prompt-sheet visual style and notation mode were selected, and which logical
references were selected. Studio should not know whether the image contains one
panel, twelve panels, a diagram, a timing map, a collage, arrows, labels,
motion trails, or something a future model uses better than today's format.

This plan establishes the implementation path for ADR 0041:

```text
docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md
```

The accepted direction is:

1. AI-generated media artifacts are opaque to Studio.
2. Prompt strings are opaque to Studio.
3. Reference media contents are opaque to Studio.
4. Agent instructions and evals own creative interpretation, sheet layouts,
   prompt semantics, and artifact-content quality checks.
5. Core validates only the durable envelope: purpose, target, model,
   deterministic generation metadata such as `promptSheetVisualStyleId` and
   `promptSheetNotationModeId`,
   parameters, asset identity, relationships, selected references, file kinds,
   provider contracts, costs, receipts, and safety boundaries such as path/URL
   leaks.

## References Reviewed

- `AGENTS.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0024-keep-media-slicing-out-of-app-state.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `docs/decisions/0036-use-unsliced-location-sheets.md`
- `docs/decisions/0040-use-agent-media-execution-policy-for-external-built-in-image-generation.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/reference/studio-skills.md`
- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/client/scene-shot-list-json-schemas.ts`
- `packages/core/src/server/media-generation/shot-video-take/input-specs.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/core/src/server/media-generation/scene-storyboard-sheet.ts`
- `packages/core/src/server/media-generation/lookbook-image.ts`
- `packages/core/src/server/media-generation/lookbook-sheet.ts`
- `packages/core/src/server/media-generation/location-hero.ts`
- `packages/core/src/server/media-generation/location-environment-sheet.ts`
- `packages/core/src/server/media-generation/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`
- `packages/core/src/server/visual-language-json/validator.ts`
- `packages/core/src/client/visual-language-json-schemas.ts`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/README.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-prompt-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/scene-storyboard-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director/SKILL.md`

## Current Violations Found

### Required prompt-sheet content plan

The strongest violation is the `videoPromptImagePlan` contract.

Current code defines prompt-sheet internals in:

```text
packages/core/src/client/shot-video-take.ts
packages/core/src/client/scene-shot-list.ts
packages/core/src/client/generation-preview.ts
packages/core/src/client/scene-shot-list-json-schemas.ts
```

Current code validates prompt-sheet internals in:

```text
packages/core/src/server/media-generation/shot-video-take/input-specs.ts
packages/core/src/server/generation-preview/validation.ts
```

Current Studio UI renders prompt-sheet internals in:

```text
packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx
```

Current docs and skills teach the same model in:

```text
docs/architecture/reference/media-generation.md
docs/architecture/media-generation.md
docs/architecture/reference/studio-coordination-events.md
docs/architecture/reference/studio-skills.md
/Users/keremk/Projects/aitinkerbox/studio-skills/
```

Why this violates the principle:

- Studio requires the sheet to have 2 to 12 panels.
- Studio validates panel ids and panel numbers.
- Studio validates captions and action beat purposes.
- Studio validates whether every take shot is represented or skipped.
- Studio couples metadata such as `cinematic-realistic`,
  `handdrawn-storyboard`, and `motion-annotation` to the image-content plan.
- Studio treats `motion-annotation` as though it were mutually exclusive with
  cinematic or hand-drawn output, even though motion arrows and timing notation
  can appear on either visual style.
- Studio validates reference-mode compatibility based on that bundled metadata
  instead of treating metadata axes as independent deterministic options.

The panel, caption, shot-coverage, and content-plan parts belong in agent
instructions and evals, not in Studio runtime contracts. The visual style and
notation mode belong in Studio as deterministic prompt-sheet metadata, suitable
for future UI controls and for agent-authored JSON.

### App-owned prompt construction requiring classification

Several generation modules take an authored prompt string and add application
instructions before sending the provider payload. These are not automatically
wrong. The ownership question is whether the prompt expansion is making a
creative choice, or whether it is an accepted Studio product optimization for a
specific output role.

Examples found:

```text
packages/core/src/server/media-generation/scene-storyboard-sheet.ts
packages/core/src/server/media-generation/lookbook-image.ts
packages/core/src/server/media-generation/lookbook-sheet.ts
packages/core/src/server/media-generation/location-hero.ts
packages/core/src/server/media-generation/location-environment-sheet.ts
packages/core/src/server/media-generation/cast-character-sheet.ts
packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts
```

Representative behavior:

- `scene-storyboard-sheet.ts` hardcodes a 4:3 storyboard sheet, up to four
  panels, panel order, empty panel slots, drawing style, gutters, label rules,
  and storyboard lookbook usage. This is accepted as a valid app-owned batch
  generation optimization because the purpose exists to generate several
  storyboard images in one request.
- `lookbook-image.ts` and `lookbook-sheet.ts` add creative phrases such as
  "cinematic visual-language sample" and "storyboard style sample".
- `location-hero.ts` constructs a new prompt from a source Location Sheet and
  adds layout/content rules.
- `cast-character-sheet.ts` generates a character-sheet dependency prompt from
  context and a reason string.
- `shot-video-take/provider-payloads.ts` appends reference-conditioning prose
  to shot input prompts.

This is not the same as validating generated media contents. It needs a
product-owner review by category:

- If the expansion exists because Studio is producing an app-specific artifact,
  such as a storyboard batch sheet, profile image, or Location Hero Image, it
  may be valid in core.
- If the expansion makes a creative story, style, layout, or interpretation
  choice that should belong to the user/agent loop, move that choice to agent
  instructions or authored prompt text.
- If ownership is unclear, keep it on the audit list until the product decision
  is explicit.

### Scene storyboard sheet batch workflow

Scene storyboard generation is a confirmed app-owned optimization. It generates
a composite sheet so Studio can obtain up to four storyboard images from one
generation request. The strict prompt and composite layout should remain.

Current files:

```text
packages/core/src/server/media-generation/scene-storyboard-sheet.ts
packages/core/src/server/scene-shot-list-json/validator.ts
packages/core/src/client/scene-shot-list-json-schemas.ts
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/scene-storyboard-sheet.md
```

Important nuance:

- Core does not store crop boxes as durable sheet interpretation metadata.
- The import contract does require cropped per-shot images.
- Agent skills currently inspect the composite, identify panels, crop them, and
  import the cropped images.
- This is allowed because the purpose is not a user-controlled prompt-sheet
  format. It is an application-specific batch generation path.

### Agent skill contract violations

The sister project contains many explicit instructions that are now wrong:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/README.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-prompt-sheet.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/shot-video-prompt-sheet-spec.json
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/generation-preview-motion-annotation-prompt-sheet.json
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director/SKILL.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director/references/workflow-playbooks.md
```

Examples:

- Skills tell agents to include `videoPromptImagePlan`.
- Samples include `styleId`, `panels`, `panelNumber`, and `annotationKey`
  inside `videoPromptImagePlan`; style/notation values should move to
  `promptSheetVisualStyleId` and `promptSheetNotationModeId`, while
  panel/content fields should disappear from the Studio contract.
- Final-video guidance assumes prompt-sheet panels always exist and tells
  agents to read panels in order unconditionally.

After the core contract changes, these skill instructions must be rewritten so
agents may choose any sheet format and keep any sheet-interpretation logic in
their own prompt/eval loop. Skills should still provide detailed prompt-writing
instructions for prompt-sheet generation, including how to choose references,
how to write prompts for each visual-style and notation-mode combination, and
how to inspect or revise the generated image.

## Non-Violations Confirmed

The opaque-artifact principle does not remove all structured validation from
Studio.

These areas are still valid because they are durable Studio domain documents,
provider-envelope contracts, or accepted app-owned generation transforms, not
AI media artifact content validation:

- Screenplay JSON shape validation.
- Scene Shot List JSON shape validation.
- Cast Design and Location Design document schemas.
- Inspiration Analysis and Lookbook document schemas, as long as they remain
  structured project direction rather than claims about generated image
  contents.
- Asset registration, media kind checks, MIME/file extension checks, and
  project-relative path validation.
- Reference selection validation by asset id, relationship, purpose, role,
  required provider media kind, and model capability.
- Provider payload JSON Schema validation owned by `packages/engines`.
- `scene.storyboard-sheet` strict prompt/composite workflow, because it is an
  app-owned batch generation optimization for producing several storyboard
  images in one request.
- Preview validation that prevents local paths or provider upload URLs from
  leaking into stored/displayed previews.

The dividing line is simple:

- Studio may validate the envelope it owns.
- Studio may own deterministic application transforms for specific product
  surfaces or provider optimizations.
- Studio may not validate, parse, score, or require the creative contents of an
  user/agent-owned AI prompt, sheet, image, audio, video, or reference artifact.

## Goals

- Remove `videoPromptImagePlan` from public runtime contracts.
- Preserve prompt-sheet visual style as explicit metadata named
  `promptSheetVisualStyleId`, with values `cinematic-realistic` and
  `handdrawn-storyboard`.
- Preserve prompt-sheet notation mode as explicit metadata named
  `promptSheetNotationModeId`, with values `none` and `motion-annotation`.
- Treat motion annotation as orthogonal to visual style, so a cinematic sheet
  or a hand-drawn sheet can both use motion arrows/timing notation.
- Remove all core validation of prompt-sheet image internals.
- Treat `shot.video-prompt-sheet` as an opaque image dependency for a Scene Shot
  Video Take.
- Let prompt-sheet layout, panel count, annotation style, motion notation,
  captions, timing, and final-video interpretation live in agent instructions
  and evals only.
- Keep strict validation for project-owned envelopes, references, files,
  provider schema, cost/approval, and safety.
- Update Studio preview UI so it displays prompt, references, provider/model,
  configuration, diagnostics, and payload preview without a structured
  prompt-sheet plan tab.
- Update agent-facing skills and samples so agents no longer produce
  `videoPromptImagePlan`.
- Keep detailed prompt-sheet prompt-writing guidance in skills. The agent
  still owns choosing references and writing detailed prompts for each visual
  style and notation-mode combination.
- Add tests and architecture checks that prevent this concept from returning.

## Non-Goals

- Do not preserve `videoPromptImagePlan` as an accepted runtime field.
- Do not add a compatibility alias, compatibility loader, warning, or repair
  path for `videoPromptImagePlan`.
- Do not move prompt-sheet content validation into Studio routes, React, CLI, or
  skill wrappers.
- Do not replace structured Studio domain documents such as Screenplay, Scene
  Shot List, Lookbook, Inspiration Analysis, Cast Design, or Location Design
  with opaque blobs in this slice.
- Do not remove provider capability validation.
- Do not remove asset ownership, media kind, reference selection, or dependency
  graph validation.
- Do not remove user/agent media inspection workflows. Agents may inspect
  artifacts; Studio runtime must not encode those judgments as schema or
  validation.
- Do not optimize or test mobile behavior.

## Product Contract

### Prompt strings

User-authored and agent-authored prompt strings are opaque authored text.

Core may validate:

- the field exists when required;
- the field is a string;
- the field is non-empty when the purpose requires a prompt;
- provider-specific size/schema limits when exposed by the provider catalog;
- that local paths and provider upload URLs are not leaked through preview
  snapshots.

Core must not validate:

- whether the prompt names every reference;
- whether the prompt describes every shot;
- whether the prompt says "panel", "caption", "motion", "style", or any other
  creative instruction;
- whether the prompt follows a house template;
- whether the prompt contains a particular negative prompt phrase;
- whether the prompt is "good enough" for a model.

Core may author or expand prompts only for accepted app-specific generation
transforms. Those prompts must be deterministic implementation of a Studio
product surface or generation optimization, not a creative choice that should
belong to the user/agent loop.

Accepted example:

- `scene.storyboard-sheet` uses a strict prompt and fixed composite layout to
  generate multiple storyboard images in one provider request.

Requires product-owner investigation:

- Lookbook image/sheet prompt expansion.
- Location environment sheet prompt expansion.
- Location Hero Image prompt expansion.
- Cast profile or character-sheet prompt expansion.
- Shot-video reference-conditioning prose.

### Reference artifacts

References are project assets and provider inputs.

Core may validate:

- asset id;
- asset file id;
- project-relative path;
- media kind;
- MIME type/file extension where needed for provider compatibility;
- ownership relationship;
- selected reference role;
- provider input count/route capability;
- provider token order.

Core must not validate:

- what the image depicts;
- whether the image contains panels;
- whether labels are readable;
- whether an audio reference says the expected words;
- whether a video reference contains the expected action;
- whether a sheet visually matches a description.

### Generated sheets

Sheets are image artifacts.

Core may validate:

- purpose;
- target;
- deterministic prompt-sheet visual style and notation-mode metadata;
- generated output media kind;
- import relationship;
- selected dependency slot;
- cost/receipt/provenance.

Core must not validate:

- panel count;
- panel ids;
- panel order;
- captions;
- annotation colors;
- motion arrows;
- whether the generated pixels visually match `promptSheetVisualStyleId` or
  `promptSheetNotationModeId`;
- whether shots are represented;
- whether text is inside or outside panel image content.

## Target Contract Changes

### Update `packages/core/src/client/shot-video-take.ts`

Keep prompt-sheet visual style metadata as:

```ts
export type VideoPromptSheetVisualStyleId =
  | 'cinematic-realistic'
  | 'handdrawn-storyboard';
```

Keep prompt-sheet notation metadata as:

```ts
export type VideoPromptSheetNotationModeId =
  | 'none'
  | 'motion-annotation';
```

Add the prompt-sheet-only fields:

```ts
promptSheetVisualStyleId?: VideoPromptSheetVisualStyleId;
promptSheetNotationModeId?: VideoPromptSheetNotationModeId;
```

to:

```ts
ShotVideoTakeInputGenerationSpec
```

Both fields are required when `purpose` is `shot.video-prompt-sheet` and
forbidden for `shot.first-frame`, `shot.last-frame`, and
`shot.reference-image`.

Delete these public types:

```ts
VideoPromptAnnotationKey
VideoPromptImagePlan
VideoPromptPanel
```

Remove this field:

```ts
videoPromptImagePlan?: VideoPromptImagePlan;
```

from:

```ts
ShotVideoTakeInputGenerationSpec
```

### Remove from `packages/core/src/client/scene-shot-list.ts`

Remove `videoPromptImagePlan` from:

```ts
SceneShotVideoTakeProductionState['agentProposal']['dependencyDrafts'][number]
```

The dependency draft should keep only the generation envelope:

```ts
purpose
target
planId
dependencyKind
outputInputKind
modelChoice
promptSheetVisualStyleId
promptSheetNotationModeId
referenceMode
prompt
parameterValues
title
```

`promptSheetVisualStyleId` and `promptSheetNotationModeId` are required only
for `shot.video-prompt-sheet` dependency drafts.

### Remove from `packages/core/src/client/generation-preview.ts`

Remove:

```ts
videoPromptImagePlan?: VideoPromptImagePlan;
```

`GenerationPreviewSnapshot` should preview only:

- purpose;
- target;
- model;
- prompt-sheet visual style and notation metadata when purpose is
  `shot.video-prompt-sheet`;
- final prompt;
- logical references;
- configuration;
- diagnostics;
- optional sanitized provider preview;
- optional estimate.

### Remove from `packages/core/src/client/scene-shot-list-json-schemas.ts`

Delete:

```ts
videoPromptImagePlanSchema()
videoPromptPanelSchema()
```

Remove `videoPromptImagePlan` from `dependencyDrafts` schema.

Add schema support for `promptSheetVisualStyleId` as a prompt-sheet generation
metadata enum with:

```text
cinematic-realistic
handdrawn-storyboard
```

Add schema support for `promptSheetNotationModeId` as a prompt-sheet generation
metadata enum with:

```text
none
motion-annotation
```

### Remove from `packages/core/src/server/media-generation/shot-video-take/input-specs.ts`

Delete:

```ts
validateVideoPromptImagePlan()
validateVideoPromptPanels()
throwVideoPromptPlanError()
```

Remove:

- the requirement that `shot.video-prompt-sheet` has
  `videoPromptImagePlan`;
- the error for non-prompt-sheet purposes that include
  `videoPromptImagePlan`.

Add:

- a requirement that `shot.video-prompt-sheet` has valid
  `promptSheetVisualStyleId` and `promptSheetNotationModeId` values;
- a forbidden-field diagnostic when non-prompt-sheet shot input purposes include
  either prompt-sheet metadata field;
- no validation that the image contents match the selected visual style or
  notation mode.

Because this is pre-customer software, callers should be updated directly and
the obsolete field should disappear from the current runtime model.

### Remove from `packages/core/src/server/generation-preview/validation.ts`

Remove `videoPromptImagePlan` validation and forbidden-field logic.

Keep and strengthen preview safety validation:

- recursively reject local paths and provider upload URLs in
  `providerPreview.payload`;
- continue validating logical references as project references;
- continue validating target/model/prompt/configuration envelope fields.

### Update `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`

Remove the plan tab and `PanelCard`.

The preview dialog should show:

- prompt text;
- prompt-sheet visual style and notation metadata when present;
- logical references;
- provider/model/configuration;
- diagnostics;
- sanitized provider payload when present.

It should not show:

- prompt-sheet aspect;
- prompt-sheet panel count;
- annotation key;
- panel cards;
- continuity notes;
- hard constraints.

### Update persisted development data

If existing development databases can contain `videoPromptImagePlan` inside
JSON columns, add a one-way cleanup migration or focused migration utility that
removes that field from current persisted JSON.

Allowed migration mentions of `videoPromptImagePlan` are limited to one-way
cleanup of existing development data. Runtime validators, schemas, DTOs, UI,
and tests must not keep recognizing it.

## Implementation Slices

### Slice 1: Core contract removal

- Remove public `VideoPromptImagePlan`, `VideoPromptAnnotationKey`, and
  `VideoPromptPanel` types.
- Add public `VideoPromptSheetVisualStyleId` and
  `VideoPromptSheetNotationModeId`.
- Add `promptSheetVisualStyleId` and `promptSheetNotationModeId` to
  prompt-sheet specs, previews, and take production dependency drafts.
- Remove `videoPromptImagePlan` fields from generation specs, preview
  snapshots, and take production state.
- Remove JSON schema support for the obsolete field.
- Remove prompt-sheet content validation from input specs and preview
  validation.
- Keep `shot.video-prompt-sheet` as a purpose, dependency kind, input kind, and
  import path.
- Keep `referenceMode` only if it remains an envelope-level reference selection
  mechanism. If it exists only to infer sheet style, remove or rename it in the
  same slice.

### Slice 2: Preview safety and UI

- Recursively validate `providerPreview.payload` for leaked local paths and
  provider upload URLs.
- Remove the structured prompt-sheet Plan tab from Studio.
- Update Studio tests and route fixtures.
- Ensure preview events still support opaque prompt-sheet image generation.

### Slice 3: Tests and architecture guardrails

- Delete tests that require or forbid `videoPromptImagePlan`.
- Add tests proving `shot.video-prompt-sheet` accepts arbitrary prompt text
  without a plan.
- Add tests proving a one-panel, no-panel, or non-panel prompt description does
  not matter to core as long as the generation envelope is valid.
- Add tests proving preview validation does not parse prompt text.
- Add tests proving preview validation rejects leaked provider/local paths
  recursively.
- Add an architecture/static test that fails if runtime code reintroduces:
  - `VideoPromptImagePlan`;
  - `VideoPromptPanel`;
  - `videoPromptImagePlan`;
  - prompt-sheet metadata inside content-plan/runtime image-understanding
    schemas;
  - prompt-sheet panel validation error codes.

### Slice 4: Documentation

- Update `docs/architecture/reference/media-generation.md`.
- Update `docs/architecture/media-generation.md`.
- Update `docs/architecture/reference/studio-coordination-events.md`.
- Update `docs/architecture/reference/studio-skills.md`.
- Mark plan 0099 as superseded by ADR 0041 for the structured prompt-sheet
  contract. Do not edit the historical plan just to rewrite old names.
- Ensure the docs say prompt sheets are opaque image dependencies.

### Slice 5: Agent skills

Update the sister project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

Required changes:

- Remove `videoPromptImagePlan` from media-producer instructions and samples.
- Move prompt-sheet visual style selection to `promptSheetVisualStyleId` in
  media-producer instructions and samples.
- Move prompt-sheet notation selection to `promptSheetNotationModeId` in
  media-producer instructions and samples.
- Make clear that `motion-annotation` is a notation mode that can combine with
  either cinematic-realistic or handdrawn-storyboard visual style.
- Remove mandatory 2-to-12 panel requirements.
- Reframe prompt-sheet plan JSON as removed from the Studio contract, while
  keeping detailed prompt-writing and reference-selection guidance as required
  agent skill behavior.
- Keep agent/eval guidance free to recommend panels, motion maps, annotations,
  or any other prompt-sheet strategy, and make clear that agents own writing
  the detailed prompts for each metadata combination.
- Update final-video prompt-sheet handoff guidance so it does not assume panels
  exist. It may say "interpret the sheet according to the agent-authored brief
  or visible content" only as agent guidance.
- Update movie-director routing text.
- Update cached bundled skill sources only through the normal skill/plugin
  build process, not by editing plugin cache files directly.

Target skill contract:

- Agents must not produce `videoPromptImagePlan` JSON.
- Agents must provide `promptSheetVisualStyleId` and
  `promptSheetNotationModeId` in prompt-sheet specs/previews once the core
  contract supports them.
- Agents still own prompt-sheet creative direction. Skills should provide
  detailed instructions for writing prompts for cinematic sheets, hand-drawn
  sheets, plain sheets, and motion-annotated sheets, including the combinations
  of those axes.
- Agents still own choosing the logical references needed for the prompt sheet,
  describing how those references should guide the generation, inspecting the
  resulting image, and revising through evals/user feedback.
- Agents may use panels, numbered beats, arrows, captions, diagrams, motion
  trails, timing marks, or any other strategy as prompt-writing guidance, but
  those structures must not be represented as required Studio JSON.

### Slice 6: App-owned prompt transform audit

Audit app-owned prompt construction in:

```text
packages/core/src/server/media-generation/lookbook-image.ts
packages/core/src/server/media-generation/lookbook-sheet.ts
packages/core/src/server/media-generation/location-hero.ts
packages/core/src/server/media-generation/location-environment-sheet.ts
packages/core/src/server/media-generation/cast-character-sheet.ts
packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts
```

`scene.storyboard-sheet` is already classified as a valid app-owned batch
generation transform. Keep its strict prompt and composite layout.

For each remaining module, classify current behavior with product-owner review:

- envelope/mechanical provider mapping, keep in core;
- selected project context pass-through, keep in core if it supports the
  accepted artifact role;
- accepted app-owned generation transform, keep in core and document why;
- creative choice that belongs to user/agent, move to agent instructions or
  require an explicitly authored prompt in the spec;
- artifact-content assumptions, remove from runtime contract.

## Validation And Test Strategy

The test suite should protect the new boundary.

Core tests should prove:

- `shot.video-prompt-sheet` specs validate without `videoPromptImagePlan`;
- prompt text is not parsed for panel words, shot ids, captions, or reference
  mentions;
- reference selections are still validated by logical asset identity and route
  capability;
- provider payload previews reject leaked paths recursively;
- generation preview snapshots do not accept or require sheet internals;
- obsolete `videoPromptImagePlan` symbols are absent from current public
  runtime contracts.

Studio tests should prove:

- Generation Preview Dialog renders without a Plan tab;
- prompt-sheet previews still show prompt, references, provider configuration,
  diagnostics, and payload preview;
- no UI assumes prompt-sheet panels.

CLI tests should prove:

- `renku generation create/validate/estimate/run --purpose
  shot.video-prompt-sheet` works with an opaque prompt-sheet spec;
- sample JSON no longer includes `videoPromptImagePlan`;
- CLI errors describe envelope problems only.

Skill validation should prove:

- media-producer instructions no longer require structured prompt-sheet plans;
- media-producer instructions still provide detailed prompt-writing and
  reference-selection guidance for prompt sheets;
- motion annotation is documented as a notation mode that can combine with
  either visual style;
- examples use opaque prompt strings and logical references;
- final video handoff guidance remains agent-owned.

## Completion Checklist

### Review Area

- [x] Confirm ADR 0041 is accepted and linked from `AGENTS.md`.
- [x] Confirm this plan is referenced by the prompt-sheet cleanup PR.
- [x] Confirm reviewers treat artifact-content validation as an architectural
      boundary violation.
- [x] Confirm old review comments about "populate prompt-sheet plans" are
      closed by removing the plan contract, not by auto-generating plans.

### Architecture And Contracts

- [x] Replace `VideoPromptImageStyleId` with
      `VideoPromptSheetVisualStyleId`.
- [x] Add `VideoPromptSheetNotationModeId`.
- [x] Remove `VideoPromptAnnotationKey`.
- [x] Remove `VideoPromptImagePlan`.
- [x] Remove `VideoPromptPanel`.
- [x] Add `promptSheetVisualStyleId` to prompt-sheet input specs.
- [x] Add `promptSheetNotationModeId` to prompt-sheet input specs.
- [x] Add both prompt-sheet metadata fields to prompt-sheet dependency drafts.
- [x] Add both prompt-sheet metadata fields to prompt-sheet generation
      previews.
- [x] Remove `videoPromptImagePlan` from `ShotVideoTakeInputGenerationSpec`.
- [x] Remove `videoPromptImagePlan` from take production dependency drafts.
- [x] Remove `videoPromptImagePlan` from `GenerationPreviewSnapshot`.
- [x] Remove prompt-sheet plan JSON schemas.
- [x] Keep `shot.video-prompt-sheet` as an opaque image generation purpose.
- [x] Keep asset, relationship, dependency, provider, and path validation
      strict.

### Core Implementation

- [x] Delete `validateVideoPromptImagePlan`.
- [x] Delete `validateVideoPromptPanels`.
- [x] Delete prompt-sheet plan diagnostic codes from active runtime code.
- [x] Remove plan validation from input spec validation.
- [x] Remove plan validation from generation preview validation.
- [x] Add `promptSheetVisualStyleId` enum validation as metadata validation.
- [x] Add `promptSheetNotationModeId` enum validation as metadata validation.
- [x] Add tests proving `motion-annotation` can combine with either
      `cinematic-realistic` or `handdrawn-storyboard`.
- [x] Add recursive provider preview payload path/URL leak validation.
- [x] Remove any runtime field handling whose only purpose is recognizing
      `videoPromptImagePlan`.
- [x] Add one-way persisted JSON cleanup if existing development databases need
      it.

### Studio Implementation

- [x] Remove `VideoPromptPanel` import from the preview dialog.
- [x] Remove the Plan tab.
- [x] Remove `PanelCard`.
- [x] Update preview fixtures.
- [x] Ensure prompt-sheet previews render as generic generation previews.

### CLI And Samples

- [x] Update CLI fixtures for `shot.video-prompt-sheet`.
- [x] Update sample generation spec JSON.
- [x] Confirm CLI validation reports only envelope errors.

### Agent Surfaces

- [x] Update `studio-skills` README.
- [x] Update media-producer skill instructions.
- [x] Update shot-video-prompt-sheet reference.
- [x] Update shot-video-take reference.
- [x] Update movie-director routing guidance.
- [x] Update sample prompt-sheet specs and generation previews.
- [x] Remove required panel-count language from skills.
- [x] Move visual-style guidance to `promptSheetVisualStyleId` metadata
      language in skills.
- [x] Move motion-annotation guidance to `promptSheetNotationModeId` metadata
      language in skills.
- [x] Keep detailed agent-owned prompt-writing guidance for each visual-style
      and notation-mode combination.
- [x] Keep guidance for choosing and including the logical references needed to
      generate the prompt sheet.

### App-Owned Prompt Transform Audit

- [x] Classify prompt construction in lookbook image generation.
- [x] Classify prompt construction in lookbook sheet generation.
- [x] Document `scene.storyboard-sheet` as an accepted app-owned batch
      generation transform and keep its strict prompt/composite layout.
- [x] Classify prompt construction in location environment sheet generation.
- [x] Classify prompt construction in location hero generation.
- [x] Classify prompt construction in cast character sheet dependency drafts.
- [x] Classify reference-conditioning prompt expansion in shot-video payloads.
- [x] Bring ambiguous prompt construction cases to product-owner review before
      moving them out of core or preserving them as app-owned transforms.

### Documentation

- [x] Update media generation architecture docs.
- [x] Update Studio coordination event docs.
- [x] Update Studio skills architecture docs.
- [x] Add a short note where needed that historical plan 0099 is superseded for
      structured prompt-sheet contracts.

### Verification

- [x] Run `pnpm build:core`.
- [x] Run focused core tests for shot-video take input specs.
- [x] Run focused core tests for generation preview validation.
- [x] Run focused Studio preview dialog tests.
- [x] Run focused CLI generation command tests.
- [x] Run architecture/static tests.
- [x] Search the workspace for `videoPromptImagePlan`,
      `VideoPromptImagePlan`, and `VideoPromptPanel`; only historical plans,
      accepted ADR rationale, and one-way migration cleanup may mention them.
- [x] Search `studio-skills` for the same obsolete names and remove active
      instructions that require them.
