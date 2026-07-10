# Keep AI Artifacts And Prompts Opaque

Date: 2026-07-03

Status: accepted

## Context

Renku Studio is built around AI-assisted filmmaking. The product needs to move
quickly as image, video, audio, and multimodal models change. Prompting
strategies, reference-image formats, video prompt sheets, motion maps,
storyboard layouts, panel counts, annotation systems, and provider-specific
best practices change too quickly to be frozen into Studio runtime contracts.

The recent `shot.video-prompt-sheet` work exposed the risk. Studio added a
structured `videoPromptImagePlan` with style metadata, aspect ratios, 2-to-12
panel requirements, panel ids, panel numbers, captions, action beat purposes,
continuity notes, hard constraints, and shot-representation validation.

That made Studio act as if it understood the creative contents of a generated
prompt-sheet image. It also made current and future experimentation brittle:
an agent could discover that a one-panel motion map, a full-frame diagram, a
collage, an uncaptioned image, or a new provider-native reference format works
better, but Studio would reject it because the image did not match an app-owned
schema.

This is the wrong ownership boundary.

Agents, agent instructions, evaluations, and user review own creative artifact
interpretation and creative choices. Studio owns durable project metadata,
asset relationships, generation envelopes, provider contracts, safety
boundaries, and accepted application-specific generation transforms.

## Decision

Renku Studio will keep AI-generated artifacts, reference media contents, and
prompt text opaque to the application runtime.

Studio must treat user-authored and agent-authored prompts as opaque strings.
Studio may store them, pass them to providers, show them to users, version them,
and validate basic envelope requirements such as presence, type, and provider
limits. Studio must not parse, score, require, repair, or interpret their
creative meaning.

Studio may author or expand provider prompts for accepted application-specific
generation transforms. These transforms are deterministic product workflows,
not open-ended creative choices. Examples include generating a fixed
`scene.storyboard-sheet` composite so Studio can create several storyboard
images in one generation, or generating a Location Hero Image from a selected
Location Sheet for a consistent Studio overview surface. In those cases, the
prompt describes the app-owned output role and optimization, not the user's
creative intent.

Studio must treat AI media artifacts as media files. Studio may store them as
assets, attach them to domain owners, track provenance, select them as
references, pass them to providers, and validate media kind, file paths, MIME
types, provider route capability, and project relationships. Studio must not
validate or require what is inside the image, audio, video, sheet, reference, or
prompt.

Studio must treat generated sheets as opaque image artifacts. A Lookbook Sheet,
Location Sheet, Character Sheet, Scene Storyboard Sheet, Video Prompt Sheet, or
future sheet-like media artifact may contain any layout the agent/user chooses
unless a separate, explicit, current Studio domain model owns a non-media data
structure. The runtime must not require panel counts, panel ids, captions,
labels, annotation colors, semantic sections, or visual content coverage inside
the image.

Studio may still own deterministic generation metadata for a sheet. For
example, a Video Prompt Sheet can have validated metadata fields such as
`promptSheetVisualStyleId` and `promptSheetNotationModeId`. These fields are
authored options, suitable for future Studio UI controls and for agent-authored
JSON. They are not proof of what the generated image contains, and Studio must
not inspect the image to decide whether it visually conforms to the selected
metadata.

Prompt-sheet metadata must use orthogonal categories. `cinematic-realistic` and
`handdrawn-storyboard` are visual style choices. Motion arrows, timing marks,
and similar motion notation can be used with either visual style, so motion
annotation must be modeled as a separate notation mode, not as a mutually
exclusive visual style.

The default rule is:

```text
Validate the envelope. Do not validate the creative contents.
```

## Hard Rules

- Prompt strings are opaque authored text.
- Generated media files are opaque artifacts.
- Reference media files are opaque artifacts.
- Sheet images are opaque artifacts.
- Studio runtime must not validate prompt semantics.
- Studio runtime must not validate visual, audio, or video contents.
- Studio runtime must not encode a preferred sheet layout for agent/user-owned
  creative artifacts as schema, validation, DTO fields, or UI state.
- Studio runtime may encode a fixed output shape for an accepted app-owned
  generation transform, such as `scene.storyboard-sheet`.
- Studio runtime must not require panel counts, panel ordering, captions,
  annotation keys, or shot coverage inside generated images.
- Studio runtime may validate explicit app-owned generation metadata such as
  `promptSheetVisualStyleId` and `promptSheetNotationModeId`, but must not
  validate generated media contents against that metadata.
- Studio runtime must not inspect reference contents to decide whether a
  generation is allowed.
- Studio runtime must not add "temporary" UI, CLI, route, or skill validation
  to compensate for missing core validation of artifact contents, because that
  validation should not exist.
- Agent instructions may recommend formats, panels, notation systems, prompt
  templates, quality checks, and eval criteria, but those recommendations must
  not become Studio runtime contracts.
- When a prompt expansion or fixed output shape is ambiguous, treat it as a
  product/architecture decision. Do not assume it belongs in core merely because
  it improves one generation result.

## Allowed Validation

Studio should remain strict about the project and provider envelope it owns.

Allowed validation includes:

- generation purpose;
- target kind and target id;
- required domain owner relationships;
- selected asset ids and asset file ids;
- project-relative paths;
- media kind;
- MIME type or file extension when needed for provider compatibility;
- selected reference slots and dependency slots;
- provider model choice;
- provider route capability;
- provider parameter schema;
- explicit app-owned generation metadata such as `promptSheetVisualStyleId`
  and `promptSheetNotationModeId`;
- accepted app-owned generation transform fields, such as
  `scene.storyboard-sheet` sheet/frame settings;
- provider input count and media-kind limits;
- cost estimate and live provider approval integrity;
- generation receipt/provenance;
- prompt field presence and non-empty string checks where a provider route
  requires a prompt;
- payload safety checks that prevent local paths, secrets, or provider upload
  URLs from being stored or displayed;
- structured diagnostics for malformed envelopes.

These validations are about whether Studio can safely store, route, estimate,
run, import, and relate media. They are not about whether the artifact is
creatively correct.

Allowed app-owned generation transforms must meet all of these conditions:

- The transform exists to satisfy a Studio product workflow or UI surface, not
  to make a creative choice on behalf of the user.
- The transform is deterministic enough to document as part of the current
  product contract.
- The output role is specific, such as a storyboard batch sheet, profile image,
  or location hero image.
- The transform does not require Studio to inspect the generated media contents
  after generation to decide whether the user's creative intent was valid.
- The transform is reviewed as architecture when ownership is unclear.

## Forbidden Validation

Studio must not validate or require:

- that a prompt mentions every selected reference;
- that a prompt names every shot;
- that a prompt follows a house template;
- that a prompt contains or avoids specific creative phrases;
- that a generated image has a specific number of panels;
- that a panel has an id, number, caption, action beat, or source shot id;
- that a sheet visually represents every shot in a take;
- that a generated sheet visually matches its selected style metadata;
- that an image contains readable labels;
- that a reference image matches a Cast Member, Location, Lookbook, shot, or
  description;
- that an audio reference contains expected words or timing;
- that a video reference contains expected action;
- that a final video followed a prompt-sheet panel order;
- that a generated artifact is "good enough" according to app-owned creative
  criteria.

Those checks belong to agents, evals, user review, and optional agent-authored
briefs. They do not belong to Studio runtime validation.

These forbidden checks do not prohibit accepted app-owned generation transforms.
For example, `scene.storyboard-sheet` may keep a strict provider prompt and
fixed composite layout because it is an app optimization for generating several
per-shot storyboard images in one request. The forbidden part would be treating
that fixed storyboard-sheet layout as a general rule for user/agent-owned
prompt sheets, or validating arbitrary generated sheet images against the same
layout.

## Examples

### Video Prompt Sheet

Correct Studio contract:

```json
{
  "purpose": "shot.video-prompt-sheet",
  "target": {
    "kind": "sceneShotVideoTake",
    "takeId": "take_001",
    "shotIds": ["shot_001", "shot_002"]
  },
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "promptSheetVisualStyleId": "handdrawn-storyboard",
  "promptSheetNotationModeId": "motion-annotation",
  "referenceMode": "storyboard-lookbook",
  "prompt": "Create an experimental motion-control image for this take.",
  "parameterValues": {}
}
```

Studio validates that this is a prompt-sheet generation request for a valid
take, with a valid model, valid selected references, and valid provider
parameters. Studio also validates `promptSheetVisualStyleId` and
`promptSheetNotationModeId` because they are explicit generation metadata.

Studio does not validate whether the resulting image has:

- one panel;
- two panels;
- twelve panels;
- no panels;
- arrows;
- captions;
- metadata blocks;
- a diagram;
- a collage;
- readable labels;
- visual conformity to the selected style.

### Final Video With A Prompt Sheet Reference

Correct Studio contract:

- the final video spec may select a `video-prompt-sheet` image asset as a
  logical reference;
- provider payload construction may attach that image in the provider-required
  field;
- prompt text remains authored by the user/agent.

Incorrect Studio behavior:

- reject the final video prompt because it does not say "work through panels in
  order";
- reject the selected sheet because the image has no panel structure;
- require final-video prompt text to suppress "panel borders";
- inspect the sheet and decide whether it is usable.

### Location Sheet

Correct Studio contract:

- a Location Sheet is an image asset attached to a Location with role
  `environment_sheet`;
- it may have a concise persisted description because that description is
  project metadata supplied at import;
- generation may use it as a reference asset.

Incorrect Studio behavior:

- require the image to be a contact sheet;
- require specific rooms, material swatches, labels, captions, or diagram
  regions inside the image;
- reject the image because it does not visually match the persisted
  description.

### Scene Storyboard Sheet

`scene.storyboard-sheet` is an accepted app-owned generation transform.

Correct Studio behavior:

- use a strict provider prompt for a fixed storyboard composite;
- generate several storyboard images in one request;
- require the import workflow to provide the cropped per-shot images that
  Studio actually stores as durable storyboard assets;
- keep the composite-sheet shape tied to this specific application workflow.

Incorrect Studio behavior:

- generalize the storyboard-sheet composite layout into a requirement for
  `shot.video-prompt-sheet`;
- reject arbitrary prompt-sheet images because they do not follow the
  storyboard-sheet panel model;
- treat the storyboard-sheet prompt as a reusable house style for unrelated
  agent/user-owned artifacts.

## Relationship To Structured Domain Documents

This ADR does not make all Studio data opaque.

Studio may continue to validate structured domain documents that are themselves
the durable product data model:

- Screenplay JSON;
- Scene Shot Lists;
- Scene Shot Video Take state;
- Cast Design;
- Location Design;
- Inspiration Analysis;
- Movie Lookbooks;
- Storyboard Lookbooks;
- provider catalog schemas;
- project database records.

Those documents are not generated media artifact contents. They are Studio
metadata and user/agent-authored domain state.

The boundary is:

- If the field is durable Studio metadata, validate it in core.
- If the field is a prompt string, keep it opaque.
- If the field is an AI-generated or user-provided media artifact, keep the
  file contents opaque.
- If a sheet-like media artifact is needed as a reference, store and attach the
  image; do not model its internal visual layout.

## Relationship To Agents And Skills

Agents may inspect artifacts, compare outputs, run evals, and follow detailed
creative instructions. That is their job.

The differentiator is ownership of the choice:

- Creative choices belong to the user and the agent interaction loop.
- Application-specific output shapes and optimizations may belong to Studio
  when they are accepted product behavior.

For example, a video prompt sheet layout is agent/user-owned and should remain
flexible. A `scene.storyboard-sheet` composite is Studio-owned because it is a
batch-generation mechanism for producing several storyboard images in one
request.

Agent skills may say:

- "try a three-panel prompt sheet";
- "use a full-canvas motion map";
- "inspect the generated image before import";
- "compare the final video against the prompt-sheet brief";
- "for this provider, prompts often work better when the reference token is
  named explicitly";
- "run this eval and regenerate if the artifact fails."

But those are agent workflow instructions, not Studio schema.

Agent skills must not say that Studio requires:

- a `videoPromptImagePlan`;
- 2 to 12 panels;
- panel ids or panel numbers;
- creative house prompt templates for agent/user-owned artifacts;
- visible sheet-content checks as runtime validation.

Agent skills may say that Studio accepts `promptSheetVisualStyleId` and
`promptSheetNotationModeId` values for `shot.video-prompt-sheet` specs. They
must describe them as deterministic metadata, not as a promise that Studio
understands or validates the generated image contents.

Agent skills should keep detailed prompt-writing guidance for prompt sheets.
The removed piece is the structured prompt-plan JSON, not the agent's
responsibility to author a strong prompt. Skills should still teach agents how
to choose visual style, choose notation mode, write detailed prompt-sheet
instructions for each category combination, include the needed logical
references, inspect outputs, and iterate through evals/user feedback.

When agent instructions change, Studio should not need a schema migration or
runtime validator change unless the durable project envelope changes.

## Consequences

- Prompt-sheet experimentation can move at the speed of agent instructions and
  evals.
- New provider behaviors can be adopted without changing Studio runtime
  schemas for creative artifact layouts.
- Studio remains strict where strictness protects project data, provider
  execution, and safety.
- Reviewers must reject future changes that encode prompt, reference, sheet,
  image, audio, or video contents into app validation.
- The existing `videoPromptImagePlan` runtime contract must be removed.
- Existing docs and skills that teach structured prompt-sheet plans must be
  updated.
- Existing app-authored prompt construction should be audited against the
  creative-choice versus app-owned-transform boundary. Some prompt expansions
  may be valid product optimizations; ambiguous cases need product and
  architecture review before changing code.

## Superseded Direction

This ADR supersedes the structured prompt-sheet contract introduced by:

```text
plans/active/0099-generation-preview-dialog-and-video-prompt-image-styles.md
```

Historical plans may continue to mention `videoPromptImagePlan` as history.
Current runtime code, current docs, current samples, and current agent
instructions must not preserve it as an accepted model.
