# 0113 Reference-Visible Image Prompting Guidance

Status: completed
Date: 2026-07-05

## Summary

Rewrite Renku Studio image-generation prompt guidance so prompts describe only
what the provider model can actually see: text prompt content, selected model
parameters, and attached reference images.

The current cast character sheet skill guidance contains a deeper prompt-design
failure. It sometimes asks the model to match internal Studio concepts such as
"approved character sheets", project approval state, or a prior in-app image
without binding that instruction to a provider-visible input image. That is not
a harmless wording problem. It produces prompts that assume the model provider
can read Renku database state, asset approval status, Movie Lookbook choices, or
human review history. It cannot.

The replacement guidance must make every visual dependency explicit:

- if an image should influence the output, it must be selected as a real
  reference input;
- the prompt must refer to that image by a provider-visible role, order, or
  label, such as "Reference 1: previous character sheet";
- prompt text must explain which traits to preserve from each reference;
- prompt text must not mention internal app-only terms unless they are expanded
  into visible visual instructions;
- prompts must not say "replace" unless the route is truly editing a source
  image in place.

This plan is documentation and guidance first. It should be reviewed before
implementation touches Studio runtime prompt builders, Studio Skills, or Core
generation purpose prompts.

## Sources Reviewed

Primary provider and platform sources:

- [fal GPT Image 2 page](https://fal.ai/gpt-image-2): describes GPT Image 2 as
  quality-first, photorealistic, strong at text rendering, product photography,
  and fine-grained image editing.
- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation):
  documents image generation/editing APIs and notes that GPT Image 2 processes
  image inputs at high fidelity.
- [fal Nano Banana 2 page](https://fal.ai/models/fal-ai/nano-banana-2):
  identifies Nano Banana 2 as Gemini 3.1 Flash Image, with natural-language
  control, character consistency, accurate typography, and up to 14 reference
  images for editing.
- [Google Gemini image generation guide](https://ai.google.dev/gemini-api/docs/image-generation):
  recommends conversational multi-turn image editing, explicit image inputs,
  and specific prompts with context and intent.
- [xAI Imagine docs](https://docs.x.ai/developers/model-capabilities/imagine):
  document Grok Imagine image generation and editing, including image editing
  with up to 3 reference images.
- [fal xAI model page](https://fal.ai/explore/xai): summarizes Grok Imagine
  image/edit/video variants and shows prompt examples with concrete visual
  subject, setting, lighting, mood, and material language.
- [fal Seedream 5.0 page](https://fal.ai/seedream-5.0): describes Seedream 5
  as supporting live web retrieval, controllable editing, reduced
  hallucination, multi-step reasoning, and production-ready images.
- [fal Seedream 5.0 Lite model page](https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image):
  describes the Lite text-to-image route exposed in Studio, including detailed
  natural-language prompts, high-resolution output, and multi-image generation.

Research and practitioner-method sources:

- [Jonas Oppenlaender, "A Taxonomy of Prompt Modifiers for Text-To-Image Generation"](https://arxiv.org/abs/2204.13988):
  identifies prompt modifiers as an observed practitioner practice, not a
  provider-side substitute for actual image references.
- [Luca Cazzaniga, "SCHEMA for Gemini 3 Pro Image"](https://arxiv.org/abs/2602.18903):
  argues for structured prompt components and reports improved compliance when
  prompts are modular and explicit.
- [Seedream 4.0 paper](https://arxiv.org/abs/2509.20427): documents Seedream's
  text-to-image, image-editing, multi-image composition, and in-context
  reasoning direction, useful context for Seedream-style prompting even though
  Studio currently exposes Seedream v5 Lite through fal.

Local guidance and contracts reviewed:

- `studio-skills/skills/media-producer/references/cast-character-sheet.md`
- `studio-skills/skills/media-producer/references/character-images.md`
- `packages/core/src/client/cast-media-generation.ts`
- `packages/core/src/client/lookbook-media-generation.ts`
- `packages/core/src/client/location-media-generation.ts`
- `plans/active/0110-reference-aware-cast-character-sheet-generation-preview.md`
- `plans/active/0112-generation-preview-model-configuration-contract.md`

## Current Failure

### Prompt Language Assumes Provider Knowledge Of Studio State

Bad pattern:

```text
matching the realistic tactile production-reference caliber of the approved
Palace character sheet
```

This is broken because the provider sees only the prompt and input files. It
does not know:

- which image Studio considers "approved";
- what "Palace" means in the project database;
- whether a prior image exists unless it is attached;
- which reference asset is the intended style, identity, wardrobe, headwear, or
  layout source;
- whether the user wants a new image, a continuity variant, or an edit of a
  specific source image.

The correct direction is not to invent a better adjective. The correct
direction is to bind the instruction to visible references:

```text
Use Reference 1, the previous approved character sheet, as the identity and
wardrobe continuity source. Preserve the face shape, beard line, turban
silhouette, robe layering, fabric weight, and neutral turnaround layout visible
in that reference. Create a new clean character sheet; do not alter the
reference image itself.
```

That wording still needs to be generated from actual selected references. If
there is no attached prior character sheet, the prompt must not pretend one is
visible.

### Edit Language Is Being Used For Reference-To-Image Work

"Replace the turban" is an edit instruction. It makes sense only when the model
receives a source image and the task is to modify that image.

For a new character sheet conditioned by references, the prompt should say:

```text
Create a new character sheet. Use Reference 2 for the headwear design:
preserve the wrapped turban silhouette, fabric folds, height, and ivory tone.
Do not copy the background, camera angle, or facial identity from Reference 2.
```

For an actual image edit, the prompt can say:

```text
Edit the source image. Replace only the turban with the turban visible in
Reference 2. Preserve the source character's face, body, robe, pose, lighting,
and sheet layout.
```

The route determines the grammar. Text-to-image, reference-to-image, and image
edit must not share the same prompt skeleton.

### Internal Concepts Need Translation Before They Reach A Provider

Internal concept | Provider-visible replacement
--- | ---
Approved character sheet | "Reference 1: previous selected character sheet"
Movie Lookbook | concrete palette, light quality, texture, realism, lens/finish
Cast Design | visible face, age read, body build, grooming, wardrobe, posture
Reference option | attached reference image with an explicit role
Source asset | source image to edit or preserve
Style match | named visible traits from the attached reference
Production-reference caliber | material realism, clean layout, neutral views, readable labels if needed

## Model Inventory In Scope

Studio image purpose model choices currently include:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/openai/gpt-image-2/edit`
- `fal-ai/nano-banana-2`
- `fal-ai/nano-banana-2/edit`
- `fal-ai/xai/grok-imagine-image`
- `fal-ai/xai/grok-imagine-image/edit`
- `fal-ai/xai/grok-imagine-image/quality/edit`
- `fal-ai/bytedance/seedream/v5/lite/text-to-image`
- `fal-ai/bytedance/seedream/v5/lite/edit`

Studio purpose exposure is narrower than the catalog. This plan should cover
the model choices used by Cast, Location, Lookbook, Scene Storyboard, and Shot
Video dependency drafts, not every provider model on fal.

## Cross-Model Prompting Rules

### Rule 1: Prompts Must Be Provider-Visible

Every reference-dependent sentence must answer:

- Which attached image is being referenced?
- What role does it play?
- Which visible traits should be preserved?
- Which traits should not be copied?
- Is the output a new image, an edited source image, or a derivative profile?

The prompt must not say:

- "match the approved sheet" without attaching and naming that sheet;
- "use the Palace version" without explaining which visible image is Palace;
- "replace X" unless an edit route has a source image;
- "same as before" unless "before" is an attached prior image;
- "Movie Lookbook style" without translating it into visible style language.

### Rule 2: Reference Roles Must Be Explicit

Use stable provider-facing names:

- `Reference 1: previous character sheet, identity and wardrobe continuity`
- `Reference 2: user portrait, facial likeness only`
- `Reference 3: headwear reference, turban construction and fabric only`
- `Reference 4: active lookbook image, palette and light quality only`

The prompt should then use those names:

```text
Use Reference 1 for the same person, body proportions, robe layering, and sheet
layout. Use Reference 2 only for facial likeness. Use Reference 3 only for the
turban silhouette and fabric folds. Do not copy Reference 2's background or
camera angle.
```

### Rule 3: Separate Preserve, Change, And Exclude

Every reference-aware prompt should have three conceptual blocks:

- Preserve: identity, wardrobe state, layout, palette, lighting, material
  detail, face/grooming, height/scale.
- Change: requested new garment, camera framing, sheet structure, crop,
  output purpose, section order.
- Exclude: backgrounds, props, labels, extra characters, internal notes,
  source-image artifacts, unwanted pose/camera angle.

This keeps the model from over-copying a reference image when only one trait is
needed.

### Rule 4: Use Positive Visual Instructions Before Negative Lists

Prompt modifiers are useful, but they are not a substitute for visible
references. Oppenlaender's taxonomy supports the idea that prompt modifiers
shape outputs, but Renku should use modifiers only after the concrete subject,
reference roles, layout, and material cues are already explicit.

Good ordering:

1. target output type;
2. visible reference roles;
3. subject identity and continuity traits;
4. layout and required views;
5. style/material/light;
6. exclusions.

### Rule 5: Keep Runtime Validation Opaque

Studio runtime must not inspect whether generated images obey the creative
prompt. Agents and users may review images. Core may validate envelope data:
purpose, model, selected references, provider payload shape, cost, and preview
safety. It must not validate visual content such as whether a turban was
preserved or a label is readable.

## Model-Specific Prompt Guidance

### GPT Image 2

Source findings:

- fal positions GPT Image 2 as quality-first, strong at photorealism, text
  rendering, product photography, and fine-grained image editing.
- OpenAI documents image inputs and notes that GPT Image 2 processes image
  inputs at high fidelity.

Renku guidance:

- Use GPT Image 2 when visual fidelity matters more than fast iteration.
- Use it for realistic character sheets, profile edits, location hero images,
  and polished lookbook outputs.
- Write prompts in concrete visual language: material, light, skin texture,
  cloth weight, age read, posture, lens/finish, and exact layout.
- For edits, name the source image and every reference image separately.
- Use "create a new image using Reference N" for reference-to-image workflows;
  reserve "edit/replace/remove" for source-image edit workflows.
- Do not rely on internal "approved" or "selected" status; say what the
  attached image contributes.

Prompt skeleton:

```text
Create a [output type] for [subject].

References:
- Reference 1 is the previous selected character sheet. Use it for identity,
  body proportions, robe layering, headwear silhouette, and neutral turnaround
  structure.
- Reference 2 is a portrait. Use it only for facial likeness and grooming.

Preserve: [traits].
Change/add: [requested differences].
Do not copy: [background, camera angle, artifacts, unwanted props].

Render as [photographic/material/light/style instructions].
```

### Nano Banana 2 / Gemini 3.1 Flash Image

Source findings:

- fal describes Nano Banana 2 as Gemini 3.1 Flash Image with natural-language
  control, character consistency, accurate text rendering, and up to 14
  reference images for editing.
- Google recommends multi-turn image editing as an iterative workflow and
  advises hyper-specific prompts plus context and intent.
- The SCHEMA paper supports modular prompt structure for Gemini image models,
  with clear components and explicit routing of intent.

Renku guidance:

- Use Nano Banana 2 for fast iteration, character consistency, storyboards,
  layout-heavy sheets, and cases with several references.
- Prompt conversationally, but keep roles explicit. Natural language control
  does not mean vague app-internal language.
- Use multi-turn iteration as an agent workflow when allowed, but persisted
  specs should still carry the current explicit prompt and selected references.
- For character sheets, name the 360/turnaround intent and pass previous views
  as references when maintaining identity.
- Because this model is good with context, include why the image exists:
  "continuity sheet for later shot generation", "location reference for scene
  planning", or "lookbook image for palette and texture".

Prompt skeleton:

```text
Create a clean continuity character sheet for [subject], used by later shot
generation to preserve identity.

Use Reference 1 as the identity anchor: preserve the same face, build, posture,
wardrobe state, and headwear construction. Use Reference 2 only for [role].

The sheet must include [views/layout].
Keep [specific traits].
Avoid [over-copying/background/props].
```

### Grok Imagine Image

Source findings:

- xAI documents Grok Imagine image generation and image editing.
- xAI notes image editing supports up to 3 reference images.
- fal's xAI examples lean on concrete cinematic subject, setting, lighting,
  material, mood, and camera language.

Renku guidance:

- Use Grok when the reference count is small and the goal benefits from strong
  cinematic aesthetics or lower-cost iteration.
- Enforce the 3-reference limit before prompt writing; do not ask the prompt
  to synthesize references that were not attached.
- Rank references by role. If more than 3 candidate references exist, the
  agent must choose or ask the user rather than silently describing absent
  images.
- Keep prompts compact and visual. Grok should not receive long app-context
  dumps.
- For character continuity, identify exactly one identity anchor where
  possible and avoid mixing identity from several faces.

Prompt skeleton:

```text
Create a new [image type].

Reference 1 is the identity anchor. Preserve [face/build/wardrobe].
Reference 2 is the [style/headwear/location/material] reference. Use only
[specific traits].
Reference 3 is optional and contributes only [specific trait].

Style: [short cinematic/material/lighting instruction].
Exclude: [backgrounds, extra characters, source artifacts].
```

### Seedream 5 Lite

Source findings:

- fal describes Seedream 5 as supporting web retrieval, controllable editing,
  reduced hallucination, and multi-step reasoning.
- fal's Seedream 5.0 Lite page describes detailed natural-language prompts,
  high-resolution output, and multiple images per request for the Lite
  text-to-image endpoint.
- The Seedream 4.0 paper documents the family direction: unified
  text-to-image, image editing, multi-image composition, and in-context
  reasoning.

Renku guidance:

- Use Seedream v5 Lite for Lookbook images/sheets where high-resolution
  composition, design coherence, cultural specificity, or production concept
  iteration matter.
- For the currently exposed text-to-image route, do not pretend reference
  images are attached unless the edit route is actually selected.
- Lean into scene/material/domain specificity: architecture, geography,
  costume period, light behavior, palette, spatial relationships, and design
  intent.
- If web search is enabled for a future route, prompts must say what should be
  grounded in current public knowledge and what should remain project-fictional.
- Do not use web-grounding for private project facts or internal Studio state.

Prompt skeleton:

```text
Create a [lookbook/location/storyboard] image for [project context].

Purpose: [why the image exists in Renku].
Subject and setting: [concrete domain facts].
Composition: [spatial relationships, scale, foreground/background].
Material and light: [palette, texture, atmosphere].
Do not include: [internal app labels, unrelated story panels, fake UI text].
```

## Purpose-Specific Rewrite Direction

### Cast Character Sheet

Prompt output must become reference-role aware.

Required prompt slots:

- output type: lean identity turnaround / physical continuity sheet;
- target identity: cast member name, role, age read, body build, posture;
- visible references:
  - previous character sheet for identity/wardrobe/layout continuity;
  - portrait for facial likeness;
  - costume/headwear/accessory reference for the specific trait only;
  - lookbook/card image for palette/light/material only when attached;
- required views: face close-up, front, back, left profile, right profile;
- height/ruler instruction when height is known;
- exclusions: locations, scene props, story moments, internal notes, broad
  concept board panels.

Forbidden prompt language:

- "approved sheet" unless immediately bound to an attached reference;
- "Palace character sheet" unless the attached image is named that way for the
  provider-facing reference list;
- "replace turban" in reference-to-image mode;
- "match production-reference caliber" without visible traits to match;
- "selected Movie Lookbook" without translated palette/light/material cues.

### Cast Profile

If a selected character sheet exists and an edit model is selected:

- use the character sheet as the source image;
- prompt for a profile portrait derived from that exact source;
- preserve face, period wardrobe, hair/headwear, palette, and material detail;
- do not ask for a new full character redesign.

If no source image exists:

- use text-to-image language;
- do not pretend a sheet exists.

### Location Environment Sheet

Location sheet prompts should not reference internal location design names
alone. They should translate design into:

- architecture and geography;
- surfaces and materials;
- lighting and atmosphere;
- usable continuity views;
- scale cues;
- period and cultural constraints.

When references exist, identify whether each is:

- architectural reference;
- set dressing reference;
- palette/light reference;
- geographic or exterior reference.

### Location Hero

Hero-image edit prompts must distinguish:

- source image to edit/preserve;
- style/lookbook reference;
- location design constraints;
- shot-framing output.

Do not say "make it match the current location sheet" unless that sheet is
passed as a reference and named in the prompt.

### Lookbook Image And Lookbook Sheet

Lookbook prompts are allowed to synthesize visual language, but they still must
not speak in app-private shorthand. Convert Lookbook fields into:

- palette;
- contrast and exposure;
- texture and grain;
- lens/finish;
- set/location feeling;
- costume/material tendencies;
- composition constraints.

When source inspiration images are used, prompts must name their role:

- "Reference 1 supplies palette and contrast";
- "Reference 2 supplies architectural density";
- "Reference 3 supplies textile texture";
- "Do not copy people, text, logos, or exact composition."

### Scene Storyboard Sheet And Shot Input Images

Storyboard prompts should keep reference roles shot-facing:

- character reference;
- location reference;
- lookbook/style reference;
- previous storyboard/shot design reference.

Do not ask the provider to know scene ids, shot ids, or selected project state.
Those can appear in agent/CLI logs, not provider-facing creative text.

## Prompt Contract Shape For Skills

Studio Skills should adopt a visible-reference prompt contract before writing a
spec:

```md
Provider-visible references:

- Reference 1: <asset title>, role: <identity/style/wardrobe/layout/etc.>
  Use for: <explicit visible traits>
  Do not copy: <traits to ignore>
- Reference 2: ...

Prompt:
<provider-facing prompt text>
```

This is skill guidance, not a Studio runtime schema. It helps agents author
better prompts without making Studio parse creative contents.

## Implementation Plan

### Slice 1: Source-Grounded Prompt Guide

- Add a new source-backed prompt guide in `docs/architecture/reference/` or
  `studio-skills/skills/media-producer/references/`.
- Summarize model-specific guidance for GPT Image 2, Nano Banana 2, Grok
  Imagine, and Seedream v5 Lite.
- Include a clear "provider-visible references only" rule.
- Include route-specific prompt grammar for text-to-image, reference-to-image,
  and image edit.

### Slice 2: Studio Skills Rewrite

- Rewrite `cast-character-sheet.md` to remove vague "approved sheet" and
  internal-state wording.
- Rewrite `character-images.md` quality-bar wording so "approved" means a
  user/agent QA concept, not provider-facing prompt text.
- Add explicit prompt skeletons for:
  - no references;
  - one previous character sheet;
  - previous sheet plus portrait;
  - previous sheet plus costume/headwear/accessory reference;
  - actual source-image edit.
- Ensure each skeleton names reference images by role and visible trait.

### Slice 3: Core Prompt Audit

- Search Core generation purpose prompt builders for internal-state wording.
- Remove provider-facing references to:
  - approved/picked/selected state unless expanded into visible references;
  - internal department names without visual translation;
  - old prompt scaffold phrases that assume app context.
- Keep Core ownership clear: Core may assemble deterministic prompt scaffolds
  for accepted product purposes, but must not validate creative image contents.

### Slice 4: Preview And Agent QA

- Ensure generation previews make selected references visible enough for an
  agent/user to verify prompt-reference alignment.
- Add skill-side QA instructions:
  - before run, compare prompt reference labels to preview references;
  - fail the agent workflow if the prompt mentions a reference that is not
    selected;
  - fail the agent workflow if a selected reference has no stated role in the
    prompt.
- Keep these checks in agent workflow guidance, not Studio runtime creative
  validation.

### Slice 5: Documentation And Examples

- Add before/after examples for:
  - bad "approved Palace character sheet" wording;
  - bad "replace turban" reference-to-image wording;
  - correct reference-to-image prompt;
  - correct image-edit prompt.
- Document model selection heuristics:
  - GPT Image 2 for polished realism and high-fidelity edits;
  - Nano Banana 2 for fast natural-language iteration and many references;
  - Grok for small-reference-set cinematic/aesthetic outputs;
  - Seedream v5 Lite for high-resolution lookbook/location composition and
    reasoning-heavy text-to-image.

## Acceptance Criteria

- No provider-facing skill prompt skeleton assumes the model can see Renku
  approval state, database state, selected status, or prior images unless those
  images are selected references.
- `cast.character-sheet` guidance distinguishes:
  - text-to-image;
  - reference-to-image;
  - image edit.
- Guidance never says "replace" for a new reference-conditioned image.
- Every reference-aware skeleton includes:
  - provider-visible reference role;
  - traits to preserve;
  - traits to ignore;
  - target output type.
- The plan respects `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`:
  Studio runtime does not parse or grade creative prompt/image contents.

## Completion Checklist

### Review And Scope

- [x] Confirm the model inventory matches current Core image model choices.
- [x] Confirm sources are provider/platform/research sources, not news recaps.
- [x] Confirm the plan covers Studio Skills and Core prompt scaffolds without
      adding runtime creative-content validation.
- [x] Confirm "provider-visible references only" is the central contract.
- [x] Confirm text-to-image, reference-to-image, and image-edit prompt grammar
      are treated separately.

### Source Summary

- [x] Summarize GPT Image 2 guidance from fal and OpenAI.
- [x] Summarize Nano Banana 2 guidance from fal and Google Gemini docs.
- [x] Summarize Grok Imagine guidance from xAI and fal.
- [x] Summarize Seedream v5 Lite guidance from fal and Seedream research.
- [x] Summarize structured prompting / prompt modifier research only where it
      helps make prompts explicit.

### Skill Rewrite

- [x] Rewrite `cast-character-sheet.md` provider-facing prompt language.
- [x] Rewrite `character-images.md` quality-bar language.
- [x] Add no-reference character sheet prompt skeleton.
- [x] Add previous-character-sheet reference skeleton.
- [x] Add portrait-plus-character-sheet skeleton.
- [x] Add costume/headwear/accessory reference skeleton.
- [x] Add actual image-edit skeleton.
- [x] Remove or quarantine phrases such as "approved Palace character sheet"
      from provider-facing examples.

### Core Prompt Audit

- [x] Search Core prompt builders for app-internal creative wording.
- [x] Replace internal-state prompt phrases with visible-reference wording.
- [x] Preserve deterministic product-purpose scaffolds where Studio owns the
      workflow shape.
- [x] Avoid adding runtime prompt-content validators.

### Preview And Agent QA

- [x] Add agent guidance to compare prompt reference mentions with preview
      selected references before run.
- [x] Add agent guidance to stop when a prompt mentions absent references.
- [x] Add agent guidance to stop when selected references have no prompt role.
- [x] Keep these as workflow guidance, not Core/Studio creative validation.

### Documentation

- [x] Add before/after examples for bad internal-state prompts.
- [x] Add model-selection heuristics.
- [x] Link provider and research sources.
- [x] Update any affected active plans only when they are current direction.

### Verification

- [x] Run targeted searches for forbidden provider-facing phrases.
- [x] Run any Studio Skills validation available in `studio-skills`.
- [x] Run focused Core tests only if Core prompt scaffolds change.
- [x] Re-read the final prompt examples as if the provider can see only the
      prompt text and selected image files.
