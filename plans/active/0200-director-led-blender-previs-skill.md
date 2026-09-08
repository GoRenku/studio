# 0200 Blender-authored Shot Plans and director iteration skill

Status: implemented
Date: 2026-09-08

## Summary

Create a `blender-shot-planner` skill in `studio-skills` for authoring and directing
Blender previs as an alternative Scene Shot Plan. Each plan has its own editable
Python implementation. The agent may consult, copy and adapt useful code from
other plans; building a shared previs platform is outside this work.

The skill should supply the context and execution conventions needed for reliable
iteration while leaving modeling and Python implementation choices to the agent.
Preserve the exploration's successful scene depiction and render quality. Extend
Media Producer to use the resulting video with character/location sheets and audio.

## Review Attention

- **Consistent storage:** retain the Scene-local Shot Plan folder hierarchy below,
  including source/render separation, source revisions and generation evidence.
- **Scope:** implement the two Shot Plan types in Core/database/CLI, previs
  revisions and render registration, skills and storage documentation. The
  Blender player and directing UI come later. Existing AI take storage stays intact.
- **Accepted naming:** `Shot List` (`shot-list`) and `Previs` (`previs`).
- **Dialogue timing:** directing parameters are the shared source for animation,
  playback cues and AI prompting. Playback metadata is lightweight authored JSON,
  with no Cast/Beat/dialogue database relationships or creative validation.
- **Generation:** H3 Max is the workflow default; Seedance 2.5, Seedance 2.0 and
  Wan 3.0 are alternatives. Add missing Seedance 2.5 skill-catalog guidance.
  Character/location sheets carry appearance; a separate Lookbook image is not
  needed. Relevant Lookbook text can inform the prompt.
- **Existing files:** Harbor relocation is optional and requires approval before
  moving/removing originals. Its accepted video and provenance remain untouched.
- **Project Settings action:** add explicit temporary-file cleanup. No expiry,
  automatic pruning, project-open cleanup or retention preference. Frame caches
  remain available until the user clears them through a simple confirmation.
- **Runtime scope:** retained Blender renders require proper Asset registration;
  this and the cleanup action need focused Core support. The Blender player,
  overlays and directing UI remain deferred.
- **Database effects for review:** add the plan type and a small previs-revision
  record through the repository's Drizzle migration workflow. Preserve existing
  plan/Asset identities; no Cast, Beat or dialogue relationship tables are added.

## Requirements

| Requirement | Delivery |
| --- | --- |
| Preserve the successful exploration and learn from its execution issues. | Evidence below informs brief practical guidance and realistic evals. |
| Treat Previs as a Scene Shot Plan; separate procedural renders from AI takes. | Persisted plan type, retained render revisions and the agreed folder hierarchy. |
| Make director revisions quick without sacrificing quality. | Editable positions, camera and timing; repeatable build/render/finish workflow. |
| Keep the agent free to solve each scene well. | Scene-specific implementation, with ordinary code reuse and adaptation available. |
| Generate video using previs plus contextual references. | Media Producer guide, selected audio handling and model-specific routing. |
| Support directing a dialogue turn at a requested time. | One authored timing decision drives the previs, playback cue and generation prompt. |
| Keep player UI specification for a later iteration. | Implement supporting Core/CLI data now, but defer player controls, overlays and feedback UI. |

## Context and exploration findings

Relevant owners are `packages/core/src/client/shot-plans.ts`,
`packages/core/src/server/project-asset-files/destinations/shot-plan.ts` and
`packages/core/src/server/shot-plan-video-generations/projection.ts`. The sister
`movie-director`, `shot-planner`, `media-producer` and provider skills already own
routing, current Shot-list planning and generation/attachment workflows.

Read alongside `docs/architecture/project-asset-storage-conventions.md`,
`docs/architecture/data-model-and-storage.md`,
`docs/architecture/reference/studio-skills.md` and decisions 0041, 0076 and 0086.
The storage clarification is retained authoring sources versus temporary working
files. Studio continues to treat creative artifacts as opaque; visual judgment
belongs to the agent/director loop.

Reviewed all eight turns of [Create harbor walk previs](codex://threads/01a07aed-c926-7b43-ad17-d655af06a54b)
and its retained scripts and outputs. Evidence is in
`/Users/keremk/renku-movies/urban-basilica/scenes/03/01-shot-plan/tmp/harbor-previs/`
and the project's `tmp/media/harbor-h3-max/`,
`tmp/operations/media-generation/harbor-h3-max/` and
`tmp/qa/harbor-h3-max/render-v001/` folders.
The source is Scene `scene_fzf8844n`, Beat revision `scene_beat_sheet_cpp7a9eh`,
Beats 1–4; the established plan is `shot_plan_zx39wxev`.

The harbor geography, distinct proxies, readable gestures and camera staging
worked well. Workbench studio lighting, object colors, shadows/cavity/outlines,
Standard view transform and 16-sample AA produced a useful 960×540/24 fps baseline.
Keep that quality when iterating Harbor; use its craft as an example for other
scenes rather than a mandatory visual recipe.

### Exploration lessons and how they reach the skill

This table is the implementation coverage record for the exploration. Each lesson
has a concrete response and a check; it is not a mandatory scenario list for every
future scene. Carry the relevant advice into the named reference and exercise the
checks in `evals/director-iteration.md`. Actual failures, limitations and unproven
risks are distinguished below.

| Lesson and evidence | Guidance to incorporate | Verification |
| --- | --- | --- |
| **Context identity.** An initial read returned Sintel despite the Urban Basilica flag; current source forwards the flag, so the installed-runtime cause remains unresolved. | `directing-workflow.md`: verify returned Project/Scene identity before interpreting an empty result as missing content. Diagnose a mismatch rather than inventing replacement content. | Present a mismatched context response; the agent identifies it and obtains the intended context before authoring. |
| **Direction needs distinct timing events.** v002 used 6–8 seconds for approach, then turned during 8–8.85; it did not include a separate conversation hold. v003 added a hold at 8–11 and turn at 11–13, with Urban stopping at 8.8. | `directing-workflow.md`: distinguish departure, arrival, hold and turn when interpreting direction. Expose useful positions, camera and timing controls; new behavior may require code changes. | Ask for a three-second conversation, later stop and slow turn. Verify the settled hold lasts three seconds independently of approach/turn, and ask about material ambiguity. |
| **Delivery limits changed the performance.** v003 became 17 seconds. The approved 15-second derivative reduced the three-second hold to 2.647 seconds. | `ai-handoff.md` and the Media Producer previs guide: check the selected route early, retain the master and record derivative time mapping. Resolve changes to locked timing with the director. | Prepare the 17-to-15 handoff and show the altered hold and mapped event times; preserve master and selected audio. |
| **Configuration history was not source history.** Adding `talk` changed scripts while prior revisions mostly retained JSON, motion and `.blend` files. Motion replay matches, but exact historical Python cannot be reconstructed from that alone. | `plan-files-and-generations.md`: retain exact source/config with each rendered revision and identify the resulting generations. | Revise code as well as parameters, then reproduce the earlier retained revision using its source snapshot. Mark recovered historical source honestly. |
| **Writer protection and continuation disagreed.** `run.py` rejected populated output folders, but direct build calls could overwrite source/Blender files and `finish.py` used overwrite encoding. Build-only output could not continue through the runner. | `blender-authoring.md`: protect completed outputs at the writers; make build, render and finish separately usable. Resume frames only against unchanged inputs. | In an isolated plan, build then render then encode; retry finishing without Blender; resume an interrupted render; check that changed inputs and direct invocations cannot overwrite or mix a completed revision. |
| **Dependency failure came after expensive work.** v002 rendered before finishing failed for missing Pillow in the selected interpreter. Blender also crashed during Metal startup. | `blender-authoring.md`: preflight the actual Blender/finishing executables, required modules/fonts and FFmpeg/FFprobe with a small run. Distinguish startup failure from script failure; record working tool versions. | A missing finishing dependency fails before full rendering. A Blender script exception produces a failing command, using `--python-exit-code` or equivalent supported handling. |
| **Camera assumptions limited adaptation.** `aim[1] += look_ahead` stayed world-Y on a tested +X path. Follow grouping meant all leads; shoulder targets were limited to leads. | `blender-authoring.md`: explain world/route/actor spaces and actor/group targets. When adapting the motion, use the intended route direction and subjects for follow/look-ahead/shoulder framing. | Adapt the path to +X and inspect forward aim; request a specific follow group or shoulder subject and verify the resulting composition. |
| **Rotation continuity was an unproven risk.** Actor Euler baking lacked the camera's continuity handling near ±180°. No visible Harbor spin was established. | `blender-authoring.md`: flag angle wrapping when adapting turns; inspect continuous playback and use continuous rotation interpolation if needed. | Exercise a turn across the angular boundary in the isolated motion example; verify no unintended full spin. This does not require every scene to implement curved walking. |
| **Cue editing could change performance unintentionally.** Editing removed/appended a cue, changing array priority; default IDs could replace another cue. Facing overlapped talk and turn. | `blender-authoring.md`: keep cue identity/order stable on edit and make overlap and return/hold behavior understandable. | Edit one overlapping cue; confirm another cue is neither replaced nor reprioritized and the requested gaze/turn survives. |
| **Edited numeric inputs passed invalid states.** NaN position, zero lens and negative fade passed checks. `pair` as an action target and a missing camera target later raised `KeyError`. | `blender-authoring.md`: check finite values, meaningful ranges, references and intervals before rendering; report the offending input instead of a late lookup failure. | Exercise these invalid edits against the relevant generated/adapted implementation; failures are actionable and occur before output writes. |
| **Review tooling became stale or failed on content.** Sampling ended at 14 seconds for a 17-second take; uncovered Beat time could raise `StopIteration`; long dialogue overflowed the burned-in review frame. | `blender-authoring.md`: sample the current take through its final frame, allow unlabeled intervals and keep playback cues separate from encoding. Caption presentation is deferred to the Studio player. | Render an extended take with an unlabeled interval and long cue text; encoding succeeds without burning overlays into the video. Inspect the final action and retained cue text. |
| **Numeric checks did not prove visual quality.** Distances alone did not establish clearance or shoulder framing. The original visual loop corrected a water-obscuring camera, supporting-actor facing and head/torso overlap. | `blender-authoring.md`: use images/playback to inspect occlusion, clearance, facing and camera orientation/lens changes alongside numeric checks. Preserve the simple geometry and legibility that worked. | Inspect contact/event frames and continuous changed intervals; demonstrate the requested framing and gesture rather than accepting only numeric pass results. |
| **Iteration already had a cheap motion stage.** Full motion evaluation took about 0.028–0.038 seconds; session render/finish observations were about 19.5/15.5 seconds. | `blender-authoring.md`: prioritize short previews, saved builds and independent encoding. Deeper optimization follows profiling while retaining final quality. | Record the commands and elapsed work for a focused revision; show that an encoding correction does not rerender the scene. Treat measurements as local evidence, not a latency promise. |
| **AI conditioning was useful but not exact transfer.** H3 Max arrival was around 8–9 seconds rather than the mapped 7.06, shortening the exchange. Native speech was not verified. The director accepted the result. | Media Producer previs guide: assign motion versus appearance reference roles, compare event timing, listen before claiming speech fidelity and preserve accepted output. | Review the existing accepted take against its mapped timeline, state timing/audio limits and verify attachment to the same plan without initiating another paid take. |

The visual baseline includes `paint.sl` Studio lighting, both cavity modes,
outlines, facing markers, ground contact and restrained block geometry. Exact
Harbor settings and reference-informed geography are useful starting material
for adaptation, not a restriction on another scene's artistic solution.

All three clean previs videos, the retimed reference and AI output were probed
and fully decoded. Current motion evaluation matches stored revision samples.
Contact sheets, gesture tests and the final portion of v003 were visually
inspected. The AI video is 1344×768/24 fps with 362 frames and AAC audio;
its attached file `scenes/03/01-shot-plan/s03-p01-video-gn6p.mp4` is byte-identical
to the accepted output. This analysis used sampled images, not continuous
audiovisual playback or spoken-line transcription, so it does not establish
exact dialogue or voice fidelity.

## Shot Plan files and registered media

Keep authoring sources and Blender renders within the existing Scene Shot Plan.
AI takes follow Renku's existing video Asset destination directly in that folder,
with model/request provenance in SQLite rather than model-named directories.

```text
scenes/03/01-shot-plan/
  previs/
    source/
      build_previs.py                # editable scene-specific implementation
      scene.json                    # directing parameters, including dialogue timing
    revisions/r003/
      build_previs.py                # exact source used for this revision
      scene.json                    # exact directing parameters
      scene.blend                   # saved built scene
      playback.json                 # legend and timed cues for the future player
    renders/                        # registered, unannotated Blender MP4s
  s03-p01-video-gn6p.mp4             # existing registered AI take

tmp/
  ...                              # existing temporary operation/media categories
  .../frames/                      # reusable intermediate PNGs, never Assets
```

### Plan types, revisions and render registration

Persist `previs` (Previs) and `shot-list` (Shot List) as Shot Plan types. Existing plans retain their identity,
Scene-local numbering and content. Core/CLI expose type at creation and read time;
the existing Shot-list operations remain scoped to that type. Previs plans use
their authored source and revision history rather than artificial Shot rows.

Each successfully completed full previs render is retained as a **Previs Revision**,
with its exact source snapshot and registered **Previs Render**. Failed attempts,
single-frame tests and short diagnostic previews remain temporary. Previous
completed revisions stay available. Registration after a retry must return the
same revision when its source/render identity is unchanged, not create duplicates.

Use the existing `asset`, `asset_file` and membership machinery. Asset
type is `shot_plan_previs`, media kind `video`, origin `rendered`, with no AI
provider provenance. Preserve exact Shot Plan authorship. Core's destination is
`previs/renders/previs-gxxx.mp4` beneath the canonical Shot Plan folder; filename
allocation, copying/hashing and failure rollback reuse the current file owner.
AI takes continue as `shot_plan_video` Assets in the existing plan-root destination.
The AI Generations projection continues to list AI takes, not procedural renders.

A small `shot_plan_previs_revision` record identifies the revision, Shot Plan,
revision number, source directory, render Asset and creation time. Its source
directory contains the exact files shown above. This is the durable association
between a render and its authoring inputs, not a database model of the animation.
No Cast, Beat, dialogue-turn or cue foreign keys are added. SQLite records media
identity and revision association; authored file contents remain opaque.

Core supplies the canonical plan/source/revision paths to the CLI. The agent
writes and revises its Python and parameters at those paths. Focused Core commands
create/read revisions and attach a completed render; they validate the owned file
and relationship envelope, not the creative interpretation of parameters/cues.
Media Producer's current plan context exposes registered previs revisions as video
reference candidates, allowing the agent/director to choose the exact revision.
No assumption that the newest render is the desired AI input replaces that choice.

Retain source revisions and Blender files for reproduction. Temporary frames,
encoding intermediates, contact sheets, logs and validation reports live under
Project `tmp/`. AI request/receipt working files use the existing temporary
workflow; durable AI provenance stays on the Asset. A retimed reference derivative
is needed only when the submitted video differs from the master, and its source
and time mapping must remain traceable.

There is one unannotated previs video. Do not generate a `review.mp4` or burn
legends, timecodes or dialogue into it. Preserve the source timing and character
information needed by the future Studio player; that UI is outside this work.

### Directing parameters and playback information

`previs/source/scene.json` is the editable directing document for the current
implementation. The agent chooses its scene-specific structure. Dialogue timing
belongs here alongside the other directing parameters, because it affects the
performance rather than just the player display. For example (illustrative text):

```json
{
  "dialogue": [
    {
      "turn": 3,
      "subject": "mara",
      "text": "The exact line resolved from the Scene dialogue",
      "startSeconds": 8
    }
  ]
}
```

This is an authoring example, not a runtime-required universal scene schema.
`turn` is the director's human-readable reference to the current Scene dialogue.
The agent reads that turn and preserves the resolved line/speaker in the revision,
so a later screenplay edit does not silently change what an old render meant.
`subject` is this plan's local actor name/key, not a Cast id. Use the same subject
name in the script, legend and cues; a separate `speakerId` is unnecessary.

For “I want Mara to say the third dialogue turn at time X,” the agent:

1. Resolves the line and speaker from the current Scene dialogue. Clarifies an
   actual speaker conflict or ambiguous turn reference rather than rewriting it.
2. Changes the requested start time in the directing parameters, accounting for
   the selected performance's duration when audio is available. Clarifies a
   conflict with a locked interval; neither new speech nor time-stretching is
   implied by the timing instruction.
3. Uses the same timing for the previs performance, such as speaking gestures,
   gaze and reactions. Exact speech/lip animation is not required for block previs.
4. Produces the corresponding playback cue and carries the line/timing into the
   AI-generation prompt, together with the appropriate selected audio references.

`previs/revisions/r003/playback.json` is the lightweight information accompanying
that revision's video for the future Studio player. Authored vocabulary:

```json
{
  "subjects": [
    { "key": "mara", "label": "Mara", "color": "#D98278" },
    { "key": "urban", "label": "Urban", "color": "#C49A45" }
  ],
  "cues": [
    {
      "startSeconds": 8,
      "endSeconds": 11,
      "subject": "mara",
      "text": "The exact line resolved from the Scene dialogue"
    }
  ]
}
```

Here the cue means “show this text from 8 seconds until 11 seconds of playback.”
It does not control Blender. The agent derives it from the directing parameters;
it does not independently invent a second dialogue schedule. The end time follows
the authored performance interval, using selected audio duration where applicable;
this example's three seconds is not a default speech duration. Cue text can also
provide an action or Beat label. `subject` is optional; no cue IDs, categories or
links to screenplay records are required. Playback position/timecode comes from
the video, not a duplicated timeline in SQLite.

Keep cues for the future player; their presentation can change during UI design.
Missing subjects/cues or a name that is absent from Cast must not block recording
a revision, rendering or directing. Core treats playback content as opaque and
validates only its file envelope. The future player should still play the video
when annotations are absent. This slice stores the information; it does not build
the player or burn any of it into the MP4.

The generation handoff reads the selected revision's `scene.json`, not whatever
happens to be in the mutable source directory. If a submitted derivative changes
time, map the same directing times to its timebase and retain that mapping with
its source evidence. Native reference audio is conditioning; the generated video's
actual speech timing still needs review. Do not promise exact timing enforcement
by a provider simply because the prompt contains a timestamp.

### Explicit temporary-file cleanup in Project Settings

Add a **Temporary files** section to the existing Project Settings page with a
**Clean up temporary files** button. This is an action, not an autosaved preference.
It clears the contents of this Project's top-level `tmp/`, leaving the directory
available for subsequent work. It does not recursively search for every directory
named `tmp`, clear `.renku/`, or remove source revisions, Blender files or
registered media. The old exploration sources must be relocated safely before
any separate cleanup of their historical nested folder.

Frames remain reusable across rendering, encoding, revisions and agent turns
until the user invokes cleanup. There are no automatic age/count limits or
cleanup hooks on render completion, Project opening or app closure. After manual
cleanup, a later operation recreates the temporary files it needs; an absent
frame cache can require rendering again.

Use the existing shadcn confirmation dialog pattern to explain that cleanup
permanently removes temporary render frames and other working files, and that
later iteration may need to regenerate them. Report completion or a concrete
failure; an empty/missing tmp directory is a successful no-op. Core must constrain
filesystem operations to this exact tmp root, avoid following symlinks outside
it, and refuse deletion of any registered AssetFile encountered there. These are
file-integrity checks, not rules about the creative contents.

The confirmation is sufficient. Users choose when to clean up; active-operation
detection, blocking and process coordination are outside this action's scope.

### Cleanup architecture shape and implementation slice

- `packages/core/src/client/project-temporary-files.ts`: focused
  `CleanProjectTemporaryFilesInput` and `ProjectTemporaryFilesCleanupReport`.
  Input identifies the Project, never an arbitrary directory. Report removed
  file count and bytes; structured failure reports must identify partial cleanup.
- `packages/core/src/server/project-temporary-files/cleanup.ts`: owns tmp scope,
  AssetFile protection, safe traversal/deletion and cleanup results. Focused
  tests cover containment, symlinks, registered files and partial failures.
- `project-data-service-contracts.ts` and
  `project-data-service-wiring/project-administration.ts`: expose
  `cleanProjectTemporaryFiles` through the existing service.
- `packages/studio/server/routes/project-temporary-files.ts`: thin
  `POST /studio-api/projects/:projectName/temporary-files/cleanup` handler; delegates
  to Core and uses existing structured error translation.
- `packages/studio/src/services/studio-projects-api.ts`: typed HTTP call.
- `packages/studio/src/features/movie-studio/project-details/project-temporary-files-section.tsx`:
  action, confirmation, pending and result states, composed by
  `project-settings-panel.tsx`. Keep it separate from the settings autosave fields.

No Settings schema, background cleaner or CLI command is needed for this button.
Existing `index.ts` entrypoints stay thin. Verification covers the owning Core
behavior, route delegation and desktop button/confirmation/result behavior.

## Skill structure and directing workflow

```text
studio-skills/skills/blender-shot-planner/
  SKILL.md
  agents/openai.yaml
  references/
    directing-workflow.md
    blender-authoring.md
    plan-files-and-generations.md
    ai-handoff.md
  evals/
    director-iteration.md
```

Keep the entrypoint concise. Put storage conventions and practical Blender notes
in the references, linked where needed. Use the lesson coverage table to populate the references and evals. Keep its
case-specific evidence in the eval material so the entrypoint stays focused.

The authoring workflow is:

1. Read the intended Project, Scene, Shot Plan and relevant Beats/dialogue. Inspect
   the location and character sheets needed to stage the scene.
2. Establish the action, camera intent and timing with the director. Ask when an
   ambiguity would materially change the result, especially arrival versus hold
   timing or actor-left versus camera-left.
3. Author or adapt the plan's Python and editable parameters. Expose positions,
   camera controls and timing so ordinary directions are quick to apply. Document
   units, axes, important controls and the commands used to run it.
4. Preview the changed action, review the pictures and motion, then retain the
   source revision and its unannotated render in the agreed folders.

For subsequent direction, continue the selected plan's implementation and preserve
what is already working. A new behavior may require code changes. The agent can
choose modeling techniques, helpers and code organization appropriate to the
scene; a fixed internal module structure or universal parameter schema is not
part of the skill.

## Consistent execution and faster iteration

Keep these operational conventions across plans:

- **Preflight:** verify Blender and the finishing tools actually used, including
  a small execution before a full take. Validate edited coordinates, targets and
  timing early enough to produce useful errors.
- **Source and revisions:** retain exact source/config, directing notes, tool
  versions and input hashes for a rendered revision. Establish source authority
  before rebuilding a manually edited Blender file.
- **Build, render, finish:** save a baked `.blend`; support preview/full rendering
  from that build and encoding from existing frames. Preserve completed outputs.
  Resume partial rendering only with unchanged inputs.
- **Timing:** use a documented common frame/time convention for motion, captions
  and encoding. Preserve locked durations and verify sequence completeness.
- **Review:** inspect current event boundaries and the last frame, plus continuous
  playback for motion changes. Keep the MP4 unannotated; the future Studio player
  owns timecodes, legends and other overlays.
- **Performance:** use event frames or short previews for focused revisions,
  reuse saved builds and retry encoding independently. Profile before deeper
  optimization; preserve the accepted final rendering quality.

Retained PNGs can also support revision-to-revision reuse when the agent can
establish that a picture is unchanged. Render the affected interval including
transitions and any persistent camera/pose effects, then combine it with valid
unchanged frames. Blender's skip-existing-files option does not detect changed
animation. Global camera/look changes generally invalidate the full sequence.
Keep this as a plan-specific optimization, with image/motion verification, not
a required general dependency-analysis engine. Manual tmp cleanup resets this
working cache without removing the durable revisions.

## Architecture and ownership

The new skill supplies Blender authoring guidance. Movie Director routes to it;
Shot Planner retains Shot-list authoring. Media Producer owns video generation
and provider handoff. Movie folders own the authored Python and Blender files.
Core retains plan identity, canonical path allocation and registered Assets.

Keep provider execution in the existing provider skills and creative interpretation
in the agent. The cleanup slice above owns the newly requested Settings action.
Core owns the plan type, revision and render-registration behavior described
above. The source and playback files remain authored content, not a parallel
agent-maintained database.

## AI generation from the Shot Plan

Add `media-producer/references/shot-plan-video/blender-previs.md` as the owned
workflow guide. The Blender skill's `ai-handoff.md` supplies exact Project/Scene/
Shot Plan identity, the reviewed source revision, clean video, duration/fps,
director's locked actions and optional audio intent, then routes to that guide.
Media Producer rereads the complete current Core generation context for this
exact Shot Plan. Neither a stale handoff nor the empty Shots projection replaces
current context. Continue the established plan rather than creating another
placeholder. Use the current `shot-plan.video-generation` purpose and supported
focused commands; no new generation purpose or native provider field is needed.

### Reference roles and audio

| Input | Role in this workflow | Selection and treatment |
| --- | --- | --- |
| Clean previs video | Blocking, camera path, geography, action order and intended timing. | Use the reviewed revision as an actual native video reference. Never substitute a contact sheet, annotated review video or first-frame-only workflow. |
| Character sheets | Identity, costume, proportions and final visual treatment. | Inspect exact files for the characters present and map each proxy to the right identity. Proxy colors are identification aids, not mandatory wardrobe. |
| Location sheets | Setting, architecture, materials, atmosphere and spatial appearance. | Use the relevant same-space sheets; reconcile their geography with the authored previs. Avoid redundant upstream images. |
| Prop sheets, when needed | Identity/design of featured props. | Include when the visible prop needs a distinct reference; not every project prop. |
| Selected Shot Plan Dialogue Takes | Selected performance, voice and dialogue reference. | Follow `video-reference-continuity.md`: use relevant active selected takes, each as its exact audio file, when the selected route supports reference audio. |
| Other explicitly requested audio | Voice, rhythm, music or ambience according to director intent. | State each file's role; do not treat a music reference as dialogue or assume audio is a guaranteed final mix. |
| Lookbook text | Optional additional wording for light, palette, contrast and texture. | Translate relevant guidance into concrete prompt language. Do not upload another Lookbook image: the selected character/location sheets already encode its visuals. |

This is a scoped previs workflow rule, not removal of Lookbook references from
other Media Producer purposes. A provider cannot see a named Lookbook that was
not supplied: “follow the selected Lookbook” alone conveys no visual direction.

Read `dialogueAudio` candidates in the current plan generation context. Do not
pick the newest unselected take, generate substitute dialogue, concatenate takes,
truncate references or silently drop audio to fit a limit. No dialogue is a valid
case and does not require creating audio. If exact dialogue is requested but no
take is selected, request selection through the existing Audio workflow. If the
chosen route cannot combine the required video, images and audio, explain the
specific conflict and obtain a choice of route or input scope before execution.
Native audio generation alone is not evidence of uploaded-audio support.

Check selected audio durations and intended event placement against the previs.
Resolve a conflicting performance by revising the plan timing, choosing a capable
route or agreeing on scope; never time-stretch selected speech as an incidental
consequence of shortening the previs. Reference audio conditions generation but
does not guarantee an unchanged waveform, exact speech timing or perfect lip sync.

### Model selection and existing guidance

Use H3 Max when this workflow has no explicit model choice. This is the user's
workflow preference, not permission to mutate Project Settings. Explicitly chosen
alternatives win; a current policy/capability conflict must be exposed, not silently
worked around. Resolve the exact provider route through the current catalog,
canonical model operation guide, provider adapter and live input schema.

| Model choice | Fal.ai reference-to-video route | Guide handling |
| --- | --- | --- |
| H3 Max — default | `minimax/h3-max/reference-to-video` | Existing `video/minimax-h3/reference-to-video.md`; preserve exact Max route selection. |
| Seedance 2.5 | `bytedance/seedance-2.5/reference-to-video` | Add distinct `video/seedance-2.5/` canonical guide and catalog mapping; absent from the inspected local catalog. |
| Seedance 2.0 | `bytedance/seedance-2.0/reference-to-video` | Existing `video/seedance-2.0/reference-to-video.md`; use video-reference direction, not an image-start or storyboard-sheet recipe. |
| Wan 3.0 | `alibaba/wan-3.0-prime/reference-to-video` | Existing `video/wan-3.0-prime/reference-to-video.md`; name the actual supported Prime route in the review. |

These are supported workflow choices, not promises of identical quality, limits
or timing fidelity. Verify the live route's input combination, file/count/size/
duration limits, output duration, aspect/resolution, reference-audio handling and
native prompt-expansion policy. Do not inherit the exploration's 15-second limit
as a universal rule. A reference-video route is not automatically an exact
motion-transfer or frame-lock contract.

Seedance 2.5's endpoint is documented, but its overview and API schema currently
differ on reference mention syntax. The implementation must reconcile the exact
route's live schema with its adapter and record the source/date, rather than copy
marketing examples or assume the 2.0 recipe applies. No new paid run is required
to write this plan; an unresolved provider contract cannot be labeled verified.
[Fal route overview](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video),
[Fal API schema](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video/api).

### Prompt, timing and execution

Reuse `shared/prompt-input-visibility.md` and the selected canonical operation
and provider adapter. Finalize each modality's actual input ordering, then author
its native reference mentions. Do not put Renku IDs, filenames or guessed tokens
in place of visible media references. Character/location sheets are appearance
references; their presence does not turn this into a storyboard-image workflow.

The prompt should identify the continuous shot, explicitly assign video motion/
camera and image appearance roles, map proxies to characters, describe ordered
actions and priorities, and translate optional Lookbook guidance into visible
traits. Preserve geography and performance while replacing block geometry with
the selected appearances. State relevant exclusions against reproducing labels,
proxy materials, sheet panels or unrequested extra action. Keep creative review
agent-owned; no Studio validator should parse these instructions or judge frames.

Keep the director's master timing. If delivery requires a derivative, preserve
the master and record source revision, frame rate and exact time map. A 17-to-15
speed-up changes a three-second hold to 2.647 seconds: disclose that consequence
and resolve locked timing before preparing it. Map prompt cues and any audio
placement into the submitted timebase; never reuse incompatible master timestamps.
A different model's longer supported duration can be an option, not an automatic
switch. Store submitted derivatives and review evidence with that generation.

Use the existing configuration, Preview, confirmation, provider execution and
recovery workflow. Keep safe request/provenance and exact Shot Plan authorship;
provider request bodies contain only that route's native fields. Review returned
appearance, camera, event timing and audio separately against the input contract.
Listen when claiming dialogue/voice correctness; an audio stream or contact sheet
cannot establish it. Disclose deviations and preserve a user-accepted result;
no automatic paid retries. Attach through Core's existing boundary and allocated
Asset destination, never by manually copying a registered video into place.

## Implementation slices

### 1. Update skill and storage guidance

Create the skill entrypoint, references, UI metadata and eval document at
the named paths. Incorporate every row of the exploration lesson table into its
assigned reference and eval; retain the concrete failure examples in the eval
material, rather than expanding the main skill into a universal rulebook. Update Movie Director's `SKILL.md`, `department-map.md`,
`workflow-playbooks.md`, `specialist-handoff-checklists.md` and
`cli-coverage-and-gaps.md` to route alternative Shot Plan authoring and disclose
the current type/path/UI gaps. Add a precise boundary note to `shot-planner`;
retain its Shot-list workflow. Update the sister README capability list.

Clarify retained authoring sources in
`docs/architecture/project-asset-storage-conventions.md` and
`docs/architecture/reference/studio-skills.md`. Add a new ADR after acceptance
for retained Shot Plan sources and output separation, with only a narrowing
notice to decision 0076. It must not change registered-media destinations or
change the deferred player UI scope. Document the now-in-scope plan types,
revision storage and procedural Asset registration.

Narrow the blanket “every working file goes in tmp” wording in the directly
involved `movie-director`, `shot-planner` and `media-producer` guidance. Preserve
normal temporary operation paths; do not sweep unrelated department skills.
Update the sister release storage test so it distinguishes temporary CLI JSON
from retained Shot Plan authoring files rather than enforcing all files as tmp.
No dependency or release/install workflow changes.

### 2. Add the Media Producer previs-generation workflow

Create `skills/media-producer/references/shot-plan-video/blender-previs.md` with
this workflow's input roles, timing contract and model routing. Link it from
Media Producer's `SKILL.md` and `references/shot-plan-video/index.md`; update
`workflow.md` and `director-handoff.md` narrowly so a Blender-authored plan reaches
this guide with its exact clean revision and audio priorities. Reuse existing
`video-reference-continuity.md` selection rules and shared prompt guidance rather
than maintaining another copy. Keep `blender-shot-planner/references/ai-handoff.md`
focused on that boundary. Scope the no-extra-Lookbook-image instruction explicitly
to this workflow so it is not contradicted by generic reference advice.

Add `skills/media-producer/references/model-guides/video/seedance-2.5/index.md`
and `reference-to-video.md`, and map its distinct model key in
`references/model-guides/model-catalog.json`. Add the exact route in
`skills/fal-ai-media-provider/references/supported-routes.json` and reconcile its
reference syntax in `references/adapters/reference-inputs.md` against the current
API schema. Update the affected catalog coverage checks. Reuse existing provider
execution; do not introduce unrelated 2.5 operations or new Studio runtime code.
Implement the required previs registration/context support in the Core/CLI slice;
provider execution continues through the existing provider skills.

Extend `skills/media-producer/evals/shot-plan-video/forward-test-cases.md` with
previs requests for each of the four model choices, including selected dialogue,
no dialogue, changed reference ordering, over-limit audio, conflicting timebases,
and an unavailable required input combination. Use native request fixtures drawn
from current route schemas in the eval, not one universal request template.
Verify exact-plan authorship, scoped Lookbook omission and explicit timing
limitations. These are request preparation/review evals, not four paid generations.

### 3. Evaluate the skill's authoring and revision behavior

Use an isolated copy of the Harbor plan for evaluation. Ask the agent to apply
same-plan directions using its existing specific code: move sides, centered
camera, timed shoulder, lean, three-second conversation, later Urban stop and
slow turn. Check that routine direction is easy to apply and the accepted geometry/style
survives the revision.

Separately evaluate initial authoring from another Scene's actual references
and brief. The agent may consult and adapt the Harbor code. Review the resulting scene's
spatial/readability quality, editable controls and documented invocation.

Do not spend on new AI generation for these evals. Use the accepted H3 output
for handoff/timing examples. Do not add test scaffolding to the real movie merely
to run a documentation eval; generated checks belong in the isolated plan copy.

### 4. Optional Harbor file relocation

After explicit approval, inventory/hash and copy the exploration from
`scenes/03/01-shot-plan/tmp/harbor-previs/` into this same Shot Plan's
`previs/` source/render layout and existing AI Asset destinations. Map all configs, scripts, `.blend`/`.blend1`
files, frame sequences, previews, QA, videos and relevant AI handoff files.
Verify copies before removing anything. Keep originals until relocation and
any cleanup are separately authorized.

Do not fabricate historical source snapshots: the preserved Python is the
current recovered implementation; earlier configs/motion/renders are historical
evidence even though exact old script bytes are not all available. New revisions
capture full source. Keep original submitted requests/provenance unchanged as
historical evidence; prepare new requests with current paths explicitly.

The existing `.blend` render paths were authored as absolute paths. Save a
separate working copy with relative paths, and verify it opens/renders after
relocation. Leave the registered accepted video and database untouched. This
is local file organization, not a database migration or a new Asset lifecycle.

## Verification and completion checklist

Evaluate outcomes, not a prescribed Python structure. Use an isolated Harbor copy
for revisions and another scene for authoring; adapting existing code is valid.
Compare framing, scene readability and performance with the accepted exploration.
Use the existing H3 result for downstream review examples. Model request-preparation
evals do not require paid generation.

### Skill and workflow

- [x] Create the Blender skill, focused references, metadata and directing eval.
- [x] Trace every exploration-lesson row to its named guidance and verification;
      distinguish reproduced failures from the unproven rotation risk.
- [x] Add Movie Director routing and the Shot Planner boundary; update the README.
- [x] Verify relevant context and sheet reading, editable directing controls and
      practical instructions for running the plan.
- [x] Exercise camera/position/hold/turn revisions while preserving accepted quality.
- [x] Direct a specific dialogue turn at time X and verify the same line/timing
      reaches parameters, previs performance, playback cue and AI prompt.
- [x] Work through a Scene-grounded speaker/timing conflict as a dry-run handoff
      scenario; preserve agent clarification without runtime creative validators.
- [x] Author another scene, allowing reuse/adaptation, and review its result.
- [x] Verify dependency checks, source snapshots, safe output writes and separate
      build/render/finish execution, including a resumed unchanged render.
- [x] Inspect event/final frames and sampled motion sequences; fully decode both
      eval videos. No claim of audio or frame-by-frame perceptual certification.

### Storage and product boundaries

- [x] Keep the exact Scene Shot Plan hierarchy, source/render separation and
      source-revision-to-render traceability shown above.
- [x] Clarify retained sources in storage docs and affected skill guidance/tests;
      record the accepted storage decision while preserving ADR history.
- [x] Preserve Core numbering, Asset allocation and exact plan authorship.
- [x] Accept Shot List (`shot-list`) and Previs (`previs`) as the public types.
- [x] Implement plan types, canonical paths and revision create/read/register in Core/CLI.
- [x] Register every completed full previs render with its exact source revision.
- [x] Expose registered previs revisions as generation-context reference candidates.
- [x] Keep failed attempts/previews temporary and preserve existing AI take storage.
- [x] Store lightweight playback.json with no Cast/Beat/dialogue relationships;
      verify absent annotations do not block registration. Keep the player UI deferred.
- [x] Use a simple cleanup confirmation without active-operation detection or blocking.
- [x] Add the explicit Settings cleanup action, Core command and thin HTTP adapter.
- [x] Verify manual-only cleanup, containment, AssetFile protection, partial failures
      and desktop confirmation/result behavior; preserve settings autosave behavior.

### Media generation

- [x] Add/link the Media Producer previs guide and exact-revision handoff.
- [x] Prepare native video plus character/location references and selected audio;
      use Lookbook text where useful without an extra Lookbook image.
- [x] Exercise H3 Max default and the three alternatives with current route schemas.
- [x] Add missing Seedance 2.5 catalog/guidance and resolve reference syntax.
- [x] Check audio selection, reference ordering, unsupported inputs and duration
      conflicts using existing video guidance.
- [x] Verify time mapping, request review, safe provenance and Core attachment.
- [x] Review motion/appearance/audio separately and retain accepted output.

### Optional Harbor relocation

Not requested. No Harbor source/media file was moved or deleted. The optional
inventory/copy/path-rewrite work remains outside this implementation. The additive
schema migration is separate and preserves the existing accepted Asset identities.

### Final verification

- [x] Run skill-creator validation and the sister repository's `pnpm test`.
- [x] Review manual eval results and disclose any playback/audio verification limits.
- [x] Inspect complete diffs, large modified files and generated Python for
      reviewability; confirm `index.ts` files remain unchanged/thin.
- [x] Check that guidance preserves agent judgment while retaining the agreed
      storage and execution conventions; no checklist item accepts poor code structure.
- [x] Report skill delivery, quality/iteration evidence and deferred product work.

Verification uses focused Core/CLI/Studio tests and root `pnpm check`, `pnpm lint`,
`pnpm test` and `pnpm build`. No automatic plan review was run. The accepted names
are Shot List and Previs. Evaluation evidence and perceptual review limits are in
`studio-skills/skills/blender-shot-planner/evals/implementation-results.md`.


## Implementation contract

Core `shot-plan-previs/registration.ts` exposes `readShotPlanPrevis` and
`registerShotPlanPrevis`; projection is in `shot-plan-previs/projection.ts` and
source snapshot filesystem behavior in `project-asset-files/previs-sources.ts`.
CLI handler registry adds `shot-plan previs show` and `shot-plan previs register`.
Register JSON contains project-relative `sourceDirectory`, `renderPath`, optional
`title`; Project and Shot Plan use existing CLI flags. Core chooses `rNNN`, copies
the source and video, and atomically records the revision association. Source/render
hashes supply retry identity, without reading creative contents. The existing Shot
Plan video destination module handles its two bounded procedural/AI destinations.
No provider dispatcher, generic metadata patch or player route is added.

Architecture stop conditions: keep CLI/server adapters thin; do not put creative
validation into Core, snapshot all temporary frames as source, combine procedural
media with AI take projections, or build a general Blender engine. Cleanup remains
a separate focused Core service and Settings component.


## Completion evidence

- Added the Blender skill with focused references and exploration/evaluation
  material; extended Movie Director, Shot List planning and Media Producer routing.
- Added typed Shot Plans, source/render revision registration, exact-plan reference
  candidates, SQLite Asset persistence and manual Settings cleanup.
- Added Seedance 2.5 model/route guidance and four separate native request fixtures.
  H3/Wan native fields differ from Seedance; references follow exact route schemas.
- Evaluated an isolated Harbor revision and new First Patron scene. Harbor retained
  its geometry/style; the 17-second output contains 408 frames. The independent
  8-second scene resumed its second 96-frame range from a saved `.blend` and was
  encoded twice from the same frames. No paid AI generation was run.
- A rebuilt earlier Harbor frame had identical decoded pixels. Writer protection,
  shared dialogue onset/hold, side swap, route-space look-ahead and cue/numeric
  examples were exercised. Visual review was sampled; original H3 speech remains
  unverified. Detailed scenarios remain as reusable skill eval cases.
- Generated migrations 0084 and the documented generation-68 guard migration 0085
  through Drizzle Kit. Applied them to Urban Basilica using Renku's verified-backup
  migration command. All existing Scene/plan/Shot/Asset/AssetFile ids were preserved;
  SQLite quick_check returned `ok`. Existing plans remain Shot Lists; no exploratory
  placeholder was silently converted or source files relocated.
- Temporary derived timing evidence is also summarized in the AI take's existing
  Asset summary, preserving revision/time-map information after tmp cleanup without
  a new provenance schema or file tree.
- Inspected implementation diffs and the focused registration/source/cleanup
  modules; public indexes remain entrypoints, with no creative validators or
  generalized Blender engine. Existing unrelated staged work is preserved.

Final verification: `pnpm build`, `pnpm check` (including lint), and `pnpm test`
passed; the full Studio workspace run passed 964 tests across 231 files. Sister
`pnpm test`, skill-creator validation and both repositories' diff whitespace checks
also passed. The Blender player UI, paid AI runs and optional Harbor relocation
were not performed.
