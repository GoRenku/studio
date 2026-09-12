# 0203 Complete Scene Generation Across Model Limits

Status: implemented (accepted 2026-09-11; preparation validation)
Date: 2026-09-11

## Summary

Improve Studio Skills so a Scene can be generated in one, two, or more requests
without losing dialogue, copying simplified Previs appearance, or breaking
synchronization during repairs. Plan the complete creative sequence first, divide
it according to the chosen route's actual limits, and reconcile each generated
clip against what it actually delivered before preparing a dependent continuation.

This plan owns skills and documentation. Companion
[0204 Raw Clip Review And Selection](0204-raw-clip-review-and-selection.md) owns
the accepted Core/CLI/UI representation and must land before the skills use its
commands. Neither plan creates an editing timeline, generation scheduler or
semantic validator.
Urban Basilica illustrates failures to prevent; its characters, timings, dialogue,
two-clip split and provider choice are not reusable rules.

## Review Attention

- **Product boundary:** Studio reviews ordered raw clips, without trimming,
  retained-range editing, transitions or assembly export. Editing belongs in tools
  such as DaVinci. Repair discussion below describes an explicitly requested
  external media operation, never an automatic step or a new Studio edit surface.
- **Compact references:** use `Clip 1.1: Initial`, `Clip 1.2: Corrected speakers and
  drawing`; `Clip 1.1` identifies the exact take within the selected plan and
  revision. Plan 0204 owns numbering and persistent selection; agents never parse
  titles to infer either. Read that selection before preparing a continuation.
- **Comparison timing:** independent Previs and Generation transports are the
  default; linked playback compares equal elapsed times without stretching media.
  Matching Previs timing is optional unless explicitly locked. Speech coverage,
  correct speakers and mouth/audio synchronization remain separate review concerns.

- **Main behavior:** preserve complete ordered dialogue and action across an
  adaptable number of generated clips. A clip's elapsed duration does not prove
  that its assigned material was performed. Generated footage is not required to
  hit every Previs timestamp exactly unless the user has locked those timings.
- **Strong appearance boundary:** simple Previs is intentional. It owns placement,
  spatial relationships, motion, camera and intended cuts/timing. It never supplies
  the finished surface treatment, facial detail, wardrobe texture, prop artwork or
  rendering style. This applies equally to rooms, characters and featured props.
- **Policy clarification requiring acceptance of this plan:** permit explicit,
  unretimed per-clip excerpts from user-selected Dialogue Audio for an authorized
  multi-clip workflow. Preserve the original Takes and selection. Record exact
  source intervals; do not silently truncate the scene, concatenate selected Takes,
  or substitute another performance. This narrows the blanket whole-file rule in
  ADR 0090 and `video-reference-continuity.md` only for this workflow.
- **No new Settings, flags, routes, DTOs, schema, diagnostic codes or runtime
  content checks.** Existing context, native provider execution, Preview,
  provenance, Asset attachment and Previs revision contracts remain in place.
- **No data migration, media regeneration, deletion, historical revision rewrite,
  dependency installation or plugin publication.** Earlier description-guidance
  changes are a baseline to inspect and integrate, not permission to repeat or
  overwrite them. This planning turn changes only this document.
- **Existing approval/configuration flow stays unchanged.** Consolidating its two
  review surfaces is a separate product choice, not necessary to fix scene quality.
  Avoid redundant questions within existing authorization; introduce no extra
  recurring approval ceremony. Paid retries and additional scope follow existing
  authorization, never an unlimited automatic repair loop.
- **Realistic limit:** references and prompts cannot guarantee exact speech,
  speaker identity, realism or frame continuity. Completion requires evidence;
  unresolved quality or infeasible runtime is reported rather than concealed.

## Requirements

| ID | Requirement and source | Owner | Verification |
| --- | --- | --- | --- |
| R1 | Full requested dialogue/action survives duration-limited generation, including omitted suffixes and 3+ clips. Latest user request. | Media Producer segmentation guide | S1–S5 |
| R2 | Plan the next request from actual retained output and remaining material; protect joins and final duration. Latest request and accepted review findings 4/7. | Same guide | S2–S6 |
| R3 | Previs remains intentionally simple and cannot define finished appearance, including insert props. User emphasis on findings 5/6. | Blender handoff and Media Producer Previs guide | S7–S8 |
| R4 | Separate wording, speaker identity, acting, visible speaker and lip-sync checks; compare cast voices. Review findings 1/2/4 and request to address findings. | Casting Director and Media Producer audio/review guides | S9–S10 |
| R5 | Repairs preserve synchronized picture/sound and trigger a new coverage/runtime check. Review finding 3 and latest omitted-line report. | Segmentation guide | S5–S6 |
| R6 | Support off-screen speech without silently redesigning coverage. Explicit user response to finding 8. | Previs handoff and quality checklist | S10 |
| R7 | Iterated descriptions and each provider request are self-contained. Original request and finding 9. | Existing authoring and input-visibility guides | S11 |
| R8 | Completion language states what is verified and what remains; no speculative policy/UI expansion. Finding 10, AGENTS scope rule and existing approval policy. | Media Producer workflow | S12 |
| R9 | Creative interpretation remains agent/user-owned; Core retains metadata ownership and exact revision association. ADRs 0041, 0090, 0095, 0096. | All slices | Contract/diff inspection |

## Context And Evidence

Source session: [Scene 2 Previs and generation](codex://threads/01a08b3d-4052-7771-9ff5-6df43264faf7).
Review used the local transcript after the task-reading tool failed. Findings are
recorded actions and user feedback, not a fresh audiovisual inspection:

- Correct ASR text was presented with intended speaker timings despite wrong voice
  assignments; Loukas then needed a more distinguishable voice from Urban.
- Location sheets were supplied but simple Blender surfaces carried into footage.
  A finished-look frame improved the environment. A separate featured prop image
  was subsequently needed, and a continuation later reverted to proxy imagery.
- The original off-screen emperor question was explicitly directed by the user.
  Later visible-speaker coverage was a user-approved creative improvement.
- Replacing generated audio removed duplicate dialogue but desynchronized mouths.
  Editing picture and sound together then shortened the retained clip to 11.96 s.
- The latest user reports that the retained clip ends the list after “Bronze.
  Powder.” The missing suffix must remain accounted for. Available nominal time
  is not proof that those words can simply be inserted into existing pictures.

Current owners and contracts:

- `studio-skills/skills/media-producer/references/shot-plan-video/blender-previs.md`
  already assigns motion to video and appearance to sheets, but also says to write
  a continuous-shot prompt. Replace that instruction with preservation of the
  authored continuous or cut sequence; a multi-clip split is not a creative cut.
- `video-reference-continuity.md` requires exact selected Takes, forbids truncation
  and asks for narrower scope or another route on overflow. ADR 0090 states the
  same whole-Take rule. Neither currently explains complete-scene excerpts.
- `shot-plan-video/forward-test-cases.md` contains a sole-unselected-Take fallback
  that conflicts with ADR 0090. Correct that affected scenario to selected Takes;
  do not expand into a selection redesign.
- `shot-plan-dialogue-audio.md`, `model-guides/shared/video-quality-checklist.md`,
  and `casting-director/references/voice-casting.md` are the existing review owners.
- Core `server/media-generation-context/purposes/shot-plan.ts` owns domain briefing;
  `server/generation/attachments.ts` and `server/shot-plan-previs/generation-source.ts`
  own attachment/revision validation. CLI `commands/media-import/command.ts`
  delegates attachment. No changes to these owners are planned.
- [ADR 0041](../../docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md),
  [ADR 0090](../../docs/decisions/0090-use-shot-plan-dialogue-audio-and-provider-neutral-cast-voices.md),
  [ADR 0094](../../docs/decisions/0094-use-previs-shot-plans-and-retained-render-revisions.md),
  [ADR 0095](../../docs/decisions/0095-use-previs-playback-display-metadata.md), and
  [ADR 0096](../../docs/decisions/0096-use-typed-previs-direction-timelines.md)
  constrain this work. `docs/architecture/data-model-and-storage.md` and
  `docs/product/design-guidelines.md` confirm that equal player times do not imply
  semantic alignment, and the monitor does not retime generations.
- Plans 0193, 0194, 0200 and 0202 describe completed/implemented foundations.
  Plans 0195 and 0201 are implemented with specified acceptance checks pending.
  Preserve those records; this plan does not absorb their pending UI verification.

## Intended Workflow

### 1. Establish the whole scene and its constraints

Read the exact selected plan/revision, current requested dialogue scope and
selected recordings. Resolve all required spoken words, speakers and ordered
actions from that context. Preserve authored cuts, including a turn crossing a
cut, and off-screen speech. Do not generate speech from a gestured conversation.

Distinguish user-locked requirements from estimates: exact wording and speaker,
required actions, locked performance speed, hard or approximate total runtime,
camera choices and optional holds. An unspecified runtime is not silently made
exact. Explicit locks cannot be relaxed to make a provider request fit.

Inspect only the selected route's current live schema and canonical model/adapter
guidance. Determine output duration range/discrete choices, reference duration and
count/combined budgets, modalities, and supported continuation inputs. Do not
hard-code a 15-second ceiling, two clips, equal partitions or provider names.

### 2. Divide material at usable boundaries

Prepare a brief agent working table in the existing
`tmp/operations/media-generation/` area. It records intended ordered coverage,
exact dialogue passages and speakers, provisional cut/clip boundaries, planned
duration, source audio intervals, reference roles and the ending action/state.
Use Markdown for creative coverage decisions only; use plan 0204's Core report
for clip order, take identity, selected files and optional source-take attribution. This is
not an alternate screenplay or parallel selection store. Reread authoritative
context on resumption and keep only working
coverage decisions here. Never put this production bookkeeping in description.

Choose boundaries at natural pauses, completed phrases, action transitions or
authored cuts where possible. A dialogue turn may span requests without becoming
two screenplay turns. Do not cut a phoneme or word. Allow room for the actual
performance and transition; do not fill every request to its maximum merely
because capacity exists. Speech duration comes from the selected performance
when available; estimates without audio remain estimates.

Cover every requested word/action, in order, across planned requests. Each final
occurrence appears once; deliberate scripted repetition remains repetition.
If overlapping reference context helps a supported operation, distinguish it from
material intended for final inclusion and define the retained join explicitly.
No universal overlap length or fixed words-per-second heuristic is introduced.

### 3. Prepare exact per-clip references

For authorized multi-clip delivery, extract only the needed intervals of the exact
selected recordings without changing performance speed, speaker or wording.
Preserve original files and selection. Keep distinct selected Takes separate;
no inferred combination or newest-candidate substitution. Resolve overlapping
selected performances with the user if they make the intended performance unclear.

Record source Asset/File identity, source start/end and any offset in the submitted
clip. Use frames or samples where precision matters. Extracted files live in
`tmp/media/`; request evidence records the source mapping. Per-clip omission of
out-of-scope source audio is not permission to omit it from the final scene.
Do not trim beyond the explicit excerpt boundaries, fill gaps, stretch speech,
replace voices or rewrite lines to hide a mismatch.

Prepare the matching Previs excerpt for the actual assigned actions and speech.
If observed timing requires updated visual guidance, prepare an explicit derivative
with its map; do not pair a new speech excerpt with stale master-time camera cues.
Do not overwrite retained Previs revisions. A changed creative plan uses the
existing revision workflow; an execution derivative retains exact source identity.

### 4. Generate, inspect, then prepare the dependent continuation

Execute each approved request once using existing provider tooling. Inspect the
output and choose the actual retained interval before deriving its continuation.
Separate these observations in the working table:

- expected versus actually delivered dialogue, including the last complete word
  or phrase and any omissions, duplicated occurrences or wrong speakers;
- visible speaker/off-screen speaker, mouth synchronization and voice continuity;
- completed action, ending pose, gaze, hand/prop state, camera and appearance;
- actual retained duration, boundary frame and audio condition at the join.

ASR may help locate words; it does not establish voice identity, exact timing or
lip-sync. Inspect/listen with available tools. When a required judgment cannot be
made, request a focused user audition instead of inventing verification. Playback
cues and elapsed-time comparisons are intended direction, not output evidence.

For normal raw generation, continue from the selected take's actual final frame,
not a guessed 15-second boundary. Record optional source-take attribution using
plan 0204's commands; record actual source files, extracted frames and audio inputs
in the existing request/provenance evidence. Core does not decide which source is
eligible or require any predecessor/frame input. Do not trim a raw clip automatically or add retained ranges to
Studio. If the user separately requests an external repair, import its result as
a distinct candidate before selecting it; the original file remains intact.

Continue from the actual retained final frame, or another supported continuation
input tied to that exact boundary. If a silent tail is removed, use the new retained
boundary, not the raw output's last frame. A frame alone does not encode velocity
or audio state: carry the continuing action in prose and, where supported and
useful, actual motion/audio context. Prefer a native starting-frame/extension
capability when it fits all required modalities; a numbered reference image is
conditioning, not a guaranteed frame lock. Do not silently switch route.

Rebuild the next self-contained request from the remaining material. Include its
exact words, speaker, local timing, continuing state and concrete reference roles.
Do not say only “continue the previous clip.” Recompute modality-local numbering
from the actual files. Preserve the finished look across the whole clip and cuts.

### 5. Handle incomplete output without losing the scene

The decision is based on what is usable, not on whether the file reached its
requested duration:

| Observation | Agent response |
| --- | --- |
| Clip completes a usable prefix but omits its assigned suffix | Retain the usable prefix; assign all remaining words/actions to the next request and recompute its duration/references. Do not declare the original allocation complete. |
| Unwanted silent tail after the prefix | Inspect whether a synchronized trim gives a natural join. Do not preserve dead time just to fill a nominal clip, or remove an intentional dramatic pause. |
| Cut-off word, wrong speaker, internal omission or bad mouth sync | Do not hide the defect with a continuation. Offer a focused repair/regeneration or revised edit; an internal gap cannot be fixed by appending the missing line after later dialogue. |
| Remaining material no longer fits planned requests | Repartition pending requests; use an additional clip only within authorized cost/scope. Recheck hard scene runtime independently of clip count. |
| Required speech/actions cannot fit a locked runtime at locked speed | Explain the measured conflict and propose a concrete runtime, coverage or performance decision. Do not delete words, speed speech or invent filler. |
| Reference limit prevents all required appearance/audio/motion inputs | Resolve input preparation or route choice before submission; no silent dropping of continuity requirements. |

The motivating list is an example: if only “Bronze. Powder.” was delivered, the
remaining list starts at “Charcoal.” The next clip may deliver it and subsequent
speech, provided its reference audio, starting pose and remaining duration are
rebuilt accordingly. Three unused nominal seconds do not guarantee that missing
speech fits existing mouth movements. Nor does adding another generation create
extra time inside a fixed total runtime.

Distinguish requested provider duration, returned file duration and retained edit
duration; these can differ. Any extraction must remain within the selected route's
actual input limits, and any edit must be inspected before its boundary is reused.
After trimming, assembly duration is the sum of retained clip durations, less any
overlap used at joins. Reconcile that duration with complete spoken/action coverage.
An adjustable hold may serve the intended ending; do not invent freeze frames or
stretch speech to force arithmetic equality. Reuse approved footage when viable.

### 6. Make the finished appearance independent of simple Previs

Keep Previs authoring inexpensive and legible. Do not solve transfer defects by
requiring photorealistic Blender modeling, textures or prop artwork. Simplified
geometry can communicate placement and movement without defining final construction
detail, color or materials. Approximate light in Previs is not final lighting authority.

Map each proxy to its intended subject and explicitly scope references:

- Previs supplies composition, spatial blocking, camera, motion, cuts and timing.
- Cast, Location and Prop references supply subject identity/design and continuity.
- The intended visual language supplies rendering style, lighting and finish.
  Realism is this example's target, not a requirement that every movie be realistic.

For generation from simple Previs, establish a reviewed finished-look image in the
relevant composition before video execution. Reuse a suitable existing image when
available; otherwise prepare one through the existing image workflow within user
authorization. It must communicate the target's actual appearance, not just repeat
proxy geometry. Keep this image's role distinct from motion/cut guidance.

A master-frame image may not resolve a featured insert. Inspect each salient
prop/close-up at its intended scale and provide a suitable appearance reference
when it is not already adequately represented. Reference selection remains agent
judgment, not mandatory sheets for every incidental object. Do not import proxy
scribbles as final artwork or assume generic realism wording supplies missing detail.

Inspect the whole generated sequence, representative frames around every cut,
featured inserts and the ending. A realistic first frame is insufficient if later
frames reproduce mannequins, block furniture or simplified props. Do not use such
footage for a dependent continuation without explicit user acceptance. If one
attempt fails, report it and a concrete next approach; no automatic paid loop.

### 7. Protect performance and verify the assembled scene

Compare a new cast voice with the existing voices it must converse with before
expensive ensemble generation. Use known references and audible texture/cadence/
resonance; low pitch alone does not establish contrast. If the agent cannot listen,
provide a focused comparison for the user. Do not claim prompt intent is heard quality.

For off-screen speech, explicitly identify audible speaker, visible subject,
listening reaction and who must not articulate the words. Changing to on-screen
coverage is a creative choice, not an automatic provider workaround.

Keep synchronized picture and sound paired in ordinary trims/reorders. Replacing
a generated track with selected dialogue is not a sync repair. A workflow requiring
exact performance timing needs a supported synchronization operation and verification;
do not introduce or promise a new lip-sync engine. Any repair reopens checks for
coverage, speaker, mouth sync, continuity and runtime, including affected joins.

Review the ordered raw clips continuously, checking every requested word and action,
voice/speaker, each join and visual style throughout. Candidate clips may be attached
through existing contracts with clear limitations, but are not described as a
complete raw coverage until the full requested material and constraints are satisfied.
Reports separate verified, failed and unverified dimensions in ordinary prose;
there is no new product status enum or automatic selection policy.

## Architecture Shape Gate And Contracts

Choose a focused extension of the existing skills. Reusing unchanged prose cannot
resolve the whole-file audio conflict or adaptive continuation gap. A general
runtime editing/assembly model is unnecessary. Plan 0204 supplies the bounded raw
clip/take/selection/attribution contract; native requests, exact Assets, summaries
and agent evidence retain their existing roles.

Implementation ownership is `studio-skills/skills/`. Add exactly one focused
reference, `media-producer/references/shot-plan-video/scene-segmentation.md`, to own
sections 1–5 and synchronization/assembly mechanics. Link it from the existing
Shot Plan video `index.md`, `workflow.md`, Previs guide and Blender AI handoff when
multi-clip work is needed. Keep entrypoints short. No dispatcher, registry, public
TypeScript type, `index.ts`, executable helper or new provider protocol is needed.

Keep appearance roles in `shot-plan-video/blender-previs.md`; voice review in the
existing casting/audio guides; final review questions in the shared quality
checklist; self-contained prose in its current authoring/input-visibility owners.
Replace conflicting instructions directly and link shared guidance instead of
copying the entire workflow into each skill or provider guide.

Reuse `renku generation context`, `renku shot-plan previs show`,
`renku generation validate`, `renku generation preview show`, the selected provider's
existing execution/recovery commands, and `renku media import` with exact
`--previs-revision` where applicable. Use existing source-derived edit attachment
for derivatives and existing Asset summaries for concise source/retained interval
and time-map evidence. Retain exact safe provenance; never attribute a local edit
to an unperformed provider generation. Ordinary media tools may measure/extract/edit
files in the agent workspace; no shared media editing platform is added.

Working tables are disposable under existing tmp policy. Essential derivation
facts go in the existing durable summary/provenance paths; do not claim tmp notes
survive cleanup. On resumption with missing evidence, reconstruct from exact retained
media/context or state what cannot be established. Do not guess a last completed word.

Use the Core commands defined in plan 0204 for numbered clip creation, take
attachment, resolution and selection. Skill instructions must let the agent act
on “Use Clip 1.1” through exact Core resolution, never a title match. Read the
explicit selection again before submission. Skills decide which references to use
and Engines validates/executes the provider-native request. Record actual inputs
in existing provenance and optional source-take attribution even if selection
changes during generation. Core validates attribution identity only, not adjacency,
same-revision scope, generation suitability or final-frame use. Selection changes do not
automatically regenerate or invalidate existing continuation footage.

Stop and revise this plan if implementation needs Core fields beyond plan 0204, scene assembly
entities, UI controls, media-content validators, a normalized provider timeline,
custom upload clients, selection changes, or a broad catch-all workflow script.

## Implementation Slices

1. **Resolve the audio policy and document segmentation.** Add
   `scene-segmentation.md`; update `video-reference-continuity.md` with the bounded
   excerpt rule and link it from the existing Shot Plan video entrypoints. Correct
   the affected sole-unselected fallback in `forward-test-cases.md`. Keep provider
   limits live and leave Core projection/selection unchanged.
2. **Strengthen simple-Previs appearance transfer.** Update
   `blender-shot-planner/references/ai-handoff.md`, its `references/blender-authoring.md`,
   and `media-producer/references/shot-plan-video/blender-previs.md`. Preserve simple
   authoring; establish finished-look inputs, independent featured prop appearance,
   authored cuts and full-sequence inspection. Do not mandate detailed Blender props.
3. **Improve voice, speech and repair review.** Update
   `casting-director/references/voice-casting.md`,
   `media-producer/references/shot-plan-dialogue-audio.md`,
   `model-guides/shared/video-quality-checklist.md` and `shot-plan-video/workflow.md`.
   Add ensemble contrast, separate verification dimensions, off-screen speech,
   retained-output readiness and accurate completion reports. Link repair mechanics
   to the segmentation owner. Preserve configuration/approval owners.
4. **Integrate the self-contained-description baseline.** Inspect existing changes
   in Blender `SKILL.md`, `references/directing-workflow.md`, `references/ai-handoff.md`,
   Shot Planner `references/shot-writing-guidelines.md` and Media Producer
   `model-guides/shared/prompt-input-visibility.md`. Preserve their intent, remove
   duplication and ensure continuation prompts use actual inputs/current remaining
   content. Do not rewrite registered scene descriptions in this implementation.
5. **Add and exercise general behavioral cases.** Extend existing
   `media-producer/evals/shot-plan-video/forward-test-cases.md`,
   `blender-shot-planner/evals/director-iteration.md` and
   `shot-planner/evals/iterative-shot-authoring.md`. Keep scenarios at their relevant
   owner; no source-text keyword tests or new runtime validators.

## Tests And Guardrails

Preparation/review exercises run with scratch artifacts and available existing
media, without changing the sample movie or buying generations. Record the input
evidence, authored requests, review findings and limitations. A written scenario
is not an executed pass. Use other characters/actions as well as the motivating
example so exact wording and scene-specific split points cannot satisfy the tests.

| Case | Required outcome |
| --- | --- |
| S1: Same ordered scene under two different route limit fixtures, one requiring 3+ requests | Each plan covers all content; respects output/reference/discrete-duration budgets; no fixed two-clip assumption. |
| S2: First output stops at a complete phrase before its assigned suffix | Next request starts at the missing phrase with exact speaker, revised audio/Previs excerpts and actual retained boundary. |
| S3: Dialogue continues across both a camera cut and generation boundary | One ordered performance, natural word boundary, no duplicated turn or invented creative cut. |
| S4: Unwanted trailing silence, then a hard total-runtime constraint | Inspect a paired trim, derive its new boundary, account for remaining speech and all retained durations; expose infeasibility rather than pad/stretch. |
| S5: Missing internal phrase, repeated intentional word, cut-off final syllable | Distinguish deliberate repetition from duplicate generation; do not fix ordering by appending missing internal content. |
| S6: Repair changes duration; replacement audio has different timings | Preserve paired edit or identify sync operation need; recheck joins, full coverage and runtime before continuation/completion. |
| S7: Rough room/characters with correct motion but wrong surface finish | Keep Previs simple, prepare/reuse finished-look guidance and reject copying proxy appearance as satisfying the request. |
| S8: Prop insert absent from master appearance reference; later proxy reversion | Prepare appropriate independent prop appearance; inspect beyond first frame and do not continue from failed visual material. |
| S9: Correct transcript but wrong/similar voices | Separate wording evidence from voice audition; provide ensemble comparison and avoid unverified speaker timing claims. |
| S10: Off-screen question over visible listener | Correct audible/visible roles and silent mouth direction; no unsolicited coverage redesign. |
| S11: Repeated feedback and continuation request without earlier chat | Self-contained description/prompt preserves current decisions; every reference resolves to actual submitted media. |
| S12: Missing required modality/frame, unknown auditory quality or cost increase | Report concrete limitation and next choice; no invented fields, unverified completion or unauthorized retry. |

Also exercise no-dialogue action coverage and a scene that fits one request (no
unnecessary splitting), multiple selected source recordings without concatenation,
a native continuation input versus reference-only conditioning, and resumption
after the prior clip was trimmed. Use current/deliberately dated schema fixtures;
validate a real request against the live route before any later paid execution.

No new automated creative scoring, ASR pass/fail service, code-name architecture
tests, blanket phrase bans or exact-output-text assertions. Assess observable
request inputs and editorial decisions. Full quality claims require actual media
inspection; preparation-only tests cannot establish provider reliability.

## Documentation And ADR Effects

After plan acceptance, add
`docs/decisions/0097-use-agent-directed-scene-segmentation.md` to record the bounded
selected-audio excerpt policy, agent ownership and unchanged durable contracts.
Add a concise narrowing notice to ADR 0090 without rewriting its historical body.
The new ADR is also the accepted summary of the workflow/appearance boundary;
operational details live in the owning skills. Preserve ADRs 0041 and 0094–0096.
No new public CLI/UI documentation or historical-plan naming sweep is required.

## Final Verification

- Run `pnpm test:media-generation` and `pnpm test` from `studio-skills` after edits.
- Run the available skill-creator validator on modified skill folders when its
  environment is ready. The previous run lacked PyYAML; report that separately
  rather than installing dependencies without authorization or claiming a pass.
- Exercise S1–S12 at their owning skills and record preparation versus audiovisual
  evidence. Paid output validation remains a later explicitly authorized movie run.
- Review all links, exact attachment/source mapping guidance, and current ADR
  consistency. Inspect full diffs and `git diff --check` in both repositories.
- Inspect large modified guides for duplicate policy and contradicting continuous-
  shot/whole-file instructions. Confirm entrypoints stay short, `index.ts` and
  runtime code unchanged, and no hidden schema/selection/approval expansion.
- Verify no movie data, historical revisions, installed plugin cache or release
  artifacts changed. A source change is not an installed/released plugin update.
- No automatic plan review is run; review and implementation remain user-controlled.

## Implementation Evidence

The skills guidance was implemented first; numbered-command adoption was added
when 0204 made the commands available. The sister repository's `pnpm test` passes.
S1–S12 and single-request/action-only/multiple-recording/native-reference/resumption
variations were exercised as manual preparation/review cases in
`media-producer/evals/shot-plan-video/segmentation-preparation-review.md`. That
report contains supplied evidence, proposed requests/decisions and limits; it does
not claim actual model output, voice, lip-sync or visual continuity verification.
No paid generation or movie-description rewrite was performed. Generic
skill-creator validation remains unavailable because the Python environment lacks
PyYAML; no dependency installation was requested. ADR 0097 and the scoped ADR 0090
notice record the accepted policy.

## Completion Checklist

### Review And Scope

- [x] Plan accepted with the bounded selected-audio excerpt clarification visible.
- [x] Integrate plan 0204 commands and compact `Clip N.M` identity; keep browsing separate from persistent selection.
- [x] Treat raw playback as review, with no automatic trims and no requirement to match unlocked Previs timing.
- [x] Confirm scope stays in skills/docs, with existing configuration and approval.
- [x] Confirm examples do not prescribe names, dialogue, two clips or a fixed limit.

### Segmentation And Continuation

- [x] Complete-scene wording/action coverage precedes provider partitioning.
- [x] Natural boundaries and 1/2/3+ requests respect all selected-route budgets.
- [x] Exact source excerpts preserve selected performance and recorded intervals.
- [x] Next request follows actual retained content/frame/action, not elapsed time.
- [x] Missing suffixes, internal omissions, repetition and partial words handled distinctly.
- [x] Trims and repairs recompute pending coverage, reference offsets and total runtime.
- [x] Native continuation and reference conditioning described with realistic limits.
- [x] No lost lines, arbitrary padding, speed changes or automatic cost escalation.

### Appearance And Performance

- [x] Simple Previs remains authoritative only for spatial/motion/camera direction.
- [x] Finished-look guidance is established independently before video generation.
- [x] Featured props/inserts receive adequate appearance evidence without detailed Blender requirements.
- [x] Full clip/cut/end review catches late proxy reversion before continuation.
- [x] Voice contrast is evaluated against the ensemble; ASR is not voice verification.
- [x] Off-screen speech remains available with explicit audible/visible roles.
- [x] Paired picture/sound repairs and final synchronization checks are explicit.
- [x] Repeated descriptions and every provider prompt remain self-contained.
- [x] Completion reports separate observed quality from unresolved dimensions.

### Architecture And Documentation

- [x] One segmentation reference owns shared mechanics; entrypoints link to it.
- [x] Correct conflicting whole-file and sole-unselected guidance in affected owners.
- [x] Existing context, selection, revision, provenance and attachment contracts preserved.
- [x] Essential source/edit mapping survives through existing durable evidence fields.
- [x] Add ADR 0097 and a scoped notice on ADR 0090 after acceptance.
- [x] No runtime semantic validation, assembly schema, UI, dependency or provider client added.

### Verification And Handoff

- [x] Execute and record S1–S12 plus single-request/no-dialogue variants without paid generation.
- [x] Report media-inspection limits and any unexecuted scenarios honestly.
- [x] Existing skills tests pass; generic-validator availability reported accurately.
- [x] Inspect complete diffs, diff statistics, heavily modified files and guide links.
- [x] Confirm `index.ts` files remain unchanged and no catch-all implementation appears.
- [x] Confirm no requested outcome was satisfied by unreviewable structure or hidden scope.
- [x] Preserve unrelated work and sample data; distinguish source completion from release.
- [x] Mark implementation complete only after required checks and actual work finish.
