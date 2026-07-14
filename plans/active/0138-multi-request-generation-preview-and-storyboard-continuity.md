# 0138 Multi-Request Generation Preview And Storyboard Continuity

Status: complete

Date: 2026-07-14

## Summary

Fix two failures exposed by the seven-shot Scene Storyboard workflow without
introducing a Preview-review domain, storyboard-specific generation contracts,
or another request-planning system.

The intended outcome is:

- `generation preview show` can send one or more ordinary
  `GenerationPreview` values to Studio in a single ordered array;
- the existing Preview dialog opens on the first request and shows `1 / N`
  with previous/next controls at the far right of the existing tab row;
- every request remains an independent `GenerationSpec`, Preview, estimate,
  approval, and run;
- the existing `GenerationContext` can expose opaque agent-readable source
  text through the general `facts.contextText` convention;
- the existing `GenerationReferenceGuide` presents Scene-related Cast and
  Location candidates and exact currently selected files using reusable
  owner/role/selection queries;
- the Media Producer agent reads the existing Scene Shot List context, chooses
  the one-to-four-Shot batches, selects only the references relevant to each
  request, and performs continuity review before generation.

The implementation must reuse the current generic generation lifecycle:

```text
existing domain context
        ↓
GenerationContext + GenerationReferenceGuide
        ↓
one or more ordinary GenerationSpecs
        ↓
one or more ordinary GenerationPreviews
```

This plan does not add:

- `GenerationPreviewReviewRequest` or `GenerationPreviewReview`;
- a Preview-review JSON document, id, service, persistence model, or ADR;
- `SceneStoryboardShotSelection` or `SceneStoryboardContextFacts`;
- Shot List flags on `generation context`;
- a storyboard-specific context service or fact resolver;
- readiness-dimension booleans;
- historical, political, costume, architecture, or narrative data models;
- a combined estimate, approval token, run, or receipt;
- a new per-Shot storyboard purpose;
- compatibility events, aliases, or wrapper APIs.

## Evidence And Failure Reconstruction

The audited task authored two ordinary transient `scene.storyboard-sheet`
specs:

- sheet 1 covered Shots 1-4;
- sheet 2 covered Shots 5-7.

The agent invoked `generation preview show` once per file. Each CLI invocation
sent a separate `studio.generationPreviewRequested` event. The Studio host
stores one event in one state value, so the second event replaced the first.
The user saw only Shots 5-7 until the first preview was sent again.

The real `$HOME/renku-movies/urban-basilica` project already contained:

- Urban and Mara character-sheet media;
- Harbor Quarter environment media;
- Storyboard Lookbook source media;
- screenplay and Scene narrative describing late-1452 Constantinople.

The generation failed because the agent did not pass those exact files and the
current Scene Storyboard guide exposes only a Storyboard Lookbook Sheet slot.
The project did not need a new historical schema or parsed narrative model.
The agent needed readable existing narrative plus exact reference candidates
and selection state.

## Context And Constraints

This plan is constrained by:

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/architecture/naming-guidelines.md`;
- `docs/architecture/coding-practices.md`;
- `docs/architecture/front-end-guidelines.md`;
- active Plan `0136` for the current generation integration;
- completed Plan `0137` for the current Studio Skills generation workflow;
- the source Studio Skills repository at
  `$HOME/Projects/aitinkerbox/studio-skills`;
- the real verification project at
  `$HOME/renku-movies/urban-basilica`.

Plan `0136` remains the authority for the current backend cutover. This plan
is a narrow behavior correction on top of that architecture.

## Accepted Design

### Multiple Preview Is An Array, Not A Domain

The Preview interaction accepts an ordered array:

```ts
previews: GenerationPreview[]
```

The Studio-safe event contains the projected equivalent:

```ts
previews: GenerationPreviewResource[]
```

There is no wrapper resource and no durable collection identity. The
coordination event id identifies the UI request. Array order controls display
order.

The CLI builds every ordinary Preview before notifying Studio. If any Preview
fails, it sends no notification. This gives the user one complete display
request without inventing batch-generation semantics.

### Domain Context Is Not Duplicated Into Generation

The Media Producer continues to read:

```bash
renku screenplay shot-list context --scene <scene-id> --include-visual-references --json
```

and the exact saved Scene Shot List. That existing domain context owns:

- Scene blocks and setting;
- Cast and Locations;
- active Shot List identity;
- exact Shot direction;
- screenplay and Lookbook context.

The agent decides which one-to-four Shots belong in each provider request.
`generation context` does not receive the Shot List or Shot subset and does
not repeat Shot List validation.

### Opaque Context Text Uses One General Convention

`GenerationContext.facts` already carries target-resolved JSON-safe context.
Use one general optional key:

```ts
facts.contextText?: string
```

For a Scene target, `contextText` is a readable presentation of the existing
authored Scene narrative in block order. It may contain the existing Scene
heading/setting, action, dialogue, and other authored blocks.

The renderer is presentation-only. It must not:

- summarize or rewrite the Scene;
- infer year, political control, temporal boundaries, costume, architecture,
  prohibited imagery, or negative prompts;
- score or validate narrative contents;
- create durable or parallel state;
- replace the structured `Scene`, `Block`, dialogue, setting, or
  `SceneNarrativeResource` contracts used by Studio.

`facts.contextText` is purpose-agnostic. Other target kinds may use the same
convention later if a concrete workflow needs opaque authored text. This plan
populates it only for current Scene-target generation.

### Reference Guides Remain The General Reference Abstraction

Do not add storyboard reference DTOs. Continue to use:

- `GenerationReferenceGuideSection`;
- `GenerationReferenceGuideSlot`;
- `GenerationReferenceCatalogItem`;
- `GenerationReferenceSelection`;
- existing placement `scope` and `subject`;
- exact `asset-file` and `project-file` references.

Improve the generic guide builder so candidate files and current selected files
are separate inputs. Conceptually:

```ts
interface GuideSlotDefinition {
  // existing fields
  assetFileIds?: string[];
  selectedAssetFileIds?: string[];
}
```

`assetFileIds` limits the candidates. `selectedAssetFileIds` initializes
only exact files whose current domain relationship has
`selection = 'select'`. Existing deliberate `initializeFirst` behavior for
other purposes is not silently redefined in this slice.

Add one internal owner/role/selection query that can serve every
relationship-backed purpose:

```ts
listSelectedGenerationReferenceFileIds({
  session,
  owner,
  roles,
})
```

The final name may match an existing database-access naming family, but the
function must remain generic across the current asset-relationship owners such
as Cast, Location, and Scene. It returns ordered exact asset-file ids and does
not guess from filesystem paths or unselected Takes. Selected Lookbook Sheets
continue through the existing Lookbook-owned query; do not broaden the asset
relationship model merely to force Lookbooks through this helper.

Add one reusable owner-slot composition function only if the final
`scene.storyboard-sheet` and `shot.video-take` implementations would
otherwise duplicate the same loops. It may accept:

- section/slot labels;
- owner kind and ordered owner ids;
- accepted roles;
- optional scope.

It must return existing `GuideSlotDefinition` values. It must not introduce a
second reference-guide schema or a declarative purpose language.

### Scene Subject Resolution Is Target-Scoped

Core needs the Cast and Location owners related to a Scene so the guide can
offer relevant candidates. Resolve those as general Scene-target facts:

```text
sceneCastMemberIds
sceneLocationIds
```

Reuse these existing fact names. Collect ids from the existing screenplay Scene
and current Scene Shot List relationships in deterministic first-appearance
order. Do not return per-Shot generation facts. The agent already has per-Shot
membership from the Shot List context.

This is reusable by any Scene-targeted generation purpose. It is not a
Storyboard context contract.

### Purpose Files Compose Primitives

`scene-storyboard-sheet.ts` remains purpose-specific only where the product
really is purpose-specific:

- output media kind;
- fixed 4:3/high-quality settings;
- Storyboard Lookbook reference slot;
- Cast continuity reference roles;
- Location continuity reference roles.

The file reads `sceneCastMemberIds` and `sceneLocationIds`, then composes
ordinary guide slots through the generic builder.

Core presents candidates and exact project selections. It does not implement a
fallback priority or select a profile, Location Hero, generic Lookbook image,
or first alphabetic file. The Media Producer skill decides which offered
reference is creatively appropriate for the current request.

### Continuity Preflight Remains Agent-Owned

For each one-to-four-Shot request, the Media Producer:

1. reads the existing Shot List context and exact saved Shot List;
2. reads `generation context` for settings, models, guide candidates, selected
   references, and `facts.contextText`;
3. identifies the Cast Members and Locations used by that Shot subset;
4. includes exact relevant style, Cast, and Location references;
5. inspects every reference before Codex ImageGen;
6. assigns every Renku-managed reference to an actual provider media field;
7. stops for user direction when continuity media is unavailable rather than
   silently generating with weaker context;
8. validates and shows all ordinary specs in one Preview invocation.

Core does not reject a provider-valid request because a creative guide slot is
empty. Engines remains the sole owner of provider media fields, cardinality,
payload validation, and capacity errors.

## Architecture Shape Gate

### Ownership

- `packages/core` owns target-resolved context text, reference catalog access,
  exact selected relationship resolution, existing guide composition, Preview
  projection, and coordination event contracts.
- `packages/cli` parses repeated Preview inputs, calls the existing one-spec
  Preview service once per input, and sends one ordered array.
- `packages/studio/server` authenticates one notification, projects each
  Preview through the existing projection, and appends one event.
- `packages/studio/src/features/generation-preview` owns only active-index
  navigation and display of ordinary Preview entries.
- Studio Skills owns Shot batching, reference relevance, prompt composition,
  continuity preflight, ImageGen use, visual inspection, crop choice, and
  attachment.
- Engines owns provider schemas and execution validation.

### Intended Code Shape

Core should modify existing owners:

```text
packages/core/src/client/generation.ts
  retain existing contracts; document/use facts.contextText

packages/core/src/server/generation/purpose-context.ts
  add focused Scene-target facts without purpose-specific request types

packages/core/src/server/generation/purpose-guide.ts
  accept exact selectedAssetFileIds and optionally compose owner slots

packages/core/src/server/database/access/generation-references.ts
  expose exact selected relationship/file ids in relationship order

packages/core/src/server/generation/purposes/scene-storyboard-sheet.ts
  compose existing generic slots only

packages/core/src/server/studio-coordination/events.ts
packages/core/src/server/studio-coordination/event-validation.ts
  replace one preview field with an ordered previews array
```

If rendering `facts.contextText` is more than a small focused private
function, add exactly one pure presentation module:

```text
packages/core/src/server/screenplay-scene-context-text.ts
```

It may render an existing Scene and Cast labels into text. It must not own
generation rules or introduce a public screenplay model.

CLI modifies existing files only:

```text
packages/cli/src/cli.ts
packages/cli/src/commands/generation-command-handlers.ts
packages/cli/src/commands/studio-notification-client.ts
```

Do not add a Preview collection document parser or command family.

Studio server modifies:

```text
packages/studio/server/routes/studio-events.ts
packages/studio/server/projections/generation-preview.ts
```

Studio React modifies:

```text
packages/studio/src/app/use-studio-coordination.ts
packages/studio/src/services/studio-current-contracts.ts
packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx
packages/studio/src/features/generation-preview/generation-preview-dialog.tsx
packages/studio/src/features/generation-request-editor/generation-request-editor.tsx
```

One small `generation-preview-request-panel.tsx` child is allowed if it is
needed to keep one existing `useGenerationPreviewEditor` instance mounted per
Preview. Do not add a collection editor hook or state framework.

Studio Skills modifies existing files:

```text
skills/media-producer/SKILL.md
skills/media-producer/references/workflow.md
skills/media-producer/references/scene-storyboard-sheet.md
skills/media-producer/samples/scene-storyboard-sheet-spec.json
```

Do not add a Preview-review sample format. Update the source repository, never
the installed plugin cache.

### Public Entrypoints

- Keep `ProjectDataService.buildGenerationPreview(...)` as the only generic
  Preview builder. Do not add a collection service.
- Keep `ProjectDataService.buildGenerationContext(...)` and its existing
  purpose/target input. Do not add Shot selection input.
- `renku generation preview show` accepts one or more repeated `--file`
  values or one or more repeated `--spec` values.
- Replace the singular coordination payload directly with
  `studio.generationPreviewsRequested` carrying `previews`.
- Keep all individual preview, update, estimate, and run endpoints unchanged.

### Forbidden Shapes

Do not:

- add a Preview collection/review type, file format, service, id, table, or
  resource;
- add a Core batch Preview builder;
- add purpose-specific public context input or output types;
- pass Shot List ids or Shot ids through generation context;
- copy the Scene Shot List context into generation context;
- build another domain context command for Storyboards;
- add a universal purpose DSL, dynamic UI schema, or target graph;
- add a time-window UI aggregator that guesses which events belong together;
- put Cast/Location/Lookbook selection rules in CLI, Studio server, or React;
- initialize continuity media from the first candidate;
- infer selected relationships from filesystem presence;
- parse `contextText` into semantic or historical fields;
- alter existing structured screenplay parsing used by Studio;
- add runtime prompt/image content validation;
- add combined pricing, approval, execution, or attachment behavior;
- refactor Shot Video Take context merely to make this plan look symmetric;
- redesign Director readiness in this slice;
- add a new ADR for an array-valued coordination payload;
- add raw HTML controls in Studio feature code;
- add compatibility aliases, re-export facades, catch-all helpers, or broad
  dispatchers.

### Stop Conditions

Stop and revise before implementation continues if:

- multiple Preview requires a wrapper concept beyond an ordered array;
- the CLI begins implementing Core Preview or reference logic;
- one request's estimate, approval, or run state is shared with another;
- a new public type contains `Storyboard` solely for generation context;
- generation context starts validating Shot List membership;
- `contextText` becomes a replacement for the UI's structured Scene model;
- purpose-guide changes create another schema beside
  `GenerationReferenceGuide`;
- a purpose file performs database queries that belong in generic reference
  access;
- the proposed generic helper is used only by Storyboards and merely hides
  special-purpose logic;
- the implementation expands into Director readiness, a historical schema, or
  per-Shot generation;
- an existing entrypoint or `index.ts` becomes a god module.

## Contracts

### CLI Preview Inputs

Support:

```bash
renku generation preview show \
  --file tmp/sheet-1.json \
  --file tmp/sheet-2.json \
  --project urban-basilica \
  --json
```

and:

```bash
renku generation preview show \
  --spec media_generation_spec_1 \
  --spec media_generation_spec_2 \
  --project urban-basilica \
  --json
```

Rules:

- accept one or more `--file` values or one or more `--spec` values;
- preserve command-line order;
- reject mixing `--file` and `--spec`;
- build every Preview before notifying Studio;
- send no partial notification when one input fails;
- retain the existing single-value behavior through the same array path;
- do not save transient files or mutate specs while showing Preview.

Return:

```json
{
  "valid": true,
  "requestCount": 2,
  "studio": { "delivery": "delivered" }
}
```

Use existing structured CLI error machinery for missing, mixed, invalid, or
unresolved inputs. Add only the minimum new diagnostic needed for mixed input
kinds if no existing diagnostic has the same meaning.

### Notification And Event

The CLI notification body becomes:

```ts
interface StudioGenerationPreviewsNotification {
  projectRef: StudioProjectRef;
  previews: GenerationPreview[];
  source: { kind: 'cli'; command: 'generation preview show' };
  operationId?: string;
}
```

The stored Studio event becomes:

```ts
interface StudioGenerationPreviewsRequestedEvent extends StudioEventBase {
  type: 'studio.generationPreviewsRequested';
  projectRef: StudioProjectRef;
  previews: GenerationPreviewResource[];
}
```

These update the current contracts directly. Do not keep singular aliases.

The Studio server:

1. validates the array contains at least one Preview;
2. projects each Preview using the existing Core and Studio projection path;
3. rejects before event append if any projection/reference is invalid;
4. appends one event containing the ordered projected array.

No event payload may contain local absolute paths, provider upload URLs,
secrets, or unresolved browser URLs.

### Preview Dialog

The host receives `previews` and opens one dialog.

For `previews.length > 1`, the existing Prompt/References/Config tab row shows:

- `1 / 2`, `2 / 2`, and so on;
- a shadcn `Button` with accessible label “Previous generation request”;
- a shadcn `Button` with accessible label “Next generation request”.

Previous is disabled at the first entry and Next at the last. The navigation is
absent for one Preview, preserving the current single-request appearance.

The dialog:

- starts at index 0;
- keeps the same Prompt/References/Config tab selected while navigating;
- displays the active Preview's title, prompt, references, configuration,
  diagnostics, estimate, read-only state, and Update action;
- preserves each mounted request panel's local editor state;
- updates only the active saved spec;
- closes all entries together;
- replaces the array only when a later complete event arrives.

Reuse `LineTabBar.trailing`. Keep `GenerationRequestEditor` generic by
accepting an optional trailing node; it must not learn about arrays or indices.

### General Context Text

For a Scene target, generation context includes:

```json
{
  "facts": {
    "contextText": "EXT. HARBOR QUARTER — EVENING\n\n..."
  }
}
```

The exact formatting should follow existing screenplay terminology and block
order. It may resolve a Cast id to the existing Cast label for readable
dialogue attribution. It must preserve authored block text and dialogue lines.

This is a presentation projection, not a serialized screenplay format. Do not
round-trip it, validate it, persist it, or consume it in Studio UI.

### Generic Scene Reference Guide

For `scene.storyboard-sheet`, the existing guide contains:

```text
visual-language / storyboard-lookbook-sheet
cast / character-sheet — one ordinary slot per Scene Cast owner
location / location-sheet — one ordinary slot per Scene Location owner
```

Use existing `subject` values to identify owners. Do not add per-Shot facts or
new scope types. The agent maps the exact Shot subset to the relevant owners
using the existing Shot List context.

Candidate roles may include existing Cast and Location visual roles appropriate
to continuity. Core does not rank creative fallbacks. Exact domain-selected
files initialize `selections`; other valid files remain candidates.

Missing selections remain visible as empty selections. The Media Producer skill
stops or asks for direction. Generic execution validation does not fail solely
because those selections are empty.

## Implementation Slices

### Slice 1: Ordered Preview Arrays

Files:

- `packages/cli/src/cli.ts`;
- `packages/cli/src/commands/generation-command-handlers.ts`;
- `packages/cli/src/commands/studio-notification-client.ts`;
- `packages/core/src/server/studio-coordination/events.ts`;
- `packages/core/src/server/studio-coordination/event-validation.ts`;
- `packages/studio/server/routes/studio-events.ts`;
- `packages/studio/server/projections/generation-preview.ts`;
- `packages/studio/src/services/studio-current-contracts.ts`;
- `packages/studio/src/app/use-studio-coordination.ts`;
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`;
- `packages/studio/src/features/generation-preview/generation-preview-dialog.tsx`;
- `packages/studio/src/features/generation-request-editor/generation-request-editor.tsx`;
- one optional focused request-panel component;
- associated focused tests.

Work:

- preserve repeated `--file` or repeated `--spec` values;
- call the existing one-request Preview builder for each input;
- notify once with an ordered array;
- project all entries before one event append;
- replace the singular event contract directly;
- add active-index navigation through the existing tab-row trailing slot;
- keep one existing editor hook instance mounted per Preview when needed;
- preserve single-request behavior.

Exit: two ordinary specs produce one visible `1 / 2` dialog without any new
collection domain or generation lifecycle.

### Slice 2: Generic Context Text And Selected References

Files:

- `packages/core/src/server/generation/purpose-context.ts`;
- optional `packages/core/src/server/screenplay-scene-context-text.ts`;
- `packages/core/src/server/database/access/generation-references.ts`;
- `packages/core/src/server/generation/purpose-guide.ts`;
- `packages/core/src/server/generation/purposes/scene-storyboard-sheet.ts`;
- associated Core and CLI integration tests.

Work:

- add Scene-target `facts.contextText` without a new public type;
- preserve existing structured Scene/UI resources unchanged;
- expose deterministic `sceneCastMemberIds` and `sceneLocationIds` as
  existing generic facts;
- add an exact selected owner/role asset-file query;
- let ordinary guide slots initialize from explicit selected asset-file ids;
- optionally extract ordinary owner-slot composition only where it removes
  demonstrated duplication;
- compose Storyboard Lookbook, Cast, and Location slots in the existing purpose
  descriptor;
- leave Shot selection, role relevance, and creative fallback choice to the
  agent.

Exit: Scene-target purposes can expose readable source text and exact selected
reference files without a Storyboard request/facts model.

### Slice 3: Media Producer Workflow And Documentation

Files in `$HOME/Projects/aitinkerbox/studio-skills`:

- `skills/media-producer/SKILL.md`;
- `skills/media-producer/references/workflow.md`;
- `skills/media-producer/references/scene-storyboard-sheet.md`;
- current Scene Storyboard samples only;
- affected existing specialist handoffs only where their commands change.

Files in Studio:

- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/reference/studio-skills.md`;
- current CLI help/examples;
- this plan's completion evidence.

Work:

- keep Shot List reading and one-to-four batching agent-owned;
- use `facts.contextText` as opaque narrative context;
- choose Cast/Location references for each batch from ordinary guide slots;
- inspect every exact reference before Codex ImageGen;
- pass every accepted ImageGen reference through `referenced_image_paths`;
- assign every Renku reference to an actual provider media field;
- stop for explicit user direction when required continuity context is absent;
- show multiple ordinary specs using repeated Preview flags;
- document the array-valued event without creating a new ADR or file format;
- verify the workflow against a read-only copy of `urban-basilica`.

Exit: a fresh agent can review two storyboard sheets together and cannot repeat
the omitted-reference workflow without first stopping for user direction.

## Tests And Guardrails

### Preview Arrays

- one repeated-input group preserves input order;
- a single input uses the same path and remains visually unchanged;
- repeated `--file` works for transient specs;
- repeated `--spec` works for saved specs;
- mixing file and spec inputs returns a structured error;
- one invalid input prevents all notification;
- notification contains ordinary Previews, not a wrapper resource;
- all server projections succeed before event append;
- unsafe or unresolved references in any entry prevent event append;
- notification failure does not mutate project state;
- no Preview invocation creates specs, estimates, runs, or assets.

### Studio UI

- one Preview shows no navigator;
- two Previews start on `1 / 2`;
- Next shows `2 / 2` and Previous returns to `1 / 2`;
- boundary buttons are disabled correctly and have accessible labels;
- the active title, prompt, references, config, diagnostics, estimate, and
  Update state are correct;
- selected editor tab persists across navigation;
- local unsaved state remains independent for mounted saved Preview panels;
- updating one saved spec does not replace another Preview;
- a later complete event replaces the prior array deterministically;
- desktop focus order and keyboard behavior remain usable;
- no mobile viewport work is added.

### Context Text

- Scene context returns `facts.contextText`;
- action blocks preserve authored text and order;
- dialogue preserves speaker attribution, parenthetical/extension where
  currently authored, line text, and order;
- text rendering does not write project state;
- text rendering does not derive semantic/historical fields;
- existing structured screenplay and Scene Narrative UI resource tests remain
  unchanged and pass;
- non-Scene targets do not receive invented text in this slice.

### Generic Reference Selection

- selected file lookup filters by exact owner and accepted roles;
- selected file lookup honors `selection = 'select'`;
- selection order is deterministic;
- Takes and unselected files remain candidates but do not become selections;
- filesystem presence alone never creates a selection;
- guide slots initialize only exact `selectedAssetFileIds`;
- Scene Cast and Location owner ids are deduplicated deterministically;
- Scene Storyboard composes existing slot/subject contracts;
- missing creative selections do not make a provider-valid spec fail generic
  execution validation;
- provider capacity remains Engines-owned;
- current non-Storyboard purposes do not regress.

### Architecture Guardrails

- Studio React does not import Core server, database, or CLI modules;
- Studio server does not branch on purpose or choose continuity references;
- CLI does not inspect Scene, Cast, Location, or reference roles;
- no new public type or service name contains `PreviewReview`;
- no new public generation context type contains `Storyboard`;
- no new batch-generation persistence or execution API exists;
- architecture tests protect import/runtime boundaries rather than private
  helper names or complete implementation inventories;
- inspect complexity of `purpose-context.ts`, `purpose-guide.ts`,
  `generation-command-handlers.ts`, `studio-events.ts`, and the Preview
  dialog before completion.

## Documentation

Update only current documentation:

- Studio coordination events: one event may carry one or more ordinary
  Previews;
- CLI generation Preview examples: repeated `--file` and repeated `--spec`;
- Studio Skills: existing domain context, opaque `facts.contextText`, exact
  reference selection, multi-spec Preview, and continuity preflight;
- current generation architecture text if it claims Preview notification is
  singular.

Do not add a new ADR. Do not edit historical plans merely to rename the event.
Do not add a new Preview document format or sample.

## Explicitly Deferred

These findings remain real but are not part of this implementation:

- broad Director readiness field redesign;
- reconciling every existing project asset-selection inconsistency;
- first-class historical or political project metadata;
- per-Shot storyboard generation and deterministic sheet assembly;
- combined estimate or group approval UX;
- generation queues and concurrency.

If the selected-reference query exposes a narrow existing readiness bug, record
it for a separate focused change rather than expanding this plan.

## Final Verification

Run focused checks during implementation:

```bash
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm --dir packages/studio test
```

Run root gates after all Studio and Studio Skills changes:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Run the sister repository's documented skill validation and fresh-agent forward
tests.

Manual desktop verification on a read-only copy of `urban-basilica`:

1. read the Scene Shot List context and exact seven-Shot list;
2. read `scene.storyboard-sheet` generation context;
3. confirm `facts.contextText` contains readable existing Scene narrative;
4. confirm Scene Cast and Location guide slots expose candidates and exact
   selected state without silent substitution;
5. author ordinary specs for Shots 1-4 and Shots 5-7;
6. show both using repeated `--file`;
7. confirm Studio opens at `1 / 2` and navigation preserves each request;
8. confirm Preview does not estimate, generate, upload, save, or attach;
9. confirm the Media Producer stops when an exact required continuity reference
   is unavailable;
10. verify only a supported desktop viewport.

Before completion:

- inspect `git diff --stat` in Studio and Studio Skills;
- inspect the complete diffs, including pre-existing user changes;
- inspect every new or heavily modified file;
- confirm `index.ts` files remain exports-only;
- confirm no wrapper domain, special-purpose context DTO, broad dispatcher,
  catch-all helper, compatibility layer, or format-only churn was introduced;
- confirm the installed skill cache was not edited;
- confirm no checklist item was satisfied by accepting unreviewable code shape.

## Completion Evidence

Completed on 2026-07-14.

Implementation verification:

- focused Core, CLI, Studio server, and Studio desktop integration tests passed;
- the final Core suite passed with 42 files and 183 tests;
- the final CLI suite passed with 10 files and 34 tests;
- the final Studio suite passed with 65 files and 268 tests, with the 12-test
  desktop Preview integration suite also passing after the final state test;
- `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` passed at the
  workspace root. Lint retained the pre-existing `no-console` warning in
  `packages/studio/server/bin.ts` and reported no errors;
- the sister repository's updated JSON sample parses successfully, its source
  skill links remain local, and a fresh-agent forward test exercised the
  revised Media Producer workflow against an isolated project copy;
- `git diff --check` passed in both repositories. The complete diffs, new
  files, heavily modified files, and diff statistics were inspected. No
  `index.ts` file changed, and the installed skill cache was not edited.

Real-project verification used only the disposable copy at
`/tmp/renku-plan0138-verification-019f5fdb/movies/urban-basilica`; the source
project was not mutated. The active Scene was `scene_fzf8844n`, “The Harbor
Argument,” with active Shot List `scene_shot_list_aztyns98` and seven ordered
Shots. Core returned readable `facts.contextText`, deterministic Urban and Mara
Cast facts, the Harbor Quarter Location fact, and ordinary continuity slots.
Urban and Mara had exact selected character-sheet files. Harbor Quarter exposed
five Location candidates but no selected file, and the Storyboard Lookbook slot
had neither a candidate nor a selection.

The fresh agent inspected the exact Shot List, generation context, and both
selected Cast images. It identified the intended Shots 1-4 and Shots 5-7 split,
then correctly stopped before authoring specs or opening Preview because the
required exact Location and Storyboard Lookbook continuity context was absent.
It did not estimate, upload, generate, attach, or perform any paid action. This
is the accepted workflow result: missing continuity must stop before a weaker
request is composed. The desktop integration test independently verified that
two complete ordinary requests open at `1 / 2`, navigate in order, preserve the
shared tab, keep separate unsaved drafts, and retain disabled boundary controls.

Deferred readiness finding: the isolated sample project's Harbor Quarter and
Storyboard Lookbook selection state needs an owning workflow/user decision
before this specific Scene can be generated with the requested continuity.
This is project readiness state, not a Core execution requirement or a runtime
bug, so it does not expand this plan.

## Completion Checklist

### Review Area

- [x] Reproduce the separate-event/last-preview-wins failure.
- [x] Confirm an ordered array is sufficient and no collection domain exists.
- [x] Confirm the final scope is limited to the three implementation slices.
- [x] Confirm Decisions `0041` and `0047` remain intact.
- [x] Confirm every Preview remains one ordinary request.
- [x] Confirm the final code shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Keep the existing `GenerationSpec`, `GenerationPreview`,
      `GenerationContext`, and `GenerationReferenceGuide` contracts.
- [x] Add only the general `facts.contextText` convention.
- [x] Replace the singular event payload directly with an ordinary Preview
      array.
- [x] Do not add a collection service, resource, document, id, or persistence.
- [x] Do not add Storyboard-specific context request/facts types.
- [x] Keep exact selection resolution generic by owner and role.
- [x] Keep durable business rules in Core and provider validation in Engines.
- [x] Keep creative reference relevance and continuity judgment agent-owned.
- [x] Keep package-boundary diagnostics structured.

### Preview Array Implementation

- [x] Accept repeated `--file` or repeated `--spec` values.
- [x] Preserve order and reject mixed input kinds.
- [x] Build every ordinary Preview before notification.
- [x] Project every Preview before appending one event.
- [x] Preserve the current single-request Preview experience.
- [x] Add `1 / N` previous/next navigation using shadcn Buttons.
- [x] Preserve independent editor state without a collection editor framework.
- [x] Keep estimates, Updates, approvals, and runs independent.

### Context And Reference Implementation

- [x] Render Scene-target `facts.contextText` without semantic interpretation.
- [x] Preserve existing structured Scene and UI resource contracts.
- [x] Resolve deterministic Scene Cast and Location owner ids.
- [x] Add the generic exact selected-reference file query.
- [x] Distinguish candidates from selected relationships.
- [x] Initialize guide selections only from exact selected file ids.
- [x] Compose Storyboard Cast and Location slots from existing guide types.
- [x] Avoid Core-owned creative fallback ranking.
- [x] Leave Shot subset selection and relevance to the agent.

### CLI, Studio, And Agent Surfaces

- [x] Keep CLI handlers thin and free of purpose/reference business logic.
- [x] Keep Studio routes thin and free of continuity decisions.
- [x] Keep `GenerationRequestEditor` generic through its trailing-row slot.
- [x] Update the source Media Producer workflow and existing samples.
- [x] Require exact reference inspection and inclusion for Codex ImageGen.
- [x] Require actual provider-field assignment for Renku generation.
- [x] Require explicit user direction before proceeding without needed
      continuity context.

### Tests And Guardrails

- [x] Add repeated-input CLI and notification tests.
- [x] Add array event validation and server projection tests.
- [x] Add desktop Preview navigation and state-preservation tests.
- [x] Add Scene context-text preservation tests.
- [x] Add generic selected-reference and guide-selection tests.
- [x] Prove Preview arrays are read-only coordination payloads.
- [x] Prove missing creative references do not become generic runtime
      requirements.
- [x] Add or update import/runtime architecture tests without hard-coding
      private names or inventories.

### Documentation

- [x] Update current coordination, CLI, and Studio Skills documentation.
- [x] Do not add a Preview-review ADR or document format.
- [x] Record real-project verification evidence in this plan.
- [x] Record deferred readiness findings separately if still relevant.
- [x] Do not edit historical plans for naming sweeps.

### Final Verification

- [x] Run focused Core, CLI, and Studio tests.
- [x] Run Studio Skills validation and fresh-agent forward tests.
- [x] Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [x] Verify the two-sheet `urban-basilica` workflow on desktop.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect large/heavily modified files and split only demonstrated
      complexity.
- [x] Confirm public `index.ts` files remain thin entrypoints.
- [x] Confirm no wrapper domain, purpose-specific context model, semantic
      artifact validator, compatibility layer, or format-only churn was added.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then change this plan's status to complete.
