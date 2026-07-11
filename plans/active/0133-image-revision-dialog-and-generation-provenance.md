# 0133 Image Revision Dialog And Generation Provenance

Status: proposed
Date: 2026-07-10

## Summary

Add a lower-right Edit action to the image cards that currently represent:

- Cast Character Sheets;
- Location Environment Sheets;
- Lookbook sample images;
- Lookbook Sheets;
- selected Shot Video Take-owned `first-frame`, `last-frame`,
  `reference-image`, and `video-prompt-sheet` inputs.

The action opens one Image Revision dialog with two primary modes:

- **Regenerate** reconstructs the generation that produced the current image,
  shows the same prompt, references, configuration, diagnostics, and estimate
  information as Generation Preview, lets the user revise the supported
  generation controls, and can start one new approved generation.
- **Edit** starts with an empty instruction prompt, uses the current image as
  the required `image.edit` source, shows the resolved edit model and source
  reference, and can start one new approved image-edit generation.

Opening the dialog is read-only. Closing it without generating does not create
or update a Media Generation Spec. Clicking the active mode's `Regenerate` or
`Edit` footer action persists a new spec, estimates and runs that exact spec
through the normal Core lifecycle, sends the approved request to the selected
provider, then imports the single output through the destination owner's
existing domain rules.

This feature must not clone the current Generation Preview dialog. It first
extracts a shared generation-request editor composition that both Generation
Preview and Image Revision consume. The dialog shells, save/run orchestration,
and product-specific primary tabs remain separate.

Generation Preview remains an agent-oriented inspection/update surface. It does
not gain a Generate button: after a user inspects or edits a saved preview, the
AI agent may run that saved generation through the existing CLI/Core workflow.
Image Revision is deliberately different because the user initiates a concrete
Regenerate or Edit operation from an image card and completes that operation in
the UI.

This plan also removes the lower-right Lookbook Sheet selection control and its
obsolete global default-sheet mutation path. Lookbook Sheet choice for Shot
Video Takes remains direction/take-owned reference selection; the Lookbook
Visual Content surface no longer presents the first sheet as a selected sheet.

## User Experience Decision

### Card Action

Eligible cards show a Pencil/Edit icon in the lower-right action cluster.

- The control uses the local `Button` and tooltip primitives.
- Its accessible label uses meaningful product text, for example
  `Edit Ottoman Siege Camp location sheet`.
- The icon does not replace the card's click-to-preview behavior.
- When a card also has a selection/inclusion control, both controls share one
  lower-right action cluster without overlap.
- Lookbook Sheets no longer show the circular global selection control.

### Dialog Structure

The dialog has two primary line tabs:

1. `Regenerate`
2. `Edit`

Each mode embeds the shared generation-request editor. That editor may retain
its secondary `Prompt`, `References`, and `Config` sections because those are
different concerns from the primary Regenerate/Edit choice.

The Regenerate mode:

- opens on the source run's immutable `specSnapshot`, not the current mutable
  saved spec;
- shows exactly which historical generation produced the selected asset file;
- lets the user change the authored prompt, supported negative prompt,
  purpose-owned editable reference selections, model choice, and configuration
  controls that Core explicitly marks editable;
- keeps fixed or derived configuration rows visible but read-only;
- never updates the historical run or its original saved spec;
- remains inspectable with no write when the user closes the dialog.

The Edit mode:

- always starts with an empty authored instruction prompt;
- uses the selected asset file as the single required source image;
- recommends the corresponding edit model family from source-generation
  provenance when available, otherwise uses the current `image.edit` default;
- exposes the same shared model/config editor contract where the selected edit
  model supports it;
- disables `Edit` until the prompt, estimate, and all Core-owned validation
  requirements are satisfied.

Both modes:

- show a current estimate before the active mode action is enabled;
- require an explicit user click on `Regenerate` or `Edit` for the live provider
  run;
- send `approveLiveProviderRun: true` only from that mode-specific click;
- keep the dialog open and show structured errors when preview, estimate, run,
  or import fails;
- close after a successful run/import and let normal resource-key refresh show
  the new asset/input;
- do not parse, score, repair, or otherwise interpret prompt or image contents.

### Footer Actions And UI-Initiated Execution

The Image Revision dialog footer is right-aligned and ordered:

```text
Cancel   Regenerate
```

when the Regenerate tab is active, and:

```text
Cancel   Edit
```

when the Edit tab is active.

The intended desktop composition is:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ <source image title>                                           [×] │
├─────────────────────────────────────────────────────────────────────┤
│ REGENERATE | EDIT                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Prompt | References | Config                                       │
│                                                                     │
│ shared generation-request editor                                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ estimate / validation / run status                 Cancel  Regenerate│
└─────────────────────────────────────────────────────────────────────┘
```

On the Edit tab, the final button label is `Edit`. The estimate/status region
stays left-aligned and may wrap within its own bounded area; the two action
buttons stay together at the lower right. Error details remain in the content
area near the affected editor state rather than pushing the footer actions out
of alignment.

`Cancel` is the secondary/outline action. It closes the dialog and discards the
browser draft without persisting a spec, approving a run, calling a provider,
or importing media. The dialog close control and Escape key have the same
semantics, subject to the pending-run rule below.

The right-hand mode action is the primary action:

- `Regenerate` applies the current Regenerate draft, persists a new typed spec,
  re-estimates it, requests explicit live-run approval from the click, executes
  the provider request, and materializes the result through the source owner's
  destination handler.
- `Edit` applies the current empty-origin Edit draft as a new `image.edit` spec,
  re-estimates it, requests explicit live-run approval from the click, executes
  the provider request with the current image as its source, and materializes
  the result through the same source-owner destination policy.

The browser calls the Image Revision run endpoint directly. It does not emit a
Generation Preview event, ask an AI agent to notice a pending request, invoke
the CLI, or require an agent-authored receipt. Core still owns spec creation,
validation, estimate, approval, provider execution, run persistence,
output verification, and import.

While the provider/import operation is pending:

- the primary label becomes `Regenerating...` or `Editing...`;
- both footer buttons, the dialog close control, Escape dismissal, mode tabs,
  and editable fields are disabled so the in-flight intent cannot change;
- the dialog remains visible with clear progress/status text;
- duplicate clicks cannot create a second run.

On failure, restore the `Cancel` plus active mode action footer, preserve the
current draft, and show the structured error without closing. On success, close
the dialog only after purpose-owned import succeeds and publish the returned
resource keys so the originating surface refreshes.

### Single-Output Policy

The first Image Revision slice produces exactly one image per `Regenerate` or
`Edit` action.

This policy avoids silently choosing one result from a multi-output run and
avoids adding an unplanned result-picker workflow. The shared editor must show
the effective output count as `1`. It is a fixed Image Revision workflow value,
not a hidden default.

The underlying media-generation purposes and CLI may continue supporting
multi-output specs. A future result-review plan may make output count editable
in Image Revision after it defines how the user selects and materializes one or
more outputs.

## Supported Targets And Purposes

The first slice uses an explicit target union. It must not show Edit on every
image asset merely because `image.edit` can technically accept an image.

| Image Revision target | Owner surface | Regenerate source purposes | Edit destination |
| --- | --- | --- | --- |
| `castCharacterSheet` | Cast Member / Character Sheets | `cast.character-sheet`, `image.edit` | new sibling Cast Character Sheet |
| `locationEnvironmentSheet` | Location / Location Sheets | `location.environment-sheet`, `image.edit` | new sibling Location Environment Sheet |
| `lookbookImage` | Lookbook / Sample Images | `lookbook.image`, `image.edit` | new sibling Lookbook sample image |
| `lookbookSheet` | Lookbook / Lookbook Sheets | `lookbook.sheet`, `image.edit` | new sibling Lookbook Sheet |
| `shotVideoTakeInput` | Shot Take / References | `image.create`, `image.edit` | new selected take-owned input in the same slot |

`shotVideoTakeInput` is restricted to the selected take-owned image kinds:

- `first-frame`;
- `last-frame`;
- `reference-image`;
- `video-prompt-sheet`.

The Edit action must not appear on shared Cast Character Sheet, Location Sheet,
or Lookbook Sheet references merely because they are visible inside the Shot
Take References tab. Those assets are revised from their owning Cast, Location,
or Lookbook surfaces. The take only owns its reference selection.

The following are out of scope for this plan:

- Cast Profile Images;
- Location Hero Images;
- Scene Storyboard Images or temporary Storyboard Sheets;
- Shot Video Take final videos;
- dialogue audio and voice samples;
- Inspiration folder files;
- arbitrary project reference images;
- manual files outside the explicit target union;
- a generic "edit any Asset" browser surface.

An eligible imported image may use Edit even when it has no Renku generation
provenance. Regenerate is available only when Core can resolve one exact source
run and its supported spec snapshot. Missing or ambiguous provenance disables
Regenerate with a structured explanation; it must not select the latest run for
an owner, match by title, or guess from a filename.

## Result Materialization Decision

Generation and import remain separate Core lifecycle steps even though the
dialog presents them as one user action.

For shared owner collections:

- Cast Character Sheet, Location Environment Sheet, Lookbook Image, and
  Lookbook Sheet revisions create a new sibling asset through the existing
  purpose-owned import command;
- the source asset/file remains unchanged;
- no global selected/default sheet state is changed;
- the destination handler preserves meaningful source relationship metadata
  required by that domain, without inventing filenames, ids, or generic visible
  labels;
- a Lookbook sample-image revision is added as an unplaced sample image; it does
  not silently steal or duplicate section/point placements from the source.

For a selected take-owned image input:

- the result is imported into the same `inputKind + subjectKind + subjectId`
  slot;
- the existing Core replace-selected behavior makes the new input selected;
- the previous selected take-owned input follows the current recoverable
  discard/Trash behavior;
- the command validates that the source input belongs exclusively to the
  current take before it mutates the slot.

There is no in-place asset-file overwrite and no generic asset patch command.

## Context And Dependencies

Accepted architecture and decisions:

- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `docs/decisions/0043-use-explicit-live-provider-run-approval.md`
- `docs/decisions/0044-use-media-generation-module-boundaries.md`
- `docs/decisions/0045-use-generation-preview-purpose-bindings.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/generation-preview-purpose-bindings.md`
- `docs/architecture/shot-video-take-owned-media.md`
- `docs/architecture/project-asset-storage-conventions.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/naming-guidelines.md`

Relevant completed/current plans:

- `plans/active/0091-uniform-take-reference-sheet-selection.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `plans/active/0111-generation-preview-dialog-redesign.md`
- `plans/active/0121-shot-video-take-owned-media-copy-and-trash.md`
- `plans/active/0123-generic-image-edit-generation-purpose.md`
- `plans/active/0130-live-provider-approval-boundary.md`
- `plans/active/0131-generation-preview-prompt-editor-and-reference-update.md`
- `plans/active/0132-generation-preview-ownership-and-change-amplification-remediation.md`

Plan 0132 is an implementation prerequisite. This plan must build on its target
shape:

- focused Core Generation Preview service ownership;
- one cohesive purpose preview/update capability;
- purpose-definition binding modules instead of the current central lifecycle
  switchboard;
- narrow Studio route command ports;
- a feature-owned generation editor hook instead of preview state prop drilling.

Do not implement this plan by adding more hooks to the current
`purpose-lifecycle-registry.ts` or more Generation Preview methods to
`ProjectDataService` while 0132 remains incomplete.

The real verification project is:

```text
$HOME/renku-movies/urban-basilica
```

Current Urban Basilica inspection confirmed that Media Generation Run outputs
already contain `artifactId`, `projectRelativePath`, and `contentHash`, and the
eligible Cast Character Sheet, Location Environment Sheet, Lookbook Image, and
Lookbook Sheet asset files in the screenshots have unique content-hash matches
to their source runs. That makes a deterministic one-way provenance backfill
possible for those files without filename or timestamp guessing.

## Problem Findings

### Generation Preview Is A Dialog Shell And An Editor Mixed Together

The current `packages/studio/src/features/generation-preview` implementation
already owns useful shared pieces:

- prompt editing;
- editable reference selection;
- Config rendering;
- diagnostics;
- estimate display;
- stale-response protection;
- structured API errors.

However, those pieces are still composed around one Generation Preview dialog
and its saved-spec Update action. Copying that folder into an Image Revision
feature would create two editors that drift in layout, prompt behavior,
reference controls, Config rendering, and async error handling.

The reusable boundary is the generation-request editor, not the entire dialog.
Generation Preview remains a preview/update shell; Image Revision owns the
Regenerate/Edit tabs and run/import lifecycle.

### Asset Files Do Not Have Canonical Generation Provenance

Media Generation Runs durably store a spec snapshot and generated outputs, but
most shared image import paths only mark the asset origin and return the receipt
to the caller. The projected Asset/AssetFile does not retain the run id that
produced the imported file.

`image.edit` currently searches run output JSON for a matching
`projectRelativePath`. That only works while the registered asset file keeps the
run output path. Purpose-owned imports normally copy generated files into Cast,
Location, Lookbook, or take-owned folders, so path matching is not a durable
lineage contract.

Some owner records separately store `media_generation_run_id`:

- Scene Dialogue Audio Takes;
- Shot Video Take media inputs;
- Shot Video Take videos.

Adding one more purpose-specific run-id field for Cast/Location/Lookbook images
would duplicate provenance ownership again. The correct owner is the generated
AssetFile itself.

### Lookbook Sheet Selection Still Has A Global UI And Command

`LookbookVisualContentTab` treats the first sheet as `defaultSheetId` and shows
an `ImageSelectionControl`. The button calls:

```text
setDefaultLookbookSheet
PUT /visual-language/lookbooks/sheets/:sheetId/default
```

That command reorders sheets so the chosen sheet becomes first. Shot Video Take
reference planning still contains first-sheet fallback/default projection even
though the accepted take reference model is explicit per-direction sheet
selection.

Removing only the icon would leave the obsolete global business concept in
Core, the server route, browser service, fake service, and tests. This plan
deletes that path and removes first-sheet-as-selection behavior from Shot Video
Take reference planning.

## Architecture Shape Gate

### Package Ownership

`packages/core/src/server/asset-file-generation` owns durable provenance between
an AssetFile and the Media Generation Run output from which its bytes came.

`packages/core/src/server/image-revision` owns:

- the explicit supported `ImageRevisionTarget` union;
- source owner/file validation;
- Regenerate availability and source-run resolution;
- construction of Regenerate and Edit drafts;
- purpose-owned editor-control application;
- single-output Image Revision policy;
- exact spec persistence, estimate, approved run, and result materialization
  sequencing;
- a bounded destination registry whose handlers call existing owner commands;
- structured diagnostics and resource keys.

`packages/core/src/server/generation-preview` continues to own the common
generation preview envelope and purpose preview capabilities after plan 0132.
It must not learn Cast/Location/Lookbook/take destination rules.

Purpose-owned media generation modules continue to own:

- typed spec normalization;
- model lists and provider payloads;
- editable control-to-spec mapping for their own spec;
- purpose-specific preview construction.

`packages/studio/server` owns only:

- HTTP body/param parsing;
- calling the narrow Core Image Revision command port;
- resolving browser URLs through existing file projections;
- coordination/resource event publication;
- structured error serialization.

`packages/studio/src/features/generation-request-editor` owns the reusable
browser editor composition:

- Prompt, References, and Config sections;
- common controlled draft values;
- domain-neutral editor controls described by Core;
- diagnostics and estimate presentation;
- shared pending/error presentation primitives.

`packages/studio/src/features/generation-preview` owns only Generation Preview
product orchestration and its Update/Close dialog shell.

`packages/studio/src/features/image-revision` owns:

- the app-level dialog provider/hook;
- Regenerate/Edit primary tab state;
- context/preview/estimate request coordination;
- stale-response protection;
- explicit `Regenerate`/`Edit` footer actions and run/import success handling;
- the reusable lower-right Image Revision card action.

Movie Studio Cast, Location, Lookbook, and Scene features only construct the
explicit target for the image they already own and call the Image Revision
dialog hook. They do not decide purpose eligibility, find runs, create specs,
or choose import behavior.

### UI Design Gate

Frontend design review is a hard gate for the Studio slices. Use the installed
`product-design:audit` skill with browser-captured evidence twice:

1. **Baseline audit before UI implementation.** Capture the current Generation
   Preview dialog, Image Preview dialog, eligible image cards, Shot Take
   reference cards, and Lookbook Sheet selection control in the real Urban
   Basilica project. Capture the relevant surfaces in both light and dark
   themes at the normal desktop viewport.
2. **Built-flow audit before completion.** Capture the implemented Image
   Revision flow from card action through Regenerate, Edit, validation,
   estimate, `Cancel`, mode-specific primary actions, pending, error, and
   successful refresh states. Compare it with the accepted baseline and the
   supplied screenshots at the same viewport.

Load and use `browser:control-in-app-browser` for the audit capture unless the
user explicitly asks to use Chrome or the in-app browser is unavailable. Save
and inspect every accepted screenshot before using it as design evidence. Tie
each finding to a captured step; do not treat a DOM snapshot or a screenshot by
itself as proof that the interaction is polished or accessible.

Before writing dialog/card JSX, inspect and treat these as the visual source of
truth:

- `packages/studio/src/styles/theme.css`;
- local primitives under `packages/studio/src/ui`;
- `ImageOverlayCard`, `ImageSelectionControl`, `Dialog`, `DialogFooter`,
  `LineTabs`, `Button`, tooltip, editor, form-control, Alert, and loading-state
  patterns;
- the current Generation Preview and Image Preview dialog compositions;
- `docs/architecture/frontend.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- the supplied Cast, Location, Lookbook, and Shot Take screenshots.

The design audits must validate:

- the lower-right action cluster when Edit and selection/inclusion coexist;
- the primary Regenerate/Edit tabs versus the secondary
  Prompt/References/Config navigation;
- empty Edit-prompt, unavailable Regenerate, estimate-loading, run-pending,
  structured-error, and success states;
- `Cancel` immediately left of the active `Regenerate`/`Edit` primary action,
  including `Regenerating...`/`Editing...` pending copy;
- stable dialog height, scrolling, footer placement, and keyboard focus;
- light and dark theme token use;
- intentional visible copy with no filenames, ids, provider routes, or generic
  filler labels added to cards.

The implementation must:

- reuse Studio spacing, typography, radius, border, shadow, muted-surface,
  accent, destructive, focus-ring, and editor tokens rather than introducing a
  parallel Image Revision palette;
- use the established `DialogHeader`, line-tab, content inset, scroll region,
  and `DialogFooter` spacing rhythm;
- keep footer actions aligned and consistently ordered, with estimate/status
  content separated from the right-aligned `Cancel` plus active `Regenerate` or
  `Edit` actions;
- use shared Shadcn-style controls from `src/ui`; add a missing primitive there
  before feature use instead of styling a raw browser control;
- use existing card overlays and action-control sizes so the Pencil/Edit action
  feels native beside selection and delete controls;
- cover hover, focus-visible, pressed, selected, disabled, loading, destructive,
  validation-error, and success states in both themes;
- keep the dialog visually stable when switching modes, when diagnostics
  appear, and when prompt/config content becomes scrollable;
- make the active tab, primary footer action label, pending label, and executed
  Core mode agree at all times;
- preserve full keyboard reachability, visible focus, meaningful accessible
  names, and sensible tab order; screenshot evidence may identify risks but
  keyboard and semantic tests are still required;
- fix visible spacing, alignment, cropping, overflow, theme, or hierarchy
  mismatches before the UI slice is considered complete.

Do not use visual ideation merely to restyle the feature. The existing Studio
design language and supplied screenshots are the target. If the baseline audit
finds a material hierarchy problem that cannot be resolved from existing
patterns, use `product-design:ideate` to produce alternatives and obtain a
selected direction before implementing that redesign.

Use the local browser implementation for verification. Create a Figma board
only if the user explicitly asks for one. Desktop behavior is the supported
target; do not add mobile design work.

### Target Core Layout

```text
packages/core/src/server/
  asset-file-generation/
    commands.ts
    queries.ts
    output-match.ts
    types.ts

  image-revision/
    contracts.ts
    service.ts
    source-context.ts
    regenerate-draft.ts
    edit-draft.ts
    editor-controls.ts
    execution.ts
    destination-definition.ts
    destination-registry.ts
    destinations/
      cast-character-sheet.ts
      location-environment-sheet.ts
      lookbook-image.ts
      lookbook-sheet.ts
      shot-video-take-input.ts
```

The exact private split may be adjusted before implementation only when it
preserves these named responsibilities. `service.ts` is the public orchestration
entrypoint, not a god file. `destination-registry.ts` is a small typed map from
the five stable target discriminants to complete destination definitions. It
must not contain import implementations.

No `index.ts` is added under `image-revision` or `asset-file-generation`. The
intentional package public entrypoints remain:

- `packages/core/src/client/index.ts` for browser-safe contracts;
- `packages/core/src/server/index.ts` for public Core commands.

Those index files may export contracts/commands only; they may not contain
implementation logic.

### Target Studio Layout

```text
packages/studio/server/
  routes/image-revisions.ts
  routes/image-revisions.test.ts
  projections/image-revision.ts

packages/studio/src/
  features/generation-request-editor/
    generation-request-editor.tsx
    generation-request-tabs.tsx
    generation-request-prompt-panel.tsx
    generation-request-reference-grid.tsx
    generation-request-config-panel.tsx
    generation-request-editor-draft.ts

  features/generation-preview/
    generation-preview-dialog.tsx
    use-generation-preview-editor.ts
    ...preview-only shell/presentation files

  features/image-revision/
    image-revision-dialog-provider.tsx
    image-revision-dialog.tsx
    image-revision-dialog-footer.tsx
    image-revision-card-action.tsx
    use-image-revision-editor.ts
    image-revision-mode-tabs.tsx
    image-revision-status.tsx

  services/
    studio-image-revisions-api.ts
```

The common editor folder is a feature-level product composition, not a new
`src/ui` primitive. It knows generation preview contracts. Low-level controls
continue to come from `src/ui`.

`image-revision-dialog-footer.tsx` owns the small, exhaustive mode-to-copy
projection:

```ts
regenerate -> Regenerate / Regenerating...
edit       -> Edit / Editing...
```

and renders `Cancel` immediately to the left of the primary action. It does not
own provider execution or destination rules.

### Files Expected To Shrink Or Disappear

- `generation-preview-dialog-host.tsx` should shrink after plan 0132 and remain
  event/visibility coordination only.
- `generation-preview-dialog.tsx` should remain a thin shell around the shared
  editor and footer actions.
- current prompt/reference/config components may move to
  `generation-request-editor`; update imports directly and delete replaced
  paths. Do not leave re-export files.
- `image-overlay-card.tsx` and `image-collection-section.tsx` receive a narrow
  lower-right action-cluster contract, not Image Revision domain logic.
- `lookbook-visual-content-tab.tsx` loses default-sheet state and selection
  control logic.
- `lookbook-panel.tsx` loses `setDefaultSheet` orchestration.
- `studio-visual-language-api.ts`, the Visual Language route, Core lookbook
  command/wiring, and tests lose `setDefaultLookbookSheet` directly.
- `image-edit.ts` loses recursive run-output path scanning after canonical
  AssetFile provenance exists.
- owner-specific persisted `media_generation_run_id` columns disappear after
  their public projections read the canonical AssetFile provenance relation.

### Domain Branching

Image Revision destination branching lives only in the bounded destination
registry and its five focused handlers.

Regenerate-purpose branching lives in purpose definition bindings. The shared
Image Revision service asks the source purpose for a typed regeneration editor
capability; it must not switch over `cast.character-sheet`,
`location.environment-sheet`, `lookbook.image`, `lookbook.sheet`,
`image.create`, and `image.edit` inline.

The Studio server and React code must not branch on generation purpose to build
specs or import results.

### Explicitly Forbidden Shape

Do not:

- copy the Generation Preview dialog into Image Revision;
- turn the entire Generation Preview dialog into an over-configurable shell
  with product-specific boolean props;
- add a generic `patchMediaGenerationSpec` or `patchAsset` API;
- persist a draft merely because the user opened the dialog;
- update the source run's saved spec when Regenerate is edited;
- use the latest spec/run for an owner as source provenance;
- match provenance by title, filename, timestamps, or fuzzy paths;
- keep runtime path-scanning fallback after the provenance migration;
- put destination ownership decisions in a Studio route or React component;
- let shared Generation Preview code import Cast, Location, Lookbook, or Shot
  Take mutation modules;
- let a destination registry become a broad media-kind or purpose switchboard;
- write provider calls directly from Image Revision;
- bypass explicit live provider approval;
- auto-select a new shared Cast/Location/Lookbook asset globally;
- mutate image bytes in place;
- show Image Revision for non-owned Shot Take references;
- keep `setDefaultLookbookSheet` as a hidden command after removing its button;
- replace global Lookbook Sheet selection with a compatibility alias;
- use raw HTML interactive controls in Studio feature code;
- infer creative correctness from prompts or images;
- add source-text architecture tests that enumerate implementation function
  names or private registries.

### Stop Conditions

Stop and revise the implementation when:

- `service.ts` starts doing source resolution, spec mutation, provider
  execution, and every destination import itself;
- adding one target requires edits in more than its target contract, source
  resolver/registration, focused destination handler, and tests;
- adding one editable field requires a new shared lifecycle hook rather than a
  purpose-owned cohesive capability;
- Studio React starts reconstructing typed specs from visible rows;
- an adapter needs database access to determine ownership;
- provenance can be missing yet Regenerate still becomes enabled;
- multi-output results are silently truncated or the first output is chosen
  without an accepted result-selection design;
- common editor extraction creates an all-purpose dialog component with deeply
  conditional JSX;
- the generated migration cannot preserve current project data deterministically.

## Public Contracts

### AssetFile Generation Provenance

Add a browser-safe contract in
`packages/core/src/client/asset-file-generation.ts`:

```ts
export interface AssetFileGenerationProvenance {
  assetFileId: string;
  mediaGenerationRunId: string;
  outputArtifactId: string | null;
  createdAt: string;
}
```

The public `mediaGenerationRunId` fields currently exposed on Shot Video Take
inputs/videos and Scene Dialogue Audio takes may remain in those projections,
but they become derived from this canonical relation. They must not remain as
separately writable database state.

Add focused server commands/queries:

```ts
readAssetFileGenerationProvenance(input)
recordAssetFileGenerationProvenance(input)
copyAssetFileGenerationProvenance(input)
```

`recordAssetFileGenerationProvenance` validates:

- the AssetFile exists and is active;
- the run exists and completed successfully;
- one run output has the same media kind and content hash as the AssetFile;
- `outputArtifactId`, when supplied, identifies that exact output;
- conflicting provenance for the same AssetFile fails before a write.

### Image Revision Targets

Add `packages/core/src/client/image-revision.ts` with this explicit union:

```ts
export type ImageRevisionTarget =
  | {
      kind: 'castCharacterSheet';
      castMemberId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'locationEnvironmentSheet';
      locationId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'lookbookImage';
      lookbookId: string;
      imageId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'lookbookSheet';
      lookbookId: string;
      sheetId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'shotVideoTakeInput';
      sceneId: string;
      takeId: string;
      inputId: string;
      assetId: string;
      assetFileId: string;
    };
```

Do not replace this with `{ ownerType: string; ownerId: string }` or a generic
Asset target. Each discriminant has different ownership validation and result
materialization.

### Editor Context And Draft

Add:

```ts
export type ImageRevisionMode = 'regenerate' | 'edit';

export interface ImageRevisionEditorContext {
  target: ImageRevisionTarget;
  source: {
    title: string;
    assetId: string;
    assetFileId: string;
  };
  regenerate: ImageRevisionModeContext;
  edit: ImageRevisionModeContext;
}

export type ImageRevisionModeContext =
  | {
      state: 'available';
      mode: ImageRevisionMode;
      draft: ImageRevisionDraft;
      preview: GenerationPreviewRequest | null;
      controls: GenerationEditorControl[];
      diagnostics: DiagnosticIssue[];
    }
  | {
      state: 'unavailable';
      mode: ImageRevisionMode;
      diagnostics: DiagnosticIssue[];
    };
```

The Edit mode may return an editor-ready source/model/config shell before its
empty prompt is a valid persisted `image.edit` spec. That shell is not a
`GenerationPreviewRequest` until the user enters valid instructions. Do not
weaken persisted `image.edit` prompt validation to support an empty UI draft.

Use one bounded editor envelope:

```ts
export interface ImageRevisionDraft {
  mode: ImageRevisionMode;
  authoredText: string;
  negativeText?: string;
  referenceSelections: Array<{
    dependencyId: string;
    selected: boolean;
  }>;
  generationControls: Array<{
    controlId: string;
    value: GenerationPreviewConfigurationValue;
  }>;
}
```

`GenerationEditorControl` is a Core-authored descriptor with a stable
`controlId`, current value, control kind, allowed values/range, required state,
and visible label. It is not a generic JSON pointer. Each purpose binding owns
how its control ids map to its typed spec.

The output count control is present as read-only value `1` in Image Revision.

### Core Commands

Export these narrow Core commands from `packages/core/src/server/index.ts`:

```ts
readImageRevisionContext(input): Promise<ImageRevisionEditorContext>

previewImageRevisionDraft(input): Promise<GenerationPreviewRequest>

estimateImageRevisionDraft(input): Promise<ImageRevisionEstimateReport>

runImageRevision(input): Promise<ImageRevisionRunReport>
```

Each command receives `projectName`/`homeDir`, the explicit target, mode, and
current draft as applicable. Every command reloads and validates the target;
the browser does not receive a reusable authorization/session token.

`runImageRevision` input includes:

```ts
{
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
  approveLiveProviderRun: true;
}
```

The Studio browser calls this command only from the active mode's primary
footer action. Core requires `draft.mode` to match the validated editor mode and
must reject a request that changes mode, source, purpose, or immutable target
bindings between preview/estimate and execution.

`runImageRevision` is the UI-initiated execution boundary. It must call the
existing shared Media Generation lifecycle so the provider request is prepared,
approved, executed, and recorded exactly as it would be for the CLI. The Studio
route must not call `@gorenku/studio-engines`, upload provider inputs, construct
provider payloads, or synthesize receipts itself.

The report includes the persisted spec record, run record, purpose-owned import
report summary, imported Asset/AssetFile ids, and resource keys. It must not
return provider upload URLs or local absolute paths.

### Purpose Regeneration Capability

Extend the complete purpose definition shape introduced by plan 0132 with one
cohesive optional image-regeneration capability. Use a deliberate name such as:

```ts
export interface MediaGenerationPurposeImageRegeneration {
  createEditor(input): Promise<GenerationEditorDefinition>;
  applyEditorDraft(input): Promise<MediaGenerationSpec>;
}
```

The capability:

- starts from a validated run `specSnapshot`;
- identifies editable prompt/reference/config controls;
- applies the bounded draft to a new typed spec;
- preserves immutable purpose and owner bindings;
- normalizes output count to the visible Image Revision single-output policy;
- calls the purpose's existing normalization/provider preview path.

Do not add separate shared hooks such as `setPrompt`, `setModel`,
`setTakeCount`, or one hook per parameter.

### Studio HTTP Contracts

Add a narrow `ImageRevisionRouteCommands` port and these endpoints:

```text
POST /studio-api/projects/:projectName/image-revisions/context
POST /studio-api/projects/:projectName/image-revisions/preview
POST /studio-api/projects/:projectName/image-revisions/estimate
POST /studio-api/projects/:projectName/image-revisions/run
```

The Context/Preview/Estimate endpoints are read-only even though POST is used to
carry the tagged target/draft body. Only Run persists a spec, calls a provider,
and imports a result.

Do not add these commands to `ProjectDataService`. Follow the narrow Core
command-port direction from plan 0132.

### Structured Diagnostics

Use stable codes in the Core image-revision/provenance namespaces, including:

```text
CORE_ASSET_FILE_GENERATION_PROVENANCE_MISSING
CORE_ASSET_FILE_GENERATION_PROVENANCE_CONFLICT
CORE_ASSET_FILE_GENERATION_OUTPUT_MISMATCH
CORE_IMAGE_REVISION_TARGET_UNSUPPORTED
CORE_IMAGE_REVISION_OWNER_MISMATCH
CORE_IMAGE_REVISION_SOURCE_FILE_NOT_IMAGE
CORE_IMAGE_REVISION_SOURCE_INPUT_NOT_SELECTED
CORE_IMAGE_REVISION_SOURCE_INPUT_NOT_TAKE_OWNED
CORE_IMAGE_REVISION_REGENERATE_PROVENANCE_REQUIRED
CORE_IMAGE_REVISION_REGENERATE_PURPOSE_UNSUPPORTED
CORE_IMAGE_REVISION_CONTROL_UNSUPPORTED
CORE_IMAGE_REVISION_DRAFT_INVALID
CORE_IMAGE_REVISION_OUTPUT_COUNT_UNSUPPORTED
CORE_IMAGE_REVISION_OUTPUT_MISSING
CORE_IMAGE_REVISION_OUTPUT_NOT_IMAGE
CORE_IMAGE_REVISION_IMPORT_FAILED
```

The implementation may refine suffixes before coding only if the final names
remain domain-prefixed and are updated consistently in the plan before review.

## Database And Migration

### Canonical Table

Add this Drizzle-owned table:

```text
asset_file_generation
```

Columns:

```text
asset_file_id            primary key, foreign key -> asset_file.id
media_generation_run_id  not null, foreign key -> media_generation_run.id
output_artifact_id       nullable text
created_at               not null text
```

The table represents one fact: the bytes registered as this AssetFile came from
one Media Generation Run output. It does not describe creative contents or the
domain relationship that uses the file.

Update Drizzle schema ownership under:

```text
packages/core/src/server/schema/assets.ts
packages/core/src/server/schema/index.ts
```

### Remove Parallel Run-Id Storage

After provenance is backfilled, remove separately persisted
`media_generation_run_id` columns from:

```text
scene_dialogue_audio_take
scene_shot_video_take_media_input
scene_shot_video_take_video
```

Update their readers so existing public `mediaGenerationRunId` projections join
through `asset_file_generation`. Update their writers to record AssetFile
provenance through the focused command in the same transaction as the owner
relationship.

Do not keep both persisted values with a consistency assertion. That would be
parallel durable state.

### Intentional Custom Data Migration

This migration requires a documented custom data step because it must move
existing owner run ids, inspect generated run-output JSON, and remove old
columns. The TypeScript Drizzle schema remains the final source of truth.

Follow the repository and current Drizzle Kit codebase-first workflow:

1. update the TypeScript schema to the reviewed final shape;
2. generate the schema migration with Drizzle Kit from `packages/core`;
3. document the required custom data-copy section before changing generated
   SQL;
4. place the provenance backfill before old run-id columns/tables are rebuilt
   or dropped;
5. keep the generated SQL, journal, and snapshot together;
6. set the next `PRAGMA user_version` because current runtime reads the new
   relation unconditionally;
7. apply it through `renku project migrate urban-basilica`, which creates and
   verifies the project database backup first.

Backfill order:

1. insert exact rows from existing owner `media_generation_run_id` columns;
2. resolve `output_artifact_id` by exact run id plus AssetFile content hash when
   the run output supplies both;
3. for remaining eligible active image AssetFiles, match
   `asset_file.content_hash` to `contentHash` values in successful Media
   Generation Run outputs;
4. insert only when the content hash identifies one exact run for the file;
5. leave ambiguous/unmatched files without provenance rather than guessing;
6. audit unresolved eligible files before dropping old columns.

Use SQLite JSON functions only inside this explicit one-way migration. Runtime
provenance reads must use the normalized table.

### Import And Copy Writes

Update all generated-media import/finalization paths to record provenance when
they accept a Media Generation Run receipt, including at minimum:

- Cast Character Sheet;
- Cast Profile (even though it is not an Image Revision target yet);
- Location Environment Sheet;
- Location Hero;
- Lookbook Image;
- Lookbook Sheet;
- Scene Storyboard image materialization;
- Scene Dialogue Audio Take;
- Shot Video Take input;
- Shot Video Take video.

This is storage ownership work, not an expansion of Image Revision eligibility.

Take iteration/copy code must copy the provenance relationship when it creates a
new AssetFile containing the same bytes. It must not point two active takes at
the same AssetFile.

Manual imports without a run receipt create no provenance row. An import that
claims a generated receipt but whose run output does not match the imported
file fails before metadata is committed.

## Common Generation Editor Refactor

### Shared Composition

Move the current domain-neutral editor pieces from
`features/generation-preview` into `features/generation-request-editor`:

- prompt editor composition;
- reference grid/card composition;
- configuration rows and controls;
- diagnostics banner;
- estimate presentation where it can remain shell-neutral;
- pure editor draft helpers.

The shared editor receives:

- one Core-authored preview/editor definition;
- controlled draft values;
- read-only/editable capability flags;
- pending state;
- field/reference change callbacks.

It does not receive:

- `onUpdateGenerationPreview`;
- `onRunImageRevision`;
- dialog open/close state;
- Regenerate/Edit tab state;
- source/destination ownership rules;
- a large collection of booleans selecting product modes.

Generation Preview keeps its Update action and saved-spec semantics. Image
Revision keeps its mode-specific `Regenerate`/`Edit` execution and result
import semantics. The common editor must not add a run action to Generation
Preview.

### Config Controls

The current preview Config rows are mostly display projections. Do not make a
row editable merely because it has `providerField` or `allowedValues`.

Only a row accompanied by a Core-authored `GenerationEditorControl` is
interactive. The purpose regeneration binding must be able to apply that
control to its typed spec and rebuild the exact preview/estimate.

Use local Shadcn-style `Select`, `Input`, `Slider`, and other primitives as
appropriate. If a needed primitive is missing, add it under `src/ui` before
feature use.

### Async Draft Behavior

`useImageRevisionEditor` owns:

- context loading;
- separate Regenerate and Edit drafts;
- dirty state;
- debounced or explicit preview/estimate refresh;
- current request revision ids;
- stale response rejection when the target, mode, or draft changes;
- pending/error state for context, preview, estimate, and run;
- `Regenerate`/`Edit` enablement from the active mode and current validated
  estimate state;
- footer label and pending-label projection from the active mode;
- pending-run dismissal and duplicate-submission protection.

Do not share the Generation Preview saved-spec Update request state. Reuse pure
editor helpers and request-race patterns, not product orchestration state.

## Lookbook Sheet Selection Removal

Remove the global default-sheet mutation end to end:

- `setDefaultLookbookSheet` Core command and input contract;
- ProjectDataService wiring/method while the broader service still exists;
- Studio Visual Language route;
- `studio-visual-language-api.ts` client function;
- `LookbookPanel.setDefaultSheet` orchestration;
- `LookbookVisualContentTab.onSetDefaultSheet` prop;
- `defaultSheetId`, selected styling, and `ImageSelectionControl` from Lookbook
  Sheet cards;
- associated fake-service methods and tests.

In Shot Video Take reference planning:

- remove `defaultSelected` from `ShotVideoTakeLookbookReferenceChoice`;
- remove first-sheet fallback from the Shot Take References projection and
  preflight selected-reference resolution;
- keep all available Lookbook Sheets visible as choices;
- require the take direction's explicit `selectedLookbookSheetId` when a
  concrete sheet is needed;
- report missing required selection through current structured dependency
  diagnostics;
- do not change unrelated Lookbook ordering used for gallery display.

If another accepted purpose still deliberately uses a documented
`selected-or-default` selector, review it separately and name that contract. Do
not use the deleted global default-sheet mutation as its selection mechanism.

## Implementation Slices

### Slice 0: Complete Plan 0132 Prerequisite

Implement and verify the Generation Preview ownership remediation before this
feature. Confirm the shared preview service, purpose binding, narrow route port,
and browser editor hook exist in the target shape.

Stop if Image Revision would otherwise need to extend the old central lifecycle
registry or ProjectDataService.

### Slice 1: AssetFile Generation Provenance

Touch:

- Core client provenance contract;
- Drizzle asset/media schema;
- AssetFile generation query/command module;
- generated migration and documented custom backfill;
- generated-media import/finalization commands;
- take-owned file-copy paths;
- owner projections that currently read persisted run ids.

Add the canonical table, migrate exact existing provenance, remove parallel
columns, and replace `image.edit` output-path scanning with the canonical read.

Verify the Urban Basilica Cast Character Sheet, Ottoman Siege Camp Location
Sheet, Imperial Wound Lookbook images, Imperial Wound Lookbook Sheet, and
take-owned prompt sheet/frame inputs resolve as expected.

### Slice 2: Core Image Revision Source And Drafts

Add the explicit target union, source owner resolvers, Regenerate source-run
resolution, Edit draft construction, supported-purpose capabilities, editor
control descriptors, and single-output policy.

Add context/preview/estimate commands. Do not add provider execution yet.

Test imported images with no provenance: Edit available, Regenerate unavailable.

### Slice 3: Core Execution And Destination Registry

Add `runImageRevision` orchestration and the five focused destination handlers.

The execution sequence is:

1. reload and validate source target;
2. apply the current draft through the purpose capability;
3. persist a new Media Generation Spec;
4. estimate the persisted spec;
5. enforce explicit live provider approval;
6. run the persisted spec;
7. require one completed image output;
8. materialize through the target destination handler;
9. record provenance for the imported AssetFile;
10. return resource keys and structured report.

Use transaction/file-write-set boundaries already owned by each import command.
If generation succeeds but import fails, keep the run/output durable and report
the import failure; do not fabricate attachment success or delete the run.

### Slice 4: Baseline Frontend Design Audit

Run `product-design:audit` against the current desktop Studio surfaces using
accepted browser screenshots in both themes. Record the existing dialog/card
spacing, component/token sources, interaction-state strengths, visible UX or
accessibility risks, and concrete acceptance criteria for the new dialog.

Do not start the common editor or Image Revision JSX until this evidence-backed
baseline is complete. If the audit exposes a material visual-direction choice,
resolve it through the conditional ideation gate before implementation.

### Slice 5: Common Generation Request Editor

Extract the common prompt/reference/config/diagnostics editor composition.
Update Generation Preview to consume it with no visible behavior regression.

Update `ImageOverlayCard` and `ImageCollectionSection` from singular
`bottomRightControl` to a deliberate `bottomRightActions` cluster and update all
callers directly. Do not keep the old prop alias.

### Slice 6: Image Revision Dialog And Studio API

Add the narrow Studio server route/projection, browser API client, dialog
provider/hook, dialog shell, primary mode tabs, shared editor use, right-aligned
`Cancel` plus mode-specific `Regenerate`/`Edit` actions, direct run request,
success refresh, and structured error states.

Mount the provider once at app composition level. Do not use a new global
`window` event for browser-local card actions and do not prop-drill dialog state
through the whole Movie Studio tree.

### Slice 7: Eligible Card Surfaces

Add lower-right actions to:

- Character Sheet cards only in `cast-member-assets-tab.tsx`;
- Location Sheet cards in `location-visual-content-tab.tsx`;
- Lookbook sample image and Lookbook Sheet cards in
  `lookbook-visual-content-tab.tsx`;
- Core-projected selected take-owned general reference cards in
  `scene-shot-references-tab.tsx` / `scene-shot-reference-card.tsx`.

Do not add the action to Cast Profile cards or to shared reference sections
inside Shot Take References.

### Slice 8: Remove Lookbook Sheet Global Selection

Delete the obsolete command, route, browser service, UI control, first-sheet
selection projection, fakes, and tests. Add explicit take-reference selection
tests.

### Slice 9: Documentation, Real Project Migration, Design Audit, And QA

Update accepted docs/ADR, migrate Urban Basilica through the backed-up Drizzle
workflow, run the provenance audit, and verify the desktop surfaces in the real
project. Then run the built-flow `product-design:audit` using accepted browser
screenshots at the same desktop viewport and in both themes. Treat its visible
spacing, hierarchy, overflow, state, and consistency findings as required fixes
before completion.

## Tests And Guardrails

### Provenance Tests

- generated import records exact run/output provenance;
- receipt whose content hash does not match the AssetFile fails before writes;
- manual import creates no provenance row;
- conflicting second provenance write fails;
- take-owned file copy copies provenance to the new AssetFile;
- discarded AssetFiles do not resolve as active Image Revision sources;
- migrated owner projections still expose the expected run id through the
  canonical join;
- `image.edit` recommends a model from canonical provenance and no longer scans
  all run output paths.

### Core Image Revision Tests

- every target discriminant validates its exact owner relationship;
- wrong Cast Member, Location, Lookbook, Scene, Take, input, asset, or file id
  fails before spec creation;
- only selected take-owned supported input kinds are eligible;
- shared Shot Take references are rejected as take-owned revision targets;
- imported eligible images can Edit but cannot Regenerate without provenance;
- Regenerate uses the run snapshot even when the saved spec was later updated;
- Regenerate creates a new spec and never mutates the source spec/run;
- Edit opens with an empty prompt and cannot persist/run until non-empty;
- unsupported editor control ids fail through structured diagnostics;
- immutable target/purpose bindings cannot be changed by a draft;
- preview and estimate represent the exact derived spec that Run persists;
- output count is visibly/effectively one;
- zero, multiple, non-image, failed, or simulated-only output states are handled
  deliberately;
- live run requires explicit approval; estimate and context do not;
- a valid UI-initiated Regenerate/Edit run reaches the selected provider exactly
  once through the shared lifecycle and records the resulting run;
- context, preview, and estimate calls never call a provider;
- a request whose draft mode or immutable bindings differ from the validated
  source context fails before spec creation or provider execution;
- provider failure creates no destination import and leaves the dialog-facing
  report actionable;
- each shared destination appends a sibling asset and leaves source unchanged;
- Lookbook Image result does not silently copy/replace placements;
- take input result replaces the selected slot through Core and returns Trash
  resource keys for the previous input;
- run success plus import failure returns a structured partial failure without
  claiming attachment success.

### Common Editor Tests

- Generation Preview still edits/saves prompt and supported references;
- Image Revision Regenerate and Edit use the same prompt/reference/config
  components;
- only Core-authored config controls are interactive;
- fixed/derived rows remain read-only;
- a new request invalidates stale preview/estimate/run responses;
- Generation Preview still has no provider-run action;
- `Cancel`, the close control, and Escape perform no mutation before a run;
- `Cancel`, close, Escape, mode tabs, and fields are disabled while a run/import
  is pending;
- raw HTML interactive controls remain absent from feature code.

### Card And Dialog Tests

- eligible cards expose an accessible lower-right Edit action;
- Profile, Hero, Storyboard, take video, and shared Shot Take reference cards do
  not expose the action;
- card preview click still opens Image Preview;
- action click opens Image Revision and does not also open Image Preview;
- selection/inclusion and Edit controls coexist in one action cluster;
- Regenerate opens with source prompt/config/reference state;
- Edit opens with empty instructions and selected source image;
- unavailable Regenerate shows its Core diagnostic while Edit remains usable;
- the footer renders `Cancel` then `Regenerate` on the Regenerate tab and
  `Cancel` then `Edit` on the Edit tab;
- the primary action calls the Image Revision run endpoint directly with the
  active mode and explicit live-run approval intent;
- the primary pending label is `Regenerating...` or `Editing...`, duplicate
  submissions are blocked, and the active mode cannot change in flight;
- Generation Preview retains `Update`/`Close` behavior and never gains the
  Image Revision execution footer;
- successful run closes, refreshes the owner surface, and shows the new result;
- failed context/preview/estimate/run/import keeps the dialog open;
- light and dark themes keep focus, hover, destructive, disabled, and pending
  states legible;
- dialog header, primary tabs, secondary tabs, content insets, scroll regions,
  estimate/status area, and footer actions use the established Studio spacing
  rhythm with no one-off parallel visual system;
- mode changes, diagnostics, long prompts, and Config controls do not resize the
  shell unexpectedly, overlap the footer, clip focus rings, or leak scrolling
  outside the dialog;
- Edit and selection/inclusion controls use consistent size, radius, overlay,
  hover, and focus-visible treatment in the lower-right action cluster;
- keyboard navigation reaches every interactive element in a sensible order,
  preserves visible focus, and does not trigger card preview when activating
  Edit;
- Cancel is immediately left of the primary mode action and both remain
  right-aligned without crowding the estimate/status area;
- desktop-only QA covers the current Studio panel sizes; no mobile work is
  added.

### Lookbook Selection Tests

- Lookbook Sheet cards have no global selection/default control or selected
  ring derived from first position;
- no Studio request targets `/lookbooks/sheets/:sheetId/default`;
- Core has no `setDefaultLookbookSheet` public command;
- Shot Take Lookbook references show available sheets but select only from the
  current direction state;
- missing required explicit selection returns the current structured dependency
  issue;
- gallery order remains stable and is not interpreted as selection.

### Architecture Guardrails

Add stable boundary tests that prove:

- Studio image-revision routes do not import database/schema modules;
- Image Revision browser code does not import Core server modules;
- shared generation editor code does not import Image Revision or Cast,
  Location, Lookbook, or Shot Take mutation modules;
- Generation Preview code does not import Image Revision execution;
- image-revision destination handlers call owner commands and no generic asset
  patch API exists;
- only Core asset-file-generation code writes the canonical provenance table;
- production code no longer reads old owner-specific run-id columns;
- no raw browser control tags appear in Studio feature code;
- no obsolete global Lookbook Sheet default route/command remains.

Protect import paths and runtime behavior. Do not enumerate private helper names
or every destination definition as architecture-test source strings.

## Documentation

Create an accepted ADR for canonical AssetFile generation provenance and the
Image Revision generation/import boundary. Update:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- `docs/architecture/shot-video-take-owned-media.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/drizzle-migrations.md` only if the project
  workflow itself changes (the feature should normally follow it unchanged);
- relevant CLI docs only if public JSON reports or existing commands change.

Audit `$HOME/Projects/aitinkerbox/studio-skills` for guidance that calls a
first Lookbook Sheet a global default or tells agents to work around missing
image-edit provenance. Update active skill guidance only when the shared
CLI/agent contract changed; do not add UI-only instructions to unrelated
skills.

## Final Verification

Run focused verification first:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-core lint
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio lint
```

Validate the migration from `packages/core` using the repository-owned Drizzle
configuration, inspect the generated SQL/snapshot/journal, and apply it to Urban
Basilica only through:

```bash
renku project migrate urban-basilica
```

Confirm the command reports a verified pre-migration backup. Query the migrated
database to confirm:

- canonical provenance row counts;
- no conflicting AssetFile provenance;
- expected eligible screenshot assets resolve to their exact source run/spec;
- ambiguous/unmatched files remain unresolved rather than guessed;
- old owner-specific run-id columns are absent;
- current public take/dialogue projections still report run ids.

Run root verification when focused checks pass:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Manually verify in the selected desktop browser against Urban Basilica:

1. Cast Member / Character Sheets;
2. Ottoman Siege Camp / Location Sheets;
3. Imperial Wound / Sample Images;
4. Imperial Wound / Lookbook Sheets;
5. Bombardment / Takes / References for selected first frame, last frame,
   reference image, and Video Prompt Sheet inputs where present;
6. a shared Cast/Location/Lookbook reference inside Takes to confirm it has no
   take-owned Edit action;
7. an imported eligible image with no source run to confirm Edit works and
   Regenerate explains why it is unavailable;
8. light and dark themes.

Run the required built-flow `product-design:audit` with the browser capture
workflow. Keep the accepted baseline and built screenshots in step order,
inspect them before acceptance, and verify that every design finding is either
fixed or recorded as an explicit blocker. The audit must cover visible theme,
spacing, hierarchy, control consistency, overflow, interaction states, and
screenshot-observable accessibility risks; finish keyboard and semantic checks
separately because screenshots cannot prove them.

Before completion:

- inspect `git diff --stat`;
- inspect the complete diff;
- inspect every new or heavily modified file;
- inspect migration SQL, snapshot, and journal together;
- confirm no unrelated formatting churn;
- confirm `index.ts` files remain thin exports;
- confirm no central registry or service became a god file;
- confirm common editor extraction reduced duplication without creating a
  boolean-driven universal dialog;
- confirm no checklist item was satisfied by accepting unreviewable structure.

## Completion Checklist

### Review Area

- [ ] Confirm the implementation preserves Core ownership of provenance,
      generation validity, run approval, and destination materialization.
- [ ] Confirm centralized Image Revision ownership did not become a monolithic
      implementation.
- [ ] Confirm the final Core and Studio file shapes match the Architecture Shape
      Gate.
- [ ] Confirm no new broad dispatcher, catch-all helper, generic patch API, or
      god file was added.
- [ ] Confirm the supported target/purpose matrix is explicit and no extra image
      surfaces gained Edit accidentally.
- [ ] Confirm image/prompt creative contents remain opaque.

### Architecture And Contracts

- [ ] Complete plan 0132 before extending the preview/editor boundary.
- [ ] Add `AssetFileGenerationProvenance` and make its table the canonical
      durable source.
- [ ] Remove parallel owner-specific persisted run-id columns and update public
      projections to derive through AssetFile provenance.
- [ ] Add the exact `ImageRevisionTarget` tagged union with five target kinds.
- [ ] Add Image Revision context, draft, editor-control, estimate, and run
      reports.
- [ ] Add narrow Core Image Revision public commands through the intentional
      server entrypoint.
- [ ] Keep Image Revision out of `ProjectDataService` and universal Studio
      fakes.
- [ ] Add a cohesive purpose regeneration capability; do not add one shared
      hook per field.
- [ ] Keep package-boundary failures in structured diagnostics.
- [ ] Keep live provider approval inside Core and require a direct
      `Regenerate` or `Edit` click from the Image Revision footer.
- [ ] Keep generation spec persistence, run, and import as explicit internal
      lifecycle steps.
- [ ] Add no compatibility aliases, old routes, wrapper facades, or re-export
      stubs.

### Database And Provenance

- [ ] Update the Drizzle TypeScript schema first.
- [ ] Generate the migration with the package-owned Drizzle Kit configuration.
- [ ] Document the intentional custom data-copy portion before editing SQL.
- [ ] Backfill exact owner run ids before dropping old columns.
- [ ] Backfill additional unique content-hash matches without filename/title/
      timestamp guesses.
- [ ] Leave ambiguous provenance unresolved.
- [ ] Increment `PRAGMA user_version` because runtime requires the new table.
- [ ] Commit SQL, journal, and snapshot together.
- [ ] Update generated-media import/finalization commands to write provenance.
- [ ] Update take-owned copy behavior to copy provenance to new AssetFiles.
- [ ] Replace `image.edit` path scanning with canonical provenance reads.
- [ ] Apply the migration to Urban Basilica through the backed-up Core command.
- [ ] Audit the screenshot assets and unresolved eligible image count.

### Core Image Revision

- [ ] Implement target owner/file resolution and active-image validation.
- [ ] Implement exact source-run/spec-snapshot resolution for Regenerate.
- [ ] Implement empty-instruction `image.edit` editor context without weakening
      persisted spec validation.
- [ ] Implement purpose-owned editor controls and typed draft application.
- [ ] Enforce the visible single-output policy.
- [ ] Implement context, preview, and estimate commands with no writes.
- [ ] Implement run orchestration that persists a new exact spec.
- [ ] Implement the five focused destination handlers.
- [ ] Append sibling shared assets without global auto-selection.
- [ ] Keep Lookbook sample revisions unplaced unless the user explicitly places
      them later.
- [ ] Replace selected take-owned inputs through the existing Core ownership/
      Trash lifecycle.
- [ ] Preserve completed runs when downstream import fails.

### Common Editor And Studio UI

- [ ] Run the baseline `product-design:audit` before writing the UI slices.
- [ ] Capture and inspect the current Generation Preview, Image Preview,
      eligible cards, take references, and Lookbook Sheet control in both
      themes.
- [ ] Record the shared primitives, theme tokens, spacing rhythm, and concrete
      visual acceptance criteria from the baseline.
- [ ] Use conditional `product-design:ideate` only if an unresolved hierarchy
      decision requires a new visual direction.
- [ ] Extract one reusable generation-request editor composition.
- [ ] Keep Generation Preview and Image Revision dialog shells/orchestration
      separate.
- [ ] Keep shared editor components free of destination and run/import logic.
- [ ] Add Core-authored config controls using local Shadcn-style primitives.
- [ ] Add the app-level Image Revision dialog provider/hook.
- [ ] Add Regenerate/Edit primary tabs and mode-specific draft state.
- [ ] Add current-request revision tracking and stale-response rejection.
- [ ] Render right-aligned `Cancel` then `Regenerate` or `Edit` according to the
      active tab.
- [ ] Add `Regenerating...` and `Editing...` pending labels and disable
      dismissal, mode changes, field changes, and duplicate submission while
      execution/import is in flight.
- [ ] Add explicit estimate and mode-action enablement behavior.
- [ ] Call the Image Revision run endpoint directly from the primary action and
      pass explicit live-run approval intent.
- [ ] Keep Generation Preview agent-driven with its existing `Update`/`Close`
      behavior and no provider-run action.
- [ ] Keep the dialog open on structured failures and close/refresh on success.
- [ ] Rename the card lower-right prop to an action cluster and update callers
      directly with no alias.
- [ ] Add accessible Edit actions to Character Sheet, Location Sheet, Lookbook
      image/sheet, and selected take-owned input cards.
- [ ] Do not add Edit to Profile, Hero, Storyboard, take video, or shared take
      reference cards.
- [ ] Reuse Studio theme, spacing, typography, radius, border, shadow, focus,
      editor, muted-surface, accent, and destructive tokens.
- [ ] Keep dialog header, tabs, content insets, scroll regions, and footer
      spacing consistent with existing Studio dialog patterns.
- [ ] Verify stable dialog geometry for mode changes, long content,
      diagnostics, pending states, and structured errors.
- [ ] Verify keyboard order, visible focus, accessible labels, and action/card
      event separation in addition to screenshot review.
- [ ] Verify desktop light/dark layout, focus, hover, pending, and error states.
- [ ] Run the built-flow `product-design:audit`, compare accepted screenshots at
      the same viewport, and fix all material visual consistency findings.

### Lookbook Sheet Selection Removal

- [ ] Delete `setDefaultLookbookSheet` from Core contracts, implementation, and
      wiring.
- [ ] Delete the Studio default-sheet route and browser client function.
- [ ] Remove Lookbook panel/default-sheet UI props, state, selected ring, and
      circular control.
- [ ] Remove first-sheet-as-selection behavior from Shot Take reference and
      preflight planning.
- [ ] Remove `defaultSelected` from the take Lookbook reference contract.
- [ ] Keep available sheets visible and use only explicit direction selection.
- [ ] Update fakes and tests directly; do not keep obsolete-name sentinels.

### Tests And Guardrails

- [ ] Add migration/provenance behavior tests.
- [ ] Add exact owner validation tests for every target discriminant.
- [ ] Add Regenerate snapshot/new-spec/no-source-mutation tests.
- [ ] Add empty Edit prompt and valid `image.edit` execution tests.
- [ ] Add editor-control validation and exact preview/estimate/run parity tests.
- [ ] Add active-mode/footer-label, Cancel/no-write, pending-dismissal, direct
      provider-run, duplicate-submission, and mode-mismatch tests.
- [ ] Add single-output and invalid-output tests.
- [ ] Add destination materialization and partial import failure tests.
- [ ] Add Generation Preview regression tests after shared editor extraction.
- [ ] Add Image Revision hook/dialog/card interaction tests.
- [ ] Add Lookbook global selection removal and explicit take selection tests.
- [ ] Add stable import/runtime architecture guardrails without private-name
      inventories.
- [ ] Run the architecture-shape checks listed in Final Verification.

### Documentation And Skill Surfaces

- [ ] Add the accepted AssetFile generation provenance/Image Revision ADR.
- [ ] Update data-model, media-generation, preview-binding, asset-file, and
      take-owned-media docs.
- [ ] Update CLI docs only where a real public contract changed.
- [ ] Audit active `studio-skills` guidance for global Lookbook Sheet defaults
      and provenance workarounds.
- [ ] Do not edit historical plans merely for naming sweeps.

### Final Verification

- [ ] Run focused Core and Studio typecheck/test/lint commands.
- [ ] Inspect and validate generated migration SQL, journal, and snapshot.
- [ ] Apply migration to Urban Basilica through `renku project migrate` and
      confirm the verified backup.
- [ ] Run root `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` when the
      blast radius requires it.
- [ ] Complete desktop manual QA on every supported owner surface and both
      themes.
- [ ] Complete the required baseline and built-flow Product Design audits with
      accepted, inspected screenshots and step-linked findings.
- [ ] Confirm browser-captured audit evidence does not substitute for keyboard,
      semantic, and behavior tests.
- [ ] Review `git diff --stat` and the complete diff.
- [ ] Inspect newly large or heavily modified files and split them before
      review if responsibilities accumulated.
- [ ] Confirm `index.ts` files remain thin public entrypoints.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [ ] Only then mark the plan complete.
