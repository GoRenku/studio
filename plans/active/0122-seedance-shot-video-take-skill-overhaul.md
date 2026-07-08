# 0122 Seedance Shot Video Take Skill Overhaul

Status: proposed
Date: 2026-07-07

## Summary

Rewrite the shot video take skill guidance so agents can reliably produce
Seedance 2.0 final video prompts from the actual active workflow:

- text-only video;
- image-to-video / first-frame video;
- first-and-last-frame video;
- reference-to-video with a storyboard image;
- reference-to-video with non-storyboard visual, video, or audio references.

The immediate trigger is a failed Seedance 2.0 storyboard-reference take for the
`urban-basilica` Bombardment sequence. The generated video blended elements from
all panels into one composite start image, rendered storyboard arrows/text into
the footage, jittered and morphed geography, transformed walls, placed Hagia
Sophia or mosque-like architecture in the wrong spatial relationship, and drifted
period details. This is not a small prompt-tuning issue. It exposes that the
current skill layout lets an agent produce a mechanically valid prompt that is
creatively and model-operationally unsafe.

The fix should be a route-first skill overhaul with Seedance 2.0 as the primary
target. Other models can remain documented, but the skill should optimize the
happy path for Seedance because that is the model being tested.

## Sources Reviewed

Local skill files:

- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-prompt-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/seedance-prompt-sheet-reference-video.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-first-last-frame.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-reference-images.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/reference-visible-image-prompting.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/sample-prompt.md`

Related plans:

- `plans/active/0089-agent-shot-video-take-cli-and-skills.md`
- `plans/active/0097-seedance-prompt-sheet-skill-remediation.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `plans/active/0113-reference-visible-image-prompting-guidance.md`

Prompting references:

- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/references/seedance-2-0.md`
- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/references/failure-fixes.md`

External model sources checked on 2026-07-07:

- ByteDance Seedance 2.0 model page: `https://seed.bytedance.com/en/seedance2_0`
- ByteDance Seedance 2.0 launch post: `https://seed.bytedance.com/en/blog/official-launch-of-seedance-2-0`
- fal Seedance 2.0 guide: `https://fal.ai/learn/tools/how-to-use-seedance-2-0`
- Seedance 2.0 paper: `https://arxiv.org/abs/2604.14148`

Relevant source facts:

- ByteDance describes Seedance 2.0 as a unified multimodal audio-video model
  supporting text, image, audio, and video inputs.
- ByteDance says references can control performance, lighting, shadow, camera
  movement, composition, motion rhythm, visuals, sound characteristics, and even
  text-based storyboards.
- ByteDance's launch post says current multimodal reference input supports up
  to 9 images, 3 video clips, and 3 audio clips.
- fal guidance emphasizes explicit subject/action, camera behavior, sound
  design, and clear `Shot 1:` / `Shot 2:` labels for multi-shot work.
- fal guidance warns that without clear shot labels, longer prompts tend to
  become one continuous take instead of an edited sequence.

## Current Skill Structure Audit

### Size and loading problem

The current shot-video guidance is too large and too cross-wired for a fragile
task:

```text
390 lines  skills/media-producer/SKILL.md
501 lines  skills/media-producer/references/shot-video-take.md
440 lines  skills/media-producer/references/shot-video-prompt-sheet.md
176 lines  skills/media-producer/references/seedance-prompt-sheet-reference-video.md
84 lines   skills/media-producer/references/shot-first-last-frame.md
59 lines   skills/media-producer/references/shot-reference-images.md
```

The agent must currently load and mentally reconcile over 1,600 lines to handle
shot-video work well. The most important Seedance storyboard-reference behavior
is split across at least four places:

- main media-producer overview;
- final take workflow;
- storyboard image generation workflow;
- Seedance storyboard-reference final prompt guidance;
- older remediation plan `0097`;
- separate `renku-write-prompts` Seedance guidance.

That makes the critical path easy to miss. The current files contain good
sentences, but the structure does not force the agent into the right procedure.

### Mixed responsibilities

`media-producer/SKILL.md` mixes:

- all media purpose routing;
- Renku-managed generation lifecycle;
- Codex built-in image generation lifecycle;
- Studio notification rules;
- import rules;
- cost approval rules;
- cast, location, lookbook, storyboard, voice, and shot-video guidance;
- target-resolution guidance;
- final binding rules.

`shot-video-take.md` mixes:

- take resolution;
- authoring document mutation;
- model/input selection;
- dependency generation;
- provider token mapping;
- Seedance and Kling token examples;
- storyboard handoff guidance;
- spec lifecycle;
- import lifecycle;
- examples.

`shot-video-prompt-sheet.md` mixes:

- creating the storyboard image dependency;
- deciding realistic versus hand-drawn strategy;
- geography guidance;
- audio and spoken timing;
- downstream final-video handoff;
- import details.

These are not equally important at the moment the agent is drafting a final
Seedance prompt. The final prompt path needs a much narrower decision tree.

### Prompt quality guidance exists but is not operational enough

The current docs already say many correct things:

- use provider tokens;
- call the image a storyboard, not a "video prompt sheet";
- describe visible panels;
- suppress borders, arrows, labels, captions, metadata rows, and UI;
- give every reference a role.

The failed prompt proves this is insufficient. The guidance is written as
advice, not as a hard route checklist. It lets an agent stop at a generic panel
summary without doing a visual storyboard audit or producing Seedance-ready
motion direction.

### The sample prompt shows the missing operating model

The sample `sample-prompt.md` is stronger because it does all of the following:

- names the storyboard as the controlling blueprint;
- states that each P## beat controls camera angle, shot scale, framing,
  staging, screen position, and direction;
- separates storyboard staging from final appearance references;
- defines visual medium, motion language, cinematography, audio, environment,
  emotional guidance, and rhythm;
- writes each beat as an executable video instruction;
- names specific camera scale, body direction, screen direction, contact,
  impact, and release timing.

The generated Constantinople prompt did not meet that bar. It described the
panels, but it did not turn the storyboard into a robust Seedance operating
manual. It also treated "continuous" as a broad prohibition on cuts, which can
encourage the model to blend panels unless the prompt explicitly says the
panels are physical waypoints in one real camera path.

## Failure Analysis From The Current Take

### 1. Panel blending

Observed failure:

- the starting frame mixed city, walls, siege field, and cannon elements into
  one composite image;
- the model seemed to treat the storyboard page as a collage of ingredients
  rather than a temporal plan.

Likely skill failure:

- the final prompt did not make the storyboard image the controlling temporal
  artifact strongly enough;
- "no cuts" was not paired with "use panels as ordered physical waypoints, not
  as a blend, morph, panorama, or composite";
- the prompt did not require the camera to begin in Panel 1's geography and
  physically pass through Panel 2 and Panel 3 before arriving at Panel 4.

Required fix:

- add a Seedance storyboard-reference grammar that distinguishes:
  - multi-shot panels with cuts;
  - continuous-take panels as waypoints;
  - hand-drawn panels as staging/motion references;
  - realistic panels as staging plus possible look/location references.

### 2. Visible arrows, labels, and text

Observed failure:

- arrows/text from the storyboard appeared in the final video.

Likely skill failure:

- artifact suppression was present but too weak and too late;
- the prompt did not explain that arrows/labels are instructions for the model,
  not scene objects or overlays.

Required fix:

- make artifact suppression its own mandatory section for storyboard-reference
  final prompts;
- explicitly name arrows, borders, panel grid, labels, captions, shot ids,
  camera rows, movement rows, VO rows, UI, and text boxes as forbidden
  on-screen artifacts;
- add "arrows and labels describe motion only; they must not appear as visible
  marks in the footage."

### 3. Geography collapse and transformation

Observed failure:

- walls transformed;
- the city, wall, field, and cannon did not maintain one coherent geography;
- Hagia Sophia or mosque-like architecture appeared in the wrong place and
  relationship.

Likely skill failure:

- the final prompt did not include a geography continuity contract;
- it described desired places but did not define spatial relationships and
  forbidden reversals;
- it did not explicitly correct visible storyboard anachronisms or prompt
  period risks.

Required fix:

- final storyboard prompts need a `GEOGRAPHY / PERIOD CONTINUITY` section;
- each beat must state where the camera is, where it is going, what is behind
  and ahead, and what must never swap sides;
- if the storyboard contains useful geometry but period errors, the prompt must
  say which visual facts to use and which historical errors to suppress.

For the 1453 Constantinople example, a prompt-quality pass should have added
constraints such as:

- use Byzantine Constantinople as a pre-Ottoman Christian imperial city;
- do not add Ottoman mosque silhouettes, minarets, or later Ottoman skyline
  features inside the city unless the screenplay explicitly calls for them;
- treat Hagia Sophia as a Byzantine church form, not an Ottoman mosque;
- the final cannon reveal looks into the Ottoman siege field around the cannon;
  do not put the city or wall on the wrong side of the cannon unless the shot
  design explicitly requires that reverse view.

The exact period facts should come from project context and user correction,
but the skill must force the agent to convert those facts into visible prompt
constraints.

### 4. Studio-context leakage

Observed risk:

- prompts can say "selected video prompt sheet", "selected Lookbook", "current
  image", or other Studio/app concepts that mean nothing to the provider.

Current mitigation:

- `reference-visible-image-prompting.md` handles this well for image prompts.

Gap:

- there is no equivalent compact, required provider-visible contract for final
  video prompts.

Required fix:

- add provider-visible video prompting guidance:
  - provider prompts may use only prompt text, route parameters, and attached
    media tokens such as `@Image1`, `@Video1`, and `@Audio1`;
  - provider prompts must not mention "selected", "approved", "current",
    "Studio", "tab", "card", asset ids, file names, or hidden app state;
  - if a concept matters, translate it into visible traits or a token role.

### 5. Route confusion

The current skill does not put route selection first. It describes all possible
paths, then expects the agent to remember which parts apply.

Seedance route behavior should be explicit:

- text-only: write subject/action, camera, sound, style, and duration; no
  provider tokens;
- image-to-video / first frame: let the image anchor identity/layout; prompt
  only motion, camera, sound, and what must remain stable;
- first-last-frame: define the transition from start to end; do not ask for a
  new unrelated scene;
- storyboard reference: inspect the image, classify the storyboard, map every
  panel to a beat, and write the final prompt as a storyboard operating manual;
- generic reference-to-video: assign each image/video/audio a narrow role and
  compose one coherent result.

## Proposed Skill Restructure

### Organization principles

Use progressive disclosure, but make the disclosure path deliberate:

- keep `skills/media-producer/SKILL.md` as a short purpose router;
- group multi-file media workflows under purpose folders in `references/`;
- put Shot Video Take guidance under `references/shot-video-take/`;
- put model-specific guidance under model subfolders such as
  `references/shot-video-take/seedance/`;
- name files by the job the agent is doing, not by historical internal purpose
  names;
- make `references/shot-video-take/index.md` the only required first reference
  for Shot Video Take work;
- let that index file name the exact next files to load for the active model,
  input mode, and task.

Do not treat the current flat `references/` folder as the right long-term
shape. It is already too crowded for media purposes that need several files.
Folder names should communicate ownership:

- `references/scene-storyboard-sheet.md` can stay flat because that purpose is
  still one focused workflow file.
- `references/shot-video-take/` should become a folder because final video
  takes have deterministic workflow, dependency creation, provider-visible
  prompting, prompt-quality checks, and model-specific route behavior.
- future model folders can follow the same pattern:
  `references/shot-video-take/kling/`, `references/shot-video-take/veo/`, or
  `references/shot-video-take/wan/` if those models later need enough guidance
  to justify their own files.

Inside Studio specs and CLI commands, the internal purpose key can remain
`shot.video-prompt-sheet`. In agent-facing filenames and provider-facing prompt
guidance, prefer `storyboard-reference-image`, `storyboard reference`, or
`shot plan`. The internal purpose key is storage vocabulary, not the mental
model the video model should receive.

### Target file layout

The media-producer skill should become a small router with route-specific
references. Use this file layout for the overhaul:

```text
skills/media-producer/SKILL.md
  concise purpose router, lifecycle reminders, and links only

skills/media-producer/references/workflow.md
  shared Renku-managed generation lifecycle used by all media purposes

skills/media-producer/references/reference-visible-image-prompting.md
  existing provider-visible image prompt guidance for image generation

skills/media-producer/references/shot-video-take/
  index.md
  renku-workflow.md
  provider-visible-prompting.md
  input-dependencies.md
  storyboard-reference-image.md
  first-last-frame-dependencies.md
  generic-reference-inputs.md
  prompt-quality-checklist.md
  seedance/
    index.md
    route-matrix.md
    text-only-final-video.md
    image-to-video-final-video.md
    first-last-frame-final-video.md
    storyboard-reference-final-video.md
    generic-reference-final-video.md
    native-audio.md

skills/media-producer/samples/shot-video-take/
  golden prompts, spec examples, and bad-prompt fixtures grouped by route

skills/media-producer/evals/shot-video-take/
  lightweight forward-test fixtures for route and prompt-quality checks
```

Do not keep the current scattered "prompt sheet" naming as the mental model.
Inside Studio and Renku specs, the purpose can remain `shot.video-prompt-sheet`.
Inside provider prompts, call the image a storyboard, storyboard reference, or
shot plan according to its visible content.

### File responsibility table

| Path | Read when | Owns | Must not own |
| --- | --- | --- | --- |
| `SKILL.md` | Any media-producer task starts. | Purpose routing, lifecycle reminders, and links to first reference files. | Shot Video Take route details, Seedance prompt grammar, or long examples. |
| `references/workflow.md` | Any Renku-managed media generation needs preview, estimate, approval, run, or import reminders. | Shared generation lifecycle. | Shot Video Take business rules or route-specific prompt content. |
| `references/shot-video-take/index.md` | Any Shot Video Take task starts. | Shot Video Take navigation, current-take gate, required context, model/input-mode decision tree, and exact files to load next. | Long Seedance templates, dependency generation details, or sample prompts. |
| `references/shot-video-take/renku-workflow.md` | The agent is creating, validating, estimating, running, or importing a final `shot.video-take` spec. | Deterministic CLI workflow for final videos: take context, preflight, preview, estimate, approval, run, import, and take attachment. | Provider-specific creative prompt grammar. |
| `references/shot-video-take/provider-visible-prompting.md` | The agent writes any final video provider prompt. | Token rules, app-language bans, reference role rules, and bad/better provider-visible examples. | Seedance-only route behavior or image-dependency creation. |
| `references/shot-video-take/input-dependencies.md` | The chosen final video mode needs prepared inputs before final generation. | Routing among storyboard/reference image, first frame, last frame, generic image/video/audio references, and already prepared assets. | The final video prompt itself. |
| `references/shot-video-take/storyboard-reference-image.md` | The agent is creating, importing, replacing, inspecting, or reading the handoff brief for the storyboard/reference image dependency. | The `shot.video-prompt-sheet` dependency workflow: context, strategy, prompt, preview, generation/import, inspection, and final-video handoff brief. | Seedance final prompt wording, provider token order, or final video estimate/run. |
| `references/shot-video-take/first-last-frame-dependencies.md` | The final mode needs generated or imported first/last frame images. | First-frame and last-frame dependency creation/import plus handoff constraints. | Model-specific final transition prompt grammar. |
| `references/shot-video-take/generic-reference-inputs.md` | The final mode uses non-storyboard image, video, or audio references. | Reference selection, import/generation expectations, and narrow role handoff notes. | Model-specific final prompt templates. |
| `references/shot-video-take/prompt-quality-checklist.md` | Before preview, estimate, approval, or paid final video generation. | Shared final-video prompt quality gates across models. | Long route guidance that belongs in model folders. |
| `references/shot-video-take/seedance/index.md` | The final model family is Seedance. | Seedance navigation and which Seedance route file to load. | Common CLI workflow, generic dependency creation, or other model guidance. |
| `references/shot-video-take/seedance/route-matrix.md` | The agent must decide the Seedance prompt grammar. | Seedance route selection across text-only, image-to-video, first/last-frame, storyboard reference, generic reference-to-video, and audio-aware variants. | Full route templates when a dedicated route file exists. |
| `references/shot-video-take/seedance/text-only-final-video.md` | Seedance text-only final video. | Text-only final prompt shape, duration/action density, camera, sound, and continuity. | Reference token guidance. |
| `references/shot-video-take/seedance/image-to-video-final-video.md` | Seedance image-to-video or first-frame final video. | Prompting from a start image: motion, camera, audio, stability, and drift prevention. | Storyboard-reference panel audit. |
| `references/shot-video-take/seedance/first-last-frame-final-video.md` | Seedance first-and-last-frame final video. | Endpoint transition prompt grammar and anti-morphing continuity rules. | Dependency image creation. |
| `references/shot-video-take/seedance/storyboard-reference-final-video.md` | Seedance reference-to-video when a storyboard/reference image is attached. | Storyboard audit, continuous-waypoint vs edited-shot grammar, artifact suppression, reference precedence, geography/period continuity, and final prompt sections. | Creating or importing the storyboard image dependency. |
| `references/shot-video-take/seedance/generic-reference-final-video.md` | Seedance reference-to-video without a storyboard image. | Assigning narrow roles to non-storyboard image/video/audio references and composing one coherent result. | Storyboard-specific panel rules. |
| `references/shot-video-take/seedance/native-audio.md` | Seedance native audio, narration, dialogue, ambience, or audio references matter. | Best-effort timing guidance, exact spoken text handling, and when to route to exact-sync workflows instead. | General audio asset import rules outside final video prompting. |

Do not leave old flat files as compatibility copies after implementation.
Rename/move the guidance to the owning files above and update callers or links
directly. This is a pre-customer skill tree, so stale paths should disappear
rather than become shims.

### Navigation contract

The rewritten skill should route in this order:

1. `SKILL.md` identifies the media purpose and routes Shot Video Take work to
   `references/shot-video-take/index.md`.
2. `references/shot-video-take/index.md` establishes the take, reads
   `renku take authoring context`, determines whether the task is dependency
   creation/import or final video prompting, and names the next files to load.
3. For dependency work, load only the relevant common dependency file:
   `storyboard-reference-image.md`, `first-last-frame-dependencies.md`, or
   `generic-reference-inputs.md`.
4. For final video work, load `renku-workflow.md`,
   `provider-visible-prompting.md`, `prompt-quality-checklist.md`, and the
   model folder index.
5. For Seedance, `seedance/index.md` loads `route-matrix.md`, then exactly one
   route file such as `storyboard-reference-final-video.md` or
   `image-to-video-final-video.md`. Load `native-audio.md` only when native
   audio, narration, dialogue, ambience, or audio references matter.
6. Build or read provider preview before final prompt approval so the prompt
   uses actual token order.
7. Draft the final prompt, run the prompt-quality checklist, then proceed with
   preview, estimate, approval, paid generation, and import.

The route-specific prompt guide should be loaded before writing the prompt, not
after the first draft.

For the current high-risk path, a Seedance storyboard-reference final video
should normally load only:

- `SKILL.md`;
- `references/shot-video-take/index.md`;
- `references/shot-video-take/renku-workflow.md`;
- `references/shot-video-take/provider-visible-prompting.md`;
- `references/shot-video-take/prompt-quality-checklist.md`;
- `references/shot-video-take/seedance/index.md`;
- `references/shot-video-take/seedance/route-matrix.md`;
- `references/shot-video-take/seedance/storyboard-reference-final-video.md`;
- `references/shot-video-take/seedance/native-audio.md`, only if audio matters;
- `references/shot-video-take/storyboard-reference-image.md`, only if the
  storyboard dependency is being created/imported now or the agent needs its
  handoff brief.

### Storyboard/reference image dependency in detail

`references/shot-video-take/storyboard-reference-image.md` is not the final
video prompt guide. It owns the image dependency itself: creating, importing,
replacing, inspecting, and handing off the storyboard/reference image that the
final video model will later receive as an image input.

That file should contain:

- purpose and boundary:
  - internal purpose key is `shot.video-prompt-sheet`;
  - agent-facing name is `storyboard/reference image`;
  - provider-facing name is `storyboard`, `storyboard reference`, or
    `shot plan`;
  - Studio stores the image as opaque media and does not validate panels,
    labels, arrows, or visual contents;
- current-take gate:
  - run `renku studio current --json` when the user says "this", "current", or
    "open";
  - continue only when the current surface identifies an existing Shot Video
    Take id;
- required context:
  - read `renku take authoring context --take <take-id> --json`;
  - read generation context/model choices when generating the dependency;
  - use ordered shot ids and take mode exactly as Core reports them;
- strategy choice:
  - choose realistic storyboard panels, hand-drawn/previs panels, a full-canvas
    motion map, a geography diagram, a timing board, or another explicit visual
    strategy according to the take;
  - choose `promptSheetVisualStyleId` and `promptSheetNotationModeId` as
    independent axes;
- reference handling:
  - realistic storyboards should usually carry final look, location, lighting,
    composition, and continuity in the panels themselves;
  - hand-drawn/previs storyboards can use Movie Lookbook, Location Sheet, and
    Character Sheet references more actively, but only as references;
- agent-owned storyboard brief:
  - transient working note, not a Studio schema or app validation contract;
  - captures panel/beat order, intended structure, visible contents,
    motion/camera cues, geography/period constraints, audio/dialogue timing,
    artifacts to suppress later, and visible errors to correct;
- generation/import workflow:
  - draft the media generation spec;
  - show the preview;
  - wait for user review;
  - validate, estimate, approve, run, and inspect for Renku-managed generation;
  - import without a receipt for Codex/manual/non-Renku sources;
- inspection before import:
  - reject or caveat outputs that contradict take order, reverse motion, collapse
    geography, invent characters/landmarks/dialogue, or become generic
    moodboards;
- final-video handoff:
  - preserve the hard constraints in a compact brief that
    `seedance/storyboard-reference-final-video.md` can reuse;
  - make clear which marks are instructions only, such as arrows, labels,
    captions, panel borders, timing rows, and UI-like text.

For the Bombardment failure, this dependency file would make the agent produce
or import a four-beat storyboard reference that preserves the continuous aerial
waypoint plan, 1453/Byzantine period constraints, cannon/wall/city spatial
relationships, narration timing, and artifact-suppression notes. The final
Seedance file would then translate that image plus handoff brief into a prompt
that tells Seedance to read `@Image1` as ordered physical waypoints, not as a
collage, first frame, panorama, or page layout.

## Seedance 2.0 Final Prompt Contract

### Universal Seedance prompt rules

Every Seedance final video prompt should:

- describe visible action, camera behavior, temporal progression, and sound
  when sound matters;
- use provider tokens only when those inputs are actually present;
- assign every supplied reference a narrow provider-facing role;
- avoid decorative tag piles;
- avoid provider-invisible app language;
- avoid relying on a separate negative field unless the active route supports
  it; put critical negatives into the main prompt;
- match the selected duration to the shot count and action density.

### Text-only route

Use this when no image/video/audio reference controls the result.

Required shape:

```text
[Subject and action].
Camera: [specific camera movement and framing].
Sound: [key sound events and ambient bed, if native audio matters].
Look and continuity: [period, location, material, palette, performance].
Do not include: [critical exclusions].
```

Do not invent `@Image1` or say "selected reference."

### First-frame / image-to-video route

Use this when a starting image anchors the shot.

Prompt contract:

- identify the starting image token if the provider contract exposes one;
- do not re-describe it as a new scene to create;
- say what moves, what the camera does, what sound evolves, and what must
  remain stable;
- forbid drift from source image layout, identity, period, and props.

### First-and-last-frame route

Use this when both endpoints are binding.

Prompt contract:

- treat the first frame as the start state;
- treat the last frame as the required destination state;
- describe the transition path, physical continuity, camera movement, and
  sound;
- do not ask for unrelated new geography between frames;
- do not let the model "solve" the transition by morphing architecture or
  characters unless transformation is explicitly desired.

### Storyboard-reference route

Use this when a storyboard or panelled shot plan is attached as a reference
image.

This is the highest-risk route and needs the strongest prompt contract.

Required pre-draft audit:

- inspect the actual storyboard image;
- count panels and read them in intended order;
- classify the storyboard:
  - continuous-take waypoints;
  - edited multi-shot sequence;
  - hand-drawn / pencil / previs;
  - realistic / final-style panels;
  - motion-annotated with arrows or timing rows;
  - text-heavy shot plan or script-board;
- note visible camera scale, angle, screen direction, foreground/background,
  action, geography, and audio/timing cue per panel;
- list artifacts that must not render;
- list hard constraints and contradictions with project context;
- decide whether visible panel errors should be copied or corrected.

Required final prompt sections:

```text
REFERENCES
CRITICAL STORYBOARD RULE
STORYBOARD PANELS AS VIDEO BEATS
MOTION AND CAMERA
GEOGRAPHY / PERIOD CONTINUITY
NARRATION AND AUDIO, if applicable
LOOK AND RENDER TRANSLATION
ON-SCREEN TEXT AND STORYBOARD ARTIFACTS
NEGATIVE CONSTRAINTS
```

Do not copy these section names blindly when a shorter prompt is genuinely
better, but the information must be present.

Core storyboard operating rule:

```text
@Image1 is the storyboard blueprint for this video. Read it as ordered video
beats, not as the first frame and not as a page layout to copy. Each panel
controls camera angle, shot scale, framing, staging, screen direction, motion
direction, and rhythm. Turn the panels into footage in order.
```

For continuous-take storyboards, add:

```text
Use the panels as physical waypoints in one uninterrupted camera path. Do not
blend panels into one composite image, do not morph geography between panels,
and do not show the storyboard page. The camera must travel through a coherent
3D space from Panel 1 to Panel 2 to Panel 3 to Panel 4.
```

For edited multi-shot storyboards, add explicit shot labels:

```text
Shot 1 / Panel 1: ...
Shot 2 / Panel 2: ...
Shot 3 / Panel 3: ...
```

Do not use "no cuts" for edited sequences. Do not use shot labels for a
continuous take unless the labels are clearly framed as waypoints rather than
cuts.

### Hand-drawn versus realistic storyboard handling

Hand-drawn, pencil, clay, mannequin, animatic, or previs storyboard:

- use for staging, camera, shot scale, screen direction, action, timing, and
  rhythm;
- do not render sketch lines, blank mannequins, clay material, borders, arrows,
  labels, or page layout;
- use Movie Lookbook, Character Sheets, Location Sheets, or written prompt for
  final appearance only when those references are actually attached or visible
  to the provider.

Realistic or final-style storyboard:

- use for staging, camera, shot scale, screen direction, action, timing, and
  rhythm;
- it may also carry final look, location, lighting, and composition if it is
  period-correct and visually aligned;
- still forbid page layout, borders, arrows, labels, captions, metadata rows,
  and UI;
- if the realistic storyboard contains known errors, explicitly say which errors
  not to reproduce.

### Reference precedence

When multiple references are attached:

```text
@Image1 is the storyboard. It controls sequence, staging, camera, movement, and
timing.
@Image2 is only [location / character / look / prop] continuity. Do not use it
as an alternate storyboard, first frame, page layout, or different geography.
@Audio1 is [narrator voice / ambience / sound-character] reference. Timing is
best-effort inside native Seedance audio.
```

The storyboard must not compete with location or lookbook boards. Supporting
references should be narrow and concrete.

## Prompt-Quality Checklist

Before any final `shot.video-take` estimate or paid run, the agent must answer
these questions. If any answer is "no", revise the prompt first.

### Mechanical grounding

- Did the agent re-read persisted take authoring context immediately before
  final prompt/spec work?
- Did the agent inspect provider preview or prepared inputs for actual token
  order?
- Does every `@ImageN`, `@VideoN`, and `@AudioN` in the prompt correspond to an
  actual provider input?
- Does every provider input have a role in the prompt?

### Provider-visible language

- Does the prompt avoid provider-invisible phrases such as "selected",
  "approved", "current", "Studio", "card", "tab", asset ids, and file names?
- Are app concepts translated into visible traits or provider tokens?

### Storyboard-reference prompts

- Did the agent inspect the storyboard image, not only its title or thumbnail?
- Does the prompt identify the storyboard by provider token?
- Does the prompt say the storyboard is an ordered temporal control document?
- Does the prompt describe every visible panel in order?
- Does each panel include camera/framing, action, subject motion, geography, and
  timing/audio cues when present?
- Does the prompt distinguish continuous-waypoint structure from edited-shot
  structure?
- Does it forbid panel blending, composite starts, panoramas, morphing
  geography, and rendered page artifacts?
- Does it suppress arrows, labels, panel borders, text rows, captions, shot ids,
  metadata, UI, and storyboard page layout as visible footage?

### Continuity and history

- Does the prompt preserve hard constraints from take context, user corrections,
  visible storyboard content, and relevant reference images?
- Does it identify any visible storyboard errors that should not be reproduced?
- Does it include period/era constraints when period drift would damage the
  shot?
- Does it define spatial relationships that must not swap?

### Audio

- Is exact narration/dialogue copied exactly when known?
- Is timing described as best-effort for native Seedance audio unless using an
  exact-sync workflow?
- Are key sound events and ambient bed stated concretely when audio matters?

## Concrete Remediation Tasks

### Phase 1: Create the Shot Video Take reference namespace

- Trim `media-producer/SKILL.md` to high-level media routing and lifecycle
  rules.
- Add `references/shot-video-take/index.md`.
- Move Shot Video Take guidance out of the flat reference files into the
  `references/shot-video-take/` folder.
- Make `index.md` the first loaded Shot Video Take reference and give it the
  concrete routing table:
  - dependency creation/import;
  - final video prompting;
  - text-only;
  - image-to-video / first-frame;
  - first-and-last-frame;
  - storyboard reference;
  - generic reference-to-video;
  - native-audio-aware final video.
- Route by persisted take state first: active take id, take authoring context,
  final model family, input mode, selected dependencies, and provider preview.
- Add "Seedance 2.0 first" language for current shot video takes while leaving
  clean extension points for other explicitly selected model families.
- Remove old flat files after their contents are moved. Do not leave
  compatibility copies, redirect stubs, or duplicate docs under the old names.

Acceptance:

- An agent handling a Shot Video Take loads `SKILL.md`, then
  `references/shot-video-take/index.md`, then only the files named by the
  current route.
- The old flat Shot Video Take files no longer contain active guidance.
- The file tree matches the table in this plan.

### Phase 2: Split deterministic workflow from input dependency work

- Create `references/shot-video-take/renku-workflow.md`.
- Keep it focused on deterministic Studio/Core/CLI lifecycle:
  - current take resolution;
  - `renku take authoring context`;
  - authoring updates;
  - preflight;
  - generation preview;
  - validation;
  - estimate;
  - approval;
  - run;
  - import;
  - final take attachment.
- Create `references/shot-video-take/input-dependencies.md`.
- Make it a short router for prepared inputs, not a prompt-writing guide.
- Create or move the dependency-specific files:
  - `storyboard-reference-image.md`;
  - `first-last-frame-dependencies.md`;
  - `generic-reference-inputs.md`.
- Make each dependency file end with a handoff note that captures constraints
  the final video prompt must preserve.

Acceptance:

- A task that only creates a storyboard/reference image does not need to load
  Seedance final prompt files.
- A task that only writes a final Seedance prompt does not need to load image
  dependency creation instructions unless it needs the storyboard handoff brief.
- Final video run/import instructions live in one common workflow file.

### Phase 3: Make storyboard/reference image dependency guidance concrete

- Rewrite the current `shot-video-prompt-sheet.md` content into
  `references/shot-video-take/storyboard-reference-image.md`.
- Rename the agent-facing concept from "video prompt sheet" to
  "storyboard/reference image" everywhere except exact internal purpose keys.
- Include these sections:
  - purpose and boundary;
  - current-take gate;
  - required context;
  - strategy choice;
  - reference handling;
  - agent-owned storyboard brief;
  - generation/import workflow;
  - inspection before import;
  - final-video handoff.
- Make the agent-owned storyboard brief mandatory for generated/imported
  storyboard dependencies. The brief is transient agent guidance, not Studio
  schema, not saved app state, and not runtime validation.
- The brief must capture:
  - panel count and order when panels exist;
  - intended structure: continuous waypoint, edited shot sequence, motion map,
    geography diagram, text-light shot plan, or other strategy;
  - visible panel/beat contents;
  - camera and motion cues;
  - geography and period constraints;
  - audio/dialogue/narration timing;
  - visible artifacts to suppress later;
  - visible errors to correct later;
  - hard constraints such as prop counts, line of action, foreground/background
    relationship, and final frame behavior.
- Add the Bombardment example as a compact explanatory example, not as a
  hard-coded project rule.

Acceptance:

- The file clearly answers "what does creating or importing the
  storyboard/reference image dependency itself mean?"
- The generated/imported dependency produces a handoff that a final video prompt
  can use without relying on memory or thumbnails.
- The file states that Studio runtime must not inspect or validate storyboard
  image contents.

### Phase 4: Add provider-visible video prompting and shared checklist

- Create `references/shot-video-take/provider-visible-prompting.md`.
- Document provider-visible inputs for final video:
  - prompt text;
  - route parameters;
  - attached image/video/audio tokens;
  - source/first/last frame tokens when the route exposes them.
- Ban provider-facing app language:
  - "selected";
  - "approved";
  - "current";
  - "Studio";
  - "card";
  - "tab";
  - asset ids;
  - filenames;
  - hidden app state.
- Add bad/better examples:
  - bad: "Use the selected video prompt sheet."
  - better: "@Image1 is the storyboard for this video..."
- Create `references/shot-video-take/prompt-quality-checklist.md`.
- Keep the checklist shared across models and route-specific enough to catch
  missing tokens, app-language leakage, missing reference roles, unsupported
  negative fields, and unreviewed storyboard artifacts.

Acceptance:

- The phrase "selected video prompt sheet" never appears in a final provider
  prompt sample.
- Provider-facing samples never ask the model to know Studio state.
- The shared checklist catches token mismatches before estimate or paid run.

### Phase 5: Build the Seedance model folder

- Create `references/shot-video-take/seedance/index.md`.
- Create `references/shot-video-take/seedance/route-matrix.md`.
- Create route files:
  - `text-only-final-video.md`;
  - `image-to-video-final-video.md`;
  - `first-last-frame-final-video.md`;
  - `storyboard-reference-final-video.md`;
  - `generic-reference-final-video.md`;
  - `native-audio.md`.
- Put common Seedance selection and capability notes in `index.md` and
  `route-matrix.md`.
- Put route-specific prompt shapes in the route files.
- Include duration guidance for single-shot versus multi-shot work.
- Include explicit shot-label guidance for edited multi-shot outputs.
- Include image-to-video stability guidance so starting images anchor identity,
  layout, period, and props instead of becoming vague inspiration.
- Include first/last-frame transition guidance so the model does not solve the
  transition through unwanted morphing.

Acceptance:

- A Seedance route can be selected before the prompt is drafted.
- Continuous takes and edited multi-shot sequences no longer share the same
  vague prompt pattern.
- Non-storyboard reference-to-video and storyboard-reference video no longer
  share the same instructions.

### Phase 6: Replace Seedance storyboard-reference final prompt guidance

- Move the useful content from the current
  `seedance-prompt-sheet-reference-video.md` into
  `references/shot-video-take/seedance/storyboard-reference-final-video.md`.
- Make it mandatory for Seedance reference-to-video when a storyboard/reference
  image is attached.
- Require the pre-draft storyboard audit.
- Require the continuous-waypoint versus edited-shot distinction.
- Require hand-drawn/previs versus realistic/final-style storyboard handling.
- Require reference precedence when supporting images, videos, or audio are also
  attached.
- Require panel artifact suppression:
  - no rendered arrows;
  - no labels;
  - no panel borders;
  - no captions;
  - no metadata rows;
  - no UI;
  - no shot ids;
  - no storyboard page layout.
- Require geography/period continuity:
  - where the camera starts;
  - where it travels;
  - what stays in foreground/background;
  - which side of frame or line of action must hold;
  - which period/geography errors visible in the storyboard should be corrected.
- Include the Bombardment failure mode as a short "why this exists" example.

Acceptance:

- A final prompt for a four-panel continuous storyboard cannot pass the
  checklist unless it describes four ordered waypoints and the physical camera
  path between them.
- A final prompt for an eight-panel edited storyboard cannot pass unless it
  preserves P01-P08 as separate beats or shots according to the storyboard.
- A final prompt cannot pass if it lets the storyboard image compete with
  location/lookbook boards as an alternate first frame or alternate geography.

### Phase 7: Update samples and golden prompts

- Replace weak samples such as `generation-preview-shot-video-take-final.json`
  with Seedance-ready examples under `samples/shot-video-take/`.
- Move or rewrite prompt-sheet samples so storyboard/reference image examples
  use the new naming and handoff brief.
- Add at least these golden prompt samples:
  - Seedance text-only single shot;
  - Seedance first-frame/image-to-video;
  - Seedance first-last-frame;
  - Seedance storyboard reference, continuous-waypoint, realistic panels;
  - Seedance storyboard reference, edited multi-shot, hand-drawn/previs panels;
  - Seedance storyboard reference with narration/audio reference.
- Add "bad prompt" fixtures for:
  - panel blending risk;
  - rendered arrows/text risk;
  - Studio-context leakage;
  - geography contradiction;
  - period drift.

Acceptance:

- Forward-testing a fresh agent against the sample storyboard produces a prompt
  structurally similar to `sample-prompt.md`, adapted to the actual subject
  rather than copied as a fight-scene template.

### Phase 8: Forward-test the skill

Use the skill-creator forward-testing pattern after the rewrite.

Test cases:

- Bombardment four-panel continuous aerial take with narration.
- Eight-panel hand-drawn action storyboard similar to `sample-prompt.md`.
- Calm two-character dialogue shot with one image reference and one audio
  reference.
- First/last-frame transformation or reveal shot.
- Text-only atmospheric establishing shot.

Do not give the forward-test agent the intended fix. Give it the rewritten
skill, raw take/storyboard context, and ask it to produce the final prompt.

Acceptance:

- The prompt-quality checklist catches weak outputs before paid generation.
- The agent does not use provider-invisible Studio language.
- The prompt distinguishes storyboard artifacts from final footage.
- Geography and period constraints are explicit.

## Non-Goals

- Do not add Studio runtime validation of storyboard panel contents. ADR 0041
  says AI artifacts and prompts remain opaque to Studio.
- Do not require every storyboard image to have panels. Some future references
  may be a full-canvas motion map, diagram, or non-panel shot plan.
- Do not ban storyboard references. The failure was bad prompting and weak
  handoff, not the existence of a storyboard input.
- Do not make Seedance the only supported model. Make it the optimized default
  for current testing, while leaving other explicitly chosen models supported.
- Do not preserve compatibility shims for obsolete skill paths unless a later
  implementation plan explicitly requires them.

## Implementation Notes

- Keep `SKILL.md` under control. The skill-creator guidance recommends keeping
  the body lean and moving route-specific details to references.
- Keep reference navigation shallow even with subfolders: `SKILL.md` should link
  to `references/shot-video-take/index.md`, and that index should directly list
  every common and model-specific file an agent may need for the active route.
  Do not require agents to discover required files through a long chain of
  nested references.
- Use subfolders for multi-file media workflows, not for one-off reference files.
  The folder should signal that the purpose has several owned workflow slices.
- Use imperative wording. Skills are instructions for future agents, not
  essays.
- Update `agents/openai.yaml` only if the skill description changes enough that
  UI metadata becomes stale.
- Validate the skill folder after edits with the skill validation script.
- Do not edit unrelated active plans or user-modified skill files while
  implementing this plan unless the rewrite task explicitly includes them.

## Completion Checklist

### Review area and architecture

- [ ] Confirm `skills/media-producer/SKILL.md` is a short router and does not
  contain detailed Shot Video Take or Seedance route guidance.
- [ ] Confirm Shot Video Take files live under
  `skills/media-producer/references/shot-video-take/`.
- [ ] Confirm Seedance-specific files live under
  `skills/media-producer/references/shot-video-take/seedance/`.
- [ ] Confirm old flat Shot Video Take files were moved, rewritten, or deleted,
  not kept as compatibility aliases.
- [ ] Confirm no non-index re-export, redirect, or pass-through documentation
  file was added to preserve old paths.
- [ ] Confirm the skill keeps Studio runtime boundaries intact: no runtime
  validation of storyboard panels, prompt contents, arrows, labels, captions, or
  generated media contents.
- [ ] Confirm internal purpose keys such as `shot.video-prompt-sheet` appear only
  where exact Studio/CLI contract names are needed.
- [ ] Confirm provider-facing prompt samples use `storyboard`, `storyboard
  reference`, or `shot plan`, not "video prompt sheet."

### Navigation and progressive disclosure

- [ ] Update `SKILL.md` to route Shot Video Take work to
  `references/shot-video-take/index.md`.
- [ ] Write `references/shot-video-take/index.md` with a route table that names
  the exact next files to read for dependency creation/import and final video
  prompting.
- [ ] Ensure a Seedance storyboard-reference final-video task loads a small,
  bounded set of files rather than the full media-producer reference folder.
- [ ] Ensure dependency-only tasks can stop at dependency files without loading
  model-specific final prompt files.
- [ ] Ensure final-video-only tasks can use a dependency handoff brief without
  rereading dependency generation lifecycle details unless needed.

### Common Shot Video Take files

- [ ] Create `references/shot-video-take/renku-workflow.md` for deterministic
  final video CLI/spec lifecycle.
- [ ] Create `references/shot-video-take/provider-visible-prompting.md` for
  token rules, hidden Studio-state bans, and reference role examples.
- [ ] Create `references/shot-video-take/input-dependencies.md` as the prepared
  input router.
- [ ] Create `references/shot-video-take/storyboard-reference-image.md` for
  storyboard/reference image creation, import, inspection, and handoff.
- [ ] Create `references/shot-video-take/first-last-frame-dependencies.md` for
  first/last-frame image dependency creation and handoff.
- [ ] Create `references/shot-video-take/generic-reference-inputs.md` for
  non-storyboard image/video/audio reference inputs.
- [ ] Create `references/shot-video-take/prompt-quality-checklist.md` for shared
  final-video prompt gates.

### Storyboard/reference image dependency

- [ ] Document the current-take gate with `renku studio current --json`.
- [ ] Document required take context with
  `renku take authoring context --take <take-id> --json`.
- [ ] Explain realistic versus hand-drawn/previs storyboard strategy.
- [ ] Explain `promptSheetVisualStyleId` and `promptSheetNotationModeId` as
  independent metadata axes.
- [ ] Require a transient agent-owned storyboard brief.
- [ ] Ensure the brief captures panel/beat order, intended structure, visible
  contents, camera/motion cues, geography/period constraints, audio/dialogue
  timing, artifacts to suppress, visible errors to correct, and hard continuity
  constraints.
- [ ] Document preview, validation, estimate, paid run, inspection, and import
  expectations for Renku-managed generation.
- [ ] Document import without receipt for Codex/manual/non-Renku sources.
- [ ] Include the Bombardment example as an explanatory dependency-to-final
  handoff case.

### Seedance model files

- [ ] Create `references/shot-video-take/seedance/index.md`.
- [ ] Create `references/shot-video-take/seedance/route-matrix.md`.
- [ ] Create `text-only-final-video.md` with subject/action, camera, sound,
  look, continuity, and duration guidance.
- [ ] Create `image-to-video-final-video.md` with start-image stability and drift
  prevention guidance.
- [ ] Create `first-last-frame-final-video.md` with endpoint transition and
  anti-morphing guidance.
- [ ] Create `storyboard-reference-final-video.md` with mandatory storyboard
  audit, continuous-waypoint versus edited-shot grammar, artifact suppression,
  reference precedence, and geography/period continuity.
- [ ] Create `generic-reference-final-video.md` for non-storyboard
  reference-to-video prompting.
- [ ] Create `native-audio.md` for best-effort native audio, exact text handling,
  and exact-sync workflow escape hatches.

### Samples and evals

- [ ] Move or create samples under `samples/shot-video-take/`.
- [ ] Add golden samples for Seedance text-only, image-to-video,
  first/last-frame, storyboard continuous-waypoint, storyboard edited
  hand-drawn/previs, and storyboard with narration/audio reference.
- [ ] Add bad-prompt fixtures for panel blending, rendered arrows/text,
  Studio-context leakage, geography contradiction, and period drift.
- [ ] Add lightweight eval or forward-test fixtures under
  `evals/shot-video-take/` if the skill package supports that folder.

### Validation and final verification

- [ ] Run the skill validation script for the media-producer skill folder.
- [ ] Forward-test the rewritten skill on the Bombardment continuous aerial take.
- [ ] Forward-test a hand-drawn edited multi-shot action storyboard.
- [ ] Forward-test a dialogue/reference/audio case.
- [ ] Forward-test a first/last-frame transformation or reveal case.
- [ ] Forward-test a text-only atmospheric establishing shot.
- [ ] Confirm the forward-test prompts do not leak provider-invisible Studio
  language.
- [ ] Confirm the forward-test prompts preserve storyboard artifacts as
  instructions only, not visible footage.
- [ ] Confirm geography, period, reference precedence, audio timing, and
  artifact suppression are represented in the prompt-quality checks.

## Done Criteria

This plan is complete when:

- shot video take guidance is route-first and Seedance-first;
- final Seedance storyboard-reference prompts require a real storyboard audit;
- final prompts no longer leak Studio/app state;
- storyboard references are called storyboards or shot plans in provider-facing
  text, not internal `video-prompt-sheet` objects;
- continuous storyboard prompts use ordered physical waypoints instead of
  ambiguous "no cuts" prose;
- edited multi-shot storyboard prompts use explicit shot labels;
- hand-drawn/previs and realistic/final-style storyboards have different
  handling rules;
- geography, period, reference precedence, audio timing, and artifact
  suppression are mandatory prompt-quality checks;
- updated samples demonstrate good prompts and known bad prompts;
- forward tests show the rewritten skill prevents the specific failure modes
  from the Bombardment Seedance take before a paid run.
