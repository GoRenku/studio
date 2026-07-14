# 0136 Studio UI Compatibility And Generation Backend Integration

Status: active

Date: 2026-07-12

## Summary

Plan `0136` is the complete remaining product-integration plan for the
context-first generation replacement. It incorporates every still-valid Plan
`0135` requirement and adds the UI compatibility remediation required because
the first Plan `0135` implementation attempt treated deleted backend callers as
permission to delete or simplify the Studio experience. That was incorrect.

The non-negotiable outcome is:

- Renku Studio looks and behaves exactly as it did at the pre-work `HEAD`;
- no visible control, card, tab, label, badge, column, footer, dialog, empty
  state, loading state, error state, hover state, focus state, playback control,
  save notification, or navigation behavior changes, except for the three
  explicitly approved visible changes listed below;
- the existing Studio feature and UI component tree remains the experience
  source of truth;
- the new Engines/Core generation architecture becomes the backend source of
  truth;
- missing domain use cases are restored at the correct Core ownership boundary,
  not approximated in React, routes, CLI handlers, or compatibility shims;
- the old generation dependency graph, recursive generation planner, provider
  switchboards, and semantic prompt/media validation are not recreated.

This plan blocks further Plan `0135` implementation until it is reviewed and
accepted. Once accepted, it supersedes all Plan `0135` implementation and
checklist authority. Every retained Plan `0135` requirement is incorporated
here, and every conflicting UI direction is explicitly rejected here. The
generic Engines/Core/CLI/Skill work already implemented under Plans `0134` and
`0135` remains candidate work, subject to the architecture and verification
gates below.

## Plan Consolidation And Closure

Plan `0136` is the complete replacement completion plan for all remaining work
originally assigned to Plan `0135`. Plan `0135` will not retain a second
implementation phase, separate checklist, or later cleanup after Plan `0136`.

The plan lifecycle is explicit:

1. During review, Plans `0135` and `0136` remain proposed and no further Studio
   implementation begins.
2. When Plan `0136` is accepted, Plan `0135` receives a short header note that
   it is superseded by Plan `0136`; its still-valid requirements are owned by
   this plan and its conflicting UI directions are rejected.
3. Implementation and review are tracked only through the Plan `0136`
   checklist.
4. Plan `0136` cannot complete until every retained Plan `0135` requirement,
   every Plan `0134` handoff caller, and every compatibility requirement passes.
5. On completion, Plan `0136` is marked complete and Plan `0135` receives a
   closure note stating that all retained work completed through Plan `0136`.
   No residual Plan `0135` work remains active.

The disposition of Plan `0135` is:

| Plan `0135` area | Disposition in Plan `0136` |
| --- | --- |
| Provider defaults and fixed/recommended settings | Retained in full |
| Curated image model availability and Nano Banana Pro | Retained in full |
| Purpose inventory and one focused descriptor per purpose | Retained in full |
| Typed reference guides, stable placement ids, candidates, and notices | Retained in full |
| Exact external/Renku attachment and provenance rules | Retained in full |
| Current-request-only estimate architecture | Retained in full |
| Non-current-request pricing tags/badges | Removed from generation, model, reference, and dependency cards |
| Storyboard 2x2 deterministic workflow and agent-owned split | Retained in full |
| Shot First/Last/Prompt/Lookbook/Cast/Location/dialogue guidance | Retained in full |
| Generic CLI commands and Studio/CLI projection parity | Retained in full |
| Skill updates, one-way migration, caller restoration, tests, and docs | Retained in full |
| Shared typed-slot UI consolidation | Not required; existing UI structure wins |
| Rename Lookbook and Location **Visual Content** tabs to **Assets** | Approved |
| Remove other non-price badges or planning/status presentation | Rejected; only the AI Production Status column is approved for removal |
| Reduce AI Production to Model and Duration columns | Approved; remove the broken Status column and its `input-required`/availability cells |

This table is only a review crosswalk. The retained requirements are restated
below so Plan `0136` is self-contained and can be completed without treating
Plan `0135` as a second source of implementation truth.

## User Direction And Compatibility Authority

The pre-work Studio experience is the compatibility authority.

At the time this plan was written:

```bash
git diff --exit-code HEAD -- packages/studio
```

passes. `packages/studio` is therefore back at the exact pre-work source state.
That state must remain the baseline until the visual and behavioral evidence is
captured.

Plan `0136` explicitly cancels the authority to make visible UI changes except
for the three changes approved below. Unless the user separately approves a
later UI change, implementation must not:

- remove, add, or relocate the existing estimate presentation for the one
  current generation request;
- change AI Production columns other than removing Status;
- replace the existing Shot References experience with a generic list;
- replace the existing Takes workspace with a simplified take list;
- replace Dialogue Audio with a button that only opens Generation Preview;
- add generation buttons to Cast, Location, Lookbook, Scene, or other surfaces;
- remove or consolidate tabs, cards, pickers, preview actions, playback,
  revision actions, hover behavior, keyboard behavior, or save feedback;
- change any visible copy, including empty, loading, warning, error, or
  confirmation text;
- alter spacing, sizing, aspect ratios, class names, grid structure, responsive
  desktop behavior, or detail-panel insets;
- change which current user action opens a dialog, saves state, generates media,
  plays media, previews media, picks media, or deletes media.

The approved visible changes are exactly:

1. Remove pricing tags or badges on generation, model, reference, and dependency
   cards when they represented a possible request, dependency, or candidate
   rather than the one current generation request.
2. Remove the **Status** column from the AI Production Model table, leaving
   exactly **Model** and **Duration**. Do not recreate `Input required`,
   `Unavailable`, or another status cell under a different label.
3. Rename the existing Lookbook and Location **Visual Content** tabs to
   **Assets** without changing tab placement, behavior, or contents.

The removed pricing tags must not be backed by explicit child specs,
reconstructed from purpose guides, replaced with placeholder copy, or moved
elsewhere. Pricing for the one current generation request remains in its
existing UI and existing location.

“Current generation” means the exact top-level `GenerationSpec` the user is
currently editing, previewing, or running in Generation Preview, AI Production,
Dialogue Audio, or Image Revision. It never means a possible reference, a
missing asset, a guide recommendation, or downstream work.

Any fourth UI change requires a separate, explicit user decision made against
fresh visual evidence. Passing TypeScript or unit tests does not authorize a UX
change.

## Context

This plan is constrained by:

- `plans/active/0134-context-first-generation-simplification.md`;
- `plans/active/0134-generation-purpose-reference-guide-template.md`;
- `plans/active/0135-generation-purpose-guides-and-product-integration.md`;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/frontend.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- `docs/architecture/reference/context-first-generation-foundation-manifest.md`;
- `docs/architecture/shot-video-take-owned-media.md`;
- `docs/architecture/structured-diagnostics.md`;
- `docs/architecture/coding-practices.md`;
- the pre-work `HEAD` implementation of `packages/studio`;
- the existing Studio Vitest, in-process E2E, Playwright smoke, and Playwright
  regression suites;
- `$HOME/renku-movies/urban-basilica` as the real desktop compatibility project;
- `$HOME/Projects/aitinkerbox/studio-skills` for agent-facing generation
  workflows.

Desktop is the only supported verification target. This plan does not add or
change mobile behavior.

## Consolidated Product Requirements From Plan 0135

### Settings And Provider Defaults

- Provider-schema defaults remain provider-owned. If the user or agent does not
  author a value, Renku omits it and lets the provider apply its default.
- A fixed Studio setting is allowed only when changing it would break Studio
  presentation or an accepted deterministic product workflow. Users and agents
  cannot change or remove fixed settings.
- A recommended setting initializes editable Studio state. Once the UI saves
  it, it is authored Studio state. CLI/spec creation does not insert the
  recommendation automatically; agents receive it as guidance and explicitly
  author the value they choose.
- An authored recommended value remains distinct from an untouched provider
  default.
- Engines-owned semantic field metadata binds fixed and authored recommended
  settings to actual provider fields. Studio, CLI, Core purpose files, and
  Skills do not guess provider field names.

### Curated Models

Image model selection uses Engines-owned product availability metadata. The
accepted selectable image models are:

- GPT Image 2;
- Nano Banana 2;
- Nano Banana Pro;
- xAI Grok Imagine Image 1.5.

Nano Banana Pro and its route must exist. Seedream 5 Pro remains deferred.
Obsolete catalog models remain cataloged but are unselectable. Generate uses an
allowed text-to-image or reference-to-image endpoint as appropriate; Edit uses
an allowed edit/reference endpoint. Video model options remain unchanged.
Recommended models initialize the existing Studio dropdown and are CLI
guidance, not silently authored spec state.

### Complete Purpose Inventory

Every inventory row has one focused purpose descriptor and uses the generic
generation lifecycle. Generation and attachment remain separate.

| Purpose | Target | Output | Product behavior |
| --- | --- | --- | --- |
| `image.create` | Project | Image | Generic creation; no named slots; Additional References only |
| `image.edit` | Asset | Image | Exact source image plus optional Character, Location, Lookbook, future Prop, and Additional References |
| `lookbook.image` | Lookbook | Image | Project-ratio recommended setting; medium quality and Nano Banana 2 recommended values |
| `lookbook.video-sheet` | Lookbook | Image | Multiple global sheets; 4:3, high quality, GPT Image 2 recommended values |
| `lookbook.storyboard-sheet` | Lookbook | Image | Multiple global sheets; 4:3, high quality, GPT Image 2 recommended values |
| `cast.video-character-sheet` | Cast Member | Image | Multiple sheets; 16:9, high quality, GPT Image 2 recommended values |
| `cast.storyboard-character-sheet` | Cast Member | Image | Multiple sheets; 16:9, high quality, GPT Image 2 recommended values |
| `cast.profile` | Cast Member | Image | Fixed 1:1; medium/Nano Banana 2 recommended values; first video Character Sheet initially selected |
| `cast.voice-sample` | Cast Member | Audio | Current product behavior through the generic lifecycle |
| `scene.dialogue-audio` | Scene Dialogue | Audio | Current product behavior through the generic lifecycle and focused dialogue take attachment |
| `location.sheet` | Location | Image | Multiple sheets; 16:9, high quality, GPT Image 2 recommended values |
| `location.hero` | Location | Image | Fixed 16:9; otherwise Profile-equivalent behavior with first Location Sheet initially selected |
| `scene.storyboard-sheet` | Scene | Image | Accepted deterministic 2x2 composite and agent-owned split workflow |
| `shot.video-take` | Scene Shot Video Take | Video | Typed Shot/Lookbook/Cast/Location/dialogue guidance and one explicit provider request |

Both audio purposes are required. Accepted purpose renames and splits are made
directly with no aliases or compatibility readers.

### References, Guides, And Attachments

- Typed purpose references remain visible guidance slots in Studio and CLI
  context. Slot occupancy is not a dependency or execution rule.
- Multiple exact candidates use the existing subject-filtered alternate picker
  interaction without changing its UI.
- Cast Profile and Location Hero initialize with the first matching sheet and
  allow replacement through the existing picker.
- Generic `image.create` has no named typed slot.
- Every generation supports Additional References.
- A Renku-generated reference retains its own earlier generation spec and real
  provenance when explicitly attached to a later spec.
- User-supplied or externally generated media has no Renku generation spec or
  synthetic provenance. It is attached as opaque target-owned media through a
  focused Core command and does not enter a reusable catalog unless separately
  imported into that domain.
- Reference contents remain opaque and are never interpreted, scored, repaired,
  or validated.
- Guide notices are non-blocking guidance and remain distinct from provider
  diagnostics.
- Estimates cover only the current validated provider request with immediate
  exact inputs. They never traverse provenance, references, missing creative
  work, or dependency trees.

### Storyboard Sheet Golden Workflow

`scene.storyboard-sheet` retains:

- the current deterministic 2x2 prompt/composite behavior;
- the overall 4:3 sheet and project-aspect Shot panels;
- fixed high quality;
- GPT Image 2 as the recommended model;
- initial selection of the first Storyboard Lookbook Sheet when available;
- a non-blocking notice when no Storyboard Lookbook Sheet exists;
- agent/Skill-owned splitting and focused attachment.

No image-splitting library or automatic Core, Engines, or Studio split path is
added.

### Shot Video Guidance

The current guide must provide exact current candidates for:

- First Frame;
- Last Frame;
- Video Prompt Sheet;
- general reference images;
- video Lookbook Sheets;
- video Character Sheets repeated for each Scene Cast Member;
- Location Sheets repeated for each Scene Location;
- dialogue audio repeated for each Scene Dialogue;
- Additional References.

First/last-frame requirements come only from the selected provider schema. A
reference-mode request with no general references receives a non-blocking guide
notice unless the provider schema makes an input mandatory.

### Stable Guide Placement Identifiers

These ids are persisted current contract values. Labels and guidance copy may
change in a separately approved copy plan without changing the ids.

| Purpose | Section id | Slot id | Cardinality | Scope | Subject |
| --- | --- | --- | --- | --- | --- |
| `image.edit` | `source` | `source-image` | `one` | none | none |
| `image.edit` | `cast` | `character-sheet` | `one` | none | Cast Member |
| `image.edit` | `location` | `location-sheet` | `one` | none | Location |
| `image.edit` | `lookbook` | `video-lookbook-sheet` | `many` | none | none |
| `image.edit` | `lookbook` | `storyboard-lookbook-sheet` | `many` | none | none |
| `cast.profile` | `source` | `video-character-sheet` | `one` | none | none |
| `location.hero` | `source` | `location-sheet` | `one` | none | none |
| `scene.storyboard-sheet` | `visual-language` | `storyboard-lookbook-sheet` | `one` | none | none |
| `shot.video-take` | `shot` | `first-frame` | `one` | Shot when direction is per-Shot | none |
| `shot.video-take` | `shot` | `last-frame` | `one` | Shot when direction is per-Shot | none |
| `shot.video-take` | `shot` | `video-prompt-sheet` | `one` | Shot when direction is per-Shot | none |
| `shot.video-take` | `shot` | `general-reference` | `many` | Shot when direction is per-Shot | none |
| `shot.video-take` | `lookbook` | `video-lookbook-sheet` | `many` | Shot when direction is per-Shot | none |
| `shot.video-take` | `cast` | `video-character-sheet` | `one` | Shot when direction is per-Shot | Cast Member |
| `shot.video-take` | `location` | `location-sheet` | `one` | Shot when direction is per-Shot | Location |
| `shot.video-take` | `dialogue` | `dialogue-audio` | `one` | Shot when direction is per-Shot | Scene Dialogue |

Purposes absent from this table use only the universal
`{ kind: 'additional' }` placement. Repeated subjects reuse the listed
section/slot ids. `scope` identifies optional Shot direction; `subject`
identifies the Cast Member, Location, or Scene Dialogue inside that direction.
Ids are never derived from labels or asset-role strings.

### CLI, Skills, Migration, And Caller Restoration

The following generic CLI surface remains required:

```text
generation context
generation reference list
generation model list
generation validate
generation spec create
generation spec update
generation spec show
generation spec list
generation preview show
generation estimate
generation run
generation run show
```

Studio and CLI receive the same Core purpose, context, settings, guide,
candidates, selections, models, and notices. CLI commands remain thin parsers
and serializers. `generation reference list` exposes reusable catalog media;
target-owned external attachments remain visible only through their owning
context/spec.

Current Studio Skills must:

- consume context and typed guide placements;
- create a separate `image.create` spec for Renku-generated ad-hoc images;
- attach external media without inventing a generation spec;
- explicitly validate before estimate/run;
- retain agent-owned Scene Storyboard Sheet splitting;
- avoid dependency planning and creative-content validation.

The accepted one-way Drizzle migration is applied and inspected against a copy
and then the real `urban-basilica` project under the existing backup rules. Every
caller in
`docs/architecture/reference/context-first-generation-caller-handoff.md` must
be updated to a current contract or deliberately deleted because the capability
itself is obsolete. A legitimate UI capability is never classified as obsolete
merely because its old backend contract was deleted.

## Current Checkpoint Audit

### Work That Is Already Substantially Present

The current non-Studio implementation contains candidate work for:

- the generic `GenerationSpec`, exact reference selection, preview, validation,
  estimate, approval-token, run, output, and receipt contracts;
- provider request assembly and schema validation in Engines;
- provider-field descriptors and product setting bindings;
- curated Studio model availability metadata, including Nano Banana Pro;
- one Core purpose descriptor file per accepted generation purpose;
- Core purpose context, fixed/recommended settings, reference-guide sections,
  exact candidates, initial selections, and notices;
- generic CLI context/reference/model/validate/spec/preview/estimate/run commands;
- focused generation media attachment work;
- the generation-42 migration and real `urban-basilica` migration backup;
- Studio Skills updates to context-first generation and agent-owned Storyboard
  splitting.

Evidence at plan-authoring time:

- `pnpm build:core` passes;
- `pnpm test:engines` passes 43 files and 705 tests, with 12 existing todo
  tests;
- CLI generation-handler tests pass, while the complete CLI test command is
  not valid evidence in the current sandbox because local listen operations are
  denied and one Drizzle test loses its temporary directory during the sandboxed
  run;
- `packages/studio` has no source diff from `HEAD`.

### Work That Is Not Complete

Studio cannot compile against the current backend checkpoint. The exact restored
Studio tree currently reports 405 TypeScript errors and 78 removed public
exports. The failures cluster around four experience contracts:

1. Generation Preview and the shared Generation Request editor.
2. Image Revision / Regenerate / Edit.
3. Scene Dialogue Audio editing, estimates, generation, takes, and playback.
4. Scene Shot Video Take design, references, AI Production, take lifecycle, and
   media playback.

This is not a reason to delete the callers. It is evidence that Plan `0134`
deleted domain use cases together with generation-planning code. Plan `0136`
owns restoration of the legitimate use cases on top of the new foundation.

### Visual Evidence Available And Remaining

The user-provided Chrome appshot dated 2026-07-12 documents the current
`urban-basilica` AI Production state at the fixed desktop experience. It shows:

- the Model table currently has Model, Duration, and Status columns;
- Status cells contain `Input required` and `Unavailable` values;
- Run Setup displays the current request's **Estimated Total** separately;
- the surrounding Input, Run Setup, prompt, duration, audio, guidance, and
  multi-shot UI that must remain unchanged.

This is accepted evidence for removing only the Status column while preserving
the current-request estimate and surrounding panel. It is not a substitute for
the complete deterministic screenshot matrix.

Implementation must not begin until the baseline capture gate below runs in an
environment where the checked-in Playwright harness can render the pre-work
`HEAD` Studio against deterministic fixtures.

## Definition Of 100% UI Compatibility

Compatibility is broader than “the page still renders.” Every retained state
must match the pre-work baseline in all of the following dimensions.

### Visual Compatibility

- same desktop viewport layout;
- same panel, rail, card, table, tab, dialog, footer, header, and overlay
  geometry outside the approved AI Production Model-table reflow;
- same visible copy, capitalization, punctuation, and placeholder text outside
  the approved **Visual Content** to **Assets** labels and removed Status/price
  text;
- same typography, color, border, shadow, radius, spacing, padding, and gaps;
- same image and video aspect ratios, fitting, cropping, and preview behavior;
- same control placement and affordances;
- same loading, empty, ready, unavailable, warning, error, saving, saved,
  running, completed, and confirmation states.

The only approved visual differences are the three listed changes:

- non-current-request pricing tags/badges are absent from generation, model,
  reference, and dependency cards;
- the AI Production Model table contains exactly Model and Duration, with the
  Status header and all Status cells absent;
- the existing Lookbook and Location tab labels read **Assets**.

Removed pricing tags and renamed tabs must not change retained geometry,
spacing, controls, or surrounding layout. The AI Production table keeps its
outer bounds and row geometry while Model and Duration use the space previously
occupied by Status. Current-generation estimate presentation remains
pixel-identical.

### Interaction Compatibility

- same entry action for every existing flow;
- same tab order and selected-tab persistence;
- same picker and alternate-selection behavior;
- same include/exclude, pick/unpick, delete/confirm, create, update, and cancel
  behavior;
- same hover and keyboard-focus video preview behavior;
- same audio playback and take-management behavior;
- same debounced autosave and unmount flush behavior;
- same latest-request-wins behavior for overlapping preview updates;
- same save notification path through the detail header;
- same deep-link selection and take/shot navigation behavior;
- same structured-error placement without dialog closure or state loss.

### Data And Persistence Compatibility

- reopening a saved preview shows the same authored prompt, references,
  configuration, estimate presentation, and diagnostics;
- take selection, grouping, structure, camera, composition, dialogue inclusion,
  reference selection, model, route settings, prompt, and picked state survive
  reloads exactly as before;
- final videos and Storyboard previews appear in the same take cards and stage;
- generated and imported media refresh the same surfaces without a browser
  refresh;
- delete operations preserve the same Trash and recoverability behavior;
- external media and Renku-generated media keep their correct, different
  provenance semantics without changing how the cards look.

### Accessibility Compatibility

This plan is not an accessibility redesign. Existing accessible names, roles,
focus order, keyboard behavior, dialog semantics, labels, progress semantics,
and error announcements must not regress outside the approved changes. The AI
Production table must expose exactly two accessible column headers, Model and
Duration, and the two renamed tabs must expose **Assets** as their accessible
name. Screenshot comparison alone is not enough; DOM and keyboard assertions
remain required.

## Compatibility Surface Matrix

The baseline capture and implementation tests must cover at least these states.

| Surface | Required baseline states |
| --- | --- |
| App shell | Project open, selected detail route, sidebar, header, save status |
| Generation Preview | Prompt, References, Config, estimate footer, diagnostics banner, negative prompt, editable saved spec, read-only unsaved preview, update pending, structured update failure |
| Image Revision | Regenerate mode, Edit mode, source image, optional references, schema controls, preview, estimate, run pending, successful run, failure |
| Cast | Details, profile image, multiple Character Sheets, Voice Samples, audio playback, delete confirmation, image revision entry action |
| Location | Details, Assets tab, hero image, multiple Location Sheets, sheet preview, hero-generation action, delete confirmation |
| Lookbook | report, Assets tab, images, multiple sheets, image preview, delete confirmation, image revision entry action |
| Scene Narrative | dialogue card idle, audio playback, Dialogue Audio panel open, Dialog/Takes/Advanced tabs, autosave, estimate, generation, take deletion |
| Shots rail | empty state, ordered shots, selected shot, deep link, detail tab persistence |
| Shot Design | Composition, Camera Motion, Dialogs, References, AI Production tabs and their current ordering |
| Shot References | General, Lookbook, Cast, Location, Dialogue grouping; ready and placeholder/unavailable cards without pricing tags; single and multiple candidate pickers; preview/revision actions; include/exclude; save feedback; diagnostics |
| AI Production | input mode list, Model/Duration table with no Status column or candidate-price tags, route settings, prompt, group tag, unchanged current-request estimate, progress, output review, explicit import, errors |
| Takes | empty state, New Take pending, take cards, Storyboard previews, final video previews, hover/focus playback, picked ordering, delete confirmation, take editing, contiguous and non-contiguous shot selection |
| Resource refresh | CLI/agent mutation refresh for Cast, Location, Lookbook, Scene, dialogue audio, take references, and final video |

## Compatibility Conflicts With Plan 0135

Plan `0135` authorized several visible changes. The user has now explicitly
accepted three and revoked the rest. Plan `0136` therefore keeps the pre-work
rendering and interaction contract except for non-current-request pricing-tag
removal, AI Production Status-column removal, and the two **Assets** tab-label
changes.

This does **not** authorize moving the deleted dependency planner into a new
layer. The implementation must distinguish the existing experience from the old
backend mechanism that happened to feed it.

### Cards And Non-Current-Request Pricing

The existing reference-card structure remains. Dependency pricing does not.
Under the new architecture:

- a ready card comes from an exact `GenerationReference` candidate or selection;
- an available card comes from an exact guide candidate;
- a placeholder or unavailable card may retain its existing non-price visual
  presentation when the current guide reports no selected exact reference;
- no generation, model, reference, or dependency card receives a candidate or
  dependency estimate, price, pricing tag, pricing badge, cost total, or hidden
  price field;
- no read operation invents a prompt, creates a child spec, infers missing
  creative work, walks provenance, or recursively totals other work;
- Core reports exact current candidates, selections, and notices without
  manufacturing a planned generation dependency.

The old non-current-request price tags are deleted from card rendering and data
contracts. They are not visually replaced.

### AI Production Model Table And Estimate Presentation

The existing AI Production panel, table container, rows, Run Setup, and estimate
footer remain. The Model table changes only by removing its Status column:

- model rows come from Engines-owned availability metadata;
- the table renders exactly Model and Duration;
- Status, `Input required`, `Unavailable`, and equivalent status cells are not
  projected or rendered;
- input support still comes mechanically from Engines field capability metadata
  for input-mode controls and provider validation, not for a replacement status
  column;
- duration and other controls bind through Engines semantic field descriptors;
- readiness is provider validation of the one current request;
- estimate is the immediate request estimate only;
- run progress and outputs come from the one current `GenerationRun`;
- no production plan, dependency inventory, graph total, child estimate, or
  `input-required` business rule is recreated.

The current-generation estimate keeps its existing placement, copy, and visual
weight. No dependency/candidate price is displayed in the table, reference
cards, model choices, tags, badges, or footer.

### Lookbook And Location Assets Labels

Only the existing Lookbook and Location **Visual Content** tab labels change to
**Assets**. Routes, query parameters, tab ids, selection persistence, contents,
layout, and actions remain unchanged. This is a copy change, not a feature
rename or a new shared Assets domain.

### Existing Entry Points

Plan `0136` adds no visible generation entry points. Existing Studio actions are
connected to the new backend. Purposes without an existing Studio action remain
available through CLI, Skills, and the existing Generation Preview notification
flow until a separate UI plan is approved.

## Architecture Shape Gate

### Ownership

`packages/engines` owns:

- provider/model discovery;
- provider JSON schemas;
- Studio-selectable model availability;
- semantic model field descriptors, including prompt, duration, quality,
  aspect ratio, and exact media-role capability;
- provider payload assembly and validation;
- direct-request pricing, execution, outputs, and receipts.

`packages/core` owns:

- generic generation contracts and lifecycle;
- purpose descriptors, settings, guide slots, exact candidates, and notices;
- project and target ownership validation;
- saved-spec selection for an owning Studio use case;
- focused Image Revision orchestration over `image.edit`;
- focused Scene Dialogue Audio editing and take attachment over
  `scene.dialogue-audio`;
- focused Shot Video Take lifecycle and non-generation design state;
- Shot Video Take generation-session composition over `shot.video-take`;
- exact reference-selection mutations through generic specs;
- final media attachment, take-owned files, pick state, and Trash behavior;
- structured diagnostics and resource keys.

`packages/studio/server` owns only:

- HTTP request parsing;
- calling one focused Core command/query per route operation;
- adding safe browser URLs to exact Core media files;
- serializing the Core response;
- translating structured errors.

`packages/studio/src/services` owns only:

- endpoint paths;
- `fetch` calls and Studio token headers;
- HTTP-decorated response types;
- structured response error parsing.

`packages/studio/src/features` remains the experience layer. It may:

- hold draft interaction state;
- call services;
- bind already-classified Core/Engines fields to existing controls;
- arrange Core-projected sections in the existing visual layout;
- render existing cards, dialogs, tables, tabs, and save feedback.

It must not:

- decide target ownership;
- decide which assets belong to a guide slot;
- guess provider field names or capabilities;
- create purpose/model maps;
- validate project metadata;
- construct missing generation tasks;
- infer reference requirements;
- calculate generation cost;
- persist take design or reference state locally.

`packages/cli` owns only command parsing, file/input loading, calls to current
Core commands/queries, output formatting, Studio notification delivery, and
structured diagnostic reporting.

Studio Skills own agent-facing workflow guidance and creative choices. They
consume CLI/Core context and never duplicate runtime settings, guide
eligibility, provider validation, attachment ownership, or project mutation
rules.

### Core Module Layout

The following focused current modules are planned.

```text
packages/core/src/client/
  generation.ts
  generation-preview-resource.ts
  image-revision-workflow.ts
  scene-dialogue-audio-workspace.ts
  shot-video-take-workspace.ts

packages/core/src/server/generation/
  attachments.ts
  context.ts
  estimates.ts
  previews.ts
  purpose-settings.ts
  references.ts
  runs.ts
  specs.ts
  validation.ts
  purposes.ts
  purposes/*.ts

packages/engines/src/generation/
  setting-fields.ts
  studio-model-availability.ts

packages/core/src/server/generation-preview-resource/
  projection.ts
  prompt.ts
  references.ts
  configuration.ts
  estimate.ts

packages/core/src/server/image-revision-workflow/
  context.ts
  draft.ts
  estimate.ts
  run.ts
  attachment.ts

packages/core/src/server/scene-dialogue-audio-workspace/
  context.ts
  setup.ts
  estimate.ts
  run.ts
  takes.ts

packages/core/src/server/shot-video-take-workspace/
  contracts.ts
  state.ts
  queries.ts
  lifecycle-commands.ts
  design-commands.ts
  generation-session.ts
  references.ts
  outputs.ts
```

The names above are current public concepts, not aliases for deleted modules.
No file may re-export an old contract under an obsolete name.

`packages/core/src/server/index.ts` and `packages/core/src/client/index.ts`
remain thin public entrypoints. They may export accepted contracts and commands
only. They must not contain projection or orchestration bodies.

### Studio Module Layout

The existing feature and UI file structure remains in place. No visual file is
deleted, renamed, moved, consolidated, or replaced.

Existing service and server modules are updated directly:

```text
packages/studio/server/projections/
  generation-preview.ts
  image-revision.ts
  screenplay-responses.ts

packages/studio/server/routes/
  generation-preview.ts
  image-revisions.ts
  screenplay.ts

packages/studio/src/services/
  studio-generation-preview-api.ts
  studio-image-revisions-api.ts
  studio-scene-dialogue-audio-api.ts
  studio-shot-video-takes-api.ts
```

Feature hooks and controller code may change only to consume the accepted
current contracts. JSX structure, class names, visible text, component order,
control variants, and interaction affordances are frozen by the compatibility
gate.

### CLI And Skills Module Shape

The existing generic CLI command modules are updated directly:

```text
packages/cli/src/commands/
  generation-command.ts
  generation-command-handlers.ts
  studio-notification-client.ts
  media-import-command-handlers.ts
```

`generation-command.ts` owns parsing and dispatch to focused handlers only.
Handlers call Core, serialize the current contract, and emit structured
diagnostics. They do not build purpose guides, choose model fields, classify
assets, or reproduce focused workspace business rules. Obsolete
purpose-specific generation/take commands are removed rather than wrapped.

Current Skills in `$HOME/Projects/aitinkerbox/studio-skills` are updated in
place. They consume the generic CLI and explain agent workflow choices; they do
not become a second runtime purpose registry or validation layer.

### Explicitly Forbidden Shapes

Stop and redesign if implementation introduces any of the following:

- a `legacy`, `compat`, `adapter`, `shim`, or `facade` module that recreates an
  old API for unchanged callers;
- old public contract names reintroduced as aliases;
- a Studio-local purpose, model, guide-slot, or provider-field map;
- route-local asset ownership or reference eligibility rules;
- a generic Core state-patch command;
- a monolithic Shot workspace function that reads state, maps references,
  estimates, runs, imports, and formats HTTP in one body;
- a production plan, dependency graph, recursive estimate, automatic child
  spec, automatic prompt generation, or automatic reference generation;
- React logic that guesses whether a media file is a Character Sheet, Location
  Sheet, Lookbook Sheet, dialogue take, first frame, or last frame;
- a second generic generation lifecycle for Image Revision, Dialogue Audio, or
  Shot Video Take;
- an AI Production model-row status/readiness projection whose only purpose is
  to feed the removed Status column;
- deletion or simplification of a UI component because its prior backend type
  no longer exists;
- test exclusion used to hide an incompatible UI state;
- baseline screenshot updates made after implementation begins.

### Architecture Stop Conditions

Implementation stops for review if:

- a preserved visible state cannot be represented without recreating automatic
  dependency planning;
- a baseline screenshot changes outside dynamic fixture data or the exact
  approved visual-diff manifest;
- an existing UI assertion must change for anything other than removed pricing
  tags, the removed AI Production Status column/cells, or the two approved
  **Assets** labels;
- a feature component begins owning project or provider business rules;
- a Core workspace module exceeds a focused responsibility and starts routing
  unrelated use cases;
- a new contract mirrors an obsolete DTO only to reduce caller edits;
- the implementation cannot explain the source of every visible status, price,
  warning, and disabled control through the current contract;
- non-current-request pricing or dependency/candidate-estimate data reappears in
  any Core, server, service, feature, fixture, or UI contract.

## Public Contracts

### Purpose Product Contracts

Plan `0134` owns `GenerationSpec`, validation, estimate, approval, and run.
Plan `0136` completes the product policy projection with deliberate current
contracts equivalent to:

```ts
interface GenerationPurposeDescriptor {
  purpose: GenerationPurpose;
  targetKind: GenerationTarget['kind'];
  outputMediaKind: 'image' | 'audio' | 'video';
  settings: GenerationPurposeSettings;
  buildContext(input: BuildGenerationContextInput): Promise<GenerationContext>;
  buildReferenceGuide(
    input: BuildGenerationReferenceGuideInput,
  ): Promise<GenerationReferenceGuide>;
}

interface GenerationPurposeSettings {
  fixed: GenerationProductSetting[];
  recommended: GenerationProductSetting[];
  recommendedModel?: GenerationModelIdentity;
}

interface GenerationProductSetting {
  kind: 'aspect-ratio' | 'quality';
  value: JsonValue;
}

interface GenerationReferenceGuide {
  sections: GenerationReferenceGuideSection[];
  additionalReferences: GenerationReferenceSelection[];
  notices: GenerationGuideNotice[];
}
```

`purposes.ts` is a typed registry only. Purpose bodies, target queries, labels,
and guide construction live in one focused file per inventory row. An allowed
model that cannot mechanically represent a fixed setting is unavailable for
that purpose and produces a structured configuration diagnostic. A
`GenerationGuideNotice` is non-blocking guidance and cannot make a provider
request valid or invalid.

### `GenerationPreviewResource`

`packages/core/src/client/generation-preview-resource.ts` is the current
experience read model for the existing Preview dialog. It contains:

- purpose, target, project/subject labels, and title;
- selected provider/model identity;
- authored prompt text, exact provider prompt preview, and optional negative
  text when the selected model exposes it;
- ordered exact references with display label, media kind, included state, and
  editable selection id;
- schema-derived configuration sections and controls;
- the one direct estimate, when available;
- provider payload preview with safe local tokens only;
- structured diagnostics;
- the owning `GenerationSpec` id when the preview is saved.

The Studio server adds browser URLs. Preview update accepts authored prompt
changes and reference inclusion changes and updates the generic spec through
Core. It does not use dependency ids.

### `ImageRevisionWorkflow`

`packages/core/src/client/image-revision-workflow.ts` is the current focused
use-case contract for the unchanged Regenerate/Edit dialog. It contains:

- an exact source asset/file target;
- the existing Regenerate and Edit modes;
- a generic `image.edit` spec draft per available mode;
- schema-derived controls;
- exact optional references;
- preview, estimate, approval, run, and attachment results;
- structured diagnostics.

Core composes the generic generation commands. There is no separate revision
generation lifecycle and no destination registry duplicated in Studio.

### `SceneDialogueAudioWorkspace`

`packages/core/src/client/scene-dialogue-audio-workspace.ts` contains the data
the unchanged Dialogue Audio panel already displays:

- exact Scene and Dialogue identity;
- Cast Member and Cast Voice options;
- provider/model choices derived from Engines;
- plain/V3 text and opaque voice settings;
- output format and language settings;
- direct estimate state;
- generated takes with exact asset/file ids, timestamps, duration, and
  provenance;
- structured diagnostics.

Focused Core commands save setup, estimate the current generic spec, run the
current generic spec, attach the resulting audio to the dialogue-owned take,
and discard a take through Trash. The existing Studio action remains one
product action even though Core composes several generic lifecycle steps.

### `ShotVideoTakeWorkspace`

`packages/core/src/client/shot-video-take-workspace.ts` contains only current
Shot Video Take domain state and the current generation session:

- take identity, title, source Shot List, ordered Shot membership, picked state,
  final video, Storyboard images, history/editability status, and timestamps;
- version-3 take structure with continuous or multi-cut direction;
- composition, camera motion, cast/location direction, and dialogue inclusion
  state retained by migration generation 42;
- exact Cast, Location, Lookbook, and dialogue labels/media needed by existing
  cards;
- the active generic `shot.video-take` spec id;
- the generic purpose context, guide sections, exact candidates, selections,
  model descriptors, authored values, diagnostics, direct estimate, current
  run, and outputs.

It does not contain a dependency inventory, production graph, recursive
estimate, missing-work plan, provider-route switchboard, or synthetic prompt.

Focused Core commands are named deliberately:

```text
listShotVideoTakes
readShotVideoTakeWorkspace
createShotVideoTake
discardShotVideoTake
setShotVideoTakePicked
replaceShotVideoTakeShots
setShotVideoTakeStructure
setShotVideoTakeDirection
setShotVideoTakeGenerationSpec
attachShotVideoTakeOutput
```

Reference inclusion and alternate selection update the active generic spec;
they are not written back into take state.

### Engines Semantic Field Metadata

Engines descriptors must expose stable semantics needed by the unchanged
controls without UI field-name guessing:

```text
authored-text: prompt | negative-prompt
setting: aspect-ratio | quality | duration
media: source-image | reference-image | first-frame | last-frame | source-video | audio
```

These semantics classify provider fields only. They do not declare purpose
requirements or asset eligibility.

## Baseline Capture Gate

No Studio production implementation starts before this gate passes.

### Isolated Baseline

Create a disposable local checkout of the pre-work `HEAD`. Do not modify the
working tree or staging area. Use the existing workspace dependency store; do
not install or upgrade packages.

Run the existing deterministic Studio E2E fixture and capture the compatibility
surface matrix at fixed desktop viewports. The primary viewport is `1440x900`.
Use a second desktop width only where existing panel resizing is part of the
current experience.

### Locked Visual Baselines

Add a dedicated Playwright project and command:

```text
pnpm --dir packages/studio test:e2e:compat
```

Store accepted images under the package-owned Playwright snapshot directory.
Use:

- animations disabled;
- caret hidden;
- deterministic fixture ids, timestamps, and generated media;
- the same bundled fonts and browser build;
- exact viewport and device scale;
- zero unexpected changed pixels in the controlled environment.

The compatibility suite records one explicit visual-diff manifest containing:

- every removed non-current-request price element and its pre-work bounding box;
- the AI Production Model table outer bounding box, column/cell geometry, and
  Status header/cell regions;
- the existing Lookbook and Location tab outer boxes and **Visual Content** text
  regions.

Full-page comparison permits changed pixels only inside those recorded regions.
The price-tag and tab changes may not move any retained element. The AI Model
table keeps the same outer bounds and row heights; only its internal column
layout changes from Model/Duration/Status to Model/Duration. If pixels change
outside the manifest, implementation stops instead of broadening the allowance.

Baseline images are created once from the isolated pre-work `HEAD`, inspected,
and accepted before implementation. Updating them after implementation begins
is forbidden without explicit user approval.

### Locked Behavioral Baselines

Record the current assertions from:

- `generation-preview-dialog-host.e2e.test.tsx`;
- `scene-dialogue-audio-panel.test.tsx`;
- `scene-shot-references-tab.test.tsx`;
- `scene-shot-dialogs-tab.test.tsx`;
- `scene-shot-ai-production-tab.test.tsx`;
- `scene-shot-detail-save-notification.test.tsx`;
- `scene-takes-tab.test.tsx` and `.e2e.test.tsx`;
- `scene-shot-video-stage.test.tsx`;
- `take-shot-design-context.test.tsx`;
- `use-take-shot-design.test.tsx`;
- `use-shot-video-take-production.test.tsx`;
- the Studio service persistence E2E tests;
- the Playwright take, dialogue-audio, media, navigation, and visual-language
  regression suites.

Expected visible copy, roles, accessible names, order, and user interactions are
locked except for assertions that directly encode the three approved visible
changes. Those assertions are updated narrowly to require no price tags, exactly
Model and Duration with no Status column/cells, and **Assets** on the existing
Lookbook and Location tabs. Fixtures and types may be updated to current
contracts; no other assertion may be weakened, deleted, skipped, or rewritten
to accept a changed UX.

## Implementation Slices

### Slice 0: Accept The Compatibility Baseline

Files:

- `packages/studio/playwright.config.ts`;
- new compatibility Playwright specs under `packages/studio/e2e/tests/compat/`;
- package scripts only as needed for the new locked command;
- baseline screenshots.

Work:

- capture every state in the compatibility matrix from isolated `HEAD`;
- inspect every screenshot;
- record every removed pricing tag, the AI Production Model table geometry, and
  both renamed tab labels in the sole approved visual-diff manifest;
- confirm `packages/studio/src/ui`, `src/styles`, and `src/assets` are unchanged;
- record the behavior-test assertion inventory;
- identify every visible state fed exclusively by a deleted backend concept;
- stop for architecture review if such a state has no accepted current contract.

Exit: there is objective pre-implementation evidence for “unchanged.”

### Slice 1: Complete Purpose, Model, Guide, And Attachment Foundations

Files:

- `packages/core/src/server/generation/purpose-settings.ts`;
- `packages/core/src/server/generation/attachments.ts`;
- `packages/core/src/server/generation/purposes.ts` and one focused purpose file
  per inventory row;
- `packages/engines/src/generation/setting-fields.ts`;
- `packages/engines/src/generation/studio-model-availability.ts`;
- focused Core/Engines tests.

Work:

- audit the candidate implementation against every consolidated requirement;
- complete all fourteen purpose descriptors, including both audio purposes;
- enforce fixed settings and expose recommended settings without materializing
  untouched provider defaults;
- complete the image model allowlist, Nano Banana Pro, and semantic field
  metadata while keeping Seedream 5 Pro deferred;
- implement every stable guide placement, exact candidate query, subject
  repetition, Additional References, initial Profile/Hero/Storyboard selection,
  and non-blocking notice;
- complete exact Renku-generated and external-media attachment/provenance rules;
- keep the registry thin and remove every obsolete public purpose path directly.

Exit: Core and Engines expose the complete Plan `0135` product policy through
the current generic lifecycle, with no UI or adapter-owned policy.

### Slice 2: Restore Focused Non-Generation Take Domain Ownership

Files:

- `packages/core/src/client/shot-video-take-workspace.ts`;
- `packages/core/src/server/shot-video-take-workspace/*`;
- focused database access under the owning Core database-access folder;
- project-data-service wiring;
- Core tests.

Work:

- parse only the current version-3 take state;
- preserve continuous/multi-cut structure, composition, camera, cast/location
  direction, and dialogue inclusion;
- implement take list/read/create/discard/pick/shot-membership/design commands;
- restore Storyboard and final-video projections;
- keep take-owned copy, delete, restore, and Trash behavior;
- fail fast on invalid ownership or current-state shape;
- add no generation fields back into take state.

Exit: Takes and Shot Design can function without any generation-planning code.

### Slice 3: Connect Shot References To Generic Specs

Files:

- Core purpose guide and Shot workspace reference modules;
- generic spec queries/commands;
- Studio Shot service/controller files;
- existing Shot reference components only where type/callback plumbing must
  change.

Work:

- read General, Lookbook, Cast, Location, and Dialogue sections from the Core
  guide in their current order;
- preserve subject grouping, per-Shot scope, card previews, alternate pickers,
  dialogue playback, inclusion controls, and save feedback;
- persist exact selections in the active generic spec;
- use Studio server URL decoration only;
- remove non-current-request pricing tags from reference cards and omit
  dependency/candidate price fields from the current projection;
- retain the rest of each card's exact markup, geometry, and behavior;
- retain existing UI markup and interaction assertions.

Exit: the full References UX matches the baseline except for approved pricing-tag
removal, and no reference business rule lives in Studio.

### Slice 4: Connect AI Production To One Generic Request

Files:

- Engines semantic model field metadata;
- Core Shot generation-session projection;
- existing Studio AI Production service/hook/controller files;
- existing AI Production components only for direct current-type bindings.

Work:

- project input modes from Engines capabilities and the current spec;
- remove candidate/model pricing tags while keeping the existing current-request
  estimate in its exact location and presentation;
- remove the Status header and every Status cell so the Model table contains
  exactly Model and Duration;
- do not add model-row status/readiness fields to the current Core or HTTP
  projection;
- bind model, duration, provider fields, prompt, and reference assignments;
- autosave the generic spec with the existing save feedback;
- validate, estimate, approve, and run one provider request;
- show run progress, output review, and explicit import in the existing places;
- retain take context, group tags, table outer bounds/rows, controls, and
  failure behavior;
- do not recreate a production plan or child-generation estimate.

Exit: AI Production executes the new lifecycle and matches the baseline except
for the approved pricing-tag and Status-column removals.

### Slice 5: Restore Dialogue Audio Through Generic Generation

Files:

- Core Dialogue Audio workspace contracts/modules;
- Studio screenplay response decoration and dialogue service;
- existing Dialogue Audio hook/controller files;
- existing Dialogue Audio visual components unchanged except current-type
  plumbing.

Work:

- restore the exact context, setup autosave, model/voice choices, advanced
  settings, direct estimate, Generate action, takes, playback, and deletion;
- use Engines descriptors for provider fields;
- use one generic `scene.dialogue-audio` spec/run;
- attach the completed exact output to the existing dialogue take domain;
- preserve Shot dialogue selection against exact audio files;
- preserve resource refresh and header save feedback.

Exit: Narrative and Shot Dialogue Audio behavior matches the baseline.

### Slice 6: Restore Generation Preview Resource And Updates

Files:

- Core Generation Preview Resource projection modules;
- Studio projection/route/service;
- existing Preview hook/draft controller;
- existing Preview visual components with no markup or style changes.

Work:

- project the generic preview into the current dialog experience;
- preserve Prompt/References/Config, negative prompt, diagnostics, footer
  estimate, editable/read-only state, and structured failure behavior;
- update authored prompt and reference inclusion together through generic spec
  update;
- preserve latest-response-wins behavior;
- keep provider payloads safe and out of user-facing debug chrome.

Exit: every locked Preview screenshot and assertion passes.

### Slice 7: Restore Image Revision As A Focused Use Case

Files:

- Core Image Revision Workflow modules;
- Studio projection/route/service;
- existing Image Revision hook/controller;
- existing dialog components unchanged except current-type plumbing.

Work:

- retain Regenerate/Edit modes and source context;
- bind existing controls through Engines metadata;
- preserve optional references, preview, estimate, run, and destination
  attachment;
- use the generic `image.edit` lifecycle internally;
- preserve existing action placement on every eligible media card.

Exit: Image Revision matches every locked state.

### Slice 8: Reconnect Existing Non-Shot Entry Actions

Files:

- existing Studio services/routes and Core focused attachment commands;
- no new visible components or actions.

Work:

- connect the existing Location Hero action and existing media revision actions;
- preserve current Cast Voice behavior;
- preserve Lookbook, Cast, Location, and Storyboard media refresh/import flows;
- rename only the existing Lookbook and Location **Visual Content** tab labels
  to **Assets**;
- preserve the same tab ids, routes, selection state, layout, and contents;
- leave CLI/Skill-only purposes without a new Studio action;
- retain agent-owned Storyboard splitting and focused crop attachment.

Exit: every pre-work entry action works, the two approved tab labels read
**Assets**, and no new action appears.

### Slice 9: CLI, Skills, Migration, Documentation, And Runtime Restoration

Work:

- complete and verify every required generic CLI command;
- return the same Core context, settings, guide placements, candidates,
  selections, model availability, and notices through CLI and Studio;
- update every caller in the Plan `0134` handoff inventory and remove obsolete
  public paths without aliases, fallback routes, or compatibility readers;
- align Studio Skills with the final accepted contracts without describing UI
  changes;
- preserve the golden agent-owned Storyboard split and focused attachment
  workflow;
- apply the one-way migration under the documented backup process and verify
  migrated stable Shot placement ids;
- update current generation, frontend, CLI, and test-strategy docs;
- amend ADR `0047` and add the accepted supersession/closure notes to Plan
  `0135`;
- verify migration backups and the migrated `urban-basilica` database;
- run the complete real-project compatibility matrix without paid generation;
- run paid/provider work only with explicit approval-token authority.

Exit: no Plan `0134` handoff caller or retained Plan `0135` requirement remains
open; docs and Skills describe the same architecture; the real project matches
the locked experience.

## Tests And Guardrails

### Purpose, Settings, And Models

- every purpose inventory row has exactly one descriptor;
- fixed settings cannot be changed or removed;
- recommended settings initialize editable Studio state but enter CLI specs only
  when explicitly authored;
- untouched provider defaults remain absent;
- only accepted image models are selectable;
- Nano Banana Pro is selectable and Seedream 5 Pro is absent;
- obsolete models remain cataloged but unselectable;
- both audio purposes round-trip through the generic lifecycle.

### References, Attachments, And Guidance

- every stable section/slot id, cardinality, scope, and subject matches the
  accepted table;
- repeated Cast, Location, and Dialogue placements resolve exact subjects;
- multiple candidates feed the existing filtered picker;
- Profile/Hero/Storyboard initial selection and replacement behavior pass;
- generic `image.create` has no named typed slot;
- Renku-generated references retain real earlier provenance;
- external attachments have no synthetic spec/provenance and remain
  target-owned;
- Shot context includes exact dialogue audio;
- guide notices remain non-blocking and distinct from provider diagnostics;
- provider-required inputs still block validation, estimate, and run;
- no candidate/dependency price or estimate exists.

### Storyboard Golden Path

- deterministic 2x2 prompt/composite behavior is unchanged;
- 4:3 sheet and project-aspect panel intent are preserved;
- high quality is fixed and GPT Image 2 is recommended;
- first Storyboard Lookbook Sheet initializes when available;
- its absence produces only a non-blocking notice;
- no runtime splitting module or library exists;
- the agent Skill performs splitting and focused attachment.

### CLI And Projection Parity

- every required generic CLI command passes handler and integration tests;
- CLI and Studio serialize the same Core context/settings/guide/notices;
- reusable catalog listing excludes target-owned external attachments;
- every Plan `0134` handoff caller is resolved;
- obsolete public commands/routes/contracts are absent, not aliased.

### Visual Regression

- locked Playwright screenshots for every compatibility state;
- exact desktop viewport and deterministic fixtures;
- no baseline regeneration after implementation begins;
- render final and baseline images side by side during review;
- fail on every changed pixel outside the approved visual-diff manifest;
- assert that retained element bounding boxes do not move, except the approved
  internal Model/Duration column widths inside the unchanged table bounds;
- inspect every allowed price-tag, Status-column, and tab-label region rather
  than accepting threshold changes or broad screenshot masks.

### DOM And Interaction Characterization

- keep all existing visible-copy and role assertions except the exact assertions
  updated to require removed pricing tags, no Status column/cells, and the two
  **Assets** labels;
- keep tab, picker, hover, focus, playback, save, error, and dialog assertions;
- keep all take selection/grouping tests;
- keep all autosave/unmount-flush tests;
- keep all latest-request-wins tests;
- keep resource-refresh assertions;
- do not replace assertions with snapshots that are easier to update.

### Core Behavior

- current version-3 take state round-trips without generation fields;
- invalid state fails with structured diagnostics before writes;
- take commands validate Scene, Shot List, Shot, and file ownership;
- exact reference candidates and selections round-trip by slot/scope/subject;
- Dialogue Audio setup/run/attachment and Trash behavior round-trip;
- Image Revision uses one generic spec/run and exact attachment;
- no candidate/dependency estimate or non-current-request price field exists;
- no recursive estimate or automatic child spec exists;
- final video import remains take-owned and recoverable.

### Architecture Guardrails

- Studio feature code cannot import server/database modules;
- Studio routes cannot import Engines or implement purpose/asset rules;
- CLI and Studio cannot declare guide or model availability maps;
- Core workspace modules cannot import provider SDKs;
- Engines cannot import Studio targets or UI code;
- source scans protect forbidden dependency-graph capabilities without naming
  private functions;
- architecture tests protect stable import/capability boundaries, not current
  implementation names;
- no raw HTML interactive controls are added to feature code;
- no model-row status/readiness projection exists solely for the removed AI
  Production Status column;
- no test exclusion is added for a compatibility suite.

### Source-Diff Guardrails

Final review must separately inspect:

```bash
git diff HEAD -- packages/studio/src/ui packages/studio/src/styles packages/studio/src/assets
git diff HEAD -- packages/studio/src/features
git diff HEAD -- packages/studio/src/services packages/studio/server
```

The first command must be empty unless the user explicitly approved a primitive
bug fix after baseline review. In feature diffs:

- no visible string may change except deletion of non-current-request price
  text, deletion of the Status header/cell text, and the two exact **Visual
  Content** to **Assets** replacements;
- no `className`, component order, control variant, size, icon, or conditional
  rendering branch may change except removal of exact pricing-tag and Status
  column/cell branches and the Model table's three-column-to-two-column layout
  declaration;
- apart from the three exact approved UI deltas, changes must be limited to
  imports, current contract types, service calls, controller state, and
  callback/data plumbing;
- every changed `.tsx` file requires side-by-side screenshot evidence.

## Documentation

Update only current documentation:

- `docs/architecture/media-generation.md`;
- `docs/architecture/frontend.md` when the accepted experience projection
  boundary needs clarification;
- `docs/architecture/reference/front-end-guidelines.md` for the locked visual
  compatibility test pattern;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- `docs/architecture/reference/context-first-generation-foundation-manifest.md`;
- `docs/architecture/test-execution-strategy.md`;
- `docs/cli/commands.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `plans/active/0135-generation-purpose-guides-and-product-integration.md` only
  to record supersession when Plan `0136` is accepted and closure when Plan
  `0136` completes;
- current Studio Skills in the sister repository.

Do not perform naming sweeps through historical plans or ADRs.

## Final Verification

### Focused Commands

```bash
pnpm build:core
pnpm test:engines
pnpm test:cli
pnpm --filter @gorenku/studio test:typecheck
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio test:integration
pnpm --dir packages/studio test:e2e:compat
pnpm --dir packages/studio test:e2e:smoke
pnpm --dir packages/studio test:e2e
```

### Root Commands

```bash
pnpm build
pnpm test
pnpm test:integration
pnpm lint
pnpm check
pnpm test:final
```

### Real `urban-basilica` Compatibility Run

Exercise, capture, and compare:

1. Every purpose inventory row through Core context/guide/spec validation.
2. Every image purpose through its existing Studio action or CLI/Skill surface.
3. Generation Preview saved and unsaved states.
4. Image Regenerate and Edit from every current eligible card action.
5. Fixed settings cannot change, recommended settings initialize editable UI,
   and untouched provider defaults remain absent.
6. Allowed image models, Nano Banana Pro, deferred Seedream 5 Pro, and unchanged
   video-model availability.
7. Cast profile first-sheet selection, alternate selection, Character Sheets,
   and Voice Sample media/playback.
8. Location **Assets** tab, hero first-sheet selection, alternate selection, and
   multiple Location Sheet states.
9. Movie and Storyboard Lookbook **Assets** states.
10. Scene Storyboard Sheet deterministic 2x2 composite, initial Storyboard
    Lookbook Sheet, missing-sheet notice, agent-owned split, and focused attach.
11. Scene Narrative and Dialogue Audio Dialog/Takes/Advanced flows.
12. Shot rail selection and every Shot Design tab.
13. Every stable Shot First/Last/Prompt/Lookbook/Cast/Location/dialogue guide
    placement through both Studio and CLI.
14. Single-candidate preview and multi-candidate alternate picker flows.
15. Missing optional reference notices remain non-blocking while
    provider-required missing inputs block estimate/run.
16. Continuous and multi-cut take direction edits with save feedback.
17. AI Production input mode, exact Model/Duration table with no Status column,
    settings, prompt, unchanged current-request estimate, validation, simulated
    run, output review, and import.
18. Takes cards, Storyboard previews, final video, hover/focus playback, pick,
    delete confirmation, and shot selection edits.
19. CLI/Skill media attachment followed by Studio resource refresh.
20. One Renku-generated attachment and one external attachment with their
    different provenance/ownership and unchanged card presentation.
21. Every generic CLI command and Studio/CLI context projection parity.
22. Every Plan `0134` caller-handoff entry resolved against a current contract.

Do not invoke a paid provider merely to satisfy compatibility evidence. Use
simulation and existing media unless the user separately approves a live run.

### Final Shape Review

- inspect complete staged plus unstaged diff;
- compare the baseline/final generation manifests;
- inspect the deleted/replacement backend trees and confirm the combined
  `0134` + `0136` result is a significant conceptual and code-structure
  simplification without using a numeric deletion quota;
- inspect every new or heavily modified file over 200 lines;
- confirm Core use-case folders remain focused;
- confirm `index.ts` entrypoints remain thin;
- confirm no deleted dependency policy moved into a workspace projection;
- confirm no UI test assertion was weakened;
- confirm every final compatibility screenshot matches exactly outside the
  approved visual-diff manifest;
- confirm no Studio production file remains deleted;
- confirm the user has reviewed the visual comparison before Plan `0136` is
  marked complete and Plan `0135` receives its closure note.

## Implementation Verification Evidence

Verified on 2026-07-13:

- the locked desktop compatibility suite passed with 11 screenshots and the
  approved-delta DOM contract, including exact retained model-family order,
  duration labels, table bounds, and per-row heights;
- Core, CLI, Engines, and Studio unit and integration suites passed;
- root build, test, integration, lint, type, architecture, and test-partition
  gates passed;
- `pnpm test:final` exited successfully, including the final 5/5 desktop smoke
  phase, when run with browser launch permission after sandboxed Chromium was
  denied its macOS rendezvous port before opening a page;
- the real `urban-basilica` database migrated with 35 take-to-shot rows, 4
  final-video rows, 13 generic specs, 31 exact reference selections, and 30
  version-3 takes preserved; SQLite quick-check and foreign-key check passed;
- `src/ui`, `src/styles`, and `src/assets` have no diff, and no raw HTML
  feature control was added;
- the one deleted Studio server file is the obsolete reusable take-input HTTP
  adapter required to remain physically absent by the combined Plan 0134/0136
  backend contract. No retained Studio UI or server production surface was
  deleted;
- unmasked baseline/current evidence was exported for user review. Plan 0136
  remains active until that review is accepted, after which the Plan 0135
  closure note and final completion markers can be written.

## Completion Checklist

### Review Area

- [x] Confirm the only approved visible changes are non-current-request pricing
      tag/badge removal, AI Production Status-column removal, and the two
      **Visual Content** to **Assets** label changes.
- [x] Confirm current-generation pricing retains its exact existing UI.
- [x] Confirm `packages/studio` started from exact pre-work `HEAD`.
- [x] Confirm Plan `0136` supersedes all Plan `0135` implementation and
      checklist authority while retaining every non-conflicting requirement.
- [x] Confirm the implementation preserves accepted package boundaries.
- [x] Confirm centralized Core ownership did not become a monolith.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, god file, shim, facade, or
      compatibility barrel was added.

### Plan Consolidation And Plan 0134 Handoff

- [x] Confirm every Plan `0135` product, architecture, CLI, Skill, migration,
      test, documentation, and verification requirement has a Plan `0136`
      owner or an explicit rejected-conflict disposition.
- [x] Confirm Plan `0135` has no independent remaining implementation phase or
      checklist after Plan `0136` acceptance.
- [ ] Add the Plan `0135` supersession note only after Plan `0136` is accepted.
- [x] Confirm the Plan `0134` focused Engines/Core checkpoint gates passed.
- [x] Confirm the generated Drizzle migration and migration-on-copy evidence
      remain valid.
- [x] Review and resolve every entry in the Plan `0134` caller-handoff
      inventory.
- [x] Confirm no unrelated failure is mislabeled as expected intermediate
      breakage.
- [x] Confirm obsolete backend contracts remain physically absent and were not
      recreated for unchanged callers.

### Baseline Evidence

- [x] Capture every compatibility-matrix state from isolated pre-work `HEAD`.
- [x] Inspect and accept every baseline screenshot before implementation.
- [x] Lock the Playwright baseline images against updates.
- [x] Record removed pricing-tag regions, AI Production Model-table geometry,
      and both renamed tab-label regions as the sole approved visual-diff
      manifest.
- [x] Record existing DOM, copy, role, focus, and interaction assertions.
- [x] Confirm browser capture uses desktop viewports only.
- [x] Name every visible state that previously depended on deleted backend
      policy before implementing its current contract.

### Architecture And Contracts

- [x] Implement exactly one focused purpose descriptor per inventory row.
- [x] Add deliberate current contracts for Preview, Image Revision, Dialogue
      Audio, and Shot Video Take workspace.
- [x] Keep generic generation lifecycle in the existing Core generation module.
- [x] Keep non-generation take design state in a separate focused Core module.
- [x] Keep provider field semantics and model availability in Engines.
- [x] Keep purpose guides and exact asset eligibility in Core.
- [x] Keep routes thin and Studio services transport-only.
- [x] Keep feature code free of project/provider business rules.
- [x] Add no generic state patch command.
- [x] Add no provider-field guessing.
- [x] Add no automatic child spec, dependency graph, recursive estimate, or
      synthetic prompt.
- [x] Add no candidate/dependency estimate, non-current-request price field,
      tag, badge, or cost total.
- [x] Add no model-row status/readiness projection solely for the removed AI
      Production Status column.
- [x] Keep package-boundary diagnostics structured.

### Product Settings And Models

- [x] Keep untouched provider defaults absent from authored state.
- [x] Enforce fixed Studio settings so they cannot change or be removed.
- [x] Initialize recommended settings as editable Studio state.
- [x] Expose recommendations as CLI/agent guidance without silently authoring
      them into specs.
- [x] Bind settings through Engines semantic field metadata only.
- [x] Make GPT Image 2, Nano Banana 2, Nano Banana Pro, and xAI Grok Imagine
      Image 1.5 selectable for accepted image routes.
- [x] Keep Seedream 5 Pro deferred.
- [x] Keep obsolete catalog models cataloged but unselectable.
- [x] Keep existing video-model availability unchanged.

### Purpose Guides, Attachments, And Provenance

- [x] Complete all fourteen purpose inventory rows, including both audio
      purposes.
- [x] Implement every accepted stable section/slot id exactly.
- [x] Implement cardinality, Shot scope, subject repetition, exact candidates,
      selections, and Additional References.
- [x] Keep generic `image.create` free of named typed slots.
- [x] Initialize Profile and Hero from the first matching sheet and allow
      replacement through the existing picker.
- [x] Include Shot dialogue audio as exact subject-scoped guidance.
- [x] Keep guide notices non-blocking and separate from provider diagnostics.
- [x] Attach Renku-generated media with its real earlier spec/provenance.
- [x] Attach external media without a synthetic generation spec/provenance.
- [x] Keep external attachments target-owned and out of reusable catalogs.
- [x] Keep all prompt and media contents opaque.

### Storyboard Sheet Golden Workflow

- [x] Preserve the deterministic 2x2 prompt/composite workflow.
- [x] Preserve 4:3 sheet and project-aspect Shot panel intent.
- [x] Keep high quality fixed and GPT Image 2 recommended.
- [x] Initialize the first Storyboard Lookbook Sheet when available.
- [x] Show a non-blocking notice when it is absent.
- [x] Preserve agent/Skill-owned splitting and focused attachment.
- [x] Add no runtime image-splitting library or automatic split module.

### Take Lifecycle And Shot Design

- [x] Restore list, create, read, discard, pick, and shot replacement commands.
- [x] Preserve Storyboard and final-video take cards.
- [x] Preserve hover/focus playback and delete confirmation.
- [x] Preserve contiguous/non-contiguous shot selection behavior.
- [x] Preserve continuous/multi-cut structure behavior.
- [x] Preserve composition, camera motion, cast/location direction, and
      dialogue inclusion state.
- [x] Preserve autosave, unmount flush, and detail-header save feedback.
- [x] Preserve take-owned file copy/delete/restore behavior.
- [x] Keep generation values and exact references out of take state.

### References

- [x] Preserve General, Lookbook, Cast, Location, and Dialogue order.
- [x] Preserve per-Shot scope and subject grouping.
- [x] Preserve exact ready cards and existing placeholder card presentation.
- [x] Remove non-current-request pricing tags without replacing their copy or
      moving retained card content.
- [x] Preserve single-candidate preview and multi-candidate picker behavior.
- [x] Preserve image revision actions on reference media.
- [x] Preserve dialogue playback and take management.
- [x] Persist include/exclude and alternate selection in the generic spec.
- [x] Keep candidate/dependency price fields out of Core projections, HTTP
      responses, Studio services, fixtures, and component props.
- [x] Source every remaining displayed price only from the one current
      generation request estimate.
- [x] Keep notices separate from provider diagnostics without changing their
      accepted placement.

### AI Production

- [x] Preserve the existing input-mode, Model-table outer bounds/rows,
      route-settings, prompt, estimate, run, review, and import layout.
- [x] Remove the Status header and all Status cells.
- [x] Keep exactly Model and Duration columns.
- [x] Do not project or render `Input required`, `Unavailable`, or a replacement
      model-row status label.
- [x] Derive capabilities from Engines metadata.
- [x] Bind duration and provider settings without field-name guesses.
- [x] Validate and estimate one exact request.
- [x] Preserve run progress and structured failures.
- [x] Preserve output review and explicit final-video import.
- [x] Add no production plan, preflight graph, or child generation.

### Dialogue Audio

- [x] Preserve Dialogue Audio panel entry and layout.
- [x] Preserve Dialog, Takes, and Advanced tabs.
- [x] Preserve text/settings autosave and unmount flush.
- [x] Preserve model/voice choices and provider capability warnings.
- [x] Preserve direct estimate and Generate behavior.
- [x] Preserve takes, playback, labels, duration, and deletion.
- [x] Preserve Shot dialogue selection and inclusion.
- [x] Use the generic spec/run internally and focused attachment afterward.

### Generation Preview And Image Revision

- [x] Preserve all Preview tabs, copy, controls, diagnostics, footer, and dialog
      behavior.
- [x] Preserve saved/editable and unsaved/read-only states.
- [x] Preserve negative prompt behavior where supported.
- [x] Preserve combined prompt/reference update and latest-response-wins.
- [x] Preserve Regenerate/Edit modes and source context.
- [x] Preserve Image Revision controls, references, estimate, run, and failure
      behavior.
- [x] Preserve every existing card entry action.

### Non-Shot Surfaces

- [x] Preserve Cast Details/Assets, media grids, Voice Samples, and playback.
- [x] Rename the existing Location **Visual Content** tab to **Assets** while
      preserving its id, route, layout, contents, hero, sheets, and actions.
- [x] Rename the existing Lookbook **Visual Content** tab to **Assets** while
      preserving its id, route, layout, contents, images, sheets, and actions.
- [x] Preserve Scene Storyboard agent-owned split/import behavior.
- [x] Add no new visible generation button or entry point.
- [x] Preserve resource refresh after CLI/Skill attachment.

### Tests And Guardrails

- [x] Add purpose/settings/model/reference/attachment/Storyboard behavior tests
      listed above.
- [x] Add generic CLI command and Studio/CLI projection-parity tests.
- [x] Keep every existing Studio visual/interaction assertion except the exact
      assertions updated for the three approved visible changes.
- [x] Update fixtures, types, and approved-delta assertions without weakening
      any other assertion.
- [x] Add locked Playwright compatibility screenshots.
- [x] Add focused Core use-case behavior tests.
- [x] Add import/capability architecture tests without private-name needles.
- [x] Verify invalid state fails before durable writes.
- [x] Verify no raw HTML feature controls were added.
- [x] Verify no compatibility suite was skipped or excluded.

### Documentation And Skills

- [x] Update current generation and frontend architecture docs.
- [x] Update CLI and test-strategy docs.
- [x] Amend ADR `0047` with the accepted focused experience resources.
- [x] Record Plan `0136` as superseding all Plan `0135` implementation and
      checklist authority after acceptance.
- [ ] Add the Plan `0135` closure note after Plan `0136` completes.
- [x] Align current Studio Skills without duplicating runtime rules. Plan
      `0137` contains the final sister-repository rewrite and verification
      evidence after this runtime integration landed.
- [x] Preserve golden agent-owned Storyboard splitting instructions.
- [x] Leave historical plans and ADRs unchanged except where they explicitly
      document the newly accepted decision.

### Final Verification

- [x] Run every focused command listed above.
- [x] Run every root command listed above.
- [x] Complete every `urban-basilica` compatibility scenario.
- [x] Compare every final screenshot to the locked baseline with zero changed
      pixels outside the exact approved visual-diff manifest.
- [x] Confirm price-tag removal and tab-label replacement did not move or resize
      retained elements.
- [x] Confirm the AI Model table retained its outer bounds and row heights while
      changing internally to exactly Model and Duration.
- [x] Inspect the full feature diff for copy, class, structure, and control
      changes.
- [x] Confirm `src/ui`, `src/styles`, and `src/assets` have no unapproved diff.
- [x] Confirm no Studio production file is deleted.
- [x] Review complete staged plus unstaged diff and final manifests.
- [x] Inspect deleted/replacement backend trees and confirm the combined result
      is significantly simpler without a numeric code quota.
- [x] Inspect every new or heavily modified large file.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no dependency/planning complexity moved elsewhere.
- [x] Confirm no checklist item relies on unreviewable structure or weakened
      evidence.
- [ ] Obtain user review of the side-by-side compatibility evidence.
- [x] Confirm no retained Plan `0135` requirement remains open.
- [ ] Only then mark Plan `0136` complete and record Plan `0135` as superseded
      with all retained work completed through Plan `0136`.
