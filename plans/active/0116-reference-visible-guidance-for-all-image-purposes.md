# 0116 Reference-Visible Guidance For All Image Purposes

Status: draft
Date: 2026-07-06

## Summary

Extend the reference-visible prompting guidance from `cast.character-sheet` to
every existing Renku Studio image-generation purpose documented in the
`studio-skills` media-producer skill.

The first implementation pass for
`0113-reference-visible-image-prompting-guidance.md` correctly moved the shared
prompting guide into the skills repository:

```text
studio-skills/skills/media-producer/references/reference-visible-image-prompting.md
```

That file is the owning source for agent prompt-writing guidance. Do not add a
new Studio architecture reference page for this prompt-writing guide. The
Studio repository may keep this active implementation plan, because plans live
here, but durable agent-facing instructions belong in `studio-skills`.

This plan is a full sweep of the remaining image purposes and samples. It
should update the skills docs where provider-facing examples still imply that a
model can see Studio selection state, approval state, active department
documents, or prior images that are not attached as provider inputs.

## Ownership Boundary

This is primarily a Studio Skills update.

Allowed changes:

- update `studio-skills/skills/media-producer/SKILL.md`;
- update `studio-skills/skills/media-producer/references/*.md`;
- update `studio-skills/skills/media-producer/samples/*.json`;
- update Core only where Core-owned deterministic provider prompt scaffolds
  still append provider-facing reference language that conflicts with this
  guidance.

Forbidden changes:

- do not create a Studio architecture reference page for skill prompt-writing
  guidance;
- do not add runtime validation that parses or grades prompt text;
- do not validate generated image contents;
- do not add prompt-content compatibility shims or obsolete phrase detectors;
- do not move creative prompt QA into Studio React, server routes, CLI
  handlers, or Core validators.

Core may continue to validate the envelope it owns: purpose, target, model,
provider route, source/reference asset ownership, selected dependency slots,
provider parameter shape, cost, provenance, and preview safety.

## Generation Preview Review Gate

The current media-producer instructions partially require Studio's generation
preview dialog before paid generation, but the rule is purpose-specific. It is
explicit for `cast.character-sheet`, `shot.video-prompt-sheet`, and final
`shot.video-take`; it is not yet stated as a cross-purpose requirement for all
Renku-managed image-generation specs.

This sweep must add that missing agent instruction:

- for every Renku-managed image-generation purpose, agents must show the Studio
  generation preview dialog and ask the user to review it before any real
  provider-backed generation run;
- the dialog review must cover the prompt, model/route, settings, source image
  or attached references, and any project-derived context that would be sent to
  the model provider;
- if the user changes the prompt, references, model, route, or parameters,
  agents must revise the same spec or preview, show the preview again, and
  only continue after the user approves the updated preview;
- this is an agent workflow gate, not Studio runtime prompt-content validation.
  Do not add validators that parse creative prompt text or score image contents.

## Swept Files

Media-producer references reviewed:

- `studio-skills/skills/media-producer/SKILL.md`
- `studio-skills/skills/media-producer/references/reference-visible-image-prompting.md`
- `studio-skills/skills/media-producer/references/workflow.md`
- `studio-skills/skills/media-producer/references/cast-character-sheet.md`
- `studio-skills/skills/media-producer/references/character-images.md`
- `studio-skills/skills/media-producer/references/cast-profile.md`
- `studio-skills/skills/media-producer/references/voice-over-profile-image.md`
- `studio-skills/skills/media-producer/references/lookbook-image.md`
- `studio-skills/skills/media-producer/references/lookbook-sheet.md`
- `studio-skills/skills/media-producer/references/location-environment-sheet.md`
- `studio-skills/skills/media-producer/references/location-sheet-board-design.md`
- `studio-skills/skills/media-producer/references/scene-storyboard-sheet.md`
- `studio-skills/skills/media-producer/references/shot-first-last-frame.md`
- `studio-skills/skills/media-producer/references/shot-reference-images.md`
- `studio-skills/skills/media-producer/references/shot-video-prompt-sheet.md`
- `studio-skills/skills/media-producer/references/shot-video-take.md`

Samples reviewed:

- `studio-skills/skills/media-producer/samples/cast-profile-spec.json`
- `studio-skills/skills/media-producer/samples/location-environment-sheet-spec.json`
- `studio-skills/skills/media-producer/samples/location-hero-spec.json`
- `studio-skills/skills/media-producer/samples/scene-storyboard-sheet-spec.json`
- `studio-skills/skills/media-producer/samples/shot-first-frame-spec.json`
- `studio-skills/skills/media-producer/samples/shot-last-frame-spec.json`
- `studio-skills/skills/media-producer/samples/shot-reference-image-spec.json`
- `studio-skills/skills/media-producer/samples/shot-video-prompt-sheet-spec.json`
- `studio-skills/skills/media-producer/samples/shot-video-take-final-spec.json`
- `studio-skills/skills/media-producer/samples/shot-video-take-production-group.json`
- `studio-skills/skills/media-producer/samples/generation-preview-motion-annotation-prompt-sheet.json`
- `studio-skills/skills/media-producer/samples/generation-preview-shot-video-take-final.json`

Core prompt scaffolds searched:

- `packages/core/src/server/media-generation/purposes/*`
- `packages/core/src/server/media-generation/purposes/shot-video-take/**`

## Current Findings

### Already Mostly Aligned

`cast.character-sheet` and `character-images.md` now contain explicit
text-to-image, reference-to-image, and source-image edit guidance. They should
only need a light consistency pass after the rest of the media-producer docs are
updated.

`shot-first-last-frame.md` now has a reference-visible example that names
`Reference 1`, `Reference 2`, and `Reference 3`. It still needs a broader pass
to clarify that `selected Movie Lookbook`, `selected Location Sheets`, and
`selected Character Sheets` are Core context terms, not wording to paste into
provider prompts.

`location.hero` examples already say the hero is derived from the supplied
Location Sheet. They need a tighter source-image edit skeleton and QA rule, not
a conceptual rewrite.

### Cast Profile

`cast-profile.md` distinguishes text-to-image and edit models, but it does not
yet give route-specific prompt skeletons.

Needed updates:

- add a text-to-image profile skeleton for no source image;
- add a source-image edit skeleton for `sourceAssetId`;
- explain that a selected character sheet is provider-visible only when passed
  as the edit source image;
- update `cast-profile-spec.json`, which currently says `selected Movie
  Lookbook visual language` in provider-facing prompt text;
- link voice-over profile guidance back to the shared reference-visible guide.

### Voice-Over Profile Image

`voice-over-profile-image.md` is conceptually strong, but its prompt shape says
`visually consistent with the active lookbook`. That should become concrete
palette, contrast, light, texture, motif, and atmosphere language.

Needed updates:

- translate active Movie Lookbook and active Cast Design into visible symbolic
  cues before provider prompt text;
- keep the no-human-face/no-avatar guardrail;
- add a short text-to-image skeleton that avoids app-private terms.

### Lookbook Image

`lookbook-image.md` is mostly about workflow and placement. It should still
adopt the shared guide because Lookbook images can use existing Lookbook images
or inspiration as evidence.

Needed updates:

- explain that existing Lookbook images are agent evidence unless they are
  attached as references;
- add a model-neutral prompt skeleton for Movie Lookbook images and Storyboard
  Lookbook images;
- require inspiration/reference images to be named by visible role when they
  are attached;
- clarify that section placement tags are not provider-visible creative
  instructions.

### Lookbook Sheet

`lookbook-sheet.md` is strong on layout and QA, but it says existing Lookbook
images are evidence without describing how attached references should be named.

Needed updates:

- add a short "references, if attached" section:
  `Reference 1 supplies palette`, `Reference 2 supplies textile texture`, and
  similar role wording;
- keep Movie Lookbook and Storyboard Lookbook sheet skeletons separate;
- clarify that source inspiration names are not provider-visible unless
  translated into visual traits or attached as references;
- update samples only if they use app-private shorthand.

### Location Environment Sheet

`location-environment-sheet.md` and `location-sheet-board-design.md` still use
phrases such as `active Location Design`, `selected Movie Lookbook`, and
`selected location references` near prompt-building guidance.

These are fine as context-reading terms, but provider prompts should translate
them.

Needed updates:

- separate "context terms" from "provider-facing prompt terms";
- rewrite the board-design prompt skeleton so it says palette, texture, lens
  feel, light behavior, material surfaces, geography, landmarks, and scale
  instead of `Use the selected Movie Lookbook`;
- add reference roles for attached location references and anti-references:
  architecture, set dressing, palette/light, geography, period detail, and
  exclusion source;
- update `location-environment-sheet-spec.json`, which currently says
  `selected Movie Lookbook texture and lighting behavior`.

### Location Hero

The Location Hero workflow is source-image edit oriented. It must keep source
image language separate from reference-to-image language.

Needed updates:

- add a source-image edit skeleton:
  `Source image: Location Sheet. Preserve... Change to one 16:9 hero image...`;
- forbid prompts that say `match current Location Sheet` unless the sheet is
  the source image or an attached reference;
- keep the existing import/source-sheet rules;
- review `location-hero-spec.json` for consistency.

### Scene Storyboard Sheet

`scene-storyboard-sheet.md` currently says `Match the selected Storyboard
Lookbook sheet` in an example prompt. The selected Storyboard Lookbook sheet is
provider-visible only when Core attaches it.

Needed updates:

- rewrite the example as:
  `Use Reference 1, the attached Storyboard Lookbook sheet, for line quality...`;
- distinguish selected shot ids and selected Storyboard Lookbook as internal
  context from provider-visible reference labels;
- translate Movie Lookbook context into palette, texture, light, composition,
  and tone cues instead of app-private names;
- update `scene-storyboard-sheet-spec.json`, which says `selected foundry
  shots`.

### Shot First Frame And Last Frame

The first-frame example is now aligned, but the requirements still use
selection language heavily.

Needed updates:

- add explicit prompt skeletons for:
  - no attached references;
  - attached Lookbook sheet plus Character Sheet plus Location Sheet;
  - first-frame source continuity for last-frame prompts;
- update `shot-last-frame-spec.json`, which says `approved first frame`;
- update production-group first/last-frame draft prompts that say `selected
  composition, motion, cast, location, lookbook, and prop references`.

### Shot Reference Image

`shot-reference-images.md` explains the purpose well, but the sample prompt
says the prop reference is for `approved first and last frames`.

Needed updates:

- add a provider-facing skeleton that names the reference image's downstream
  role without referring to approval state;
- require attached style/continuity inputs to be role-labeled when used;
- update `shot-reference-image-spec.json`.

### Shot Video Prompt Sheet

`shot-video-prompt-sheet.md` still contains several provider-facing or
template-facing phrases that say `selected Movie Lookbook sheet`, `selected
Location Sheets`, and `selected Character Sheets`.

Needed updates:

- keep selection language in context and CLI explanation sections only;
- rewrite the reusable prompt template to use attached reference roles:
  `Reference 1: Movie Lookbook sheet`, `Reference 2: Location Sheet`,
  `Reference 3: Character Sheet`;
- update validation checklist wording from "name the selected..." to "name the
  attached/provider-visible...";
- update `generation-preview-motion-annotation-prompt-sheet.json` if it relies
  on `logical references` without explicit prompt roles;
- check `shot-video-prompt-sheet-spec.json` for role language.

### Shot Video Take

`shot-video-take.md` is a video purpose, but it consumes image dependencies and
contains image-reference prompt guidance for final video prompts. It should not
be excluded from this sweep.

Needed updates:

- keep selected input terminology for Core state and CLI commands;
- rewrite provider-facing prompt examples so `selected first and last frames`
  become provider tokens or visible source roles, such as `@Image1 first frame`
  and `@Image2 last frame`;
- replace vague `Preserve all selected references exactly` with provider-token
  roles and visible constraints;
- update `shot-video-take-final-spec.json`,
  `shot-video-take-production-group.json`, and any preview examples where
  selected references are not role-labeled.

### Core Scaffolds

Most remaining Core strings that mention `selected` are diagnostics,
dependency reasons, or internal preview labels. Those are acceptable because
they are not provider-facing prompts.

Core provider-facing strings that should be checked during implementation:

- `shotInputReferencePrompt` in
  `packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.ts`;
- `promptNotesForReferences` in
  `packages/core/src/server/media-generation/purposes/shot-video-take/planning/shot-input-references.ts`;
- deterministic dependency draft prompt builders for image purposes.

Do not add Core validators that parse prompt text. If Core wording changes are
needed, keep them deterministic and purpose-scaffolded.

## Implementation Plan

### Slice 1: Shared Skill Guidance Entry Point

- Update `studio-skills/skills/media-producer/SKILL.md` so image-generation
  purpose work routes agents to
  `references/reference-visible-image-prompting.md`.
- Update `studio-skills/skills/media-producer/references/workflow.md` with the
  same cross-purpose rule.
- Add a cross-purpose generation preview review gate for every Renku-managed
  image-generation spec before paid provider-backed runs.
- Keep the guide in `studio-skills`; do not recreate it in Studio docs.

### Slice 2: Purpose Reference Rewrites

Rewrite only the portions that are provider-facing prompt guidance or examples.
Do not scrub legitimate CLI/context language where `selected` means Studio
state.

Target files:

- `cast-profile.md`
- `voice-over-profile-image.md`
- `lookbook-image.md`
- `lookbook-sheet.md`
- `location-environment-sheet.md`
- `location-sheet-board-design.md`
- `scene-storyboard-sheet.md`
- `shot-first-last-frame.md`
- `shot-reference-images.md`
- `shot-video-prompt-sheet.md`
- `shot-video-take.md`

For each file:

- identify text-to-image, reference-to-image, image-edit, or video-reference
  grammar;
- add prompt skeletons only where they remove ambiguity;
- label references by provider-visible role;
- translate Lookbook, Cast Design, Location Design, selected shot, selected
  take, and approval terms into visible traits before they reach the provider.

### Slice 3: Sample Spec Rewrite

Update sample JSON prompts that agents may copy into real specs.

Known sample prompts needing changes:

- `cast-profile-spec.json`
- `location-environment-sheet-spec.json`
- `scene-storyboard-sheet-spec.json`
- `shot-last-frame-spec.json`
- `shot-reference-image-spec.json`
- `shot-video-take-final-spec.json`
- `shot-video-take-production-group.json`
- `generation-preview-motion-annotation-prompt-sheet.json`

Review but likely keep:

- `cast-character-sheet-spec.json`
- `location-hero-spec.json`
- `lookbook-image-spec.json`
- `lookbook-sheet-spec.json`
- `shot-first-frame-spec.json`
- `shot-video-prompt-sheet-spec.json`
- `generation-preview-shot-video-take-final.json`

### Slice 4: Core Provider-Facing Scaffold Audit

Search Core for provider-facing appended prompt strings and deterministic draft
prompts. Update only strings that would be sent to providers.

Candidate areas:

- shot input reference prompt notes;
- scene storyboard sheet provider prompt when an attached Storyboard Lookbook
  sheet exists;
- dependency draft spec prompt text for image purposes.

Do not update internal diagnostics merely because they use `selected`. Those
strings describe Studio state, not provider-visible creative prompt text.

### Slice 5: Verification

- Run targeted forbidden-phrase searches over media-producer references and
  samples.
- Parse all changed JSON samples.
- If Core scaffolds change, run `pnpm type-check:core` and focused Core tests
  for touched media-generation purpose areas.
- Re-read the final prompt examples as if the provider can see only prompt text
  and selected input files.

## Acceptance Criteria

- Every image-purpose guide points agents toward the shared
  `references/reference-visible-image-prompting.md` guidance or follows its
  rules inline.
- Provider-facing examples do not ask image models to know Renku approval
  state, database selection state, active department documents, or prior images
  that are not attached.
- Purpose docs distinguish route grammar where it matters:
  - text-to-image;
  - reference-to-image;
  - source-image edit;
  - final video prompt with provider tokens.
- Sample prompts are safe to copy into real specs without hidden app-state
  assumptions.
- Agents are instructed to show the Studio generation preview dialog for every
  Renku-managed image-generation spec and wait for user approval before paid
  provider-backed generation.
- Studio runtime remains opaque with respect to creative prompt and image
  contents.
- No new Studio architecture prompt guide is added; durable prompt-writing
  guidance remains in `studio-skills`.

## Completion Checklist

### Review And Scope

- [ ] Confirm the complete image-purpose inventory from media-producer docs.
- [ ] Confirm `cast.character-sheet` remains covered by plan 0113 and only
      needs consistency checks here.
- [ ] Confirm this plan updates `studio-skills` guidance, not Studio
      architecture docs.
- [ ] Confirm Core changes are limited to provider-facing scaffolds, if any.
- [ ] Confirm no runtime creative-content validation is planned.

### Shared Guidance

- [ ] Update `media-producer/SKILL.md` to route all image purposes to
      `references/reference-visible-image-prompting.md`.
- [ ] Update `references/workflow.md` with the cross-purpose
      provider-visible-input rule.
- [x] Update `media-producer/SKILL.md` so every Renku-managed image-generation
      spec shows the Studio generation preview dialog before paid
      provider-backed generation.
- [x] Update `references/workflow.md` with the same cross-purpose preview
      review gate.
- [x] Update purpose reference run sequences that would otherwise skip the
      preview dialog before provider generation.
- [ ] Verify no Studio docs link to a non-existent Studio copy of the guide.

### Cast Image Purposes

- [ ] Update `cast-profile.md` text-to-image profile guidance.
- [ ] Update `cast-profile.md` source-image edit guidance.
- [ ] Update `voice-over-profile-image.md` to translate active Lookbook and
      Cast Design context into visible symbolic cues.
- [ ] Update `cast-profile-spec.json`.
- [ ] Re-check `cast-character-sheet.md` and `character-images.md` for
      consistency with the shared guide.

### Lookbook Purposes

- [ ] Update `lookbook-image.md` with reference/evidence ownership language.
- [ ] Add Movie Lookbook image prompt skeleton guidance when useful.
- [ ] Add Storyboard Lookbook image prompt skeleton guidance when useful.
- [ ] Update `lookbook-sheet.md` with attached-reference role language.
- [ ] Verify Lookbook samples do not rely on app-private shorthand.

### Location Purposes

- [ ] Update `location-environment-sheet.md` context-vs-provider language.
- [ ] Update `location-sheet-board-design.md` prompt skeleton to replace
      `selected Movie Lookbook` with visible visual traits.
- [ ] Add attached location reference and anti-reference role guidance.
- [ ] Update `location-environment-sheet-spec.json`.
- [ ] Add or tighten `location.hero` source-image edit skeleton guidance.
- [ ] Verify `location-hero-spec.json`.

### Storyboard And Shot Image Purposes

- [ ] Update `scene-storyboard-sheet.md` prompt example to name the attached
      Storyboard Lookbook sheet as a visible reference.
- [ ] Update `scene-storyboard-sheet-spec.json`.
- [ ] Update `shot-first-last-frame.md` route-specific skeletons and context
      wording.
- [ ] Update `shot-last-frame-spec.json`.
- [ ] Update `shot-reference-images.md`.
- [ ] Update `shot-reference-image-spec.json`.

### Prompt Sheet And Final Video Handoff

- [ ] Update `shot-video-prompt-sheet.md` reusable template with
      provider-visible reference roles.
- [ ] Update `shot-video-prompt-sheet.md` validation/checklist wording from
      selected references to attached/provider-visible references where
      provider-facing.
- [ ] Update `generation-preview-motion-annotation-prompt-sheet.json` if the
      prompt lacks reference roles.
- [ ] Update `shot-video-take.md` final prompt examples to use provider tokens
      and visible roles.
- [ ] Update `shot-video-take-final-spec.json`.
- [ ] Update `shot-video-take-production-group.json`.
- [ ] Verify `generation-preview-shot-video-take-final.json`.

### Core Scaffold Audit

- [ ] Search Core provider-facing prompt scaffolds for app-private wording.
- [ ] Update only provider-facing scaffold strings that need reference-visible
      wording.
- [ ] Leave internal diagnostics and dependency labels alone unless they are
      sent as provider creative prompt text.
- [ ] Run focused Core tests if any Core files change.

### Verification

- [ ] Run targeted search over `studio-skills/skills/media-producer` for
      provider-facing forbidden phrases such as `approved first frame`,
      `approved character sheet`, `match the selected`, `preserve all selected
      references`, and `active lookbook` in prompt examples.
- [ ] Confirm remaining `selected` wording is CLI/context/Studio-state
      language, not provider prompt text.
- [ ] Parse every changed JSON sample.
- [ ] Re-read each revised prompt example with only provider-visible inputs in
      mind.
- [ ] Confirm no unchecked checklist item remains before marking this plan
      complete.
