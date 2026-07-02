# 0097 Seedance Prompt Sheet Skill Remediation

Status: proposed
Date: 2026-07-01

## Post-Mortem Findings To Preserve

You are right. My previous post-mortem was itself wrong in an important way.

The right lesson is not "do not include prompt sheets." The right lesson is:

> Prompt sheets can work well with Seedance, but I failed to prompt the sheet as
> a storyboard/control document. I gave Seedance the sheet, then gave it a
> vague, under-structured, partially contradictory prompt that did not teach it
> how to read the sheet.

I also cannot quote or expose private reasoning logs verbatim. What I can do is
reconstruct the full observable failure chain from the prompt, payload, local
Renku context, generated video, skill guidance, and project artifacts. That is
what follows.

### Corrected Root Cause

The failure was not "prompt sheet included." The failure was:

- I included the prompt sheet.
- I did not name it as `@Image1`.
- I did not say clearly that it was a storyboard/prompt sheet.
- I did not tell Seedance to work through the panels in order.
- I did not forbid panel borders, labels, arrows, tables, shot IDs, and sheet
  text from appearing in the final video strongly enough.
- I did not say "never blend the panels into one frozen composite / panorama."
- I did not provide a structured Seedance-style
  `REFERENCES / QUALITY / MOTION / STORY / NARRATION / CRITICAL CONSTRAINTS`
  prompt.
- I contradicted the corrected prompt sheet's geography in the final prompt.

That last one is especially bad.

The prompt sheet's own spec explicitly says shot_002 must have
**battlefield/camp behind the cannon only**, with **no Theodosian Walls, no
city skyline, no wall line behind the cannon**. But my final video prompt said:

> "battlefield behind it, walls pale and distant through smoke."

That directly violated the corrected sheet's hard constraint. I should have
caught that before sending anything.

### What The Video Actually Did

I inspected the generated output and contact sheet. It roughly follows the
subject order:

- walls/city atmosphere
- wall front / threshold
- Ottoman field
- cannon mouth

But it fails the intended filmmaking:

- It feels like a lateral panoramic crawl through the sheet's visual ideas.
- It does not feel like a continuous drone path through real geography.
- The wall crossing is not physically legible as city -> wall -> field.
- The field descent feels flattened.
- The cannon reveal is the closest part, but still reads like a pushed panel
  endpoint rather than the end of one camera move.
- The model seems to have used the prompt sheet visually without enough
  instruction on how to interpret it temporally.

So your "it treated the four sections like a four-section visual source" read
is basically right, but the fix is **better sheet prompting**, not removing the
sheet.

### Research Correction

I also did the research poorly before. The stronger reading is:

- ByteDance's official Seedance 2.0 page says it supports text, image, audio,
  and video inputs, and that images/audio/videos can be used as references for
  performance, lighting, shadow, and camera movement:
  https://seed.bytedance.com/en/seedance2_0
- The Seedance 2.0 paper says the model supports multimodal reference inputs,
  including up to 9 images and 3 audio clips, for 4-15 second audio-video
  generation: https://arxiv.org/abs/2604.14148
- Storyboard-guided video work generally depends on separating layout/pose
  guidance, appearance/style, and motion prompts. That is exactly what your
  example prompt does: https://arxiv.org/abs/2605.23508
- Our own local Seedance prompt guide says reference prompts should assign
  roles, use `@ImageN` / `@AudioN`, and includes "storyboard or shot plan" as a
  valid reference role. The current flat path is
  `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/references/seedance-2-0.md`;
  the remediation should move Seedance-specific references under
  `references/seedance/`.
- The local Seedance contract exposes `@Image` and `@Audio` prompt token
  prefixes:
  `/Users/keremk/Projects/aitinkerbox/studio/packages/engines/src/shot-video/shot-video-model-families.ts`

So yes: prompt sheets are part of the intended technique. I ignored the real
lesson sitting in the docs and in your example.

### Snafus Before Sending The Request

Here is the full failure list.

- I first gave an incomplete prompt.

  You had to correct me that the narration text needed to be included. That was
  a basic miss. The final video prompt must contain the exact spoken words, not
  merely refer to "narration."

- I then gave a still-insufficient narration plan.

  You had to correct me again that the prompt needed to explain which part of
  the sentence should be uttered when. I eventually added timing blocks, but I
  treated timing as seconds in prose instead of integrating narration into the
  shot direction with production-level specificity.

- I failed to learn from the video prompt sheet itself.

  The sheet already had panel-level motion and VO timing. I should have
  translated that into a Seedance prompt that explicitly said: "Panel 1 means
  this, Panel 2 means this, Panel 3 means this, Panel 4 means this."

- I did not use the correct reference syntax.

  The actual provider contract supports `@Image1`, `@Image2`, `@Image3`, and
  `@Audio1`. I should have written something like:

  - `@Image1 is the storyboard / video prompt sheet.`
  - `@Image2 is the Theodosian Walls location reference.`
  - `@Image3 is the Imperial Wound lookbook style reference.`
  - `@Audio1 is narrator voice/style reference.`

  Instead I used vague phrases like "selected video prompt sheet," "location
  sheet," and "lookbook style."

- I failed to tell Seedance how to read the prompt sheet.

  Your example says:

  > "Work through the panels in order as separate shots that flow into one
  > continuous chase scene - never blend them into one frozen image."

  My prompt had nothing that strong. I said "preserve shot order" and "no
  cuts," but not "do not blend panels," "do not create a collage," or "use
  panels as temporal waypoints."

- I used "No cuts" in a way that may have made the panel problem worse.

  The desired take is continuous, yes. But with a prompt sheet, "no cuts"
  needed more careful phrasing:

  > "Use the four panels as four waypoints in one continuous camera path, not as
  > a split-screen, not as a collage, not as a morph between still panels."

  I did not say that. "No cuts" alone can push the model toward blending.

- I did not forbid sheet artifacts specifically.

  I wrote:

  > "No decorative title text, no readable labels, no extra subtitles..."

  That is too weak. I needed:

  > "None of the storyboard's panels, borders, numbers, labels, arrows,
  > captions, metadata rows, text boxes, UI, shot IDs, or sheet layout may
  > appear in the final video."

- I failed to carry over the sheet's hard constraints.

  The corrected prompt-sheet spec says:

  - exactly one cannon in shot_001c
  - no cannon rows
  - no duplicate guns
  - shot_002 background is battlefield/camp only
  - no walls behind the cannon
  - no city skyline behind the cannon
  - no wall line behind the cannon

  My final prompt did not include those strongly, and in one case directly
  contradicted them.

- I contradicted the corrected shot_002 geography.

  This is the biggest concrete prompt error. The prompt sheet correction said
  the viewer is between the wall and cannon, looking into the muzzle, with
  Ottoman camp behind the cannon. My prompt said the walls should be pale and
  distant behind/through the smoke. That reintroduced the exact geography
  problem the corrected sheet was created to fix.

- I did not inspect the prompt-sheet generation spec before writing the video
  prompt.

  The file
  `/Users/keremk/renku-movies/urban-basilica/generated/specs/bombardment-video-prompt-sheet-movie-lookbook-v2-corrected-spec.json`
  contains the intended constraints. I should have read it before final video
  prompting.

- I gave the model prose, not a prompt sheet operating manual.

  Your example has strong sections:

  - `QUALITY`
  - `FILM STOCK / LOOK`
  - `MOTION & CAMERA`
  - `STORY`
  - `CRITICAL ENDING`
  - `ON-SCREEN TEXT - CRITICAL`

  My prompt was mostly paragraphs. It did not create the same hierarchy of
  control.

- I under-specified motion.

  I said "glide," "crosses," "descends," and "lowers," but did not add enough
  continuous physical motion detail: smoke parallax, rooftops sliding below,
  wall towers passing under camera, field depth opening, ropes/tents/crews
  moving, final acceleration into the cannon.

- I did not protect against "nudged still pictures."

  Your example explicitly says:

  > "Give it real life... never the stiff feeling of nudged still pictures."

  My prompt did not include that kind of anti-stillness instruction. The result
  has exactly that stiff, panel-derived feeling.

- I did not instruct tempo properly.

  The desired clip needed: slow grave opening -> threshold crossing ->
  descending discovery -> sudden cannon drop. I gave times, but not enough
  cinematic tempo language.

- I did not make the final frame requirement strong.

  I should have said the final frame remains alive in motion, not a hold, fade,
  or dead centered poster frame. I only described the cannon filling foreground.

- I over-relied on exact audio timing inside native Seedance generation.

  Seedance can generate audio, but exact narration placement is not guaranteed.
  I should have treated timing as best-effort unless using a post/composition
  workflow for exact sync.

- I used the selected dialogue audio too vaguely.

  I wrote "Use the selected narrator dialogue audio..." but should have said
  `@Audio1` is a voice/style reference, and the narrator says the exact line. I
  also should have noted that timing is best-effort.

- I failed to preview the final provider reference order as part of the prompt.

  The provider inputs were effectively:

  - `@Image1`: video prompt sheet
  - `@Image2`: Theodosian Walls location sheet
  - `@Image3`: Imperial Wound lookbook
  - `@Audio1`: narrator audio

  I should have written the prompt using that order.

- I treated "ready-to-estimate" as too meaningful.

  Renku said the take was mechanically ready. That did not mean the Seedance
  prompt was creatively or structurally ready. The readiness check did not catch
  missing `@Image` roles, missing panel-artifact bans, or sheet-constraint
  contradictions.

- I created an invalid intermediate spec with `negative_prompt`.

  The endpoint rejected `negative_prompt`. The payload builder adds it when
  present:
  `/Users/keremk/Projects/aitinkerbox/studio/packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`.
  I should have verified the actual Seedance Mini reference-to-video schema
  before creating the spec.

- After the `negative_prompt` rejection, I patched the field instead of
  re-auditing the whole prompt.

  That was a missed checkpoint. A schema rejection should have triggered a full
  provider-payload review.

- I did not run a prompt-quality checklist before asking for paid generation
  approval.

  The checklist should have included:

  - Are all references named?
  - Is `@Image1` explicitly called a storyboard/prompt sheet?
  - Are panel artifacts forbidden?
  - Are panel order and timing explicit?
  - Are sheet constraints transferred?
  - Are there contradictions with the sheet?
  - Is audio timing described as best-effort or handled in post?
  - Is the endpoint schema clean?

- I promoted/attached the bad output too eagerly.

  The create-video workflow says the viewer/agent should inspect generated
  artifacts and iterate, not treat generation as success just because a file
  exists. I should have visually QA'd before presenting it as final.

### What The Prompt Should Have Done

The correct approach was much closer to your example:

```text
REFERENCES:
@Image1 is the storyboard / video prompt sheet. Treat it as the guide for shot order, look, camera route, motion arrows, and narration placement.
@Image2 is the Theodosian Walls location reference.
@Image3 is the Imperial Wound lookbook style reference.
@Audio1 is the narrator voice/style reference.

CRITICAL STORYBOARD RULE:
Work through @Image1 panel by panel in order as one continuous aerial scene. Use the panels as temporal waypoints, never as a split-screen, collage, grid, poster, or frozen composite. None of the panel borders, shot labels, arrows, text rows, captions, metadata, or sheet layout may appear in the final footage.
```

Then it needed a clean `STORY` section with panel-by-panel beats, a
`MOTION & CAMERA` section, a `NARRATION` section, and a `CRITICAL GEOGRAPHY`
section that preserved the corrected sheet constraints.

### Skill / Tooling Improvements

These are the concrete improvements I would make from this failure:

- Add a Seedance prompt-sheet lint rule: if a `video-prompt-sheet` is present,
  require the prompt to mention `@Image1` or the actual provider token.
- Require a "do not render sheet artifacts" clause for prompt-sheet workflows.
- Require "work through panels in order; never blend/collage/freeze them"
  language.
- Require every visual reference to have a role: storyboard, location, style,
  character, etc.
- Add a contradiction check between prompt-sheet spec constraints and final
  video prompt.
- Warn if a corrected prompt-sheet spec contains hard constraints not present in
  the final prompt.
- Warn if `negativePrompt` is present for a model route whose provider rejects
  `negative_prompt`.
- Treat "ready-to-estimate" as mechanical only; add a separate
  "prompt-quality ready" check.
- Add post-generation QA before selecting/attaching output as the take result.
- Add Seedance prompt-sheet guidance modeled on your example.

So, revised bottom line:

I was wrong to blame prompt sheets. The sheet was a valid tool. The prompt was
the failure. I failed to structure it, failed to address the references
correctly, failed to transfer the sheet's hard constraints, contradicted the
corrected geography, mishandled the endpoint schema once, and did not stop for
proper QA before treating the run as complete.

## Summary

This plan fixes the skill and workflow guidance that allowed a Seedance
reference-to-video prompt-sheet generation to fail despite the correct endpoint,
valid references, and a useful video prompt sheet.

The work should not teach agents to avoid prompt sheets. The correct behavior is
the opposite: when a Seedance reference route receives a `video-prompt-sheet`,
the agent must use the sheet intentionally as a storyboard/control artifact.
The final prompt must name the sheet with the correct provider reference token,
explain how to read the panels, suppress sheet artifacts, preserve hard
constraints, and pass through narration timing without over-promising exact
native audio sync.

This plan is primarily a skill-remediation plan. It may identify small Core or
CLI quality gates where skill guidance alone cannot reliably prevent repeat
failures, but the implementation should start with progressive-disclosure skill
updates.

## Context

The failure happened in a Shot Video Take using:

- input mode: `reference`;
- model: `fal-ai/bytedance/seedance-2.0/mini`;
- route: Seedance reference-to-video;
- shot group mode: multi-shot continuous take;
- required planning input: `video-prompt-sheet`;
- additional references: Location Sheet, Movie Lookbook sheet, dialogue audio.

The generated provider payload had:

- `image_urls`: prompt sheet, location sheet, lookbook sheet;
- `audio_urls`: narrator dialogue audio;
- `generate_audio: true`;
- `duration: "15"`;
- `aspect_ratio: "16:9"`;
- `resolution: "720p"`.

The endpoint call shape was valid. The problem was the final prompt and the
agent workflow that produced it.

The current relevant skills and references include:

- `renku-write-prompts`
  - `SKILL.md`
  - `references/seedance-2-0.md`, to be moved to
    `references/seedance/2-0.md` with all links updated in the same change
  - `references/failure-fixes.md`
- `renku-create-video`
  - `SKILL.md`
  - `references/session-video-workflow.md`
  - `references/viewer-iteration-loop.md`
- Renku-local `media-producer`
  - `references/shot-video-take.md`
  - `references/shot-video-prompt-sheet.md`
- `movie-director`
  - top-level routing/readiness guidance for current take work.

The current skill guidance already contains useful pieces, but they are not
sharp enough for this Seedance prompt-sheet handoff. In particular:

- `renku-write-prompts` says reference workflows should assign roles and use
  `@ImageN` / `@AudioN`, but it does not provide concrete
  prompt-sheet-to-video guidance.
- `media-producer` says to read the model report and match provider labels, but
  it does not require a prompt-sheet operating rule when `video-prompt-sheet`
  is present.
- `renku-create-video` says to inspect artifacts visually, but the final
  generation path still lets an agent treat a completed file as success without
  a strict QA gate.
- Existing readiness reports are mechanical; they do not certify that the final
  prompt is structurally fit for Seedance.

## Problem Statement

Seedance prompt sheets are a useful and common control technique. They fail when
the final prompt does not teach the model how to interpret the sheet.

The missing guidance is a route-specific middle layer:

- read the active final-video route;
- inspect the provider-preview reference order;
- assign each reference a provider token and role;
- when a prompt sheet is present, treat it as an ordered storyboard/control
  sheet, not a generic image;
- explicitly suppress prompt-sheet artifacts from the final footage;
- convert panel metadata, arrows, and narration cues into video direction;
- preserve hard constraints from the prompt-sheet brief/spec or visible sheet;
- avoid contradictory geography;
- separately explain native-audio best-effort limits;
- re-run prompt-quality checks after any provider schema or payload error.

Without this layer, agents can produce prompts that are mechanically valid but
creatively wrong.

## Goals

- Preserve prompt sheets as a first-class Seedance control method.
- Make Seedance reference-to-video prompting concrete enough for agents to use
  prompt sheets correctly.
- Add route-specific final prompt guidance for Seedance reference workflows
  with `video-prompt-sheet` inputs.
- Require provider-token role assignment for every supplied image/audio
  reference.
- Require a critical storyboard operating rule for sheet-guided final video.
- Require panel artifact suppression.
- Require panel-by-panel story, motion, tempo, and narration direction.
- Require hard-constraint transfer from the prompt sheet or prompt-sheet brief
  into the final video prompt.
- Require contradiction checks between prompt sheet constraints and final prompt.
- Treat exact native-audio narration timing as best-effort unless an exact-sync
  composition/lipsync workflow is selected.
- Add prompt-quality readiness separate from mechanical readiness.
- Improve post-generation QA before calling a take result successful.
- Keep progressive disclosure tight: only load Seedance prompt-sheet guidance
  when the active workflow is Seedance reference-to-video with a prompt sheet.
- Keep non-Seedance and non-reference model guidance out of the hot path.
- Avoid fixed prompt boilerplate. The guidance should help agents choose only
  the sections that fit the shot type, because irrelevant or overlong prompts
  can reduce generation quality.

## Non-Goals

- Do not ban prompt sheets or suggest prompt sheets are unsafe by default.
- Do not replace prompt-sheet guidance with first-frame or first/last-frame
  instructions.
- Do not load first/last-frame details when the active workflow is
  reference-to-video.
- Do not create a giant all-model video prompting reference.
- Do not hard-code Urban Basilica, Constantinople, cannons, Theodosian Walls, or
  the incident narration into general-purpose skill guidance.
- Do not require exact native-audio sync from Seedance when the provider only
  offers best-effort audio generation.
- Do not run paid generation as part of validating these skill changes.
- Do not move Core-owned route validation into skills.
- Do not add new durable project data solely to store this incident's
  post-mortem.
- Do not preserve obsolete incorrect advice such as "do not send prompt sheets
  to Seedance."
- Do not add compatibility shims for moved Seedance reference paths. Update all
  references atomically and let stale paths fail.
- Do not create rigid final prompt templates that agents copy wholesale.
  Guidance must be adaptive and shot-type-aware.

## Progressive Disclosure Design

The skill changes should follow the `skill-creator` progressive-disclosure
guidance:

- Keep each `SKILL.md` body short and procedural.
- Put route-specific detail in one-level `references/` files.
- Load the Seedance prompt-sheet reference only when the active workflow matches
  all of:
  - final `shot.video-take`;
  - model family Seedance;
  - input mode `reference`;
  - provider preview includes a `video-prompt-sheet`;
  - prompt draft or user request concerns final video prompting, estimation, or
    generation.
- Do not read first/last-frame references, image-to-video references, or
  unrelated provider references for this route.
- Keep examples short and generic. Use the incident only as a negative fixture
  in the plan and tests, not as always-loaded skill body text.

Recommended Seedance reference layout:

```text
renku-write-prompts/references/seedance/
  2-0.md
  prompt-sheet-reference-video.md
```

`prompt-sheet-reference-video.md` should contain the concrete Seedance
prompt-sheet pattern and a short QA checklist. `renku-write-prompts/SKILL.md`
should only link to it with clear routing conditions.

## Proposed Solution

### 1. Update `renku-write-prompts` Routing

Add a route-specific instruction to `renku-write-prompts/SKILL.md`:

```text
For Seedance reference-to-video with a video prompt sheet, read
`references/seedance/prompt-sheet-reference-video.md` after
`references/seedance/2-0.md`.
```

Keep this as a conditional branch. Do not make every Seedance prompt load the
prompt-sheet reference.

Also move the existing general Seedance guide into
`references/seedance/2-0.md`, then add a concise pointer:

- prompt sheets are valid reference inputs;
- prompt sheets must be named by provider token;
- panel order, artifact suppression, and role assignment are mandatory;
- sheet guidance lives in the new dedicated reference.

During migration, update every skill link to the new foldered path in the same
change. Do not leave compatibility shims. Compatibility shims are forbidden in
this project because it is not a shipping compatibility-bound product; stale
paths should fail loudly instead of silently preserving obsolete structure.

### 2. Add A Seedance Prompt-Sheet Reference

Create `references/seedance/prompt-sheet-reference-video.md`.

Suggested table of contents:

1. When to read this file
2. Required inputs
3. Provider-token role mapping
4. Prompt-sheet operating rule
5. Adaptive final prompt section guidance
6. Narration/audio handling
7. Hard-constraint transfer
8. Prompt-quality checklist
9. Common failure fixes

The reference should teach this pattern:

```text
REFERENCES:
@Image1 is the storyboard / video prompt sheet. Treat it as the guide for shot
order, camera path, motion arrows, visible composition, and narration placement.
@Image2 is the location continuity reference.
@Image3 is the visual language / lookbook style reference.
@Audio1 is the narrator voice/style reference.

CRITICAL STORYBOARD RULE:
Work through @Image1 panel by panel in order as one continuous scene. Use the
panels as temporal waypoints, never as a split-screen, collage, grid, poster,
or frozen composite. None of the panel borders, numbers, shot labels, arrows,
captions, metadata rows, text boxes, UI, or sheet layout may appear in the
final footage.
```

The guidance should not require a rigid section template. It should offer a
menu of useful sections and instruct the agent to include only the sections that
apply to the selected take, model route, prompt sheet, and user intent.

Always consider these core controls:

- `REFERENCES`
- `CRITICAL STORYBOARD RULE`
- `STORY / PANEL SEQUENCE`
- `CRITICAL GEOGRAPHY AND CONTINUITY`
- `ON-SCREEN TEXT AND SHEET ARTIFACTS`
- `NEGATIVE CONSTRAINTS`

Include these only when they are relevant:

- `QUALITY`, when image fidelity or sharpness is a meaningful failure risk.
- `LOOK / VISUAL LANGUAGE`, when a style/lookbook reference is present.
- `MOTION & CAMERA`, with different emphasis for action, dialogue,
  establishing, object, landscape, or atmospheric shots.
- `ACTION PHYSICS / MOMENTUM`, for chase, battle, stunt, impact, machinery, or
  other kinetic scenes.
- `DIALOGUE PERFORMANCE`, for dialogue, lip movement, speaker turn-taking, or
  facial acting.
- `NARRATION / AUDIO`, when native audio, voiceover, dialogue, ambience, or
  sound effects are part of the generation.
- `CRITICAL ENDING`, when the final frame or final motion state matters.
- `ESTABLISHING GEOGRAPHY`, when the shot's primary job is spatial orientation.

The guidance should explicitly warn:

- do not copy every section into every prompt;
- do not pad prompts with irrelevant boilerplate;
- keep prompts as short as possible while preserving the controls that matter;
- action, dialogue, establishing, atmospheric, object, and transition shots need
  different emphasis;
- an overlong prompt with irrelevant sections can reduce generation quality.

The reference should explain why this structure matters:

- `REFERENCES` prevents vague "selected sheet" wording.
- `CRITICAL STORYBOARD RULE` tells Seedance how to interpret the sheet.
- `STORY / PANEL SEQUENCE` converts each panel into temporal action.
- relevant motion and camera guidance prevents nudged-still-picture output.
- `CRITICAL GEOGRAPHY` prevents contradictions with the sheet.
- `ON-SCREEN TEXT` prevents labels, arrows, borders, and metadata from
  appearing in the video.

### 3. Add A Provider Reference Mapping Checklist

Update `media-producer/references/shot-video-take.md` so final video prompting
requires agents to read `providerPreview.spec.inputs` or the equivalent
preflight/provider preview before drafting provider-reference tokens.

The skill should say:

- Determine the actual provider token order from the final provider preview.
- Assign each `image_urls` input to `@ImageN` in order.
- Assign each `audio_urls` input to `@AudioN` in order.
- Do not infer token numbering from filenames or memory.
- If the provider preview contains a `video-prompt-sheet`, the final prompt
  must explicitly name that token as the storyboard/prompt sheet.
- If the provider preview contains additional image references, the final
  prompt must state whether each one is for location continuity, style, cast
  identity, prop continuity, or another specific role.

This checklist should remain general enough to support future provider routes,
but include Seedance-specific examples only in the Seedance reference.

### 4. Add A Prompt-Sheet Handoff Gate

Add a final-prompt gate in `media-producer/references/shot-video-take.md`:

When a `video-prompt-sheet` input is present, before estimating or running final
video generation the agent must confirm:

- the final prompt names the prompt sheet by provider token;
- the final prompt says to work through panels in order;
- the final prompt says panels are temporal waypoints;
- the final prompt forbids sheet layout, borders, labels, arrows, captions, and
  metadata rows from appearing;
- every supplied image/audio reference has a role;
- panel-level narration or dialogue text has been copied exactly when known;
- audio timing is described as best-effort unless an exact-sync workflow is in
  use;
- the prompt does not contradict visible sheet constraints or the prompt-sheet
  brief/spec.

If any item fails, revise the prompt before cost estimate or paid generation.

### 5. Preserve Hard Constraints From The Prompt-Sheet Brief

Update `shot-video-prompt-sheet.md` and `shot-video-take.md` together so the
handoff from generated sheet to final video prompt is explicit.

The agent should use this priority order for hard constraints:

1. Current take authoring context and selected shot data.
2. User-provided corrections.
3. Prompt-sheet generation spec or brief, if available in the project.
4. Visible prompt sheet text and imagery.
5. Selected Location Sheet, Character Sheet, and Lookbook references.

The final prompt must preserve hard constraints from these sources unless the
user explicitly changes them.

Examples of hard constraints:

- exact number of major props or vehicles;
- required background/foreground geography;
- forbidden landmarks or zones;
- one side of frame / line of action;
- exact spoken words;
- final frame behavior;
- no text overlays or readable labels.

If the final prompt contradicts a hard constraint, the agent must stop and
resolve the contradiction before estimation/run.

### 6. Add A Structured Prompt-Quality Readiness Layer

Mechanical readiness already answers "can this spec estimate or run?"

Add skill guidance for a separate prompt-quality readiness answer:

```text
Mechanically ready: Core reports required inputs, model, route, and parameters
are sufficient for estimate/run.

Prompt-quality ready: the final prompt follows the active model/workflow
guidance, names references, preserves prompt-sheet constraints, and passes the
route-specific checklist.
```

This should be skill-level guidance first. If repeated failures continue, add a
Core/CLI warning surface later.

For now, update `media-producer` and `movie-director` so when users ask
"am I ready to generate?" the agent reports both:

- mechanical readiness;
- prompt-quality readiness and risks.

### 7. Improve Negative Prompt / Unsupported Field Handling

Update skill guidance so any provider schema rejection or unsupported field
error triggers a prompt/payload re-audit, not only a minimal field removal.

Specific guidance:

- If a generated spec includes `negativePrompt` and the provider rejects
  `negative_prompt`, remove the unsupported field.
- Then re-read the provider preview and final prompt.
- Confirm that negative constraints are represented in the main prompt if the
  route does not support a separate negative field.
- Re-run the route-specific prompt-quality checklist before requesting paid
  generation approval.

Optional Core follow-up:

- Add model-route metadata for whether `negative_prompt` is actually accepted.
- Prevent unsupported `negativePrompt` from being persisted or sent for that
  route.

### 8. Strengthen Native Audio Guidance

Update the Seedance prompt-sheet reference and `shot-video-take.md`:

- Audio references are voice/style/sound-character conditioning.
- Exact spoken text must be in the final prompt.
- Exact waveform or word timing should not be promised for native Seedance
  audio.
- If exact narration timing is required, recommend a composition or post-audio
  workflow rather than relying on Seedance native audio.
- For best-effort native audio, still place narration instructions inside the
  panel sequence so the model has timing intent.

Recommended prompt wording:

```text
Use @Audio1 as the narrator voice/style reference. The narrator says exactly:
"..."
Timing is best-effort inside this native audio generation: the line should begin
during Panel 2, continue through Panel 3, and complete during Panel 4.
```

### 9. Add Post-Generation QA Before Calling Work Complete

Update `renku-create-video/references/viewer-iteration-loop.md` and
`session-video-workflow.md` with a stricter final-video QA gate:

After generation:

- inspect the output visually;
- make a contact sheet or scrub the clip when the environment supports it;
- compare against the prompt-sheet operating rule;
- report failures clearly;
- do not call the take successful merely because a file was produced;
- if the output is poor but auto-attached by the generation path, explicitly
  mark it as a rejected/weak output in the user-facing summary and propose
  targeted regeneration.

QA questions for prompt-sheet videos:

- Did the video work through panels in order?
- Did it avoid rendering panel borders, labels, arrows, and sheet text?
- Did it preserve the intended geography?
- Did it preserve the intended object/character counts?
- Did the camera feel alive rather than like a nudged still image?
- Did the ending remain alive and in motion when required?
- Did narration content and rough placement match the prompt?

### 10. Add A Failure-Fixes Entry For Prompt Sheets

Update `renku-write-prompts/references/failure-fixes.md` with concise entries:

```text
## Prompt sheet becomes collage/panorama

Cause: prompt says to use the sheet but does not explain how to read it.

Fix: name the sheet with its provider token, say panels are temporal waypoints,
work through them in order, and forbid sheet borders, labels, arrows, text rows,
and layout from appearing.

## Prompt contradicts sheet constraints

Cause: final prompt was drafted from memory or take summary instead of the
prompt-sheet brief/spec and visible sheet.

Fix: compare final prompt against the sheet's hard constraints before estimate
or run.
```

Keep this file concise. Detailed guidance belongs in the new Seedance
prompt-sheet reference.

### 11. Add A Movie Director Readiness Reminder

Update `movie-director` guidance so top-level "ready to generate?" answers do
not stop at mechanical readiness.

When the selected work is a Shot Video Take with a prompt sheet:

- dispatch to `media-producer` / `renku-write-prompts`;
- verify final prompt draft exists;
- verify provider token roles;
- verify prompt-sheet handoff checklist;
- identify unresolved prompt-quality risks before saying "ready."

The movie-director skill should not include the whole Seedance prompt guidance.
It should only route to the specialist skills and require a prompt-quality
readiness check.

### 12. Optional Core / CLI Warnings

Start with skills. Add Core warnings only if they can be implemented without
overfitting creative judgment.

Potential safe warnings:

- If Seedance reference-to-video has a `video-prompt-sheet` input and the prompt
  does not contain `@Image1`, warn.
- If any audio reference is supplied and the prompt does not contain `@Audio1`,
  warn.
- If a final prompt references "selected prompt sheet" but not provider tokens,
  warn.
- If unsupported `negative_prompt` is present for a route, block before paid
  run.

Avoid fragile semantic warnings such as trying to automatically detect all
geography contradictions in prose. That belongs in skill QA unless a structured
prompt-sheet constraint schema is introduced later.

## Implementation Order

1. Update `renku-write-prompts` progressive-disclosure routing.
2. Create the `references/seedance/` folder for Seedance-specific guidance.
3. Move the general Seedance guide to `references/seedance/2-0.md` and update
   all links in the same change.
4. Add `references/seedance/prompt-sheet-reference-video.md`.
5. Update the general Seedance guide with a short pointer to the prompt-sheet
   reference.
6. Update `references/failure-fixes.md` with prompt-sheet failure fixes.
7. Update `media-producer/references/shot-video-take.md` with:
   - provider token role mapping;
   - prompt-sheet handoff gate;
   - hard-constraint transfer;
   - schema-error re-audit instruction.
8. Update `media-producer/references/shot-video-prompt-sheet.md` only where it
   needs to preserve prompt-sheet brief/spec constraints for downstream final
   video prompting.
9. Update `renku-create-video` viewer/session references with final-video QA.
10. Update `movie-director` readiness/routing guidance.
11. Run skill validation where available.
12. Forward-test with raw artifacts from a prompt-sheet take.

## Validation Plan

Validation should avoid paid generation.

### Static Validation

- Run skill validation scripts if available for the updated skill folders.
- Confirm all referenced files exist.
- Confirm no new reference is deeply nested.
- Confirm `SKILL.md` files stay concise and route to references instead of
  embedding large fixed templates.
- Confirm no compatibility shim remains for the old flat Seedance reference
  path.
- Confirm the Seedance prompt-sheet guidance tells agents to select applicable
  sections rather than emit a fixed boilerplate prompt.
- Confirm Seedance prompt-sheet details are not loaded for unrelated model
  routes.

### Fixture-Based Prompt Review

Use a raw fixture shaped like the failed take:

- one Seedance reference-to-video multi-shot take;
- one `video-prompt-sheet`;
- one location sheet;
- one lookbook sheet;
- one audio reference;
- known narration;
- at least one hard geography constraint in the prompt-sheet brief.

Expected generated final prompt:

- names `@Image1`, `@Image2`, `@Image3`, and `@Audio1`;
- identifies `@Image1` as the storyboard / video prompt sheet;
- includes a critical storyboard rule;
- forbids sheet artifacts;
- gives panel-by-panel temporal directions;
- includes narration text and rough placement;
- preserves hard constraints;
- does not add unsupported `negativePrompt`;
- states native audio timing as best-effort when relevant.

### Negative Fixture

Use the failed prompt from this incident.

Expected review result:

- flags missing `@ImageN` roles;
- flags missing prompt-sheet operating rule;
- flags weak artifact suppression;
- flags insufficient motion/tempo;
- flags over-promised exact audio timing;
- flags unsupported `negativePrompt` if present;
- flags contradiction against the corrected shot_002 geography.

### Forward Testing

Forward-test with subagents only after the skill edits exist.

Good subagent prompt shape:

```text
Use the Renku prompt-writing/media-production skills at <paths> to prepare a
final Seedance reference-to-video prompt for this shot-video take. The take has
a video prompt sheet, location sheet, lookbook sheet, and narrator audio. Do not
run paid generation.
```

Pass raw artifacts and context, not the expected answer or this post-mortem.

Success means an independent agent naturally produces a structured prompt with
correct reference roles, prompt-sheet operating rules, narration placement, and
hard-constraint preservation.

## Acceptance Criteria

- Prompt sheets remain endorsed for Seedance reference-to-video workflows.
- `renku-write-prompts` has a dedicated Seedance prompt-sheet reference loaded
  only for relevant reference workflows.
- Final video prompt guidance requires provider-token reference roles.
- Final video prompt guidance requires sheet artifact suppression.
- Final video prompt guidance requires panel order and temporal waypoint
  language.
- Final video prompt guidance requires hard-constraint transfer from sheet to
  prompt.
- Final video prompt guidance warns against exact native-audio sync promises.
- Schema/payload errors trigger prompt-quality re-audit before paid generation.
- Create-video guidance includes a post-generation QA gate for final videos.
- Movie-director readiness answers distinguish mechanical readiness from
  prompt-quality readiness.
- The failed prompt from this incident would be rejected by the new checklist
  before paid generation.

## Open Questions

- Should Core expose prompt-sheet generation specs/briefs directly in final
  video provider preview so agents do not need to find project files?
- Should final video outputs auto-attach to takes, or should attachment require
  an explicit post-generation QA/promote action?
- Should Seedance route metadata explicitly declare `negative_prompt` support so
  unsupported fields are blocked before provider calls?
- Should prompt-quality readiness become a first-class CLI report, or remain a
  skill-level checklist until more failures accumulate?

## Notes For Implementation

Keep the first implementation disciplined. The goal is not to write a
movie-length prompting bible. The goal is to add a small, route-specific
reference that another agent will actually load at the right moment.

The central rule to preserve:

```text
For Seedance reference-to-video with a video prompt sheet, prompt the sheet as
an ordered storyboard/control sheet. Name it by provider token, explain panel
order and temporal flow, forbid sheet artifacts, preserve hard constraints, and
then run the final prompt through a route-specific quality checklist before
paid generation.
```
