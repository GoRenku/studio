# 0180 Lookbook-Driven GPT Image 2 Beat Storyboards And Prop Context

Status: complete
Date: 2026-08-16

## Completion Evidence

Implemented 2026-08-16 in the Studio and Studio Skills repositories.

- Core now projects ordered `scenePropIds` for Scene and Shot context, exposes
  exact Prop Sheet slots for `scene.storyboard-sheet`, keeps fixed managed high
  quality, and exposes no competing Scene Storyboard model recommendation.
- A focused CLI integration test proves the unchanged Core report projection,
  exact Storyboard Lookbook and Prop candidates, the default Codex choice, and
  fixed settings.
- ADR 0080 and current architecture/CLI references record the accepted
  appearance, continuity, batching, execution, crop, QA, and department
  boundaries.
- Studio Skills now use one detailed Scene Storyboard recipe owner, a
  prompt-only external Codex sample with exact Lookbook/Character/Location/Prop
  roles, arbitrary Beat cardinality followed by up-to-four image batching, and
  one-pass accept-or-report QA.
- Focused Core tests, focused/new CLI tests, Core and CLI type checks, test type
  checks, lint, builds, architecture checks, `pnpm check`, Studio Skills release
  tests, the image prompt-guide registry validator, and full `pnpm build` pass.
- `pnpm test` passes the full Core, CLI, Engines, and Studio unit suites.
- `pnpm test:integration` passes the new Scene Storyboard CLI case and all Core
  integration tests, then stops on four unrelated existing assertions in the
  general CLI workflow file: stale Lookbook fixture creation, a legacy Cast
  Voice path expectation, and two obsolete Studio server-policy expectations.
- An isolated copy of Urban Basilica verified the 10-Beat Bombardment Scene as
  4 + 4 + 2 without changing its Beat revision, a deliberately prepared Prop
  fact and exact candidate slot, the required Storyboard Lookbook Sheet,
  prompt-only frozen external provenance, and a valid managed GPT Image 2 edit
  Preview with exact references and Core-fixed high quality. Fixture setup
  attached isolated media before verification. No image tool or paid provider
  run was invoked, and the live Project was not changed.

## Review Attention

- This implementation changes the Beat Storyboard agent workflow and the Core
  generation context that feeds it. The user explicitly requested
  implementation of this plan.
- Storyboard appearance becomes exclusively Storyboard Lookbook-driven.
  Storyboard Lookbooks may define photorealistic, realistic, illustrative,
  graphic, painterly, hand-drawn, abstract, or any other visual language. The
  skills must not add a default storyboard look, medium, finish, warmth,
  monochrome treatment, or Production Lookbook styling.
- Every Beat Storyboard request must read the current Storyboard Lookbook and
  attach one exact usable Storyboard Lookbook Sheet. This is an agent-workflow
  requirement. Core continues to expose request-scoped candidates without
  auto-selecting them or semantically validating prompt/image contents.
- Core adds scenePropIds to Scene and Shot generation facts and adds exact
  Prop Sheet slots to scene.storyboard-sheet context. The existing
  renku generation context command already returns the Core report unchanged,
  so no new CLI command or flag is planned.
- The Project has one image-generation setting: **Use Codex for image
  generation**. It is on by default. A Codex request is saved as an
  agent-external request with model codex/gpt-image-2 and executed through the
  Codex image-generation capability; it is not a Renku provider or Engines
  model. Turning the setting off selects Renku-managed generation; this
  reference-driven workflow then uses fal-ai/openai/gpt-image-2/edit. An
  explicit user choice or a path already saved on the request still wins. Core
  exposes no second Scene Storyboard model recommendation.
- Scene Beat design remains independent from image batching. A Scene may have
  five, six, ten, or any other number of Beats justified by its narrative
  developments. Only after the exact Scene Beats revision exists does media
  generation partition the requested Beats into consecutive groups of at most
  four. Each group becomes one output image containing one complete panel per
  Beat; a final remainder may contain one to three panels with unused space
  left empty. The cost optimization must never add, remove, merge, split, or
  reorder Beats.
- The existing one-to-four-panel composite transform and vision-guided crop
  workflow are a proven regression baseline. This plan does not change their
  layout, crop selection, crop tooling, or extraction sequence and adds no
  external crop library, fixed coordinates, detector, or alternative splitter.
- The composite is a high-resolution full image, not a thumbnail sheet. Every
  panel must retain the Project aspect ratio, a complete independent
  composition, useful crop resolution, and the same continuity discipline it
  would receive in a separate request. The implementation must not falsely
  claim that each crop has the pixel dimensions of a separate full-canvas
  generation.
- The default Codex built-in request keeps exactly values: { prompt } and
  logical image references. Because the current built-in tool exposes no exact
  pixel-size or quality field, the reviewed prompt must clearly request a
  high-resolution full storyboard composite, and the agent must inspect and
  report the actual result rather than invent a pixel guarantee. When the
  Project setting is off, the managed GPT Image 2 edit route authors a
  model-supported custom image_size; Core continues to fix managed quality to
  high.
- Beat narrative fields are source context for agent reasoning, not provider
  prompt payloads to paste wholesale. The agent must translate the selected
  Beats into concrete, visible, panel-by-panel direction, including subject
  placement, action, gaze, interaction, location geography, Prop state, and
  relevant continuity.
- Character, Location, and Prop references preserve canonical subject content,
  not their Production rendering style. Prompts must reproduce the referenced
  identity, costume, silhouette, proportions, design, state, and geography
  faithfully while rendering them in the Storyboard Lookbook's visual
  language. A coarse hand-drawn Lookbook may simplify those features, but the
  subject must remain unmistakably the same; a realistic reference must not
  make the Storyboard realistic unless the Storyboard Lookbook says so.
- Generated composites receive one visual analysis and the existing crop and
  crop-inspection pass. The agent then accepts useful Beat images or reports
  the issue and stops. There is no automatic generate-analyze-edit cycle,
  repair prompt, retry, or regeneration. A fresh generation occurs only after
  explicit user direction as a new reviewed request and cost boundary.
- Beat Storyboards remain pre-production story-alignment artifacts for
  visualizing narrative flow, pace, timing, and shared understanding. Shot
  Plans remain production-planning artifacts authored from the director and
  cinematographer's camera and coverage decisions. This plan adds routing and
  language clarity only; it does not redesign Shot Plan or Beat schemas.
- No database migration, schema change, Settings field, HTTP route, new
  selection state, automatic reference choice, crop metadata, OCR,
  fixed-coordinate splitter, prompt parser, or image-content validator is
  planned. Studio changes only the existing setting's copy to say plainly that
  Codex is on by default and turning it off uses Renku.
- Existing generated media, Storyboard Lookbooks, Scene Beats revisions, Shot
  Plans, Assets, selections, and provenance remain unchanged. The current
  request-scoped reference and agent-owned visual-QA contracts remain intact.
- The plan introduces ADR 0080 because the new sole-appearance-source decision
  narrows accepted Decisions 0035 and 0048, which currently describe
  storyboard drawing language and allow Production Lookbook input to influence
  storyboard appearance.
- No product decision remains open inside this plan.

## Summary

Make the Beat Storyboard workflow reliably context-aware, model-aware, and
role-correct without moving creative judgment into Studio runtime code.

The implementation has two coordinated halves:

1. Core and CLI context:
   - add complete Scene Prop facts beside existing Cast and Location facts;
   - expose exact Prop Sheet candidate slots for Scene Storyboard generation;
   - keep Codex as the one default Project image-generation choice;
   - expose no competing Scene Storyboard model recommendation; and
   - keep the existing CLI as a thin JSON projection of Core.
2. Agent workflow:
   - make the Storyboard Lookbook the only appearance authority;
   - lead with a saved, frozen Codex built-in GPT Image 2 request;
   - keep Scene Beat creation scene-appropriate and independent from batching;
   - partition the requested saved Beats into image-only groups of up to four;
   - gather each group's Cast, Location, and Prop context;
   - inspect exact continuity media;
   - synthesize a structured GPT Image 2 prompt instead of dumping Beat prose;
   - generate one high-resolution composite for each one-to-four-Beat image
     group;
   - inspect it once and use the existing proven vision-guided crop path; and
   - import only accepted per-Beat images.

The result should support a realistic Storyboard Lookbook just as naturally as
a graphite, cartoon, watercolor, or abstract one. Nothing outside the current
Storyboard Lookbook may silently change that appearance.

## Context

### User-confirmed product direction

The user confirmed all of the following:

- Beat Storyboards always use the Storyboard Lookbook.
- The Storyboard Lookbook may define any appearance, including realistic
  imagery.
- Skills must contain no hardcoded storyboard appearance.
- Four Beats are generated as panels inside one image as an internal cost and
  performance optimization.
- Beat design may create any number of Beats appropriate to the Scene. The
  four-panel rule begins only when those saved Beats are grouped for image
  generation.
- Each panel follows Project aspect ratio and continuity rules as if it were
  generated separately.
- These are full storyboard images, not thumbnail previews.
- Character, Location, and Prop references should remain consistent across the
  Screenplay.
- Production continuity references may be realistic even when the Storyboard
  Lookbook is coarse or hand-drawn. They preserve canonical subject design,
  while the Storyboard Lookbook alone controls the rendered appearance.
- Codex built-in GPT Image 2 is the default for the current workflow.
- The agent must gather and interpret narrative and continuity context, decide
  concrete visual staging, write a model-appropriate prompt, and attach exact
  references.
- A Beat's narrativePurpose or complete narrative context must not simply be
  handed to the image model as an unprocessed prompt.
- Beat Storyboards are pre-production narrative-alignment artifacts.
- Shot Planner is production planning for director/cinematographer decisions.
- Renku CLI must expose Props through Core so the agent can include them.
- The current composite creation and vision-guided cropping workflow works and
  must not be replaced or supplemented with external cropping libraries or new
  crop algorithms.
- Generated Storyboards are analyzed once; the agent must not enter automatic
  edit, repair, retry, or regeneration loops.

### Applicable guidance from the storyboard review

The source review began from:

- https://design.tutsplus.com/articles/how-to-storyboard-basic-guides-for-aspiring-artists--cms-30962

The useful principles for Renku are:

- storyboards should communicate story progression clearly;
- consecutive panels should make action, geography, and continuity legible;
- subject placement and composition should be intentional;
- each panel should focus on the story information that matters;
- ordered panels should help collaborators discuss pace and timing; and
- visual clarity matters more than decorative detail that obscures the Beat.

The following article-level practices do not become Studio runtime contracts:

- hand-drawing technique;
- a universal storyboard medium or finish;
- fixed paper/page templates;
- one prescribed notation system;
- thumbnail-first output;
- Shot coverage fields inside a Beat; or
- automatic visual checks for panel contents.

Those choices either belong to the Storyboard Lookbook, the agent/user review
loop, or the later Shot Planner production workflow.

### Current Core and CLI evidence

Current Scene generation facts are built in:

- packages/core/src/server/generation/purpose-context.ts

buildSceneGenerationFacts currently returns:

- projectAspectRatio;
- opaque contextText;
- sceneCastMemberIds;
- sceneLocationIds; and
- sceneDialogueIds.

It already combines Screenplay references with the active Scene Beats
revision, preserves first-seen order, removes duplicates, and excludes
voice-over-only Cast Members from visual continuity. It does not collect:

- Prop references from the canonical Screenplay; or
- Beat propIds from the active Scene Beats revision.

The Scene Storyboard purpose is defined in:

- packages/core/src/server/generation/purposes/scene-storyboard-sheet.ts

It currently exposes:

- the Storyboard Lookbook Sheet slot;
- one Character Sheet slot per Scene Cast Member; and
- one Location Sheet slot per Scene Location.

The reusable Prop Sheet slot already exists in:

- packages/core/src/server/generation/reference-slots/domain-assets.ts

The missing Core work is therefore a focused extension, not a new reference
system.

The CLI handler in:

- packages/cli/src/commands/generation-command-handlers.ts

parses purpose and target, calls ProjectDataService.buildGenerationContext,
and returns the Core report. It does not filter facts or guide sections. The
correct CLI design is to leave production CLI code unchanged and add an
integration test proving the new Core facts and Prop candidate slot survive
the existing projection.

### Current Beat Storyboard workflow gaps

The current Studio Skills workflow is close to the requested shape but has
important contradictions:

- it correctly batches one to four saved Beats and already crops the returned
  composite successfully, but it does not state clearly enough that Scene Beat
  authoring may produce any narrative-appropriate Beat count and that grouping
  by four begins only at image generation;
- it filters Cast Members and Locations but omits Props in operative workflow
  prose;
- it lists Production Lookbook visual language as an optional Storyboard input;
- it describes Storyboard Lookbooks primarily as drawing language;
- the generic Scene Storyboard sample hardcodes hand-drawn, warm, practical,
  and shot-planning language;
- it tells the agent to use Beat narrative fields but does not provide a
  concrete synthesis recipe that distinguishes reasoning context from provider
  prompt content;
- it does not explicitly require subject placement, action geometry, gaze,
  object interaction, and reference roles per panel;
- it does not explicitly separate canonical subject fidelity from the
  rendering style of realistic Production continuity references;
- it does not make Codex the default Scene Storyboard sample or distinguish its
  prompt-only high-resolution request from the setting-off Renku request's
  structured image_size;
- Shot Planner and Beat Storyboard responsibilities are not stated strongly
  enough at all routing points; and
- it allows regeneration language without an explicit one-pass QA boundary.

### Current GPT Image 2 evidence

Implementation must refresh and cite the current official sources:

- https://learn.chatgpt.com/docs/image-generation
- https://developers.openai.com/api/docs/models/gpt-image-2
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide

The current official guidance supports this plan:

- Codex built-in image generation uses gpt-image-2, accepts attached reference
  images as visual guidance, and counts against general Codex usage rather than
  becoming a Renku-managed provider run.
- GPT Image 2 is recommended for new production image workflows.
- It supports reference-image generation through the edits endpoint.
- GPT Image 2's managed API processes reference inputs at high fidelity
  automatically; the managed request must omit input_fidelity rather than
  inventing a value. The Codex built-in envelope exposes no such field.
- It supports multi-image inputs and recommends naming each input by index and
  role, then saying how those inputs interact.
- It recommends stating explicitly what must remain unchanged when editing or
  composing from references. For this workflow, continuity references lock
  subject/design invariants while the Storyboard Lookbook controls target
  rendering style.
- It supports structured multi-panel compositions.
- Four-panel story prompts work best when each panel is a concrete,
  action-focused visual Beat.
- Complex prompts should use a stable order and short labeled sections rather
  than one long unstructured paragraph.
- Composition improves when viewpoint, framing, subject placement, scale,
  gaze, and object interactions are explicit.
- Image size and quality are separate controls. High quality does not by
  itself establish the output pixel dimensions.
- The official reliability boundary and exact size constraints must be checked
  at implementation time rather than copied into a timeless skill rule.

The current Renku Engines descriptor for
fal-ai/openai/gpt-image-2/edit already exposes:

- required image_urls;
- reference-image media semantics;
- one-or-more image references with no current descriptor maximum;
- custom image_size dimensions;
- high quality; and
- one generated image by default.

No Engines schema or catalog expansion is needed for this plan unless current
official/provider evidence changes before implementation.

### Accepted architecture

This plan extends, rather than bypasses:

- Decision 0040, Use Agent Media Execution Policy For External Built-In Image
  Generation, retaining the agent-external Codex/Engines boundary;
- Decision 0041, Keep AI Artifacts And Prompts Opaque;
- Decision 0048, Use One Production And One Storyboard Lookbook Per Project;
- Decision 0049, Use Request-Scoped Generation Reference Choices;
- Decision 0051, Keep Generation Authoring Incomplete And Reference Slots
  Agent-Directed;
- Decision 0070, Use First-Class Props As Continuity Subjects;
- Decision 0074, Use Core-Owned Project Workflow Settings, retaining the single
  Project image-generation choice;
- docs/architecture/media-generation.md;
- docs/architecture/reference/media-generation.md;
- docs/architecture/reference/visual-language.md; and
- docs/architecture/reference/studio-skills.md.

Core continues to own the deterministic one-to-four-panel Scene Storyboard
transform because it is an accepted product optimization. Core must not
interpret Beat prose, score prompts, decide creative suitability, inspect
generated pixels, or enforce that an image visually matches the Storyboard
Lookbook. Those remain agent/user responsibilities.

## Requirement Ledger

| ID | Requirement | Source | Planned result |
| --- | --- | --- | --- |
| R1 | Storyboard appearance comes only from the Storyboard Lookbook. | User | Remove generic appearance defaults and Production Lookbook styling from Beat Storyboard skills and samples. |
| R2 | A Storyboard Lookbook may define realistic or any other appearance. | User | Make Lookbook guidance medium-neutral and add realistic/style-contrast evals without changing the current Lookbook schema. |
| R3 | Every Beat Storyboard request uses the Storyboard Lookbook. | User | Require the agent to read the role document and attach one exact Storyboard Lookbook Sheet; stop and hand off if unavailable. |
| R4 | Beat authoring is independent from four-panel image batching. | User | Let Scene Beat design create any narrative-appropriate number of Beats; only image generation partitions requested saved Beats into consecutive groups of up to four. |
| R5 | Every panel behaves like a separate image for aspect ratio, composition, and continuity. | User | Give every panel the Project aspect ratio, a complete composition, explicit subject staging, and stable reference treatment. |
| R6 | Panels are not thumbnails. | User | Use a high-resolution full composite and durable full-panel crops; remove thumbnail and low-detail language. |
| R7 | Character, Location, and Prop continuity remains consistent across the Screenplay without importing Production rendering style. | User | Resolve exact subject ids per image batch, reuse accepted subject-owned sheets, preserve their canonical identity/design/geography, and render them only in the Storyboard Lookbook style. |
| R8 | Codex built-in GPT Image 2 is the default model path. | User | Use one Project image-path setting, **Use Codex for image generation**, on by default; turning it off selects the Renku-managed GPT Image 2 edit route. |
| R9 | GPT Image 2 prompt and reference rules are followed. | User and official docs | Use structured sections, exact reference roles, and concrete composition/action; keep the Codex envelope prompt-only and use structured size/input fields only when the Codex setting is off. |
| R10 | Narrative context is gathered and interpreted by the agent. | User | Add an explicit gather, reason, stage, and synthesize recipe. |
| R11 | Beat narrativePurpose is not sent as-is. | User | Treat narrative fields as reasoning evidence and convert them into observable panel direction. |
| R12 | Subject placement and other necessary visual decisions are deliberate. | User | Require per-panel subject scale, placement, gaze, action, object interaction, geography, and continuity choices. |
| R13 | Beat Storyboards and Shot Planner remain distinct. | User | Define pre-production story alignment versus production camera/coverage planning in skills, routing docs, and evals. |
| R14 | Renku CLI exposes Props through Core generation context. | User | Add scenePropIds and Prop Sheet guide slots in Core; prove the unchanged CLI JSON projection. |
| R15 | Runtime keeps creative artifacts opaque. | Repository architecture | Add no prompt semantic parser, image analyzer, style validator, panel validator, or automatic reference choice. |
| R16 | Existing request-scoped reference behavior remains. | ADRs 0049 and 0051 | Candidate slots remain optional authoring structure; the agent makes exact choices per request. |
| R17 | Existing data and product surfaces remain stable. | User scope and repository rules | No migration, Settings field, route, schema, selection, or durable crop/layout state; clarify only the existing image-generation setting copy. |
| R18 | The existing composite and crop path must not regress. | User | Preserve the current Core one-to-four-panel transform and media-producer vision-guided crop sequence unchanged; add no crop library, fixed coordinates, detector, or alternate splitter. |
| R19 | Generated-image QA is one-pass. | User | Generate once per reviewed request, inspect once, crop and inspect through the existing path, then accept or report and stop; never automatically edit, repair, retry, or regenerate. |

## Decisions

### Storyboard appearance authority

For scene.storyboard-sheet:

- the Storyboard Lookbook is the sole appearance source;
- the agent reads the complete current Storyboard Lookbook document;
- the agent inspects and attaches one exact Storyboard Lookbook Sheet;
- the prompt translates only the visual traits actually defined or visibly
  demonstrated by that Storyboard Lookbook;
- a Production Lookbook Sheet is never substituted;
- Production Lookbook prose is not added as an independent appearance source;
- generic skill prose adds no medium, realism, color, warmth, line quality,
  finish, texture, lighting treatment, or cinematic grade; and
- when the Storyboard Lookbook is realistic, the prompt may use realistic or
  photorealistic language because the Lookbook establishes it, not because the
  skill assumes storyboards look that way.

The current Storyboard Lookbook contract remains:

- styleBrief;
- lineAndFinish;
- valueAndAccent; and
- guardrails.

No rename or migration is planned. Current optional fields already allow
styles without linework. Skill and architecture copy will describe these as
general visual-language axes rather than a mandatory drawing technique.

### Continuity fidelity versus rendering style

Every image reference receives one non-overlapping role:

- the Storyboard Lookbook Sheet controls the target medium, realism level,
  linework, finish, lighting treatment, grade, texture, and detail density;
- Character Sheets control canonical identity, facial and body features,
  silhouette, proportions, costume, hair, and distinguishing details;
- Location Sheets control canonical spatial geography, landmarks,
  architecture, set dressing, and recognizable environmental features; and
- Prop Sheets control canonical construction, geometry, scale, materials,
  markings, condition, and Beat-specific state.

The prompt must tell GPT Image 2 to reproduce those continuity subjects
faithfully while re-rendering them in the Storyboard Lookbook's visual
language. In this plan, “faithfully” or “verbatim” means subject/design
fidelity, not copying the reference image's pixels, lighting, finish, or
photographic realism. When the Storyboard Lookbook is coarse and hand-drawn,
the prompt may simplify small details to the degree required by that style,
but must keep the identity, silhouette, costume, construction, geography, and
other defining features unmistakable. A realistic Production reference must
not make a non-realistic Storyboard realistic.

This role separation follows the current GPT Image prompting guidance to name
each input and state what must be preserved versus changed. It remains an
agent-authored prompt rule, not runtime semantic validation.

Representative prompt-role wording:

    Reference 1 — Storyboard appearance authority:
    Render every panel only in this reference's visual language.

    Reference 2 — Character continuity authority:
    Reproduce this Character as exactly as Reference 1's Storyboard style
    permits: preserve identity, facial and body features, silhouette,
    proportions, costume, hair, and distinguishing details. Re-render the
    Character in Reference 1's Storyboard style; do not copy Reference 2's
    photographic finish, lighting, or realism.

Location and Prop roles follow the same structure with their own exact
geography, construction, scale, markings, condition, and state invariants.

### Required workflow versus runtime invariant

The word always is implemented in the agent workflow:

- media-producer must not prepare or run a Beat Storyboard request without a
  current Storyboard Lookbook document and one usable Storyboard Lookbook
  Sheet;
- if the role is unauthored, hand off to lookbook-designer;
- if the document exists but no usable sheet exists, prepare and obtain
  acceptance of lookbook.storyboard-sheet before Scene Storyboard generation;
- if the sheet candidate is missing, unreadable, or unsuitable, stop for user
  direction rather than silently using the Production Lookbook or prose-only
  styling.

Core does not convert that workflow rule into:

- automatic candidate selection;
- GenerationSpec save-time rejection for an empty slot;
- prompt text validation;
- image-content validation; or
- a durable selected Storyboard Lookbook Sheet.

This preserves the accepted incomplete-authoring and request-scoped reference
contracts.

### Scene Beat cardinality and four-Beat image batching

Scene Beat Designer first authors the complete Scene Beats revision from
narrative development alone. It creates as many Beats as the Scene needs—five,
six, ten, or another justified count—without grouping, padding, merging, or
otherwise adapting them for media-generation cost.

Only after the revision is saved and the missing or explicitly requested Beat
ids are known does Media Producer partition those exact Beats in revision order
for image generation. The standard image batch is the next four consecutive
requested Beats.

For N requested Beat images:

- N = 1 to 4 produces one composite containing N panels;
- N = 5 to 8 produces one four-panel composite plus a one-to-four-panel
  remainder;
- N = 10 produces three independent image requests covering 4 + 4 + 2;
- larger sets continue in consecutive groups of four;
- image batching never changes the Scene Beats revision or any Beat identity,
  number, content, or order;
- the last request never invents filler Beats;
- the Codex request authors no num_images field, while the setting-off Renku
  request leaves its one-image default absent or explicitly uses one;
- four panels are regions inside that single output, not four provider output
  variants; and
- every composite remains an independent GenerationSpec, applicable Preview,
  external freeze or managed estimate/approval, execution, inspection, and
  attachment unit.

A smaller non-final image batch is allowed only when:

- the user explicitly requests that exact smaller subset; or
- the selected execution path's current documented/tool contract cannot accept
  the exact references needed for the four-Beat batch.

In the second case the agent reduces the batch rather than silently dropping a
needed Storyboard Lookbook or continuity reference.

This is strictly a request-cost optimization. It is not a Beat-design rule,
Beat-count recommendation, storyboard-page model, or durable batch concept.

### Panel and composite resolution

The full composite is a production-useful storyboard image, not a UI
thumbnail:

- With the Codex setting on, the agent puts the high-resolution
  full-composite requirement inside the exact reviewed prompt. The current
  built-in contract has no structured image_size or quality field, so the
  agent inspects the returned dimensions and does not promise exact pixels.
- With the Codex setting off, the agent authors a custom image_size for
  fal-ai/openai/gpt-image-2/edit near the model's current stable
  high-resolution boundary.
- The managed width and height preserve the chosen composite layout, respect
  the official edge, pixel-count, aspect-ratio, and multiple constraints, and
  use the current provider descriptor. Core continues to fix managed quality
  to high.
- The existing Core layout instruction continues to require every complete
  panel at the Project aspect ratio in Beat order, with clear gutters and empty
  unused canvas space. This plan does not prescribe a different grid.
- Every panel receives equal visual priority and enough area for a durable
  per-Beat crop.
- The agent inspects the actual composite dimensions and every resulting crop
  before import.
- The current vision-guided crop sequence remains unchanged. This plan adds no
  crop calculation, external image library, fixed-coordinate path, detector,
  or alternate extraction implementation.
- If the result is unusable, the agent reports the issue and stops instead of
  automatically editing, repairing, retrying, or regenerating it. Studio
  runtime adds no pixel-dimension or visual-quality gate.

For a 16:9 Project, 2560 by 1440 remains a setting-off Renku planning example
because it is a current high-resolution stable reference point. It is not a
Codex built-in guarantee or a universal hardcoded size for other Project ratios
or future provider contracts.

### One-pass generation review

Each approved GenerationSpec has one bounded review path:

1. execute the exact frozen Codex request or approved managed request once;
2. analyze the returned composite once with vision;
3. identify the actual panel image blocks using the current agent judgment;
4. crop through the existing working mechanism and inspect every crop;
5. import the useful accepted Beat images, or report the failed result and
   stop.

The workflow must not call image edit after inspection, synthesize a repair
prompt, run an automatic retry, or continue through a generate-analyze-edit
loop. If the user later asks for another attempt, that is a fresh independent
generation with a new saved and reviewed request and its normal usage/cost
boundary. It is not an automatic continuation of QA.

### GPT Image 2 setting and request shapes

With **Use Codex for image generation** on, the recipe and sample use:

    executionKind: agent-external
    provider: codex
    model: gpt-image-2

The Project's image-path setting is on for Codex by default. An
explicit current user choice or an execution path already authored on the saved
GenerationSpec takes precedence. A Codex request requires the harness
capability codex.gpt-image-2 and:

- keeps exactly values: { prompt } with the complete reviewed high-resolution,
  layout, composition, appearance, and creative requirements;
- keeps the selected Storyboard Lookbook, Character, Location, and Prop files
  as logical references without providerField assignments;
- assigns one stable promptMention to every reference named in the prompt;
- saves, previews when the Project Preview setting or the user requires it,
  rereads, and freezes the exact agent-external GenerationSpec before invoking
  the built-in tool;
- passes the frozen prompt unchanged and supplies every selected local image
  through the built-in tool's reference inputs;
- uses no Renku estimate, approval token, GenerationRun, provider receipt,
  image_size, quality, num_images, or input_fidelity value; and
- imports accepted crops with the frozen source Spec as exact provenance.

This plan does not add Codex to Engines. It uses the existing single Project
setting and keeps the harness availability check.

When the Project setting is off, or the user explicitly chooses Renku, use:

    provider: fal-ai
    model: openai/gpt-image-2/edit

That managed request:

- uses image_urls for all exact provider-visible image references;
- assigns one stable promptMention to every reference named in the prompt;
- places the Storyboard Lookbook reference first;
- follows with the exact batch-relevant Character, Location, and Prop
  references in a deliberate stable order;
- uses image_size as an exact structured provider value;
- leaves quality absent from authored values because Core fixes it to high;
- leaves num_images absent when the provider's one-image default is correct;
- leaves input_fidelity absent because GPT Image 2 handles image inputs at high
  fidelity automatically;
- keeps output format and other provider defaults absent unless the user
  deliberately changes them; and
- preserves the exact reviewed prompt and reference order through Preview and
  execution.

### Context gathering and prompt synthesis recipe

For each batch the agent must gather:

1. the exact Scene and exact Scene Beats revision;
2. the selected consecutive Beat records;
3. the Scene's opaque narrative context;
4. each Beat's title, description, narrativeDevelopment, narrativePurpose,
   Cast Member ids, Location ids, Prop ids, and Screenplay Block ids;
5. the current Storyboard Lookbook document;
6. one exact Storyboard Lookbook Sheet;
7. exact Cast Member, Location, and Prop records for ids in the batch;
8. exact visually inspected Character, Location, and Prop Sheet files;
9. prior accepted Beat Storyboard images when they are useful continuity
   evidence and can be attached through a real provider-visible reference; and
10. the selected execution path's current input shape, reference capacity,
    size controls, and exact model/tool guide.

The agent then reasons about:

- what visible event communicates the Beat's narrative development;
- what visual emphasis supports the Beat's narrative purpose without copying
  that abstract purpose into the provider prompt;
- which subjects must appear;
- their relative scale and placement;
- body pose, gaze, facial/emotional read, and interaction;
- the Location's stable geography and important landmarks;
- each Prop's state, scale, holder, placement, and interaction;
- foreground, middle-ground, and background relationships when useful;
- continuity from the previous panel and into the next panel;
- a clear provisional viewpoint and framing for story communication; and
- which details are unnecessary and should be excluded.

The agent may make provisional composition choices for the storyboard
artifact. Those choices are not persisted as camera Shots and do not become a
production coverage plan.

The final prompt uses this maintainable order:

1. Artifact and goal.
2. Reference roles, stating explicitly:
   - the Storyboard Lookbook reference controls all rendering style;
   - each continuity reference controls its canonical subject/design facts;
   - those facts must be reproduced faithfully in the Storyboard Lookbook
     style; and
   - the continuity reference's photographic or Production rendering must not
     leak into the Storyboard appearance.
3. Panel 1 through Panel N visible direction, where N is the current one-to-four
   Beat image batch.
4. Cross-panel and cross-batch continuity.
5. Storyboard Lookbook-derived appearance.
6. Composite layout and high-resolution output constraints.
7. Exclusions and text/label rules.

Each panel description is concrete and action-focused. It names visible
subjects and spatial relationships. It does not paste:

- facts.contextText;
- the full Beat JSON;
- narrativePurpose as an abstract paragraph;
- narrativeDevelopment without translating it into a visible event;
- internal ids as visible labels; or
- Shot Planner camera/coverage prose that does not exist in the Beat.

### Continuity reference policy

Core returns the complete Scene-level owner inventory. The agent filters it to
the exact batch:

- collect unique Cast Member ids in first Beat appearance order;
- collect unique Location ids in first Beat appearance order;
- collect unique Prop ids in first Beat appearance order;
- select exact sheets by visual suitability, never candidate list order; and
- deliberately reuse the same accepted subject-owned reference across Scenes
  and batches when continuity should remain unchanged.

The agent names each selected file by exact promptMention and states its
invariants. “Match Character Reference 2” means preserve identity, proportions,
costume, hair, silhouette, and distinguishing features; it does not mean copy
Reference 2's photographic finish. Equivalent invariant wording applies to
Location geography and landmarks and to Prop construction, markings, scale,
materials, and state. The Storyboard Lookbook reference remains the only style
authority for all of them.

This does not create a global Character Sheet, Location Sheet, or Prop Sheet
selection. Different requests may still make different exact choices when the
user changes continuity direction. The saved GenerationSpec is the sole
record of each request's reference choices.

If a referenced subject has no usable continuity sheet:

- do not replace it with an unrelated Project image;
- do not omit it silently;
- do not infer continuity from a filename, title, or prior prompt;
- stop and ask whether to generate the missing subject sheet, use an explicitly
  supplied external reference, revise the batch, or proceed without that
  continuity anchor.

### Beat Storyboard versus Shot Planner

Beat Storyboards:

- belong to pre-production story development and alignment;
- visualize ordered narrative developments;
- help the director, screenwriter, and collaborators discuss story clarity,
  emotional progression, relative pace, and timing;
- may use provisional composition to make a Beat legible;
- remain owned by logical Scene Beats; and
- do not define production coverage, lenses, camera movement, rigs, lighting
  setup, or an edit plan.

Shot Planner:

- belongs to production planning;
- expresses the director and cinematographer's intentional camera coverage;
- authors ordered Shots, Beat coverage, framing, optics, movement, focus,
  lighting intent, blocking, and approximate duration where relevant;
- may use selected Shot images for one exact production Shot; and
- does not replace or regenerate Beat Storyboards as Shot coverage.

Discussing pace and timing in Storyboard review does not add numeric timing
fields to Beats. Authoring approximate Shot duration does not turn the Shot
Plan into an editorial timeline.

## Architecture Shape Gate

### Owner and public entrypoint

Core remains the only owner of:

- factual target-resolved generation context;
- Scene Cast Member, Location, Prop, and Dialogue id inventories;
- exact purpose reference-guide slots and eligible candidates;
- the Project's one image-path choice and Codex capability projection;
- the absence of a competing scene.storyboard-sheet model recommendation;
- fixed high quality for Renku-managed execution;
- the deterministic composite-layout prompt suffix;
- provider-envelope validation through Engines; and
- durable storyboard attachment ownership and provenance.

The public entrypoint remains:

- ProjectDataService.buildGenerationContext; and
- renku generation context --purpose scene.storyboard-sheet
  --target scene:<scene-id> --json.

CLI remains a thin parser/formatter. No CLI-local Prop query, purpose switch,
candidate logic, or fallback is allowed.

Studio Skills own:

- Storyboard Lookbook prerequisite handling;
- exact batch selection;
- creative context interpretation;
- subject and reference selection;
- model-specific prompt authoring;
- provisional panel staging and composition;
- the default Codex built-in request recipe;
- high-resolution prompt direction and, on managed routes, model value
  selection;
- visual inspection;
- the existing agent-owned crop selection and extraction sequence;
- the one-pass accept-or-report QA boundary; and
- user-facing creative review.

### Intended Studio repository module shape

Modify focused Core owners:

- packages/core/src/server/generation/purpose-context.ts
  - add ordered Scene Prop collection;
- packages/core/src/server/generation/purposes/scene-storyboard-sheet.ts
  - add Prop Sheet slots;
  - remove the competing model recommendation;
- packages/core/src/server/generation/purpose-context.test.ts
  - prove Prop facts and exact candidates;
- packages/core/src/server/generation/purposes.test.ts
  - prove there is no competing model recommendation, Codex remains the default,
    and managed quality stays fixed; and
- packages/cli/tests/integration/scene-storyboard-generation-context.test.ts
  - add one focused end-to-end CLI projection test instead of expanding the
    existing 3,600-line general workflow file;
- packages/studio/src/features/movie-studio/project-details/project-settings-fields.tsx
  - clarify that the existing Codex image-generation setting is on by default
    and turning it off uses Renku-managed generation; and
- packages/studio/src/features/movie-studio/project-details/project-settings-fields.test.tsx
  - cover the clearer setting label.

Do not otherwise modify production code in:

- packages/core/src/server/generation/purpose-execution.ts;
- packages/cli;
- packages/engines;
- packages/studio beyond the existing setting's clearer label and description;
- database schema/migrations.

If implementation evidence shows one of those owners must change, stop and
return the exact blocker for plan revision rather than broadening the slice.

### Intended Studio Skills module shape

Update focused workflow owners:

- skills/media-producer/SKILL.md
  - state the arbitrary-Beat-count, up-to-four-image-batch, Prop-aware,
    Lookbook-only workflow;
- skills/media-producer/references/scene-storyboard-sheet.md
  - own the complete image-batch/context/prompt/one-pass-QA recipe while
    preserving its current vision-guided crop workflow;
- skills/media-producer/references/image-models/gpt-image-2.md
  - lead with Codex built-in GPT Image 2 prompting and multi-reference guidance,
    then separate the managed route's structured size and input fields;
- skills/media-producer/references/reference-visible-image-prompting.md
  - define exact Storyboard Lookbook, Character, Location, and Prop roles;
- skills/media-producer/samples/scene-storyboard-sheet-spec.json
  - demonstrate a prompt-only agent-external codex/gpt-image-2 request with one
    Storyboard Lookbook reference and exact continuity references, including a
    Prop;
- skills/media-producer/evals/forward-test-cases.md
  - add reference-fidelity/style-separation, Prop, prompt-synthesis,
    arbitrary-Beat-count/four-plus-remainder, one-pass-QA, and
    missing-reference cases;
- skills/lookbook-designer/SKILL.md;
- skills/lookbook-designer/references/lookbook-design-guidelines.md;
- skills/lookbook-designer/references/lookbook-json-contract.md
  - replace drawing-only normative language with arbitrary Storyboard visual
    language while retaining the current JSON contract;
- skills/scene-beat-designer/SKILL.md and its Beat guidelines;
- skills/shot-planner/SKILL.md and focused routing evals;
- skills/movie-director/SKILL.md and focused handoff/routing references; and
- sister-repository skill documentation that repeats the affected boundary.

Keep scene-storyboard-sheet.md as the one detailed prompt-recipe owner.
Other skills should link or hand off to it instead of duplicating the recipe.

### Public contract shape

GenerationContext remains the existing generic contract. Its facts object for a
Scene or Shot target gains:

    scenePropIds: string[]

The complete current factual shape is:

    projectAspectRatio: string
    contextText: string
    sceneCastMemberIds: string[]
    sceneLocationIds: string[]
    scenePropIds: string[]
    sceneDialogueIds: string[]

The Scene Storyboard guide gains one slot per exact Prop:

    section id: prop
    slot id: prop-sheet
    subject kind: prop
    subject id: <exact-prop-id>
    eligible candidates: exact active Prop-owned Prop Sheet AssetFiles

No dedicated Storyboard context DTO, Prop prompt object, panel schema, batch
schema, crop schema, or selected-reference field is added.

### Stop conditions

Stop and revise the plan if implementation would require:

- parsing or scoring narrativePurpose in Core;
- creating Core-generated creative panel prompts from Beat prose;
- validating that a prompt mentions Props, panels, references, or appearance;
- validating pixels against Storyboard Lookbook style;
- storing panel descriptions, positions, crop boxes, or extraction confidence;
- adding a global selected Storyboard Lookbook Sheet, Character Sheet,
  Location Sheet, or Prop Sheet;
- changing Scene Beat or Shot Plan schemas;
- adding a new CLI command, flag, route, or Settings value;
- adding more Studio UI than the clearer copy for the existing image-generation
  setting;
- adding Codex as an Engines provider or adding a second Scene Storyboard model
  recommendation;
- bypassing the Project's image-path setting;
- adding model-family inference or a second model allowlist in skills;
- adding a generic continuity-reference framework in place of the current
  focused slot helpers;
- limiting Scene Beat authoring to four Beats or changing Beat content/order to
  fit image batches;
- changing the current one-to-four-panel Core layout transform;
- adding a crop dependency, fixed coordinates, OCR, marker/border detection,
  grid slicing, runtime auto-splitting, or any alternative crop path;
- adding an automatic image edit, repair prompt, retry, or regeneration loop
  after visual inspection;
- changing Shot Image generation behavior beyond boundary wording;
- hardcoding realistic, cinematic, hand-drawn, graphite, warm, monochrome, or
  any other appearance in generic Storyboard workflow prose;
- editing generated fal schema JSON by hand;
- moving business rules into CLI, HTTP, React, or skill wrappers; or
- expanding an index file or existing generation module into a broad
  switchboard.

## Contracts

### Scene Prop fact derivation

buildSceneGenerationFacts collects scenePropIds from:

1. canonical Screenplay references whose target belongs to the Scene and whose
   subject type is prop; then
2. every propIds entry in active Scene Beats revision order.

It applies the existing orderedUnique behavior:

- preserve first occurrence;
- remove exact duplicate ids;
- do not sort;
- do not match by handle or name; and
- do not infer Props from narrative text.

Shot targets inherit the same Scene facts through their existing owning-Scene
resolution. No Shot-specific Prop field is added.

Historical or unavailable Prop ids remain factual ids. Their exact guide slots
may have no eligible candidate. Core does not substitute another Prop or
silently remove the fact. The agent handles creative readiness.

### Scene Storyboard reference guide

The guide order is:

1. Storyboard Lookbook Sheet;
2. Character Sheets in sceneCastMemberIds order;
3. Location Sheets in sceneLocationIds order; and
4. Prop Sheets in scenePropIds order.

This stable grouping is for reviewability, not automatic prompt importance.
The agent filters the complete Scene list to the exact batch and authors only
the exact chosen references.

Every slot stays request-scoped and unselected by default. One candidate does
not become selected merely because it is the only candidate.

### Single image-generation setting

scene.storyboard-sheet retains:

- target kind scene;
- output kind image; and
- fixed quality high.

The Project's **Use Codex for image generation** setting is on by default. With
it on, the request shape is agent-external codex/gpt-image-2 when the current
harness exposes codex.gpt-image-2. With it off, or when the user explicitly
chooses Renku, use fal-ai/openai/gpt-image-2/edit for this reference-driven
workflow. An execution path already saved on the request remains unchanged.

scene.storyboard-sheet exposes no `recommendedModel`, so callers do not receive
a second contradictory recommendation.

### Existing composite and cropping baseline

The current Core-owned suffix already requires one output image containing one
to four complete Project-ratio panels in Beat order, a clean grid, clear
gutters, no cropped/stretched/overlapping/merged panel regions, empty unused
canvas space instead of filler, and labels outside panel image regions. The
current media-producer workflow already inspects the actual composite, chooses
crop boxes for that exact image with vision, crops the panels, and inspects each
crop.

Both are accepted as the working baseline and remain unchanged in this plan:

- do not edit purpose-execution.ts or its existing regression tests;
- do not prescribe a new grid or change panel placement instructions;
- do not replace agent judgment with fixed coordinates, OCR, marker or border
  detection, grid slicing, runtime auto-splitting, or an image-cropping library;
- do not add crop boxes, extraction confidence, grid layout, or composite files
  to durable state; and
- do not add an automatic repair or regeneration path after inspection.

Agent-external specs remain preserved exactly by the existing execution
contract. Their reviewed prompt carries the same one-output, one-to-four-panel
layout requirements before freezing, while its rendering language remains
entirely Storyboard Lookbook-driven.

### Agent-authored request example shape

The updated sample remains an ordinary GenerationSpec:

    executionKind: agent-external
    purpose: scene.storyboard-sheet
    target: scene:<exact-scene-id>
    model: codex/gpt-image-2
    values:
      prompt: <exact synthesized prompt>
    references:
      - Storyboard Lookbook Sheet
      - exact batch-relevant Character Sheets
      - exact batch-relevant Location Sheets
      - exact batch-relevant Prop Sheets

The sample must demonstrate:

- four concrete panel descriptions;
- an exact role for every attached reference;
- explicit preservation of canonical subject/design facts while rendering all
  continuity references in the Storyboard Lookbook's style;
- subject placement and object interaction;
- style instructions derived from Reference 1 rather than a hardcoded medium;
- one Prop reference and its visible role;
- one output image containing four panels;
- Project-ratio panel geometry;
- a high-resolution full-composite requirement inside the exact prompt;
- no providerField on logical external references;
- no authored image_size, quality, num_images, or input_fidelity;
- the exact saved/frozen external Spec workflow;
- one-pass analysis followed by the unchanged crop/inspect path, with no
  automatic edit, repair, retry, or regeneration;
- no raw narrativePurpose dump; and
- no shot-planning claim.

### Documentation decision

Add:

- docs/decisions/0080-use-storyboard-lookbook-as-beat-storyboard-appearance-authority.md

ADR 0080 records:

- Storyboard Lookbook as the sole appearance authority for Beat Storyboards;
- arbitrary Storyboard Lookbook visual language;
- arbitrary Scene Beat cardinality followed by image-only batching of up to
  four saved Beats as an accepted cost optimization;
- the image-path setting, on for Codex built-in GPT Image 2 by
  default and using Renku-managed GPT Image 2 edit when turned off;
- agent-owned context synthesis and visual QA;
- continuity subject fidelity separated from Storyboard rendering style;
- preservation of the current composite/crop path and one-pass QA boundary;
- Prop-aware exact references;
- and the Beat Storyboard versus Shot Planner boundary.

Add narrow supersession notices to:

- Decision 0035, for direct Production Lookbook influence and drawing-only
  wording; and
- Decision 0048, for drawing-language wording.

Do not rewrite accepted history.

## Implementation Slices

### Slice 1: Lock the role and architecture decision

Add ADR 0080 and update the narrow accepted architecture wording before
changing workflow code.

Work:

- record Storyboard Lookbook as the only Beat Storyboard appearance source;
- record arbitrary Storyboard visual language;
- record continuity subject/design fidelity separately from rendering style;
- record the agent-workflow versus runtime-invariant boundary;
- record arbitrary Beat cardinality followed by up-to-four-panel image
  batching;
- record the unchanged composite/crop path and one-pass QA boundary;
- record the Project image-path setting, on for Codex by default, without adding
  Codex to Engines;
- record Prop reference context;
- record the Storyboard versus Shot Planner distinction;
- add narrow supersession notices to Decisions 0035 and 0048; and
- update architecture vocabulary so Storyboard Lookbook is not defined as
  necessarily drawn.

Do not change Lookbook JSON fields or stored documents.

### Slice 2: Complete Core Scene generation context

Extend the current owning modules.

Work:

- collect scenePropIds from canonical Scene references and active Beat propIds;
- preserve exact first-seen ordering and de-duplication;
- make Shot-target facts inherit scenePropIds through the existing Scene path;
- add one Prop Sheet guide slot per scenePropId;
- use the existing propSheetSlot helper;
- preserve Codex as the default Project image-generation choice;
- expose no scene.storyboard-sheet recommendedModel;
- keep high quality fixed;
- add focused unit tests.

Do not add a Core prompt synthesizer or Storyboard-specific facts DTO. Leave
purpose-execution.ts and its existing composite transform/tests unchanged.

### Slice 3: Prove the unchanged CLI projection

Add a focused CLI integration test.

The test creates or seeds:

- one Project;
- one Scene;
- one Prop referenced by the Scene and/or active Beat;
- an active Scene Beats revision whose Beat uses that Prop;
- one exact Prop Sheet AssetFile; and
- a Storyboard Lookbook Sheet.

It then runs:

    renku generation context
      --purpose scene.storyboard-sheet
      --target scene:<scene-id>
      --json

It asserts:

- facts.scenePropIds contains the exact Prop id;
- the prop/prop-sheet slot has the exact subject;
- only the exact Prop-owned Prop Sheet is eligible;
- the Storyboard Lookbook slot remains separate;
- the Project setting still selects Codex by default and reports the
  codex.gpt-image-2 external capability;
- settings contains no competing recommendedModel;
- quality remains fixed high; and
- no CLI adapter transformation is required.

Keep this in a new focused integration file. Do not add another scenario to
packages/cli/tests/integration/cli-workflows.test.ts.

### Slice 4: Replace the Beat Storyboard prompt recipe

Make scene-storyboard-sheet.md the detailed owner.

Work:

- state that Scene Beat authoring creates any narrative-appropriate Beat count
  before media generation begins;
- partition only the requested saved Beat images into consecutive batches of
  up to four;
- state one-to-three only for the final remainder, an exact user subset, or a
  real selected execution path reference-capacity constraint;
- add Props to context filtering and continuity selection;
- make the Storyboard Lookbook document and exact sheet required workflow
  inputs;
- remove Production Lookbook appearance input;
- add the gather, reason, stage, and synthesize sequence;
- add the exact GPT Image 2 prompt section order;
- separate continuity subject/design invariants from Storyboard rendering
  style, including the realistic-reference/coarse-hand-drawn case;
- require concrete per-panel visual instructions;
- forbid wholesale narrative/context dumping;
- explain provisional panel composition versus durable Shot planning;
- make agent-external codex/gpt-image-2 the default recipe and sample;
- keep the Codex request prompt-only, with high-resolution full-composite
  direction inside the exact prompt and logical references passed to the
  built-in image tool;
- document structured size selection and Core-fixed quality only for the
  setting-off Renku route;
- preserve the current vision-guided crop workflow exactly;
- make review one-pass: analyze, crop, inspect, then accept or report and stop;
- forbid automatic image editing, repair prompting, retry, or regeneration;
- update the generic Scene Storyboard sample;
- update main media-producer summary guidance; and
- update reference-visible prompt roles to include Prop state and interaction.

### Slice 5: Refresh GPT Image 2 execution and model guidance

Update the exact route guide from current official sources.

Work:

- mark built-in Codex GPT Image 2 as the default Scene Storyboard recipe;
- use fal-ai/openai/gpt-image-2/edit when the Project image-path setting is off or
  the user explicitly chooses Renku;
- expose no second model recommendation;
- document stable prompt ordering;
- document exact indexed/promptMention reference roles;
- document what each continuity reference must preserve and that its source
  rendering style must change to the Storyboard Lookbook style;
- document concrete composition, people, pose, gaze, and object interactions;
- document multi-panel action-focused Beat descriptions;
- document prompt-only Codex execution and logical image references;
- document custom size versus quality only for the setting-off Renku request;
- document current reliable size-boundary lookup rather than a timeless fixed
  constant;
- document that input_fidelity must be absent from the managed GPT Image 2
  request and is not a Codex external value;
- document one generated composite image rather than four output variants;
- preserve direct prose for simple single-image requests; and
- keep execution selection sourced from the Project image-path setting, explicit
  direction, a saved Spec, and current harness capability;
- keep managed field selection sourced from current descriptors; and
- do not add the external Codex capability to the Engines route registry.

Run the existing image prompt-guide registry validator after the change.

### Slice 6: Clarify department boundaries and Lookbook openness

Update the routing skills without duplicating the media recipe.

Lookbook Designer:

- describe the Storyboard Lookbook as arbitrary Storyboard visual language;
- retain current fields;
- explain realistic/no-linework use;
- remove normative drawing-only wording;
- keep shot direction and panel staging out of the Lookbook itself; and
- remove thumbnail-readability language from the generic sample.

Scene Beat Designer:

- describe Storyboard images as pre-production narrative alignment;
- state explicitly that Beat count follows narrative development and has no
  four-Beat generation cap;
- mention pace and timing as review outcomes, not stored Beat fields;
- keep camera/coverage fields out of Beats; and
- hand exact revision and missing Beat ids to media-producer.

Shot Planner:

- state production-planning ownership by director and cinematographer;
- state that it converts story intent into deliberate camera coverage;
- keep selected Shot images separate from Beat Storyboard images; and
- avoid routing a Beat Storyboard request through shot.image.

Movie Director:

- route story visualization/alignment to Scene Beats plus Media Producer;
- route camera/coverage production planning to Shot Planner;
- keep Production and Storyboard Lookbook roles distinct; and
- link to the detailed specialist handoff instead of repeating prompt rules.

### Slice 7: Add eval coverage and accepted documentation

Add or revise forward tests for:

- a realistic Storyboard Lookbook;
- a non-realistic Storyboard Lookbook;
- realistic Character, Location, and Prop sheets rendered faithfully in a
  coarse hand-drawn Storyboard Lookbook without inheriting realism;
- four Beats with two Cast Members, one Location, and one Prop;
- ten authored Beats remaining unchanged while image generation produces
  4 + 4 + 2;
- stable cross-batch references;
- missing Prop Sheet;
- missing Storyboard Lookbook Sheet;
- selected execution path reference capacity;
- default Codex prompt-only request and frozen-Spec provenance;
- Codex external size-control limitation;
- setting-off Renku GPT Image 2 high-resolution values;
- raw narrativePurpose avoidance;
- subject placement and Prop interaction;
- one-pass analysis with no image edit, repair, retry, or regeneration when the
  generated composite is unusable;
- unchanged vision-guided cropping with no new crop dependency or algorithm;
- Storyboard review versus Shot planning routing; and
- no paid generation during evals.

Update current architecture, CLI, and Studio Skills reference documentation.

## Tests And Guardrails

### Core unit coverage

packages/core/src/server/generation/purpose-context.test.ts:

- Scene-only Prop reference appears in scenePropIds.
- Beat-only Prop reference appears in scenePropIds.
- A Prop referenced by both appears once at its first position.
- Multiple Beats preserve first appearance order.
- Cast, Location, Dialogue, aspect-ratio, and opaque context facts remain
  unchanged.
- Shot context inherits the owning Scene's scenePropIds.
- The Prop guide section contains the exact Prop subject.
- Exact Prop Sheet candidates are eligible.
- An unrelated Prop Sheet is not eligible.
- No Prop Sheet leaves an empty truthful slot rather than a fallback.

packages/core/src/server/generation/purposes.test.ts:

- scene.storyboard-sheet still fixes high quality.
- scene.storyboard-sheet has no recommendedModel.
- other purpose recommendations remain unchanged.
- model selection remains broad and mechanically filtered by output/fixed
  settings.

packages/core/src/server/generation/purpose-context.test.ts also preserves:

- Codex as the default Project image-generation choice;
- codexBuiltIn.applicable for Scene Storyboard image generation;
- agent-external executionKind and codex.gpt-image-2 capability identity; and
- the fact that the external capability is not present in Engines models.

packages/core/src/server/generation/purpose-execution.test.ts remains unchanged
and must continue passing as the regression baseline for the existing
one-to-four complete Project-ratio panel transform and exact agent-external
request preservation. This plan adds no new composite-layout behavior for that
test to encode.

### CLI integration coverage

The new focused test proves:

- the command delegates to Core;
- JSON includes scenePropIds;
- JSON includes exact Prop Sheet slot/candidate data;
- JSON keeps Codex as the default and exposes the codex.gpt-image-2 external
  capability;
- JSON contains no competing recommendedModel;
- no new flag or adapter business rule exists; and
- human/JSON error behavior remains the current generic behavior.

### Skill forward-test matrix

| Scenario | Required evidence |
| --- | --- |
| Realistic Storyboard Lookbook | Prompt derives realism from the exact Lookbook and contains no inherited graphite, drawing, warmth, or Production Lookbook language. |
| Stylized Storyboard Lookbook | Prompt preserves the exact stylized medium without adding realism or cinematic grading. |
| Realistic continuity sheets with coarse hand-drawn Storyboard Lookbook | Prompt locks canonical Character identity/costume, Location geography, and Prop construction/state, simplifies only as the target style requires, and does not inherit photographic realism, lighting, or finish. |
| Arbitrary Scene Beat count | Scene Beat Designer authors the narrative-appropriate count without grouping or a four-Beat cap. |
| Four Beat batch | One external Codex spec, one output image, four complete Project-ratio panels, high-resolution full-composite prompt direction, and no invented num_images field. |
| Ten Beat Scene | The exact saved revision remains unchanged while three independent image specs cover Beats 1-4, 5-8, and 9-10 with no filler and stable continuity references. |
| Two characters, Location, Prop | Agent gathers exact ids, inspects exact sheets, names every prompt-visible reference role, and stages subjects/Prop interactions per panel. |
| Abstract narrative purpose | Agent uses it to choose visible emphasis but does not paste it as the provider prompt. |
| Missing Storyboard Lookbook Sheet | Agent stops and prepares/hands off the missing Lookbook Sheet workflow; never substitutes Production Lookbook. |
| Missing Prop Sheet | Agent reports the missing continuity anchor and asks for direction; never silently omits or substitutes. |
| Explicit alternative model | Agent honors user choice, loads that exact execution/model guide, and applies its real reference/size limits without treating GPT Image 2 prose as universal. |
| Codex setting on | Agent authors codex/gpt-image-2 with exactly values.prompt, preserves logical references, freezes the reviewed Spec, invokes the built-in tool, and invents no size, quality, num_images, or input_fidelity value. |
| Codex setting off | Agent uses fal-ai/openai/gpt-image-2/edit and applies its real descriptor-backed image_size and reference fields. |
| Unusable generated composite | Agent analyzes once, reports the issue, and stops without image edit, repair prompt, retry, or regeneration. |
| Existing crop workflow | Agent uses the current image-specific vision-guided crop and inspection steps without fixed coordinates, detectors, auto-splitting, or a new crop library. |
| Story visualization request | Movie Director routes to Scene Beats/Media Producer, not Shot Planner. |
| Camera coverage request | Movie Director routes to Shot Planner, not Beat Storyboard generation. |

### Opaque-artifact guardrails

Confirm implementation does not add:

- prompt substring validation;
- required prompt headings;
- a requirement that prompt text mention every reference;
- a prompt repair/rewrite service;
- Beat semantic classification in Core;
- image panel detection in Core or CLI;
- generated-image aspect-ratio rejection in runtime;
- style conformance checking;
- OCR, label checks, or panel-count validation;
- automatic reference choice;
- automatic continuity scoring; or
- fallback selection by list order.

Also confirm the agent workflow does not add:

- a generate-analyze-edit loop;
- an automatic repair prompt, retry, or regeneration;
- a crop library or new image-processing dependency;
- fixed-coordinate, OCR, marker, border, or grid-based crop inference; or
- a Beat-count rule derived from the four-panel request optimization.

The prompt recipe and evals may inspect and critique creative contents because
they remain agent-owned guidance.

### Regression guardrails

Keep passing:

- generic GenerationSpec create/update/freeze behavior;
- Preview exact prompt/reference preservation;
- managed estimate/approval/run behavior;
- agent-external source-spec provenance;
- Scene Storyboard grouped import and selection;
- Scene-local iteration-folder allocation;
- retained Scene Beats revision attachment;
- Shot Image ownership/selection;
- Lookbook role permanence;
- request-scoped reference choices; and
- current Prop Sheet/Prop Hero generation and attachment.

No paid generation is part of automated verification.

## Documentation

### Studio repository

Add:

- docs/decisions/0080-use-storyboard-lookbook-as-beat-storyboard-appearance-authority.md

Update:

- docs/decisions/0035-use-typed-lookbooks-and-storyboard-lookbook-dependencies.md
  with a narrow supersession notice;
- docs/decisions/0048-use-one-production-and-one-storyboard-lookbook-per-project.md
  with a narrow terminology notice;
- docs/architecture/reference/visual-language.md;
- docs/architecture/reference/domain-vocabulary.md;
- docs/architecture/media-generation.md;
- docs/architecture/reference/media-generation.md;
- docs/architecture/reference/studio-skills.md; and
- docs/cli/commands.md.

Document:

- Storyboard Lookbook as arbitrary appearance authority;
- Beat Storyboard pre-production role;
- Shot Plan production-planning role;
- Scene Prop facts and Prop Sheet guide slots;
- the Project image-path setting, on for Codex by default;
- GPT Image 2 edit when that setting is off or Renku is explicitly chosen;
- the absence of a competing Scene Storyboard model recommendation;
- narrative-appropriate Beat cardinality followed by image-only batching of up
  to four;
- continuity subject fidelity versus Storyboard rendering style;
- the unchanged working composite/crop path;
- agent-owned prompt synthesis and one-pass visual QA; and
- unchanged runtime opacity.

### Studio Skills repository

Update:

- media-producer workflow, purpose guide, exact model guide, reference guide,
  sample, and forward tests;
- lookbook-designer workflow, contract explanations, sample wording, and
  applicable evals;
- scene-beat-designer handoff and Beat guidance;
- shot-planner boundary and routing evals;
- movie-director department map, handoff checklist, and workflow playbooks;
  and
- README/release-facing skill descriptions only where they repeat the old
  drawing-only or routing model.

Do not edit historical plans merely to replace wording.

## Final Verification

### Focused automated verification

From the Studio repository:

    pnpm test:core
    pnpm test:cli
    pnpm type-check:core
    pnpm type-check:cli
    pnpm lint:core
    pnpm lint:cli
    pnpm build:core
    pnpm build:cli
    pnpm check:architecture

Run the exact focused Core and new CLI integration test commands directly when
the package scripts do not include integration tests in their normal test
partition.

From the Studio Skills repository:

    node skills/media-producer/scripts/validate-image-prompt-guides.mjs
      --project <isolated-test-project>
    npm run release:test

Use the repository's actual package manager for any additional accepted skill
checks. Do not install dependencies.

### Full regression verification

After focused tests pass:

    pnpm check
    pnpm test
    pnpm test:integration
    pnpm build

Record unrelated pre-existing failures separately with exact evidence. Do not
weaken this slice to make unrelated tests pass.

### Real project verification

Use an isolated copy of:

- /Users/keremk/renku-movies/urban-basilica

Do not mutate the live Project.

Verify on at least one Scene with current Props or a deliberately prepared
isolated fixture:

- generation context includes exact Prop ids and candidate slots;
- the Storyboard Lookbook Sheet is the only appearance reference;
- a Scene Beats revision with more than four Beats remains unchanged while its
  requested images partition into up-to-four-Beat requests;
- a four-Beat prompt can be prepared from exact context;
- realistic and non-realistic Lookbook directions remain possible;
- realistic Production continuity references can be prompted faithfully inside
  a non-realistic Storyboard style without importing their source finish;
- a default agent-external codex/gpt-image-2 request can be saved and frozen
  with exactly values.prompt and exact logical references;
- no built-in image tool is invoked during verification;
- with the Codex setting off, a managed GPT Image 2 Preview can represent exact
  references and a high-resolution image_size;
- no paid provider run is made;
- no new crop tool, crop dependency, or alternative splitter is invoked; and
- every save/freeze mutation stays inside the isolated copy; fixture media may
  be imported there to prepare exact reference candidates, but no generated
  Storyboard output is attached.

### Diff and architecture review

In both repositories:

- inspect git diff --stat;
- inspect the complete diff;
- run git diff --check;
- confirm no unrelated user changes were modified;
- inspect every large or heavily modified file in full;
- confirm CLI production code remained unchanged;
- confirm Engines production code remained unchanged;
- confirm Studio UI changed only the existing image-generation setting copy;
- confirm Core generation modules remain focused;
- confirm purpose-execution.ts and its tests are unchanged;
- confirm scene-storyboard-sheet.md is the single detailed recipe owner;
- confirm index files remain thin;
- confirm no compatibility alias or wrapper was added;
- confirm no prompt/image semantic validation entered runtime;
- confirm no generic appearance phrase overrides Storyboard Lookbook;
- confirm every Production continuity reference is described as a
  subject/design authority rather than a rendering-style authority;
- confirm Scene Beat authoring has no four-Beat cap and batching begins only in
  media generation;
- confirm no crop dependency, algorithm, or alternative extraction path was
  introduced;
- confirm no automatic image edit, repair, retry, or regeneration loop was
  introduced;
- confirm Shot Planner and Beat Storyboard boundaries are consistent across
  every touched skill/doc; and
- confirm no checklist item was satisfied by accepting unreviewable structure.

## Completion Checklist

### Review Area

- [x] User approves the plan before production implementation.
- [x] Confirm Storyboard Lookbook is the sole Beat Storyboard appearance
      authority.
- [x] Confirm realistic, illustrative, hand-drawn, graphic, painterly, and
      abstract Storyboard Lookbooks remain equally valid.
- [x] Confirm every agent-authored Beat Storyboard request uses the current
      Storyboard Lookbook document and one exact Storyboard Lookbook Sheet.
- [x] Confirm Scene Beat design creates any narrative-appropriate number of
      Beats without a four-Beat cap.
- [x] Confirm only image generation partitions requested saved Beats into
      consecutive groups of up to four.
- [x] Confirm a final one-to-three Beat remainder leaves unused space empty and
      never invents filler.
- [x] Confirm realistic Production references preserve canonical subject
      design without controlling Storyboard rendering style.
- [x] Confirm the current composite and vision-guided crop path remains
      unchanged.
- [x] Confirm generated-image review is one-pass and has no automatic edit,
      repair, retry, or regeneration.
- [x] Confirm full composites and per-Beat crops are not described as
      thumbnails.
- [x] Confirm Beat Storyboards remain pre-production narrative alignment.
- [x] Confirm Shot Planner remains director/cinematographer production
      planning.
- [x] Confirm the Project image-path setting uses built-in Codex GPT Image 2 by
      default and turning it off selects Renku-managed generation.
- [x] Confirm no new product surface or adjacent workflow is hidden in the
      implementation.

### Architecture And Contracts

- [x] Add ADR 0080 with the accepted role, batch, model, Prop, and workflow
      boundaries.
- [x] Add narrow supersession/terminology notices to ADRs 0035 and 0048.
- [x] Keep AI prompts and generated/reference media opaque to runtime.
- [x] Keep exact reference choices request-scoped.
- [x] Keep Core as the factual context and guide owner.
- [x] Keep CLI as a thin projection of buildGenerationContext.
- [x] Keep Engines as provider descriptor/schema/validation owner.
- [x] Keep skills as creative context/prompt/QA owners.
- [x] Add only scenePropIds to generic Scene/Shot generation facts.
- [x] Add no Storyboard-specific public DTO or panel schema.
- [x] Add no database schema or migration.
- [x] Add no Settings, flag, command, or route; change only the existing
      image-generation setting's label and description in Studio.
- [x] Keep quality high as the existing Core-fixed setting.
- [x] Keep the Project image-path setting on for Codex by default.
- [x] Preserve codex.gpt-image-2 as an agent-external capability outside
      Engines.
- [x] Expose no scene.storyboard-sheet recommendedModel.
- [x] Keep other image routes selectable and other purpose recommendations
      unchanged.
- [x] Keep purpose-execution.ts and its existing tests unchanged.
- [x] Add no crop dependency, crop algorithm, alternate splitter, or automatic
      generation repair loop.
- [x] Confirm final module/file structure matches the Architecture Shape Gate.

### Implementation Slices

#### Core Prop Context

- [x] Collect Prop ids from canonical Screenplay Scene references.
- [x] Collect Prop ids from active Scene Beats propIds.
- [x] Preserve first-seen order and exact de-duplication.
- [x] Do not infer Props from Beat or Screenplay prose.
- [x] Return scenePropIds for Scene generation context.
- [x] Return scenePropIds through the existing Shot-to-Scene context path.
- [x] Add exact prop/prop-sheet guide slots.
- [x] Reuse the existing propSheetSlot helper.
- [x] Keep empty Prop candidate slots truthful and non-blocking in Core.
- [x] Do not auto-select a sole Prop Sheet candidate.
- [x] Do not substitute another Prop or generic image.
- [x] Keep Cast, Location, Dialogue, aspect-ratio, and opaque context behavior
      unchanged.

#### Purpose And Composite Behavior

- [x] Make agent-external codex/gpt-image-2 the default recipe and sample.
- [x] Use fal-ai/openai/gpt-image-2/edit only when the Project setting is off
      or the user explicitly chooses Renku.
- [x] Preserve fixed high quality for managed execution.
- [x] Keep one generated output image per batch.
- [x] Keep one to four complete panels in Beat order.
- [x] Start batching only after the exact Scene Beats revision is authored.
- [x] Make the next four requested saved Beats the normal image request without
      changing Beat count, identity, content, or order.
- [x] Preserve Project aspect ratio inside every panel.
- [x] Keep clear gutters and non-overlapping complete panel regions.
- [x] Leave unused final-batch cells empty.
- [x] Describe panels as full storyboard images, not thumbnail depictions.
- [x] Keep the Core transform appearance-neutral.
- [x] Leave the current Core transform implementation and tests unchanged.
- [x] Preserve agent-external prompts exactly.
- [x] Preserve the existing vision-guided crop and crop-inspection sequence.
- [x] Add no external crop library, fixed crop coordinates, detector, or
      automatic splitting.

### CLI And Agent Surfaces

#### CLI Surface

- [x] Leave packages/cli production handlers unchanged.
- [x] Add a focused Scene Storyboard generation-context CLI integration test.
- [x] Prove facts.scenePropIds reaches CLI JSON.
- [x] Prove the exact Prop Sheet slot and candidate reach CLI JSON.
- [x] Prove the Storyboard Lookbook slot remains separate.
- [x] Prove the Project setting selects Codex by default and exposes the
      codex.gpt-image-2 capability.
- [x] Prove there is no competing Scene Storyboard recommendedModel.
- [x] Prove fixed managed quality remains visible.
- [x] Add no CLI-local Prop or purpose logic.
- [x] Keep the large general CLI workflow test from growing for this focused
      case.

#### Media Producer Prompt Recipe

- [x] Read the exact Scene Beats revision before batching.
- [x] Preserve every authored Beat and partition only requested image work.
- [x] Read the current Storyboard Lookbook document.
- [x] Require one exact usable Storyboard Lookbook Sheet per request.
- [x] Hand off or stop when the Storyboard Lookbook role/sheet is unavailable.
- [x] Never substitute Production Lookbook appearance.
- [x] Collect exact batch Cast Member ids.
- [x] Collect exact batch Location ids.
- [x] Collect exact batch Prop ids.
- [x] Inspect every exact selected reference file.
- [x] Treat continuity references as canonical subject/design authorities, not
      rendering-style authorities.
- [x] Preserve Character identity, silhouette, proportions, costume, hair, and
      distinguishing features.
- [x] Preserve Location geography, landmarks, architecture, and recognizable
      set features.
- [x] Preserve Prop construction, geometry, scale, markings, condition, and
      Beat-specific state.
- [x] Render all continuity subjects in the Storyboard Lookbook's style even
      when their source sheets are realistic.
- [x] Allow coarse style-driven simplification only while subjects remain
      unmistakably the same.
- [x] Reuse deliberate continuity references across batches/Scenes.
- [x] Never use candidate list order as creative selection.
- [x] Add the gather, reason, stage, and synthesize workflow.
- [x] Translate narrativeDevelopment into a visible event.
- [x] Use narrativePurpose for emphasis without pasting it wholesale.
- [x] Do not paste facts.contextText or Beat JSON into the provider prompt.
- [x] Require concrete subject scale and placement.
- [x] Require pose, gaze, action, and interaction when relevant.
- [x] Require Location geography and landmarks when relevant.
- [x] Require Prop state, scale, holder, placement, and interaction when
      relevant.
- [x] Require cross-panel continuity.
- [x] State that panel composition is provisional pre-production visualization,
      not durable Shot planning.
- [x] Analyze each generated composite once.
- [x] Keep the existing vision-guided cropping, crop inspection, and acceptance
      path agent-owned and unchanged.
- [x] Accept useful crops or report the issue and stop.
- [x] Do not automatically edit, repair, retry, or regenerate.
- [x] Keep grouped per-Beat import on the existing contract.

#### GPT Image 2 Guidance And Sample

- [x] Refresh the exact model guide from current official OpenAI sources.
- [x] Lead with built-in Codex GPT Image 2 execution.
- [x] Save the sample as agent-external codex/gpt-image-2.
- [x] Keep the sample values envelope exactly prompt-only.
- [x] Keep the sample image references logical and omit providerField.
- [x] Preserve the saved, reviewed, reread, and frozen external Spec workflow.
- [x] Lead with artifact/goal and use a stable prompt order.
- [x] Use short labeled sections for the complex four-panel request.
- [x] Name every prompt-visible reference by exact promptMention.
- [x] Give every attached reference one prompt-visible role.
- [x] State explicitly what each continuity reference preserves and what the
      Storyboard Lookbook restyles.
- [x] Put the Storyboard Lookbook reference first.
- [x] Describe how Character, Location, and Prop references interact with panel
      instructions.
- [x] Keep panel descriptions concrete and action-focused.
- [x] Specify composition, viewpoint, placement, scale, gaze, and interactions
      when they matter.
- [x] Put the high-resolution full-composite requirement in the Codex prompt
      without inventing an exact pixel guarantee.
- [x] Author a current model-supported high-resolution custom image_size only
      when the Codex setting is off.
- [x] Preserve the Project ratio instead of hardcoding 16:9 for every Project.
- [x] Omit image_size, quality, num_images, and input_fidelity from the Codex
      external values envelope.
- [x] Leave managed authored quality absent because Core fixes high.
- [x] Leave managed num_images absent or one, never four.
- [x] Omit managed input_fidelity for GPT Image 2.
- [x] Leave unrelated provider defaults absent.
- [x] Update the Scene Storyboard sample to include an exact Prop reference.
- [x] Remove hand-drawn, warm, practical, and shot-planning defaults from the
      generic sample.
- [x] Demonstrate realistic continuity references rendered in a coarse
      hand-drawn Storyboard Lookbook without photographic style leakage.
- [x] Demonstrate one-pass analysis with no automatic repair loop.
- [x] Validate the image model-guide registry after changes.

#### Lookbook And Department Skills

- [x] Update Lookbook Designer to describe arbitrary Storyboard visual
      language.
- [x] Retain styleBrief, lineAndFinish, valueAndAccent, and guardrails.
- [x] Explain realistic/no-linework usage without a schema change.
- [x] Keep camera, Shot coverage, and panel staging out of Storyboard Lookbook
      authoring.
- [x] Remove thumbnail-readability language from generic Lookbook samples.
- [x] Update Scene Beat Designer with pre-production story-alignment wording.
- [x] State that Scene Beat count follows narrative development and is never
      capped or grouped for four-panel generation.
- [x] Keep timing discussion out of persisted Beat fields.
- [x] Update Shot Planner with production camera/coverage ownership.
- [x] Keep Beat Storyboard and selected Shot Image ownership separate.
- [x] Update Movie Director routing and specialist handoffs.
- [x] Avoid duplicating the detailed prompt recipe outside media-producer.

### Tests And Guardrails

- [x] Cover Scene-only Prop references.
- [x] Cover Beat-only Prop references.
- [x] Cover exact Prop de-duplication and order.
- [x] Cover Shot context inheritance.
- [x] Cover exact and unrelated Prop Sheet candidates.
- [x] Cover empty Prop Sheet candidates.
- [x] Cover Codex as the default Project image-generation choice.
- [x] Cover the default prompt-only Codex request and frozen provenance.
- [x] Cover the absence of a competing Scene Storyboard model recommendation.
- [x] Keep the existing appearance-neutral Core suffix regression test passing
      without changing its behavior.
- [x] Cover unchanged agent-external prompts.
- [x] Cover realistic Storyboard Lookbook prompt derivation.
- [x] Cover non-realistic Storyboard Lookbook prompt derivation.
- [x] Cover realistic continuity references in a coarse hand-drawn Storyboard
      without importing their photographic rendering.
- [x] Cover narrative-appropriate Scene Beat cardinality independent from image
      batching.
- [x] Cover four Beats in one output image.
- [x] Cover ten unchanged Beats as image batches of 4 + 4 + 2.
- [x] Cover stable cross-batch subject references.
- [x] Cover two Cast Members, one Location, and one Prop.
- [x] Cover abstract narrativePurpose synthesis without raw copying.
- [x] Cover missing Storyboard Lookbook Sheet.
- [x] Cover missing Prop Sheet.
- [x] Cover alternative execution/model reference limits without silent
      reference dropping.
- [x] Cover Codex external size-control limitations honestly.
- [x] Cover Storyboard-versus-Shot-Planner routing.
- [x] Cover unusable output as analyze, report, and stop with no edit, repair,
      retry, or regeneration.
- [x] Cover preservation of the existing vision-guided crop path with no new
      crop dependency or algorithm.
- [x] Make no paid provider call in automated tests or evals.
- [x] Confirm no runtime prompt/image semantic validation was added.
- [x] Confirm no architecture test encodes private implementation names.

### Documentation And ADRs

- [x] Add ADR 0080.
- [x] Add narrow notices to ADRs 0035 and 0048.
- [x] Update visual-language architecture wording.
- [x] Update domain vocabulary for Storyboard Lookbook and Storyboard images.
- [x] Update media-generation architecture with scenePropIds, Prop slots, the
      single Codex-on-by-default setting, and batch role.
- [x] Document arbitrary Beat cardinality followed only by image-generation
      batching.
- [x] Document continuity subject fidelity separately from Storyboard rendering
      style.
- [x] Document the preserved composite/crop baseline and one-pass QA boundary.
- [x] Update CLI generation-context documentation.
- [x] Update Studio Skills architecture documentation.
- [x] Update sister-repository skill docs and evals.
- [x] Retain links and review dates for official GPT Image 2 sources.
- [x] Do not edit historical plans merely to replace terminology.

### Final Verification

- [x] Run focused Core tests.
- [x] Run focused CLI tests and the new CLI integration case.
- [x] Run Core and CLI type checks.
- [x] Run Core and CLI lint.
- [x] Run Core and CLI builds.
- [x] Run architecture checks.
- [x] Run the media-producer image prompt-guide validator.
- [x] Run Studio Skills release tests.
- [x] Run pnpm check.
- [x] Run pnpm test.
- [x] Run pnpm test:integration.
- [x] Run pnpm build.
- [x] Verify an isolated urban-basilica copy without paid generation.
- [x] Run git diff --check in both repositories.
- [x] Inspect git diff --stat and the complete diff in both repositories.
- [x] Inspect every new or heavily modified file in full.
- [x] Confirm unrelated user worktree changes were preserved.
- [x] Confirm packages/cli and packages/engines production code stayed
      unchanged and Studio changed only the existing setting copy.
- [x] Confirm purpose-execution.ts and its tests stayed unchanged.
- [x] Confirm Core modules and skill references remain focused and reviewable.
- [x] Confirm every index file remains a thin entrypoint.
- [x] Confirm no compatibility wrapper, alias, fallback, or re-export stub was
      added.
- [x] Confirm no generic storyboard appearance exists outside the Storyboard
      Lookbook.
- [x] Confirm no four-Beat rule entered Scene Beat authoring.
- [x] Confirm no crop dependency, new crop algorithm, fixed-coordinate path, or
      alternative splitter was added.
- [x] Confirm no automatic image edit, repair, retry, or regeneration loop was
      added.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark this plan complete.
