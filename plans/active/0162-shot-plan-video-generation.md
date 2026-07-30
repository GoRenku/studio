# 0162 Shot Plan Video Generation

Status: completed

Completed: 2026-07-30
Date: 2026-07-30

Prerequisite: Plan `0163-remove-stale-shot-video-ui-and-generation-scaffolding.md`
must be complete for the Studio runtime and the project database must be at
schema generation `54` before implementation begins. The retained
`studio-skills` video research is an input to this plan's skill slice, not
prerequisite cleanup to repeat.

## Summary

This plan follows the prerequisite cleanup in
`0163-remove-stale-shot-video-ui-and-generation-scaffolding.md`. Plan `0163`
removes the failed dormant Shot AI Production UI, the generic `video.create`
purpose and Project-video attachment path, and the obsolete
`ShotPlan.lastGenerationSpec` foreign-key coupling before any new video
generation functionality is introduced.

After that clean baseline, Renku Studio can still use the generic provider
capability catalog and video adapters in Engines, but it has no user-callable
video generation purpose. The agent has no current Shot Plan-aware video
reference guide, Preview cannot author the required Seedance input modes,
Studio has no video-specific Config surface, and the Scene Generations tab is
disabled.

This plan completes that workflow by extending the existing generation
architecture rather than creating a Shot Plan-owned generation system.

The smallest useful product shape is:

- keep generated videos as independent Project-owned Assets;
- add the specific `shot-plan.video-generation` purpose and require
  `GenerationSpec.authoredFrom = { kind: 'shotPlan', id }` as its one
  deliberately weak association;
- resolve that association only to build mutable authoring context and the
  Scene Generations projection;
- persist one explicit `shotPlanVideoInputMode` on
  `shot-plan.video-generation` specs so Preview can select the exact Seedance
  route without inference;
- make the Engines Studio video catalog the single runtime activation source,
  initially containing only the three Seedance 2.0 families, and delete the
  existing independently curated video-prefix inventory;
- add three purpose-specific independent image purposes for optional
  first-frame, last-frame, and video-storyboard references;
- extend the shared Generation Preview and read-only request inspector for
  video authoring instead of adding a second editor;
- expose successfully attached Project video Assets in the Scene Generations
  tab, grouped under active Shot Plans and under `Miscellaneous` when their
  source Shot Plan has been moved to Trash;
- update the `media-producer` skill so the agent owns creative method choice,
  prompt writing, reference-token accuracy, Preview review, approval, and live
  execution; and
- preserve, refresh, and re-home the accumulated Seedance, Kling, and other
  provider-specific video research, examples, and eval scenarios while
  replacing only their obsolete Take-era commands, targets, and executable
  envelopes.

This plan preserves the accepted live lifecycle from Decision `0056`: a
GenerationSpec freezes immediately before a live provider request. A failed
live request remains frozen. A changed request is authored as an ordinary new
mutable GenerationSpec; no Shot Plan pointer, copy command, continuation
contract, or plan lifecycle rule is involved.

## Requirement Ledger

Each planned concept below traces to an explicit product requirement, an
accepted decision from the user, a current documented rule, or a hard
architecture boundary.

| ID | Requirement and source | Owning implementation | Acceptance evidence |
| --- | --- | --- | --- |
| R1 | Generate one or more videos from a current Shot Plan through a purpose that says exactly what it does. Product write-up and accepted user naming. | New `shot-plan.video-generation` purpose, Project-owned Asset attachment, and `media-producer`. | End-to-end simulated and agent-external journeys create independently inspectable Project video Assets; generic `video.create` remains absent. |
| R2 | Support text-only, first-frame, first-and-last-frame, and general reference input. Product write-up. | Core `GenerationSpec.shotPlanVideoInputMode`, Engines route catalog, and Preview authoring strategy. | Core route tests and desktop Config interaction cover all four modes. |
| R3 | Show only Seedance 2.0, Seedance 2.0 Mini, and Seedance 2.0 Fast initially, while making future model activation one deliberate Engines catalog change rather than another parallel list. Product write-up, accepted review finding, and Engines ownership boundary. | Engines `StudioVideoModelCatalog` as the sole Studio video activation source; existing `listStudioModelAvailability` becomes a derived query and its authored video prefixes/helpers are deleted. | Catalog tests expose exactly the three accepted Studio families; availability equals the flattened video catalog without a second inventory; generic provider discovery retains technically implemented models. |
| R4 | Default agent guidance to Seedance 2.0 full at 480p and recommend image-to-video when the user does not specify a method. Product write-up. | Video catalog default plus `media-producer` workflow guidance. | Preview initializes the full family and 480p; skill evals prove the agent recommends rather than silently inventing a user choice. |
| R5 | Let the agent recommend duration from Shot Plan timing, allow user override, and never auto-segment beyond the provider's 15-second maximum. Product write-up. | Provider schema validation and `media-producer` guidance. | Skill evals cover a normal duration and a request exceeding 15 seconds; runtime never creates segments. |
| R6 | Generate optional first-frame, last-frame, and video-storyboard images without dependency management. Product write-up. | New image purposes `shot-plan.video-first-frame`, `shot-plan.video-last-frame`, and `shot-plan.video-storyboard`, attached as independent Project Assets. | Purpose, attachment, provenance, and reference-guide tests show independent assets with no canonical selection or lifecycle coupling. |
| R7 | Treat storyboard layout and contents as agent/user creative choices. Product write-up and Decision `0041`. | Skill guidance only; Core validates the owned generation envelope. | Architecture and purpose tests prove no prompt phrase, panel, shot-map, caption, or visual-content validator is added. |
| R8 | Offer Shot Plan-relevant character sheets, location sheets, dialogue audio, lookbook sheets, method references, and additional media without automatic selection. Product write-up. | Core Shot Plan authoring reference guide. | Guide tests cover section order, candidate identity, one request-scoped slot per subject, and no selected defaults. |
| R9 | Let the user inspect, choose, replace, and deselect slot candidates in Preview. Product write-up. | Existing Generation Preview slot edits, `MediaCard`, and `MediaCardCollectionDialog`. | Studio tests cover singleton inspection, multi-candidate inspection and selection, replacement, and deselection. |
| R10 | Keep prompt authoring in the existing CodeMirror editor with `@ImageN`, `@VideoN`, and `@AudioN` completion. Product write-up and provider contract. | Existing prompt editor extended to all selected reference media kinds. | Prompt completion tests cover exact stored mentions without runtime prompt rewriting. |
| R11 | Preserve the attached Config screenshot's three-pane Model, Input, Setup structure, omit Source Video and duplicated prompt content, and give each pane deliberate desktop proportions and spacing. Product write-up, `Config.png`, and implementation review feedback. | Shared video Config panel in `generation-request-editor`. | Desktop visual verification compares the three-pane layout, hierarchy, pane proportions, insets, row rhythm, selected states, and controls with the reference. |
| R12 | Preserve Preview Update, approval, exact request inspection, and freeze-before-live behavior without restoring the removed Shot Plan continuation pointer or Decision `0045`'s separate shot-video Preview path. Product clarification and Decisions `0045` and `0056`. | Existing shared generation Preview, ordinary spec creation, spec lifecycle, execution, provenance, request inspector, and an explicit Decision `0045` supersession notice. | Lifecycle and representative integration tests prove simulation stays mutable, every live attempt freezes before submission, changed requests use a new ordinary mutable spec, and current ADR history points to the shared Preview direction. |
| R13 | Associate a generation weakly with its Shot Plan for current authoring context and UI grouping only. User clarification. | Required `GenerationSpec.authoredFrom` envelope value persisted in nullable `authored_from_shot_plan_id`, with no foreign key; authoring context resolver and read-only grouping projection. | Tests prove missing/discarded plans never invalidate a spec, run, Asset, import, inspection, or deletion, and no Shot Plan stores a reverse pointer. |
| R14 | Show generated videos in the enabled Scene Generations tab using a shadcn accordion grouped by Shot Plan; deleted-plan videos appear under `Miscellaneous`, and the open projection refreshes after every Asset or Shot Plan mutation that changes its membership, title, ordering, or group kind. Product write-up, user clarification, and accepted review finding. | Core Scene projection, exact Scene video-generations resource key emitted by relevant Asset and Shot Plan mutations, thin HTTP route, Studio hook, local shadcn Accordion, and MediaCards. | Core projection/resource tests and Studio tests cover active groups, the miscellaneous group, empty state, ordering, Asset attach/discard/restore, and Shot Plan rename/Trash/restore/Empty Trash without manual reload. |
| R15 | Video cards hover-autoplay, delete through the existing Asset lifecycle, and open a large player with play/pause and scrubbing. Product write-up. | Existing `MediaCard`, existing generic Asset discard, and shared `VideoPreviewDialog` composed from `VideoPlayer`. | UI tests and desktop verification cover all three behaviors. |
| R16 | The Shot Plan CLI context must expose all current plan configuration, Shots, and Shot images. Product write-up. | Existing `renku shot-plan show`, plus an authored-from option on `renku generation context`. | CLI tests and `urban-basilica` verification prove the two focused commands provide full plan facts and the purpose guide. |
| R17 | Build only on the clean runtime baseline from Plan `0163`: keep adapters thin, use shadcn controls, preserve opaque prompts and media, and do not revive the failed UI, generic purpose, last-spec coupling, or obsolete Take-era runtime/workflow contracts. Hard repository architecture rules and accepted cleanup sequencing. | Core and Engines owners plus thin CLI/HTTP/React adapters. | Architecture tests, diff inspection, and the final shape review prove the boundaries and absence of stale runtime concepts. |
| R18 | Ad hoc images use the normal `image.create` Preview, and external image/audio/video files can be included as opaque request references. Product write-up. | Existing generic image Preview, safe project-file/asset-file resolution, video reference routing, and `media-producer`. | Skill and Preview tests cover reviewed ad hoc image creation and an external motion video routed without content inspection. |
| R19 | Preserve the researched provider-specific video guidance, prompt examples, negative fixtures, and eval scenarios while removing only obsolete Take-era workflow contracts and envelopes. User correction, Decisions `0041` and `0057`, and current video capability research. | `media-producer` provider-research references separated from the current Shot Plan workflow; its route-to-guide registry is a coverage index over Engines-activated routes, never a runtime activation source. | Sister-repository diff review maps every retired-path file to a refreshed successor or an explicit obsolete-contract deletion; Seedance and Kling research remains available, every active Engines route has current guide coverage, skill-only entries cannot activate a model, and current samples/evals contain no retired purpose, target, command, or lifecycle contract. |

## Product Behavior

### Agent-led workflow

For a Shot Plan video request, `media-producer`:

1. reads the exact current plan with:

   ```text
   renku shot-plan show --shot-plan <shot-plan-id> --json
   ```

2. reads the current `shot-plan.video-generation` generation context with the
   same weak source association:

   ```text
   renku generation context \
     --purpose shot-plan.video-generation \
     --target project \
     --authored-from-shot-plan <shot-plan-id> \
     --json
   ```

3. recommends an input method from the Shot Plan and available references;
   image-to-video is the normal recommendation when the user did not specify a
   method, but it is not a Core-enforced default;
4. creates any requested auxiliary reference image as its own image
   GenerationSpec, reviews it in Preview, obtains approval where required,
   executes it, and attaches the chosen result as a Project Asset;
5. creates an ordinary mutable `shot-plan.video-generation` GenerationSpec,
   setting `authoredFrom`, `shotPlanVideoInputMode`, the exact Seedance model
   route, ordered references, provider fields, parameters, and prompt mentions;
   the agent chooses relevant current Cast, Location, and Dialogue candidates
   from context while leaving Lookbook unselected unless the user or creative
   need calls for it;
6. shows the normal Generation Preview and cost estimate;
7. after user changes in Preview, reads the saved spec again and corrects the
   prompt and `promptMention` metadata to match the final provider array order;
8. obtains explicit live approval;
9. freezes immediately before the live request;
10. runs the exact frozen request through Renku-managed execution or an
    approved agent-external provider workflow; and
11. attaches each accepted result as an independent Project-owned
    `shot_plan_video` Asset with exact existing run or frozen-spec provenance.

Simulation and estimate do not freeze. A failed live request remains frozen.
If the user wants a changed request, the agent creates a new ordinary mutable
GenerationSpec from explicit current intent. Retrying the unchanged request
uses the same frozen spec. Shot Plans store no spec id, provide no continuation
command, and do not copy specs when a plan is copied.

### Skill research and activation boundary

The sister skill repository currently retains the researched video guidance
under `references/shot-video-take`, its samples, and its forward evals. The
folder mixes two different kinds of content that must not share one cleanup
decision:

1. **Durable provider and creative research:** provider-visible prompting,
   prompt-quality checks, Seedance route and audio guidance, Kling route/token
   research, golden prompts, negative fixtures, and reusable eval scenarios.
   This material is preserved, checked against current primary provider
   documentation, and re-homed under provider-neutral video-generation
   references.
2. **Obsolete executable workflow contracts:** `shot.video-take`,
   `shot.video-prompt`, Take targets, `sceneShotVideoTake`, last-spec or
   freeze-Take lifecycle instructions, old CLI examples, and JSON envelopes
   for retired purposes. These contracts are removed or rewritten directly to
   the current Shot Plan workflow; they are never kept as compatibility
   examples.

The Engines Studio video catalog is the only runtime activation boundary. It
initially registers only the nine Seedance routes accepted by R3. The sister
skill route-to-guide registry is a coverage index: it maps those Engines-owned
route identities to the instructions an executable workflow must load, but
runtime code never reads it to decide model support. Preserved Kling, Veo, and
other future-model research remains readable research but is not present in the
Engines activation catalog, current executable samples, current eval setup,
Core purpose context, or the Studio Config surface. Adding a provider guide or
registry row in the sister repository cannot make that provider executable.

The old `shot-video-take` paths disappear after their contents are classified
and moved. No alias, redirect, re-export, or fallback preserves those paths.
Before a provider guide becomes active, implementation rechecks the exact
route's fields, token notation, cardinality, duration, audio support, and source
provenance against primary vendor documentation and the current Engines
descriptor. Conflicting general marketing examples do not override the exact
route contract.

### Input modes and route behavior

`ShotPlanVideoInputMode` has exactly:

```ts
type ShotPlanVideoInputMode =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference';
```

The mode is explicit because first-frame and first-and-last-frame use the same
Seedance image-to-video route and cannot be recovered reliably from model
identity or current reference selection. It is not stored in `values`, because
that object remains the exact provider-field envelope rather than a home for
Studio authoring state.

The routing contract is:

| Input mode | Seedance route kind | Routed media fields |
| --- | --- | --- |
| `text-only` | text-to-video | no media field |
| `first-frame` | image-to-video | first-frame slot to `image_url` |
| `first-last-frame` | image-to-video | first-frame slot to `image_url`; last-frame slot to `end_image_url` |
| `reference` | reference-to-video | selected images to `image_urls`, videos to `video_urls`, and audio to `audio_urls`, each preserving GenerationSpec order |

Changing model family or input mode does not silently delete references.
References that cannot map to the selected route remain in the saved request
without a `providerField` and produce the existing structured unassigned-
reference diagnostics. The user or agent must remove them or choose a
compatible mode before execution.

Provider descriptors remain authoritative for required fields, accepted media
kinds, cardinality, duration limits, allowed aspect ratios, resolutions, audio
support, and cost. The Studio video catalog owns only the activated family
list, labels, order, exact route profiles, user-visible controls, and the 480p
product default. Core owns the durable input mode and maps it to the semantic
Engines route kind; it does not copy provider model ids or family membership.

Current `shot-plan.video-generation` purpose context, Studio model
availability, Preview, validation, and execution accept only routes in that
catalog. Generic Engines provider discovery remains intact for technically
implemented Kling, Veo, LTX, and other routes, but generic discovery is not
Studio activation. Adding a future model means adding one validated family or
route profile to the Engines Studio video catalog and its skill guide coverage;
it does not require another Core, CLI, React, or availability list.

The repeatable activation path for later models is:

1. implement or refresh the generic provider schema and adapter in Engines;
2. add the product-ready family and its supported semantic route profiles to
   `studio-video-model-catalog.ts`;
3. validate exact route capability, configurable fields, defaults, uniqueness,
   and availability derivation in Engines;
4. add sister-skill guide coverage keyed to those Engines route identities and
   compare it with current CLI JSON; and
5. let existing Core, CLI, Preview, and Studio consumers receive the new family
   through the derived catalog path.

A provider route that introduces a genuinely new workflow, such as video edit
or extension, requires a separate Core input-mode or purpose decision. It is not
activated by adding a provider-specific branch to the existing Shot Plan
workflow.

### Auxiliary image references

The three auxiliary purposes are:

| Purpose | Output | Target | Project Asset type | Meaning |
| --- | --- | --- | --- | --- |
| `shot-plan.video-first-frame` | image | Project | `shot_plan_video_first_frame` | Optional opening-frame candidate for one source Shot Plan |
| `shot-plan.video-last-frame` | image | Project | `shot_plan_video_last_frame` | Optional ending-frame candidate for one source Shot Plan |
| `shot-plan.video-storyboard` | image | Project | `shot_plan_video_storyboard` | Optional visual motion/editing guide for one source Shot Plan |

Each requires `authoredFrom.kind === 'shotPlan'` but does not create a foreign
key or plan-owned row. Assets are independently Project-owned, keep exact
generation provenance, have no selected/canonical state, and are discovered as
video reference candidates by purpose plus the stored weak source id.

Their image-generation reference guides reuse the same active Shot Plan
context:

- first-frame and last-frame authoring offers request-scoped Character Sheet
  and Location Sheet slots;
- video-storyboard authoring additionally offers the current Shot image files
  as optional request references; and
- the agent may add other exact references from the full Shot Plan report.

The guides do not automatically select those candidates or require them for a
valid saved draft.

The storyboard is opaque creative media. The agent may recommend a hand-drawn,
simple motion guide on a light gray or beige background, but Studio does not
require panels, captions, labels, arrows, shot coverage, readable text, or any
other visual content.

### Reference guide

When `shot-plan.video-generation` has
`authoredFrom: { kind: 'shotPlan', id }`, mutable authoring context may
best-effort resolve that Shot Plan and its Scene. The reference guide orders
sections as:

1. first-frame, last-frame, and video-storyboard slots;
2. one Character Sheet slot for each Cast Member in current Scene context;
3. one Location Sheet slot for each Location in current Scene context;
4. one Dialogue Audio slot for each relevant Scene Dialogue;
5. one Lookbook slot whose candidates combine the current Production and
   Storyboard Lookbook sheets; and
6. the existing Additional Media collection from the exact saved spec.

No candidate is preselected by the guide. Selection is request-scoped and does
not read or mutate canonical Profile, Hero, Lookbook card, Shot image, or other
display choices. Missing optional candidates produce guide notices, not hard
dependency failures.

The guide remains comprehensive agent-facing authoring context. The saved
Generation Preview does not render that entire superset. Core projects
unselected slots according to `shotPlanVideoInputMode`:

- text-only shows none;
- first-frame shows only First Frame;
- first-last-frame shows only First Frame and Last Frame;
- reference shows compatible available Video Storyboard, Dialogue Audio, and
  Lookbook media plus one named Cast and Location slot per Scene subject.

Cast and Location slots remain visible as subject-named empty MediaCards when
their sheet is missing. Dialogue Audio, Video Storyboard, and Lookbook slots
with no candidate stay quiet. Exact persisted selections and Additional Media
remain visible after an input-mode change so they can be removed.

External motion videos and ad hoc image/audio/video files remain opaque
`project-file` or exact `asset-file` references in the GenerationSpec. This
slice does not add a Studio file uploader or a generic attachment manager; the
agent may stage a safe project-relative file or generate an ad hoc image with
`image.create`, then include it as Additional Media.

### Generation Preview and Config

The existing Preview retains Prompt, References, and Config tabs. Its editable
and read-only modes continue to use one `GenerationRequestEditor`.

For managed video requests, Config uses a desktop three-column layout in the
requested order:

1. **Model** — Seedance 2.0, Seedance 2.0 Mini, and Seedance 2.0 Fast rows with
   selected state and duration capability;
2. **Input** — Text only, First frame, First + last frame, and Reference;
3. **Setup** — Duration, Aspect ratio, Resolution, and Generate audio controls
   supported by the exact route.

`Config.png` is the visual baseline for density, column separation, row
selection, uppercase section labels, and dark-panel hierarchy. The product
write-up's Model/Input/Setup ordering overrides the screenshot's original
Input/Model/Run Setup ordering. Source Video is not shown. The three panes
remain intact; refinements adjust only their proportions, internal insets, row
heights, and control alignment.

The Prompt tab is the only surface that displays or edits prompt content.
Config does not repeat the final or authored prompt. The existing Update action
persists prompt, model, mode, parameters, and slot changes atomically through
Core.

Reference cards behave as follows:

- every available image/video candidate renders directly as a MediaCard and
  opens the large media preview, while its selection toggle remains a separate
  control;
- no slot renders an invented `Choose` button or generic picker;
- selected slots can be deselected;
- image, video, and audio candidates use the same domain-neutral MediaCard;
- audio cards embed the existing `AudioPreview` player and expose the same
  explicit selection control; and
- Additional Media stays at the bottom and displays the exact saved request.

Prompt completion reads exact stored `promptMention` values for selected image,
video, and audio references. Image mentions keep the current rich thumbnail
preview; video and audio mentions use intentional media labels. Runtime code
does not scan, renumber, repair, or rewrite prompt text. Replacing a reference
in the same slot preserves its existing mention metadata. A newly selected
video-workflow reference does not receive an invented generic mention; the
agent rereads the final request and writes exact provider-ordinal metadata
before live execution.

### Weak association and Generations tab

`GenerationSpec.authoredFrom` is structurally required for
`shot-plan.video-generation` and the three Shot Plan video auxiliary purposes.
The envelope requires a non-empty Shot Plan id but deliberately does not
require a live matching Shot Plan row.

It is not:

- an Asset owner;
- a foreign key;
- a dependency edge;
- a plan snapshot;
- a selected/final video pointer;
- a cascade or discard rule;
- a reason to add a generic Project video generation purpose; or
- a reason to reject an otherwise valid spec, run, import, Asset read,
  request inspection, or Asset deletion when the plan is absent.

The Scene Generations read model includes only active Project-owned
`shot_plan_video` Assets whose exact managed run snapshot or frozen external
source spec has `purpose: 'shot-plan.video-generation'` and a Shot Plan
association that can be traced to the requested Scene.

Grouping is:

- an active Shot Plan row produces a group titled with its current plan title;
- a Shot Plan row that has been moved to Trash still supplies its Scene id but
  does not supply a visible group title, so all such videos appear in one
  `Miscellaneous` group at the end;
- restoring the plan naturally returns its videos to the named group;
- multiple successful video Assets may appear under one plan;
- groups contain newest videos first and active plan groups follow the Scene's
  normal Shot Plan ordering; and
- plans with no attached videos do not produce empty accordion sections.

Normal Studio deletion is recoverable Trash deletion, so a deleted plan row is
available for the miscellaneous projection while its active Shot Plan Trash
item remains restorable. Empty Trash may retain internal discarded tombstone
rows for lifecycle bookkeeping, but the garbage-collected Trash item is no
longer recoverable context. The weak id is intentionally not converted into
another durable Scene link: the video remains a valid Project Asset, but cannot
be manufactured into a scene-scoped group after permanent removal.

The Generations tab has:

- an enabled `generations` Scene tab and URL/Studio-selection value;
- a loading state, structured error state with Retry, and a quiet empty state;
- a local shadcn Accordion that permits multiple groups to be expanded and
  opens the first group initially;
- `MediaCardGrid` within each group;
- video MediaCards using existing muted hover playback;
- no visible raw filename, Asset id, source id, or invented generic label;
- meaningful Asset titles only when current data supplies them;
- the existing generic Asset discard command behind Delete;
- click-to-open `VideoPreviewDialog` with the shared `VideoPlayer`; and
- a separate inspect corner action that opens the existing read-only
  Generation Request inspector for the Asset file's exact provenance.

## Explicit Non-goals

This plan does not add:

- a generic `video.create` purpose or a generic user-callable video workflow;
- Shot Plan-owned videos or video rows;
- Generation, GenerationAttempt, Take, Clip, timeline, edit, or render tables;
- a selected, approved, final, or canonical Shot Plan video;
- dependency graphs, invalidation, reconciliation, plan snapshots, or cascade
  lifecycle behavior;
- automatic prompt generation, prompt repair, reference-token rewriting, image
  inspection, storyboard validation, or semantic media analysis;
- automatic shot-to-storyboard panel mapping;
- automatic duration segmentation or stitching for requests over 15 seconds;
- Kling, Veo, Grok, LTX, source-video/edit-video, extend-video, or additional
  provider families in the Studio Config surface;
- activation of preserved Kling, Veo, or other future-model research in the
  current skill coverage registry, executable samples, or supported workflow;
- a general Studio media uploader or Additional Media picker;
- a second Preview or a video-only request inspector;
- reuse, migration, or salvaging of the failed Shot AI Production UI removed
  by Plan `0163`;
- `ShotPlan.lastGenerationSpec`, a spec foreign key, a reverse pointer,
  continuation command, or copy-on-plan-copy behavior;
- mobile layouts or mobile verification;
- compatibility aliases for retired Take-era purpose names, target shapes,
  commands, executable envelopes, lifecycle rules, or skill paths; or
- final movie rendering or timeline assembly.

## Context And Current Evidence

### Accepted decisions and documentation

This plan is constrained by:

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0045-use-generation-preview-purpose-bindings.md`;
- `docs/decisions/0049-use-request-scoped-generation-reference-choices.md`;
- `docs/decisions/0051-keep-generation-authoring-incomplete-and-reference-slots-agent-directed.md`;
- `docs/decisions/0053-use-one-configurable-studio-media-card.md`;
- `docs/decisions/0054-use-string-resource-keys-for-studio-projection-invalidation.md`;
- `docs/decisions/0055-preserve-agent-external-generation-specs-on-images.md`;
- `docs/decisions/0056-freeze-generation-specs-at-live-execution.md`;
- `docs/decisions/0057-use-model-routed-human-readable-generation-prompts.md`;
- `docs/decisions/0061-use-mutable-copy-and-freeze-shot-plans.md`;
- `docs/decisions/0062-detach-shot-plans-from-generated-video-assets.md`;
- `docs/decisions/0064-use-exclusive-asset-membership-and-scoped-selection.md`;
- `docs/decisions/0065-use-bounded-adaptive-media-card-mosaics.md`;
- `docs/decisions/0066-use-semantic-media-card-preview-and-collection-dialogs.md`;
- `docs/decisions/0068-remove-stale-shot-video-generation-scaffolding.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- `docs/architecture/video-generation-model-capabilities.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/studio-server-hono.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/architecture/front-end-guidelines.md`; and
- `docs/product/design-guidelines.md`.

The new decision is recorded in
`docs/decisions/0069-use-shot-plan-video-generation-with-weak-context.md`.
Decision `0068`, introduced by prerequisite Plan `0163`, removes the failed
UI, generic purpose, generic Project-video destination, and last-spec
coupling. Decision `0069` adds only the new specific purpose, explicit input
mode, one Engines Studio video activation catalog, shared media-kind Preview
authoring, best-effort current authoring context, read-only Scene grouping, and
exact projection invalidation. It does not change Project Asset ownership,
provenance, execution, request inspection, or deletion independence.

### Related and prerequisite plans

The implementation must build on, not duplicate:

- prerequisite active Plan
  `0163-remove-stale-shot-video-ui-and-generation-scaffolding.md`, which must
  be implemented and verified first for the Studio runtime, schema, UI, and
  current repository documentation; its attempted sister-skill deletion is not
  a prerequisite because the user restored that repository to preserve
  provider research;
- `0155-detach-shot-plans-from-generated-video-assets.md`;
- `0156-shot-plan-authoring-cli-and-agent-skills.md`;
- `0157-shot-plans-studio-ui.md`;
- `0159-unified-asset-ownership-and-selection-scopes.md`; and
- `0160-reusable-media-card-preview-and-collection-dialogs.md`.

Plan `0154-video-shot-plans-and-generation-attempts-core-model.md` contains the
retired attempt/take direction and is historical evidence only. It is not a
contract to preserve.

### Repository evidence

- before prerequisite cleanup, `packages/core/src/client/generation.ts` still
  owns the obsolete generic `video.create` purpose; Plan `0163` removes it and
  its only attachment/file-destination path rather than reusing it here;
- the post-cleanup generation architecture still owns Project targets, ordered
  references, `promptMention`, and `GenerationSpec.authoredFrom`;
- `media_generation_spec.authored_from_shot_plan_id` already persists the weak
  source id without a foreign key and has an index. No new association table or
  column is needed;
- prerequisite Decision `0068` removes the obsolete
  `shot_plan.generation_spec_id` foreign key and last-spec commands while
  preserving `GenerationSpec.authoredFrom` as the only weak source context;
- Project-owned Assets and exact source-spec/run provenance remain the accepted
  attachment architecture;
- `packages/core/src/server/generation-preview-resource` already projects and
  updates the shared editor, but its authoring branch is image-specific and
  must become a small media-kind strategy boundary.
- `packages/engines/src/generation/studio-image-model-catalog.ts` is the
  accepted precedent for a curated Studio model family catalog backed by exact
  provider schema descriptors.
- `packages/engines/src/generation/studio-model-availability.ts` currently
  contains a second authored video policy in
  `CURATED_VIDEO_MODEL_PREFIXES`, `videoModelOrder`, and
  `isAcceptedVideoModel`. Its only production caller is Core
  `generation/purposes.ts`, which needs an Engines-owned common availability
  query but does not need or justify a second video inventory. This plan keeps
  that query, deletes the authored video policy, and derives every video row,
  label, and order from the new Studio video catalog.
- the installed fal catalog already has full, Mini, and Fast Seedance 2.0
  text-to-video, image-to-video, and reference-to-video routes.
- current detailed fal Seedance API references define exact `@ImageN`,
  `@VideoN`, and `@AudioN` tokens, image-to-video first/last fields, reference
  arrays, duration limits, and media cardinality. Engines descriptors remain
  runtime truth if vendor prose differs.
- `packages/core/src/server/generation/attachments.ts` already requires exact
  managed-run or frozen external-spec provenance for product purposes; this
  plan adds the same requirement for `shot-plan.video-generation`.
- `packages/studio/src/features/generation-request-editor` and
  `generation-request-inspector` already share one editor.
- `MediaCard` already supports muted hover playback and recoverable delete
  actions; `VideoPlayer` already supports play/pause and scrubbing.
- `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx` already
  renders a visible but disabled Generations tab.
- no local Accordion primitive exists, but the current `radix-ui` dependency
  includes Accordion; no dependency installation is required.
- the failed `shot-ai-production-*`, `shot-video-preview`, and
  `ShotGeneration*` contracts have no production caller and are removed by
  Plan `0163`; this plan uses `Config.png` as a visual reference and builds the
  shared video Config from current contracts without moving or copying the old
  implementation.

Implementation must recheck the primary external references immediately before
coding provider or migration contracts:

- [fal Seedance 2.0 reference-to-video API](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video/api)
- [fal Seedance 2.0 image-to-video API](https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api)
- [Drizzle SQLite migration guidance](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/sqlite/migrations.mdx)

### Real project evidence

Read-only inspection of `/Users/keremk/renku-movies/urban-basilica` found:

- current Shot Plan `shot_plan_37a3r9yz` for Scene `scene_zp6ysnpy`;
- one current Shot with a selected Shot image;
- no current legacy `video.create` specs or attached Project videos;
- current Character Sheet, Location Sheet, Dialogue Audio, Production
  Lookbook, Storyboard Lookbook, Scene Storyboard, and Shot image media suitable
  for realistic reference-guide verification; and
- schema generation `53`, ending at Drizzle migration `0067`, before the
  prerequisite cleanup migration.

Plan `0163` first advances the disposable verification copy to schema
generation `54` while dropping the obsolete Shot Plan foreign key. This plan
then needs a normal generated migration for the new
`shot_plan_video_input_mode` column and advances generation `54` to `55`.
There is no legacy video-spec conversion or compatibility reader.

### Sister-skill evidence

`/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer` owns
the generic Preview, approval, freeze, live execution, and attachment workflow.
The repository has been restored to its last commit after the earlier cleanup
attempt, so its dormant video material is present and must be treated as source
evidence for this plan.

The `references/shot-video-take/index.md` header calls the material a
"retained design reference" and requires contract revalidation before
reactivation. Commit `51122cb` likewise describes the Shot video production
skills as temporarily removed from active use rather than disposable research.
The current tree contains:

- shared provider-visible prompting and prompt-quality guidance;
- Seedance endpoint selection, text-only, first-frame, first/last-frame,
  reference, storyboard-reference, and native-audio guides;
- Kling route, field, token, and audio/voice research with dated source
  provenance;
- mixed `index`, Renku workflow, director handoff, and audio/voice documents
  whose reusable orchestration or provider facts must be separated from retired
  Take lifecycle instructions;
- Seedance golden prompts and bad-prompt fixtures;
- JSON examples for Seedance storyboard, first/last-frame, first-frame,
  storyboard-reference, motion-annotation, generic image, and a retired
  `video.create` request; and
- Shot-video forward eval scenarios.

Those files mix durable research with obsolete executable contracts. References
to `shot.video-take`, `shot.video-prompt`, `shot.first-frame`, Take targets,
`sceneShotVideoTake`, old continuation/freeze rules, and the generic
`video.create` sample are not current contracts. Provider behavior, prompt
craft, golden/negative examples, source provenance, and reusable eval intent
remain valuable under Decisions `0041` and `0057`.

This plan therefore owns an explicit classify-refresh-re-home pass. It removes
the old paths only after each file has either a named current successor or a
documented obsolete-contract deletion. It does not preserve old paths or old
envelopes as compatibility material.

The migration inventory is:

| Current source | Required treatment and successor |
| --- | --- |
| `references/shot-video-take/index.md`, `renku-workflow.md`, and `director-handoff.md` | Rewrite reusable orchestration into `references/shot-plan-video/index.md` and `workflow.md`; remove Take creation, cloning, continuation, and freeze rules. |
| `references/shot-video-take/audio-and-voice.md` | Split provider facts into the refreshed Seedance `native-audio.md` and Kling `index.md`; move current approval/execution sequencing into the Shot Plan workflow. |
| `references/shot-video-take/provider-visible-prompting.md` | Move to `references/video-generation/provider-visible-prompting.md` and refresh provider-token claims. |
| `references/shot-video-take/prompt-quality-checklist.md` | Move to `references/video-generation/prompt-quality-checklist.md`; preserve it as agent-owned creative review, not runtime validation. |
| `references/shot-video-take/seedance/*.md` | Re-home one-for-one under `references/video-generation/models/seedance-2.0/`, using the current mode names in the Architecture Shape Gate and refreshing exact route facts. |
| `references/shot-video-take/kling/index.md` | Re-home as inactive research at `references/video-generation/models/kling/index.md`, refresh dated provenance, and do not add a registry entry. |
| `samples/shot-video-take/seedance-golden-prompts.md` and `seedance-bad-prompt-fixtures.md` | Preserve and relabel under `samples/shot-plan-video/`; remove only obsolete Take/purpose framing. |
| `samples/shot-video-take/seedance-storyboard-final-spec.json` | Rewrite as `samples/shot-plan-video/seedance-storyboard-video-spec.json` using `shot-plan.video-generation`, Project target, `authoredFrom`, `reference` input mode, current placements, and current lifecycle. |
| `samples/shot-video-take/shot-first-frame-spec.json` | Rewrite as `samples/shot-plan-video/video-first-frame-spec.json` using `shot-plan.video-first-frame`, Project target, and `authoredFrom`. |
| `samples/shot-video-take/motion-annotation-storyboard-reference-spec.json` and `storyboard-reference-image-spec.json` | Rewrite as `samples/shot-plan-video/video-storyboard-motion-annotation-spec.json` and `video-storyboard-cinematic-spec.json` using `shot-plan.video-storyboard`; preserve the distinct creative approaches. |
| `samples/shot-video-take/shot-reference-image-spec.json` | Move to `samples/shot-plan-video/additional-image-reference-spec.json`; retain its current `image.create` envelope and reusable prompt, changing only stale workflow framing. |
| `samples/shot-video-take/first-last-frame-final-spec.json` | Preserve the useful Veo example as non-executable research at `references/video-generation/models/veo-3.1/first-last-frame-example.md`; discard its retired JSON envelope. |
| `evals/shot-video-take/forward-test-cases.md` | Rewrite reusable scenarios into `evals/shot-plan-video/forward-test-cases.md` against current workflow and safety boundaries. |
| `samples/video-create-spec.json` | Delete with no successor because the generic executable purpose is intentionally obsolete. |

## Architecture Decisions

### Reuse, refactor, or introduce

1. **Reuse unchanged:** generic spec lifecycle, run execution, estimate,
   attachment provenance infrastructure, Project Asset ownership, Asset Trash
   lifecycle, read-only request inspection, generic Engines provider
   discovery/adapters, MediaCard, collection dialog, prompt editor, and
   VideoPlayer. Reuse provider research as evidence, not as an executable
   contract.
2. **Refactor the current owner:** split image-specific Preview authoring into a
   bounded media-kind strategy and add video beside image; extend existing
   purpose context and reference-guide builders with the optional weak source;
   replace the independently curated video branch of
   `studio-model-availability.ts` with a projection of the one Studio video
   catalog; add exact Scene video-generations invalidation to relevant existing
   Asset and Shot Plan mutations;
   separate provider/model research from current Shot Plan workflow guidance
   and refresh mixed examples to the new envelope.
3. **Introduce only where the current model cannot represent the requirement:**
   the `shot-plan.video-generation` purpose, explicit
   `shotPlanVideoInputMode`, a curated Studio video catalog, three auxiliary
   image purposes/destinations, a purpose-specific Shot Plan video destination,
   a Scene video-generation read model, a local Accordion primitive, and a
   shared VideoPreviewDialog.

No other new durable concept is justified.

### Skill content ownership

`media-producer` keeps three boundaries:

- `references/shot-plan-video` owns the current Renku workflow, current purpose
  names, Preview/approval/freeze/attachment sequence, and auxiliary-reference
  handoff;
- `references/video-generation` owns reusable provider-neutral prompt craft and
  provider/model research, including models that are not currently activated;
  and
- `video-model-guide-registry.json` maps only exact currently supported routes
  to the guide documents loaded for executable workflows.

Samples and evals under `shot-plan-video` are current executable fixtures and
must use current purpose, target, source, route, and lifecycle contracts.
Unsupported-provider examples may remain only as clearly labeled research
examples outside that executable fixture set. The registry is not a second
activation catalog: it references Engines-owned route identities only to prove
guide coverage, runtime code never consumes it for availability, and a
skill-only entry cannot activate a route. It does not duplicate provider
schemas or capabilities, and research documents never override Engines
descriptors or the Studio video catalog.

### Weak-source rule

The weak Shot Plan association is stored once in `GenerationSpec.authoredFrom`.
Mutable authoring may resolve only an active current plan; a missing or
discarded plan produces stale-context guidance. The Scene projection may also
read a discarded plan row solely to recover its Scene id for the
`Miscellaneous` group. All execution validation uses the saved request and
resolved media, not live plan contents. Exact request inspection uses the
frozen spec or run snapshot and does not resolve current plan state.

### Opaque creative artifacts

Core may validate the input mode, provider field routing, model schema,
reference identities, media kinds, MIME types, counts, duration, safe paths,
cost, approval token, and provenance. It may not validate whether prompts,
images, audio, video, or storyboards creatively represent the Shot Plan.

## Architecture Shape Gate

### Package ownership and public entrypoints

#### `packages/engines`

Own provider-schema-backed Studio video family selection in:

- `src/generation/studio-video-model-catalog.ts`
- `src/generation/studio-video-model-catalog.test.ts`
- existing `src/generation/studio-model-availability.ts`
- existing `src/generation/studio-model-availability.test.ts`

The existing `src/generation/index.ts` remains the bounded public entrypoint and
exports the deliberate catalog types/read functions and the existing common
availability query. It contains no catalog rows, provider switches, or
validation logic.

The catalog initially has three families. Each family maps the Engines-local
route kinds `text`, `image`, and `reference` to exact fal model ids and declares
only Duration, Aspect ratio, Resolution, and Generate audio as
user-configurable. Future models are added to this same catalog only after
their exact provider descriptors and skill-guide coverage are ready; no second
availability list or provider-prefix registry is added.

`listStudioModelAvailability` remains because Core has one current production
need for a common Engines-owned availability shape across image, audio, and
video. It is a derived query, not a catalog. Its video branch flattens
`listStudioVideoModelFamilies()` and authors no video prefixes, accepted-model
rules, labels, or ordering of its own. Delete
`CURATED_VIDEO_MODEL_PREFIXES`, `videoModelOrder`, `isAcceptedVideoModel`, and
the duplicated broad-video inventory assertions in the current availability
test. Generic provider discovery remains unchanged and is not used as a
fallback when a route is absent from the Studio video catalog.

Core maps its durable four input modes to the three Engines route kinds; Engines
does not duplicate the Core input-mode contract, and Core does not copy model
ids or family membership.

#### `packages/core`

Core owns:

- the durable GenerationSpec input-mode envelope;
- purpose and authored-context validation;
- video route selection and reference routing;
- auxiliary purpose attachment and Project file destinations;
- current Shot Plan authoring context/reference guides;
- exact source-provenance grouping of Project video Assets; and
- resource invalidation keys.

Public callers use:

- `GenerationSpec`, `ShotPlanVideoInputMode`, the discriminated
  `GenerationPreviewAuthoring`, and Scene video-generation projection types
  from `@gorenku/studio-core/client`;
- existing generation service methods with the narrowed additional inputs; and
- `listSceneShotPlanVideoGenerations` through `ProjectDataService`.

Expected focused internal modules are:

```text
packages/core/src/server/generation/
  shot-plan-video-model-authoring.ts
  shot-plan-video-configurable-values.ts
  shot-plan-video-reference-routing.ts
  authored-shot-plan-context.ts
  purposes/
    shot-plan-video-generation.ts
    shot-plan-video-first-frame.ts
    shot-plan-video-last-frame.ts
    shot-plan-video-storyboard.ts
  reference-slots/
    shot-plan-video-references.ts

packages/core/src/server/generation-preview-resource/
  authoring-strategies/
    image.ts
    video.ts
    none.ts
    registry.ts

packages/core/src/server/shot-plan-video-generations/
  projection.ts
  source-provenance.ts

packages/core/src/server/project-asset-files/destinations/
  shot-plan-video.ts
  shot-plan-video-reference-image.ts
```

The authoring strategy registry is keyed only by output media kind and maps to
three small strategies: image, video, and none. It may select a strategy; it may
not become a purpose/provider dispatcher.

`generation-preview-resource/update.ts` remains the transaction-facing
orchestrator but delegates model resolution, configurable-value validation,
and media reference routing to the selected strategy. If its managed branch
still contains image and video implementations inline, the gate has failed.

`generation/purposes.ts`, destination registries, project-data wiring, and
package `index.ts` files remain thin registries or entrypoints.

#### `packages/cli`

CLI owns parsing and serialization only:

- add `authoredFromShotPlan?: string` to `GenerationCommandFlags`;
- parse `--authored-from-shot-plan <id>` only for `generation context`;
- pass `{ kind: 'shotPlan', id }` to Core; and
- render Core's structured result unchanged in JSON mode.

No Shot Plan lookup, route selection, candidate selection, or provider-specific
business logic belongs in CLI handlers.

#### `packages/studio`

The Studio server owns thin HTTP transport:

```text
GET /studio-api/projects/:projectName/screenplay/scenes/:sceneId/video-generations
```

The route calls `listSceneShotPlanVideoGenerations`, projects safe Asset file
URLs, serializes the Core grouping, and translates structured errors. Video
deletion continues to use the existing Asset DELETE route.

Frontend ownership is:

```text
src/features/generation-request-editor/
  generation-request-video-config-panel.tsx
  generation-request-video-model-list.tsx
  generation-request-video-input-list.tsx
  generation-request-video-setup.tsx

src/features/movie-studio/shot-plan-video-generations/
  scene-shot-plan-video-generations-tab.tsx
  shot-plan-video-generation-group.tsx
  use-scene-shot-plan-video-generations.ts

src/services/
  studio-shot-plan-video-generations-api.ts
  studio-shot-plan-video-generations-contracts.ts

src/ui/
  accordion.tsx
  video-preview-dialog.tsx
```

The feature folder consumes the Core projection and sends Asset-discard intent.
It does not resolve provenance, decide group membership, read Shot Plans, or
interpret generation prompts.

Every form or interactive control uses local shadcn-style primitives. No raw
`button`, `input`, `select`, `textarea`, or `dialog` is added in feature code.
Semantic tables/sections are allowed for structure.

#### `studio-skills`

`media-producer` owns current Shot Plan workflow guidance, reusable video prompt
craft, provider/model research, examples, and evals. Workflow contracts and
provider research live in separate folders so retiring one workflow cannot
erase the research library. A small route-to-guide data file keeps guide
coverage out of a monolithic provider switch in `SKILL.md`; the Engines Studio
video catalog remains the runtime activation boundary:

```text
skills/media-producer/references/shot-plan-video/
  index.md
  workflow.md

skills/media-producer/references/video-generation/
  provider-visible-prompting.md
  prompt-quality-checklist.md
  models/
    seedance-2.0/
      index.md
      endpoint-selection.md
      text-only.md
      first-frame.md
      first-last-frame.md
      reference.md
      storyboard-reference.md
      native-audio.md
    kling/
      index.md
    veo-3.1/
      first-last-frame-example.md

skills/media-producer/references/video-model-guide-registry.json
skills/media-producer/samples/shot-plan-video/
skills/media-producer/evals/shot-plan-video/
```

The current registry maps exactly the nine Engines-activated Seedance routes
to guide documents. Kling and any other preserved model research remain outside
the registry until a later accepted plan adds that model to the Engines Studio
video catalog. Validation proves that every Engines-activated route has one
current guide mapping and that every mapping references an active Engines route
and an existing file. The registry never drives runtime model discovery,
validation, Preview, or execution. The cross-repository coverage check compares
the registry with current JSON output from:

```text
renku generation model list \
  --purpose shot-plan.video-generation \
  --json
```

It does not check in a generated copy of the Engines catalog. Validation may
also check that current JSON fixtures conform to current envelopes; it must not
semantically score, freeze, or rewrite creative prompt content.

The move is direct: old `references/shot-video-take`,
`samples/shot-video-take`, and `evals/shot-video-take` paths are deleted after
classification. No compatibility alias, redirect, re-export, or duplicate copy
remains.

### Existing files that shrink or disappear

- `studio-model-availability.ts` loses its authored video prefixes, family
  labels, order, and acceptance helpers; its video branch becomes a projection
  of `studio-video-model-catalog.ts`.
- `studio-model-availability.test.ts` loses the separate broad video-family
  inventory and instead proves the derived availability result equals the
  flattened Studio video catalog.
- `generation-preview-resource/authoring.ts` shrinks to shared projection and
  reference-routing coordination or disappears into the strategy folder.
- `generation-preview-resource/update.ts` loses its inline image-only route and
  configurable-value implementation.
- no failed Shot AI Production, `ShotGeneration*`, generic `video.create`, or
  last-spec production path should exist at the start of this plan; if one
  remains, stop and complete the runtime portion of prerequisite Plan `0163`
  rather than importing, moving, wrapping, or adapting it.
- the sister repository's old `shot-video-take` reference, sample, and eval
  paths disappear in Slice 6 only after reusable research and scenarios have
  named successors; `samples/video-create-spec.json` disappears because its
  executable contract is obsolete.
- no compatibility re-export, alias, facade, or wrapper recreates the removed
  paths.

### Forbidden implementation shapes

Stop implementation and revise this plan if it starts to produce:

- a Shot Plan video table, attempt entity, selected-video field, or dependency
  service;
- a Core service that snapshots or validates creative Shot Plan content;
- a broad purpose/provider/mode switch inside Preview update;
- a second authored Studio video-model list in availability, Core, CLI, React,
  or the sister-skill registry;
- prefix-based Studio video activation or fallback to generic provider
  discovery when a route is absent from the Studio video catalog;
- duplicated image and video Preview editors;
- React grouping based on raw specs, Assets, or current Shot Plans;
- server or CLI business rules for source-plan validity, provider routing, or
  media eligibility;
- a generic state-patch command for GenerationSpec or Shot Plan metadata;
- a reverse GenerationSpec id on Shot Plan, a plan-to-spec foreign key, a
  continuation command, or spec copying during Shot Plan copy;
- source-text architecture tests containing private helper/function names;
- runtime compatibility for `video.create`, Take-era names, the failed UI, or
  missing `shotPlanVideoInputMode`;
- wholesale deletion of provider research because its current folder or
  examples also contain obsolete workflow names;
- registration or executable-fixture use of Kling, Veo, or another model that
  is outside the accepted Seedance Studio catalog;
- prompt parsing, token renumbering, storyboard inspection, or semantic media
  validation;
- a raw interactive HTML control in Studio feature code; or
- an `index.ts` that contains domain logic rather than exports.

### Shape stop conditions

Pause before continuing if:

- `update.ts`, a purpose registry, or a route begins owning routing,
  validation, persistence, and projection together;
- the Scene projection begins mutating Assets or Shot Plans;
- a candidate-guide builder begins enforcing dependency or lifecycle rules;
- the skill registry begins encoding creative quality judgments;
- implementation attempts to reuse production code or runtime contracts deleted
  by prerequisite Plan `0163`;
- a sister-skill file is deleted without a named re-homed successor or an
  explicit finding that its contents are only an obsolete executable contract;
- preserved unsupported-model research appears in the skill coverage registry,
  current samples/evals, purpose context, or Studio Config;
- a model can be activated by changing `studio-model-availability.ts`, Core,
  Studio, CLI, or a skill guide without adding its validated route profile to
  the Engines Studio video catalog;
- the Generations tab needs additional durable state to render current
  successful video Assets; or
- a checklist item can be claimed only by accepting a god file, parallel
  contract, or compatibility layer.

## Public Contracts

### GenerationSpec and storage

Add to `packages/core/src/client/generation.ts`:

```ts
export type ShotPlanVideoInputMode =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference';

export interface GenerationSpec {
  // existing fields
  shotPlanVideoInputMode?: ShotPlanVideoInputMode;
}
```

Envelope rules:

- `shot-plan.video-generation` requires `shotPlanVideoInputMode`;
- the three image auxiliary purposes forbid it;
- every non-video purpose forbids it;
- `shot-plan.video-generation` requires
  `authoredFrom: { kind: 'shotPlan', id }`;
- the three auxiliary purposes require a non-empty Shot Plan source id; and
- absence or discard of the source row is not an envelope error.

Add nullable `shot_plan_video_input_mode` to `media_generation_spec`. Update
insert, update, equality, freeze, list, and read projections directly.
Run Drizzle Kit to generate `0069_shot_plan_video_generation.sql` and advance
`PRAGMA user_version` from `54` to `55`. Existing non-Shot-Plan-video rows stay
null. There are no current `urban-basilica` video specs to convert.

`media_generation_run.spec_snapshot_json` already captures the field and needs
no schema change.

### Engines video catalog

Add:

```ts
type StudioVideoRouteKind = 'text' | 'image' | 'reference';

interface StudioVideoModelFamily {
  id: string;
  label: string;
  routes: Partial<Record<StudioVideoRouteKind, StudioVideoModelRouteProfile>>;
}

interface StudioVideoModelRouteProfile {
  provider: 'fal-ai';
  model: string;
  userConfigurableParameters: StudioModelConfigurableParameter[];
}
```

Extend the existing configurable-parameter contract with an optional
`initialValue` used for the catalog-owned 480p default. Catalog validation
proves every exact route exists, is video output, declares only real non-media
non-prompt fields, supports its route kind, and accepts every configured
initial value. Family ids are ordinary deliberate catalog identities rather
than a separately maintained three-value type union. The initial Seedance
families define all three route kinds; a future family may omit a route kind it
does not support, and Preview reports that mode unavailable instead of adding a
provider-specific branch.

Public read functions mirror the deliberate image catalog API:

- `listStudioVideoModelFamilies()`
- `readStudioVideoModelFamily(familyId)`
- `readStudioVideoModelRouteProfile({ provider, model })`

Keep the existing public `listStudioModelAvailability` query, but change its
video implementation to flatten `listStudioVideoModelFamilies()`. It must not
contain an authored prefix, label, order, or accepted-model inventory. Its
image branch continues to derive from the image catalog and its audio behavior
remains unchanged. The only current production caller remains Core
`generation/purposes.ts`.

`shot-plan.video-generation` model listing, Preview, validation, and execution
use the catalog-backed availability and exact route-profile reads. Core maps
its input mode to `StudioVideoRouteKind` and never owns provider model ids.
Generic Engines `catalog/model-discovery.ts` continues to list all technically
implemented video descriptors; that capability inventory is not Studio product
support and is never a fallback for a missing Studio route profile.

### Preview authoring

Replace the image-assuming authoring object with a discriminated current
contract:

```ts
type GenerationPreviewAuthoring =
  | { kind: 'none' }
  | {
      kind: 'image';
      selectedModelFamilyId: string;
      modelFamilies: GenerationPreviewModelFamily[];
      controls: GenerationEditorControl[];
    }
  | {
      kind: 'video';
      selectedModelFamilyId: string;
      modelFamilies: GenerationPreviewVideoModelFamily[];
      selectedInputMode: ShotPlanVideoInputMode;
      inputModes: GenerationPreviewVideoInputMode[];
      controls: GenerationEditorControl[];
    };
```

`GenerationPreviewVideoModelFamily` includes `familyId`, label, availability,
and the duration capability label for the selected mode.
`GenerationPreviewVideoInputMode` includes id, label, and availability. Only
the four accepted modes are projected.

Update input adds:

```ts
shotPlanVideoInputMode?: ShotPlanVideoInputMode;
```

Core requires it for managed video Preview updates and rejects it for image
Preview updates. External request updates remain prompt/reference-only and do
not expose model Config authoring.

### Purpose authoring context

Extend `BuildGenerationPurposeInput` and the corresponding ProjectDataService
input with:

```ts
authoredFrom?: GenerationSpecAuthoredFrom;
```

`buildGenerationPreview` and editable Preview Update pass the saved spec's
source. CLI context passes the explicitly parsed flag. The read-only
Asset-file request inspector does not resolve current authored context.

Guide notices use stable codes:

- `CORE_GENERATION_AUTHORED_SHOT_PLAN_UNAVAILABLE`
- `CORE_GENERATION_OPTIONAL_REFERENCE_UNAVAILABLE`

They are warnings/guidance, not execution diagnostics or write rejection.

Boundary failures use structured codes:

- `CORE_SHOT_PLAN_VIDEO_INPUT_MODE_REQUIRED`
- `CORE_SHOT_PLAN_VIDEO_INPUT_MODE_FORBIDDEN`
- `CORE_SHOT_PLAN_VIDEO_MODEL_FAMILY_INVALID`
- `CORE_SHOT_PLAN_VIDEO_MODEL_ROUTE_UNAVAILABLE`
- `CORE_SHOT_PLAN_VIDEO_PARAMETER_INVALID`
- `CORE_SHOT_PLAN_VIDEO_AUTHORED_SOURCE_REQUIRED`
- `ENGINES_STUDIO_VIDEO_MODEL_CATALOG_INVALID`

Existing provider-envelope diagnostics remain authoritative for missing media,
unsupported values, cardinality, duration, MIME type, and unresolved media.

### Auxiliary attachment and file paths

Add destination:

```ts
{ kind: 'shotPlan.video'; titleHint?: string }
{ kind: 'shotPlan.videoReferenceImage'; titleHint?: string }
```

The focused resolvers store output videos and auxiliary images under:

```text
videos/
videos/references/
```

The attachment destination registry maps `shot-plan.video-generation` to the
video destination, Project ownership, Asset type `shot_plan_video`, media kind
`video`, and exact provenance. When that provenance resolves a source Shot Plan
and Scene, attach/discard/restore emits the exact Scene video-generations
resource key. It maps all three auxiliary purposes to the reference-image
destination, Project ownership, their deliberate Asset types, media kind
`image`, and exact provenance; auxiliary Assets do not emit the Scene
video-generations key because they are not members of that projection.

### Scene Generations projection

Add client contracts:

```ts
interface SceneShotPlanVideoGenerations {
  sceneId: string;
  groups: ShotPlanVideoGenerationGroup[];
  resourceKeys: string[];
}

type ShotPlanVideoGenerationGroup =
  | {
      kind: 'shotPlan';
      shotPlan: { id: string; title: string };
      assets: Asset[];
    }
  | {
      kind: 'miscellaneous';
      assets: Asset[];
    };
```

Add ProjectDataService:

```ts
listSceneShotPlanVideoGenerations(
  input: ShotPlanProjectInput & { sceneId: string }
): Promise<SceneShotPlanVideoGenerations>;
```

The projection reads active Project-owned `shot_plan_video` Assets, resolves
the exact source request through existing provenance APIs, and reads Shot Plan
rows plus their active Trash state only to determine Scene and group kind. An
active row produces its named group. A discarded row produces
`Miscellaneous` only while its Shot Plan Trash item remains active and
restorable. A garbage-collected Trash item supplies no Scene context even if an
internal discarded tombstone row remains. The projection never falls back to
Asset title, filename, path, a reverse Shot Plan pointer, or a matching model.

Add:

```ts
studioSceneVideoGenerationsResourceKey(sceneId: string): string
```

The key represents the exact Scene Generations projection, not a generic
Project Assets surface. The projection returns it in `resourceKeys`, and the
Scene Generations hook uses the shared matcher to reload.

Every mutation that can make the projection stale returns this key:

- `shot_plan_video` Asset attach, discard, and restore when exact provenance
  resolves the source Shot Plan and Scene;
- Shot Plan title changes, because group labels change;
- Shot Plan Trash and restore, because the group moves between its current
  title and `Miscellaneous`; and
- permanent Shot Plan removal through Empty Trash, using the Trash item's Scene
  owner before it is marked garbage-collected, because its videos cease to
  belong to any scene projection.

These Shot Plan mutations return the key in addition to their existing
`studioSceneShotPlansResourceKey(sceneId)` because both browser projections
become stale. A Project video whose weak source plan was already permanently
removed belongs to no Scene Generations projection and emits no invented Scene
key. Do not add `studioProjectAssetsSurfaceResourceKey` or another generic
Project Asset invalidation key: Studio still has no generic Project Assets
projection, and unrelated Project media must not refresh every Scene.

### Studio and selection contracts

Change:

```ts
type ScenePanelTab =
  | 'narrative'
  | 'beats'
  | 'shotPlans'
  | 'generations';
```

Update Core Studio selection validation/current projection, Studio URL parsing
and serialization, selection resolution, and tests directly. Do not keep the
local `SceneTabItem | 'generations'` workaround.

Studio service response types add safe browser URLs to the Asset files but
otherwise preserve Core group identity. The HTTP route is read-only. Delete
uses the existing:

```text
DELETE /studio-api/projects/:projectName/assets/:assetId
```

with owner `{ kind: 'project' }`.

## Implementation Slices

### Slice 1 — Confirm the cleanup prerequisite and record the new decision

Files:

- verify the runtime, schema, UI, and current-documentation completion gates in
  Plan `0163` before implementation starts;
- add `docs/decisions/0069-use-shot-plan-video-generation-with-weak-context.md`;
- add a concise discoverability notice to Decision `0068` that the specific
  workflow was subsequently introduced;
- add a concise discoverability notice to Decision `0045` that Decision `0069`
  supersedes its separate shot-video Preview route/helper clauses with shared
  media-kind Preview authoring and the existing exact request inspector; and
- leave historical ADR bodies unchanged.

Acceptance:

- the cleanup migration, deleted stale Studio runtime/UI files, and current
  repository docs are present before this plan adds new contracts;
- the restored sister-skill video research is present and inventoried as Slice
  6 input rather than deleted as a prerequisite;
- the ADR deliberately names `shot-plan.video-generation`, the explicit input
  mode, mutable authoring context, read-only grouping, execution, provenance,
  ownership, inspection, and deletion;
- the ADR records the one Engines Studio video activation catalog, derived
  availability query, shared media-kind Preview direction, and exact Scene
  video-generations invalidation boundary;
- Decisions `0045` and `0068` point to Decision `0069` with the exact narrowed
  or superseded scope while their historical reasoning remains unchanged;
- normal deleted-plan grouping and permanent Trash behavior are explicit; and
- no reverse pointer, continuation, dependency, or Shot Plan-coupled generation
  lifecycle language survives.

### Slice 2 — Persist explicit video input mode

Files:

- `packages/core/src/client/generation.ts`
- `packages/core/src/server/generation/spec-envelope.ts`
- `packages/core/src/server/schema/media-generation.ts`
- `packages/core/src/server/database/access/media-generation.ts`
- `packages/core/src/server/generation/specs.ts`
- ordinary GenerationSpec equality/lifecycle callers and focused tests
- generated Drizzle migration and snapshot/journal
- `packages/core/src/server/database/lifecycle/migration-0069.test.ts`

Work:

- add the contract and purpose rules;
- update every current caller directly;
- generate the migration with the repository Drizzle Kit config;
- preserve all current non-video rows and provenance;
- update current test fixtures rather than recognizing `video.create` or an
  obsolete video spec shape.

### Slice 3 — Establish one Studio video catalog and delete the duplicate policy

Files:

- add `packages/engines/src/generation/studio-video-model-catalog.ts`
- add focused catalog tests
- update `packages/engines/src/generation/studio-model-availability.ts`
- replace its duplicated video inventory tests
- update thin Engines generation/package entrypoints

Work:

- register the nine current fal routes: three families times text, image, and
  reference route kinds;
- keep family ids open to deliberate future catalog additions and allow a
  future family to omit unsupported route kinds without adding provider
  branches outside Engines;
- expose only Duration, Aspect ratio, Resolution, and Generate audio;
- set 480p as the initial resolution when accepted by the route;
- derive duration labels from exact descriptors;
- delete `CURATED_VIDEO_MODEL_PREFIXES`, `videoModelOrder`,
  `isAcceptedVideoModel`, and the independently authored broad-video inventory;
- keep `listStudioModelAvailability` as the one Engines-owned common query
  consumed by Core, but derive its video rows, labels, and order exclusively
  from `listStudioVideoModelFamilies()`;
- restrict current `shot-plan.video-generation` purpose context,
  purpose-scoped model listing, validation, and execution to catalog routes;
- keep generic provider discovery, schemas, and execution adapters unchanged
  for technically implemented models that are not yet Studio-activated; and
- add no compatibility branch, prefix fallback, Core family list, CLI list,
  React list, or skill-owned runtime activation path.

### Slice 4 — Add the specific video purpose, auxiliary purposes, and guide

Files:

- purpose modules and `purposes.ts`
- `authored-shot-plan-context.ts`
- `reference-slots/shot-plan-video-references.ts`
- focused Asset/provenance query helpers
- attachment destination registry
- `shot-plan-video.ts`, `shot-plan-video-reference-image.ts`, and the bounded
  file destination registry
- exact Scene video-generations resource-key emission for the video destination
- purpose, guide, attachment, file-path, and opaque-artifact architecture tests

Work:

- add `shot-plan.video-generation` with Project target, video output, required
  weak authored source, exact attachment provenance, and the purpose-specific
  Project video destination;
- add the three image purposes and independent Project attachment details;
- resolve an active Shot Plan best-effort for authoring and warn when it is
  missing or discarded;
- use current Scene Cast, Location, Dialogue, and Lookbook candidate helpers;
- give first/last image purposes Cast and Location slots and give the
  video-storyboard purpose optional current Shot image candidates;
- query auxiliary candidates by exact Asset provenance and source plan id;
- order the guide exactly as accepted;
- return warnings for unavailable optional context;
- do not select candidates or validate creative contents.

### Slice 5 — Refactor Preview authoring by media kind and add video

Files:

- `packages/core/src/client/generation-preview-resource.ts`
- `generation-preview-resource/authoring-strategies/*`
- `generation/shot-plan-video-model-authoring.ts`
- `generation/shot-plan-video-configurable-values.ts`
- `generation/shot-plan-video-reference-routing.ts`
- `generation-preview-resource/projection.ts`
- `generation-preview-resource/update.ts`
- generation service wiring and focused tests

Work:

- make `GenerationPreviewAuthoring` discriminated and update image callers
  directly;
- move the current image implementation behind the image strategy without
  behavior change;
- implement video family/mode projection and exact route selection;
- validate and persist only catalog-declared video parameters;
- route media by mode and retain incompatible references as unassigned;
- pass weak source context only for editable authoring;
- keep external specs prompt/reference-only;
- keep Preview Update atomic and frozen requests read-only.

### Slice 6 — Extend CLI and agent-facing workflow

Repository files:

- CLI flag types/parser/help
- `generation-command-handlers.ts` and focused handler tests
- current architecture/reference CLI and skill docs

Sister-skill files:

- `media-producer/SKILL.md`
- new `references/shot-plan-video/*`
- new `references/video-generation/*`
- current `references/shot-video-take/*`
- current `samples/shot-video-take/*` and `samples/video-create-spec.json`
- current `evals/shot-video-take/*`
- new `references/video-model-guide-registry.json`
- new `samples/shot-plan-video/*` and `evals/shot-plan-video/*`
- `shot-planner/SKILL.md` handoff wording

Work:

- add the authored-from context flag and keep the CLI thin;
- document the two-command context workflow;
- teach method recommendation, auxiliary reference generation, default
  full/480p, duration guidance, no auto-segmentation, exact reference order,
  Preview reread after Update, freeze-before-live, and independent attachment;
- keep Preview and approval boundaries separate even when several commands are
  involved;
- apply the Sister-skill evidence migration inventory to every retired-path
  reference, sample, and eval before deleting its old path;
- refresh exact provider facts and dated source provenance from primary
  provider documentation while preserving provider-visible prompt craft,
  distinct creative examples, and reusable eval intent;
- write current `references/shot-plan-video` workflow guidance from the
  accepted purpose, weak-source, Preview, approval, freeze, and attachment
  contracts;
- map only the nine Engines-activated Seedance routes to current guides; keep
  Kling, Veo, and other future-model research outside the coverage registry and
  current executable fixtures;
- validate both directions of guide coverage without making the sister-skill
  registry a runtime support source: every activated Engines route has a guide,
  and every guide mapping refers to an activated route and existing file;
- compare coverage with current
  `renku generation model list --purpose shot-plan.video-generation --json`
  output rather than checking in a copied Engines catalog;
- delete old `shot-video-take` paths after the classify-refresh-re-home pass,
  with no alias or duplicate copy; and
- validate registry and current fixture structure without analyzing, scoring,
  or rewriting creative prompts.

### Slice 7 — Build the shared video Config and reference interactions

Files:

- `generation-request-editor.tsx`
- new video Config modules
- current Config/controls modules as needed for the discriminated authoring
- prompt reference completion/preview modules
- generation Preview draft/update service contracts
- current reference card/grid and reference-picker adapter
- `src/ui/video-preview-dialog.tsx`
- `src/ui/video-player.tsx` accessibility copy
- focused component and Preview E2E tests

Work:

- render generic, image, and video authoring without a second editor;
- implement and preserve the Model/Input/Setup three-pane desktop layout;
- remove duplicated prompt content from Setup and refine pane proportions,
  insets, row heights, and control spacing;
- use local shadcn controls only;
- make singleton and collection candidate inspection distinct from selection;
- preview video references through the shared dialog;
- preserve `AudioPreview` for dialogue references and add the missing
  choose/deselect interaction without creating another audio player;
- extend `@` completion to stored video/audio mentions;
- preserve exact prompt text and request order; and
- verify the new editor imports no module removed by Plan `0163`.

### Slice 8 — Project successful videos into the Generations tab

Core files:

- add client read-model contract
- add `server/shot-plan-video-generations/*`
- ProjectDataService contract/wiring
- `server/studio-coordination/resource-keys.ts`
- `server/assets/resource-keys.ts`
- `server/generation/attachment-destinations.ts`
- `server/commands/shot-plan-authoring-commands.ts`
- `server/shot-plans/trash.ts`
- `server/trash/trash-object-registry.ts`
- `server/trash/trash-lifecycle-service.ts`
- focused resource-key and projection tests

Studio server/service files:

- add thin GET route and response projection
- register route in the bounded projects router
- add service contracts/API and transport tests

Studio UI files:

- add local `ui/accordion.tsx` from the existing Radix dependency
- add the `shot-plan-video-generations` feature folder
- update `ScenePanelTab`, selection/URL handling, and `scene-panel.tsx`
- update Scene panel and app E2E tests

Work:

- group only exact successful attached video Assets;
- project discarded source plans to Miscellaneous without mutating anything;
- add `studioSceneVideoGenerationsResourceKey(sceneId)` and return it from the
  projection;
- emit that exact key from relevant Project video attach/discard/restore and
  Shot Plan title/Trash/restore/Empty Trash mutations;
- keep the existing Scene Shot Plans key on Shot Plan mutations because both
  projections become stale, and add no generic Project Assets key;
- make Empty Trash union the affected Trash definitions' exact resource keys
  into the successful mutation report before their items are marked
  garbage-collected, while dry-run preview remains non-mutating;
- render accordion sections and quiet video cards;
- reuse generic Asset discard and refresh;
- open the shared large player;
- open the existing exact Generation Request inspector from a separate
  MediaCard inspect action;
- preserve all current Shot Plans tab behavior.

### Slice 9 — Update accepted documentation and remove stale current guidance

Update:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/generation-preview-purpose-bindings.md`
- `docs/architecture/video-generation-model-capabilities.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/project-asset-storage-conventions.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/studio-server-hono.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/product/design-guidelines.md`

Correct current video guidance to use exact provider `@ImageN`, `@VideoN`, and
`@AudioN` tokens. Make clear that the current Studio surface exposes only the
three Seedance families through the one Engines Studio video activation catalog
even though generic Engines provider discovery contains more video providers.
Document `listStudioModelAvailability` as a derived query rather than a second
catalog, and document the exact Scene Generations invalidation key and all
mutations that emit it. Do not edit historical plans for a naming sweep.

## Tests And Guardrails

### Engines owning-layer tests

- the catalog contains exactly the three accepted Studio families and all nine
  exact fal routes;
- every route resolves to a current video descriptor;
- `listStudioModelAvailability({ mediaKind: 'video' })` equals the flattened
  ordered catalog result rather than a separately asserted family inventory;
- purpose-scoped `shot-plan.video-generation` listing and execution exclude
  non-catalog video routes while generic discovery remains unchanged;
- generic provider discovery still contains technically implemented,
  non-activated video routes without exposing them through Studio
  availability;
- route kinds expose the required media shape;
- configurable fields exist exactly once, are not prompts/media, and accept
  configured initial values;
- duration labels and 480p initialization derive correctly;
- duplicate families/routes and invalid catalog fields fail with structured
  catalog diagnostics.

### Core GenerationSpec and lifecycle tests

- `shot-plan.video-generation` requires each accepted input mode and rejects
  missing/unknown modes before persistence;
- non-Shot-Plan-video purposes reject `shotPlanVideoInputMode`;
- the video purpose and every auxiliary purpose require a non-empty
  `authoredFrom` Shot Plan id without requiring a matching row;
- create/update/read/list/freeze preserves the field;
- live execution freezes before the Engines call and failed live execution
  remains frozen;
- simulation/estimate stay mutable;
- changed requests use ordinary new mutable GenerationSpecs and no Shot Plan
  stores or copies a reverse spec id;
- migration `0069` preserves current rows, indexes, foreign keys, provenance,
  and advances generation to `55`.

### Core purpose and reference tests

- `shot-plan.video-generation` has Project target, video output,
  `shot_plan_video` Asset type/path, required weak authored source, and exact
  provenance;
- all three auxiliary purposes have Project target, image output, correct
  purpose-specific Asset type/path, exact provenance, and no selection;
- their guides expose the accepted Cast/Location and optional Shot image
  candidates without dependency validation;
- active Shot Plan context returns method refs, Cast, Location, Dialogue,
  Lookbook, and Additional sections in order;
- no candidate is preselected;
- candidate identity uses exact AssetFile or project-relative file identity;
- missing optional media and a stale source produce warnings, not failures;
- deleted source plans do not invalidate specs or attached assets;
- creative prompt text and storyboard media are never parsed or inspected.

### Core Preview owning-layer tests

- image behavior remains unchanged behind the image strategy;
- each video mode selects the correct route kind for all three families;
- first and last frame route to exact singular fields;
- reference images/video/audio route to exact arrays in stable spec order;
- incompatible selections are retained unassigned and block execution through
  current diagnostics rather than being deleted;
- only catalog-declared parameter values persist;
- model/mode/parameter/prompt/slot updates are atomic;
- same-slot replacement preserves mention metadata while a newly selected
  video reference does not receive an invented runtime token;
- external requests cannot edit managed Config;
- read-only inspector remains independent of current Shot Plan state.

### Core Scene projection tests

- active successful video Assets group under current Shot Plan title;
- several Assets from one plan remain separate and newest first;
- different plans produce different groups in normal plan order;
- a soft-deleted plan's Assets appear in the final Miscellaneous group;
- restore returns the group to its current plan title;
- a discarded Shot Plan counts as Miscellaneous context only while its active
  Trash item remains restorable; after Empty Trash, an internal discarded
  tombstone row does not keep the video in the Scene projection;
- the projection returns only
  `studioSceneVideoGenerationsResourceKey(sceneId)` as its browser dependency;
- relevant Project video attach/discard/restore emits the exact Scene
  video-generations key, while auxiliary and unrelated Project Assets do not;
- Shot Plan title/Trash/restore/Empty Trash mutations emit both the
  existing Scene Shot Plans key and the Scene video-generations key;
- successful Empty Trash unions affected object resource keys into its mutation
  report before marking Trash items garbage-collected, while dry-run preview
  remains non-mutating;
- plans with no videos do not create groups;
- draft specs, simulations, failed runs, unattached run outputs, auxiliary
  images, unrelated Project videos, and discarded video Assets do not appear;
- managed run snapshots and frozen external specs both resolve;
- missing exact provenance is never inferred from titles, paths, a reverse
  Shot Plan pointer, or plan ids embedded elsewhere.

### CLI and HTTP adapter tests

- CLI parses and delegates `--authored-from-shot-plan` for context;
- invalid flag shape produces a structured CLI error;
- CLI does not resolve the Shot Plan or choose a model;
- the GET route decodes ids, delegates once, returns safe file URLs, and maps
  Core structured errors;
- the existing Asset DELETE route remains the only video discard transport;
- fake ProjectDataService fixtures are updated directly for the new read
  method.

### Studio UI tests

- Generations is a valid Scene selection and URL value;
- the formerly disabled tab loads the new feature;
- loading, error/retry, empty, active groups, and Miscellaneous render;
- accordion uses intentional plan titles and no raw identifiers;
- video cards hover-preview, delete through Asset Trash, refresh, and open the
  player;
- while the tab is open, resource events refresh membership after Project video
  attach/discard/restore and refresh labels/group kind after Shot Plan
  rename/Trash/restore/Empty Trash;
- the generation-request corner action opens the existing exact read-only
  inspector without resolving current Shot Plan state;
- `VideoPreviewDialog` plays, pauses, scrubs, and closes accessibly;
- Config renders three Model/Input/Setup panes in that order, omits Source
  Video, and does not repeat Prompt-tab content;
- model, mode, parameter, prompt, candidate, and deselection changes reach one
  atomic Update request;
- singleton media inspection and collection choose actions remain separate;
- dialogue audio can be played, chosen, replaced, and deselected through the
  current reference flow;
- frozen/read-only requests disable mutation but keep inspection;
- `@` completion includes exact stored image/video/audio mentions and never
  rewrites authored text;
- current image Preview and Shot Plans tab journeys remain green.

### Stable architecture guardrails

- Engines catalog tests protect descriptor capabilities, not internal helper
  names.
- Core generation architecture tests protect package imports and the absence
  of prompt/media content validators.
- Studio architecture tests continue to reject raw interactive controls in
  feature code and UI imports into Core/server layers.
- no architecture test enumerates private helper/function names or every
  current purpose/command.
- existing complexity/structure guardrails are extended only if they can
  protect the bounded strategy/import boundary rather than source-text
  implementation names.
- sister-skill structural tests prove every Engines-activated route resolves to
  one existing guide, every guide mapping names an activated route, and
  preserved inactive model research is absent from the coverage registry and
  executable fixture set. The cross-repository check consumes current CLI JSON
  rather than a checked-in mirror of Engines model support.
- skill path cleanup is verified by a file-by-file migration inventory, not by
  brittle hashes or semantic prompt comparisons.

### Skill evals

- retained provider-visible prompting, Seedance guidance, Kling research,
  golden prompts, bad-prompt fixtures, and reusable forward scenarios have
  named successors after the old folder is removed;
- current executable samples and evals use only current purpose, target,
  `authoredFrom`, input-mode, Preview, approval, freeze, and attachment
  contracts;
- exact route token, field, cardinality, duration, and audio claims are
  revalidated from primary provider docs before the corresponding Seedance
  guide is registered;
- unspecified method recommends image-to-video and explains why;
- explicit text, first-frame, first/last, and reference requests are honored;
- default family/resolution is full/480p while explicit overrides survive;
- auxiliary reference generation uses separate specs and approval;
- duration over 15 seconds results in user guidance, not automatic splitting;
- ad hoc `image.create` follows the normal Preview/approval workflow;
- an external motion video is retained as opaque media and routed to the exact
  reference array without runtime content interpretation;
- final provider array order matches prompt mentions after Preview changes;
- user deselection is respected after the agent rereads the saved spec;
- live execution freezes immediately before provider use;
- failed live requests are not unfrozen;
- outputs attach as independent Project videos with `authoredFrom`;
- changed requests create an ordinary new spec rather than using plan
  continuation state; and
- no eval expects `video.create`, last-spec state, Take, GenerationAttempt,
  selected video, dependency, or creative artifact validation.

## Documentation

The documentation slice must explain:

- why the public purpose is specifically `shot-plan.video-generation`;
- why `shotPlanVideoInputMode` is durable while route identity remains
  provider model identity;
- why generic provider discovery and the one Engines Studio video activation
  catalog answer different questions;
- why `listStudioModelAvailability` derives video rows from that catalog and
  owns no second prefix/family inventory;
- the three auxiliary purposes and independent Project Asset paths;
- best-effort source-plan context and its strict non-ownership semantics;
- exact successful-Asset provenance used by the Generations projection;
- normal soft-delete Miscellaneous behavior and permanent Trash limits;
- exact Scene Generations invalidation after relevant Asset and Shot Plan
  mutations, with no generic Project Assets resource key;
- shared Preview/read-only inspection behavior;
- current Seedance-only Studio exposure;
- the separation between current Shot Plan workflow guidance, reusable
  provider/model research, and the exact-route skill coverage registry;
- how retained Seedance, Kling, and other model research is refreshed and
  preserved without retaining obsolete Take-era executable contracts;
- exact provider mention tokens and agent responsibility for final ordering;
- freeze-before-live, including failed live attempts;
- the two-command agent context workflow;
- the absence of dependency, selected-video, attempt, or creative-validation
  machinery; and
- the absence of generic `video.create`, reverse Shot Plan spec state, and
  failed-UI contracts after prerequisite cleanup.

Decision `0068` is the cleanup baseline and Decision `0069` is the accepted
source of truth for the new workflow. Decision `0068` receives a short notice
that the specific workflow was subsequently introduced. Decision `0045`
receives a short notice that Decision `0069` supersedes only its separate
shot-video Preview route/helper clauses with shared media-kind Preview
authoring and the existing exact request inspector. Both historical ADR bodies
remain unchanged.

## Final Verification

### Generated migration and real project

1. Generate the migration through the repository-owned Drizzle Kit command:

   ```text
   pnpm --dir packages/core db:generate -- --name shot_plan_video_generation
   ```

2. Inspect generated SQL and metadata; do not hand-edit generated SQL unless a
   documented custom migration is required.
3. Confirm prerequisite migration `0068` first produces schema generation
   `54`, then run the focused migration `0069` test from generation `54` to
   `55`.
4. Back up and migrate a disposable copy of
   `/Users/keremk/renku-movies/urban-basilica`.
5. Run SQLite `quick_check`, `foreign_key_check`, row-count/provenance checks,
   and confirm current non-Shot-Plan-video specs have null
   `shot_plan_video_input_mode`.

### Focused automated verification

Run:

```text
pnpm test:engines
pnpm test:cli
pnpm --dir packages/core test
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio test:typecheck
```

Run the sister-skill structural validator and the new Shot Plan video eval
fixtures. Inspect the sister-repository file migration inventory and prove:

- every retained research file has a named successor;
- every deleted no-successor file contains only an obsolete executable
  contract;
- all nine Engines-activated Seedance routes resolve to current guides and
  every guide mapping names an activated Engines route;
- preserved Kling, Veo, and other inactive research is absent from the active
  coverage registry and current executable fixtures; and
- no old `shot-video-take` path or compatibility alias remains.

Inspect the Engines results and prove:

- Studio video availability is the exact ordered flattening of the Studio video
  catalog;
- generic provider discovery still includes technically implemented inactive
  models; and
- there is no independent video prefix/family inventory outside
  `studio-video-model-catalog.ts`.

Then run repository-wide:

```text
pnpm check
pnpm test
pnpm build
```

### Representative workflow verification

Against the migrated disposable `urban-basilica` copy:

- read `shot_plan_37a3r9yz` and verify all Shots, briefs, selected/candidate
  images, and coverage are present, with no last-spec field;
- read `shot-plan.video-generation` context with the authored-from flag and
  verify relevant Cast, Location, Dialogue, Lookbook, and method-reference
  slots;
- create one spec per input mode without paid execution and inspect the exact
  route, provider payload preview, reference fields, controls, and diagnostics;
- generate or import representative auxiliary image Assets and confirm they
  appear as unselected candidates;
- exercise Preview Update and then reread the exact saved spec;
- simulate without freezing;
- freeze a representative agent-external request immediately before using a
  local fixture output and attach it as a Project video;
- inspect the Asset's exact request through the existing read-only inspector;
- confirm the Scene Generations tab groups the video under the plan;
- while the tab remains open, rename the plan and confirm its label refreshes
  from the resource event;
- move the plan to Trash and confirm the video refreshes under Miscellaneous;
- restore the plan and confirm the named group returns without manual reload;
- discard and restore the video Asset through the existing Trash lifecycle and
  confirm membership refreshes; and
- on a second disposable copy, run Empty Trash after discarding the source plan
  and confirm the video remains a valid Project Asset but disappears from the
  Scene projection after the emitted resource event.

No live paid provider call is required for final repository verification.

### Desktop visual verification

At the supported desktop viewport:

- compare the video Config tab with `/Users/keremk/Desktop/Config.png`;
- confirm Model/Input/Setup order, three Seedance rows, four input modes, no
  Source Video, setup controls, or duplicated prompt;
- confirm the three panes retain deliberate widths, consistent 20px insets,
  aligned section labels, and a shared 44px option-row rhythm;
- verify no raw filename/id or filler copy is visible;
- verify reference singleton and multi-candidate inspect/select behavior;
- verify the accordion, hover autoplay, delete confirmation, large dialog,
  play/pause, scrubber, focus return, and keyboard interaction;
- verify editable and frozen read-only Preview states; and
- do not perform or report mobile verification.

### Architecture-shape review

Before completion:

- inspect `git diff --stat` and the complete diff in both repositories;
- confirm every runtime, schema, UI, and current-doc prerequisite from Plan
  `0163` remains satisfied without repeating its discarded wholesale
  sister-skill deletion;
- compare the sister-skill before/after inventory and confirm provider research,
  golden/negative examples, and reusable eval intent were preserved and
  re-homed;
- inspect all new or heavily modified files;
- confirm Preview update delegates to bounded strategies;
- confirm purpose, destination, route, and package `index.ts` files remain thin;
- confirm no file combines provider catalog, Core routing, persistence, HTTP,
  and React projection;
- confirm `studio-model-availability.ts` contains no authored video inventory
  and derives its video result only from the Studio video catalog;
- confirm no generic Project Assets resource key was added and every mutation
  named by R14 emits the exact Scene video-generations key;
- confirm no Shot Plan video table, selected-video state, dependency mechanism,
  prompt parser, content validator, compatibility alias, re-export facade, or
  raw feature control was introduced;
- confirm no failed UI, generic `video.create`, generic Project-video
  destination, last-spec coupling, or obsolete Take-era executable contract
  was reintroduced;
- confirm preserved inactive model research did not enter the skill coverage
  registry, current executable fixtures, Core purpose context, or Studio
  Config;
- confirm formatting changes are limited to intentional touched lines; and
- confirm no checklist item was satisfied by accepting an unreviewable code
  shape.

## Completion Checklist

### Review Area

- [x] Confirm all requirements R1–R19 remain implemented and verified.
- [x] Confirm the implementation preserves Core, Engines, CLI, HTTP, React,
      Asset, Preview, and skill ownership boundaries.
- [x] Confirm centralized generation ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.
- [x] Confirm Project-owned videos remain independent from Shot Plan lifecycle.
- [x] Confirm the runtime, schema, UI, and current-documentation portions of
      Plan `0163` were implemented and verified before this plan began.
- [x] Confirm generic `video.create`, failed-UI reuse, and reverse Shot Plan
      spec state remain absent.
- [x] Confirm the restored sister-skill provider research was classified,
      refreshed, and re-homed rather than deleted with obsolete workflow
      contracts.
- [x] Confirm inactive provider research did not become current Studio support.
- [x] Confirm no requirement was broadened into dependency or attempt
      infrastructure.

### Decisions And Architecture Contracts

- [x] Add ADR `0069` with the specific purpose, explicit input mode, weak
      association, narrow-context rule, one Engines video activation catalog,
      shared Preview direction, and exact Scene invalidation boundary.
- [x] Add a concise discoverability notice to cleanup Decision `0068` without
      rewriting its historical body.
- [x] Add a concise discoverability notice to Decision `0045` that Decision
      `0069` supersedes its separate shot-video Preview route/helper clauses,
      without rewriting its historical body.
- [x] Preserve Decision `0056` freeze-before-live semantics for successful and
      failed live requests.
- [x] Keep prompts, reference media, and storyboards opaque in runtime code.
- [x] Keep adapters thin and durable rules in Core/Engines owners.
- [x] Keep package-boundary failures and guide notices structured.
- [x] Add no compatibility shim, alias, fallback reader, or facade.
- [x] Keep current Shot Plan workflow guidance, reusable provider/model
      research, and exact-route coverage registry as separate skill
      boundaries.

### GenerationSpec And Migration

- [x] Add `ShotPlanVideoInputMode` and
      `GenerationSpec.shotPlanVideoInputMode`.
- [x] Require it only for `shot-plan.video-generation` and forbid it elsewhere.
- [x] Require non-empty `authoredFrom` for the video purpose and all three
      auxiliary purposes without requiring a live source row.
- [x] Persist `shot_plan_video_input_mode` through create, update, read, list,
      equality, and freeze paths.
- [x] Generate migration `0069` through Drizzle Kit and advance user version to
      `55`.
- [x] Prove the migration preserves current `urban-basilica` data and exact
      provenance with no compatibility behavior.

### Engines And Video Authoring

- [x] Add the three-family, nine-route Studio video catalog.
- [x] Make it the sole Engines-owned Studio video activation source while
      leaving generic provider discovery, schemas, and adapters intact.
- [x] Delete the current independently authored video prefixes, labels, order,
      acceptance helpers, and broad-family inventory from
      `studio-model-availability.ts` and its tests.
- [x] Keep `listStudioModelAvailability` only as the common Engines query used
      by Core, with video rows derived exactly from the ordered video catalog.
- [x] Prove future family activation requires one validated Engines catalog
      addition rather than a parallel Core, CLI, React, availability, or skill
      list.
- [x] Validate every catalog route and configurable field against current
      provider descriptors.
- [x] Restrict `shot-plan.video-generation` purpose listing, context,
      validation, and execution to those catalog routes without deleting
      generic Engines descriptors.
- [x] Expose only Duration, Aspect ratio, Resolution, and Generate audio.
- [x] Apply the accepted 480p initial value and derive duration capability.
- [x] Add focused Core Shot Plan video model resolution,
      configurable-value validation, and reference routing modules.
- [x] Route all four input modes to exact Seedance fields and arrays.
- [x] Preserve incompatible references as unassigned with diagnostics instead
      of deleting them.

### Purposes, References, And Assets

- [x] Add `shot-plan.video-generation`,
      `shot-plan.video-first-frame`, `shot-plan.video-last-frame`, and
      `shot-plan.video-storyboard`.
- [x] Add the `shot_plan_video` Project Asset type, three independent reference
      Asset types, and purpose-specific `videos/` destinations.
- [x] Preserve exact run/frozen-spec provenance and no canonical selection.
- [x] Build best-effort current Shot Plan and Scene authoring context.
- [x] Offer method, Cast, Location, Dialogue, and Lookbook slots in accepted
      order with no default selection.
- [x] Offer Cast/Location context for first/last image authoring and optional
      current Shot images for video-storyboard authoring.
- [x] Keep Additional Media as exact saved-request references.
- [x] Return warnings for missing optional context.
- [x] Add no storyboard/prompt/media semantic validation.
- [x] Emit the exact Scene video-generations key for relevant attached,
      discarded, or restored `shot_plan_video` Assets and emit no such key for
      auxiliary or unrelated Project Assets.

### Preview And Studio Editor

- [x] Make `GenerationPreviewAuthoring` a discriminated none/image/video
      contract and update all callers directly.
- [x] Move image authoring behind the bounded image strategy without behavior
      regression.
- [x] Add the video strategy and keep Preview Update shallow and atomic.
- [x] Pass `authoredFrom` only into mutable authoring context.
- [x] Preserve the existing read-only exact request inspector.
- [x] Implement Model/Input/Setup in that order using the screenshot baseline.
- [x] Show exactly three Seedance families and four input modes, without Source
      Video.
- [x] Keep prompt display and editing in CodeMirror and remove prompt content
      from Setup.
- [x] Preserve the three-pane Config layout while refining pane proportions,
      insets, row heights, and control alignment.
- [x] Extend exact `@` completion to image, video, and audio mentions.
- [x] Keep runtime prompt text byte-for-byte authored; do not renumber or
      repair it.
- [x] Separate media inspection from choose/deselect actions.
- [x] Preserve the existing AudioPreview and add explicit audio
      choose/replace/deselect behavior.
- [x] Filter unselected Preview slots by exact video input mode while
      preserving exact persisted selections for removal.
- [x] Name Cast and Location slots by subject, show their missing-sheet
      placeholders, and omit empty optional Dialogue/Storyboard/Lookbook slots.
- [x] Remove slot-local Choose buttons and render image, video, and audio
      candidates directly as MediaCards with independent preview and selection.
- [x] Use local shadcn controls only.
- [x] Import or copy no module removed by prerequisite Plan `0163`.

### CLI And Skills

- [x] Add and document `--authored-from-shot-plan` for generation context.
- [x] Keep CLI parsing/delegation thin.
- [x] Update `media-producer` to read full Shot Plan and generation context.
- [x] Teach method recommendation, auxiliary generation, full/480p default,
      duration guidance, Preview reread, exact tokens, approval, freeze, and
      attachment.
- [x] Teach requests over 15 seconds without automatic segmentation.
- [x] Preserve the normal Preview/approval workflow for ad hoc `image.create`
      references and safe opaque external motion-video references.
- [x] Inventory every current `shot-video-take` reference, sample, and eval
      before deleting the old paths.
- [x] Re-home and refresh provider-visible prompting, prompt-quality guidance,
      Seedance route/audio guides, Kling research, golden prompts, bad-prompt
      fixtures, and reusable forward scenarios.
- [x] Add a structural route-to-guide registry containing exactly the nine
      Engines-activated Seedance routes as guide coverage, not runtime
      activation policy.
- [x] Prove every activated Engines route has one current guide mapping and
      every mapping references an activated route and existing guide.
- [x] Compare guide coverage with current
      `renku generation model list --purpose shot-plan.video-generation --json`
      output; check in no copied Engines catalog.
- [x] Keep Kling, Veo, and other future model research out of the skill coverage
      registry and current executable fixtures.
- [x] Author current Shot Plan workflow references and rewrite reusable samples
      and evals to current purpose, target, source, input-mode, Preview,
      approval, freeze, and attachment contracts.
- [x] Keep the conforming generic `image.create` example, move the Veo
      first/last-frame example to inactive research, and delete the obsolete
      `video.create` executable sample.
- [x] Delete old `shot-video-take` paths only after every file has a named
      successor or an explicit obsolete-contract deletion, with no aliases or
      duplicate copies.
- [x] Update `shot-planner` handoff without adding video state to Shot Plans.
- [x] Add skill evals for all accepted workflows and safety gates.

### Scene Generations Projection And UI

- [x] Add the Core Scene video-generation read model and ProjectDataService
      entrypoint.
- [x] Resolve only exact attached Asset provenance.
- [x] Group active plans by current title and soft-deleted plans under one final
      Miscellaneous group.
- [x] Treat a discarded plan as Miscellaneous context only while its active
      Trash item remains restorable; ignore internal tombstone rows after Empty
      Trash.
- [x] Omit empty plan groups and non-success/non-attached/non-video media.
- [x] Add the thin GET route and safe Studio service projection.
- [x] Reuse the existing Asset DELETE/Trash lifecycle.
- [x] Add `generations` to Core and Studio Scene selection/URL contracts.
- [x] Remove the disabled local tab workaround.
- [x] Add the local shadcn Accordion primitive from the existing dependency.
- [x] Render quiet MediaCards with hover playback and meaningful copy only.
- [x] Add the shared VideoPreviewDialog and generic VideoPlayer accessibility
      labels.
- [x] Wire the separate MediaCard inspect action to the existing exact
      Generation Request inspector.
- [x] Add `studioSceneVideoGenerationsResourceKey(sceneId)` and return it from
      the projection.
- [x] Refresh after relevant Project video attach, discard, and restore.
- [x] Refresh group labels, ordering, and membership after Shot Plan
      rename/Trash/restore/Empty Trash mutations while preserving the existing
      Scene Shot Plans key.
- [x] Make successful Empty Trash include the affected definitions' exact
      resource keys before garbage collection; keep dry-run preview
      non-mutating.
- [x] Add no generic Project Assets resource key.

### Tests And Guardrails

- [x] Add owning-layer Engines catalog tests.
- [x] Prove Studio video availability is derived from the catalog while generic
      provider discovery retains inactive technical capabilities.
- [x] Add Core envelope, lifecycle, migration, purpose, guide, routing,
      attachment, and projection tests.
- [x] Add Core resource-event tests for every Asset and Shot Plan mutation that
      can stale the Scene Generations projection.
- [x] Keep the full invalid matrix at the owning layer.
- [x] Add representative CLI and HTTP adapter tests only.
- [x] Add Studio visible-behavior and interaction tests.
- [x] Add representative Preview and Scene E2E journeys.
- [x] Add skill structural checks for active route coverage, inactive research
      isolation, current fixture envelopes, and old-path removal.
- [x] Add forward evals that preserve reusable creative scenarios without
      retaining obsolete Take-era runtime expectations.
- [x] Keep architecture tests tied to stable imports, capabilities, contracts,
      and runtime behavior rather than private implementation names.
- [x] Prove production runtime code does not parse creative prompt/media
      contents.

### Documentation

- [x] Update all current generation, model, storage, frontend, server, and skill
      architecture references named in Slice 9.
- [x] Correct current provider mention examples to exact `@ImageN`,
      `@VideoN`, and `@AudioN` tokens.
- [x] Document Seedance-only current Studio exposure and generic catalog scope.
- [x] Document the single Engines activation catalog, derived availability
      query, and deletion of the old independent video policy.
- [x] Document the workflow/research/activation split and the retained inactive
      provider research.
- [x] Document the weak association, Miscellaneous behavior, and permanent
      Trash limit.
- [x] Document exact Scene Generations invalidation and the absence of a generic
      Project Assets key.
- [x] Document independent auxiliary Project Assets and no dependency model.
- [x] Do not edit historical plans merely for naming cleanup.

### Final Verification

- [x] Run the focused migration, Engines, Core, CLI, Studio, Preview, and skill
      verification.
- [x] Run `pnpm check`, `pnpm test`, and `pnpm build`.
- [x] Verify the representative workflow against a migrated disposable copy of
      `urban-basilica`.
- [x] Complete supported desktop visual and accessibility verification against
      `Config.png`.
- [x] Inspect `git diff --stat` and the complete diff in both repositories.
- [x] Inspect every new or heavily modified file for focused responsibility.
- [x] Confirm package and module `index.ts` files remain thin.
- [x] Confirm the runtime, schema, UI, and current-doc prerequisites from Plan
      `0163` remain satisfied and no removed stale runtime concept was
      recreated.
- [x] Compare the sister-skill before/after inventory and confirm every retained
      research artifact has a successor while every no-successor deletion is
      an obsolete executable contract.
- [x] Confirm inactive provider research is absent from the skill coverage
      registry, current executable fixtures, Core purpose context, and Studio
      Config.
- [x] Confirm no second authored Studio video-model inventory or prefix
      activation path remains.
- [x] Confirm Decision `0045` and Decision `0068` contain the exact concise
      discoverability notices pointing to Decision `0069`.
- [x] Confirm no god file, catch-all module, broad dispatcher, compatibility
      layer, raw feature control, or prompt/media content validator exists.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark this plan complete.

## Completion Evidence

- `pnpm check`, `pnpm test`, and `pnpm build` pass for the full workspace.
- The full suite passes 1,342 tests; 12 existing provider tests remain
  explicitly marked todo.
- Migration `0069` advances schema generation to `55`, passes its focused test,
  and preserves a migrated disposable copy of `urban-basilica`.
- A representative `shot-plan.video-generation` request for
  `shot_plan_37a3r9yz` validates, estimates, and simulates through the exact
  Seedance route with canonical duration binding.
- Desktop browser verification at `1440 × 1000` confirms Model/Input/Setup,
  all four input modes, the three Seedance families, no duplicated prompt,
  schema-backed controls, and the enabled Scene Generations empty state.
- The sister-skill validator confirms all nine active routes, current samples,
  current internal guide links, inactive-research isolation, and removal of
  obsolete Take-era paths.
- `git diff --check` passes in both repositories, generated migration snapshot
  JSON parses, the complete diffs and heavily modified files were inspected,
  and package/module entrypoints remain thin.
