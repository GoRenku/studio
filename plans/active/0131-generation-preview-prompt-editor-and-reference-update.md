# 0131 Generation Preview Prompt Editor And Reference Update

Status: complete
Date: 2026-07-09

## Summary

Add explicit editing to the Studio Generation Preview dialog.

Today the dialog shows the prompt as read-only prose and lets editable
references save immediately through a narrow cast-character-sheet reference
endpoint. The intended outcome is:

- the Prompt tab contains a markdown-like prompt editor;
- the References tab lets the user check and uncheck editable references using
  the same circular selection-control language used by Shot Take references;
- reference toggles update only local dialog draft state;
- an `Update` button appears immediately to the left of `Close`;
- `Update` persists the edited prompt and reference selections in one request;
- `Update` does not close the dialog;
- successful updates rebuild and replace the preview snapshot while keeping the
  dialog open.

The smallest useful scope is saved generation previews that include a
`generationSpecId`. Draft previews that do not have a saved spec may still be
reviewed, but they cannot be updated from the dialog in this slice.

## Context

This work is constrained by:

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `plans/active/0111-generation-preview-dialog-redesign.md`
- `plans/active/0114-generation-preview-contract-verification-remediation.md`
- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/generation-preview/saved-image-preview.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/final-specs.ts`
- `packages/studio/server/routes/generation-preview.ts`
- `packages/studio/server/projections/generation-preview.ts`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-dialog.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-prompt-panel.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-reference-card.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-reference-grid.tsx`
- `packages/studio/src/ui/image-overlay-card.tsx`
- `packages/studio/src/ui/image-selection-control.tsx`
- `packages/studio/src/ui/textarea.tsx`
- `packages/studio/package.json`
- `packages/studio/src/styles/theme.css`
- `/Users/keremk/Projects/aitinkerbox/renku/viewer/package.json`
- `/Users/keremk/Projects/aitinkerbox/renku/viewer/src/components/blueprint/shared/text-editor-dialog.tsx`
- `/Users/keremk/Projects/aitinkerbox/renku/viewer/src/components/blueprint/shared/syntax-preview.tsx`
- `/Users/keremk/Projects/aitinkerbox/renku/viewer/src/styles/prism-renku-dark.css`
- `/Users/keremk/Projects/aitinkerbox/renku/viewer/src/styles/prism-renku-light.css`
- `/Users/keremk/Projects/aitinkerbox/renku/viewer/docs/architecture.md`
- `/Users/keremk/Projects/aitinkerbox/renku/plans/refactor-saving-in-viewer.md`
- `/Users/keremk/Projects/aitinkerbox/renku/movie-studio`

Important observations from the current code:

- The preview dialog already uses `ImageOverlayCard` and
  `ImageSelectionControl` for preview references.
- The References tab for Shot Takes uses the same lower-right circular
  selection-control language through `SceneShotReferenceCard`.
- The preview dialog currently saves each editable reference toggle immediately
  through
  `/generation-previews/specs/:specId/reference-inclusion`.
- The server route calls
  `ProjectDataService.updateCastCharacterSheetReferenceInclusion`, which is
  correctly Core-owned but incorrectly specific to one purpose for a shared
  preview dialog.
- Current preview prompt text is provider-facing text returned through
  `providerPreviewPromptText(...)`; it is not always guaranteed to be the exact
  stored `spec.prompt`.
- A deeper pass through the external Renku repo found the rich text editor
  pattern in the sibling `viewer` package, not in the narrow
  `movie-studio/src` tree. `viewer/package.json` depends on
  `prism-react-editor@^3.0.1`; `viewer/docs/architecture.md` documents it as
  the code/syntax editor dependency; and `plans/refactor-saving-in-viewer.md`
  describes text-card editing as a code editor with Markdown syntax
  highlighting, select/copy/paste, and normal undo/redo keybindings.
- The concrete reusable source is
  `viewer/src/components/blueprint/shared/text-editor-dialog.tsx`: it imports
  `Editor` and `BasicSetup` from `prism-react-editor`, loads Markdown and JSON
  Prism grammars, imports `layout.css` and `search.css`, and applies Renku
  light/dark Prism theme CSS. Studio already has the same `--editor-bg` and
  `--editor-fg` tokens in `packages/studio/src/styles/theme.css`, but
  `packages/studio/package.json` does not yet include `prism-react-editor`.

## Architecture Shape Gate

### Ownership

`packages/core` owns all durable media-generation spec mutations:

- deciding whether a saved generation preview can be updated;
- reading the persisted media generation spec;
- validating prompt update envelopes;
- applying prompt text to the persisted spec;
- applying purpose-owned reference selection updates;
- rebuilding the generation preview after the spec update.

`packages/studio/server` owns only HTTP concerns:

- parse the request body;
- call the Core service;
- project the returned Core preview into a Studio preview with browser URLs;
- serialize structured errors.

`packages/studio/src/features/generation-preview` owns browser draft state:

- editor text;
- reference checked state;
- dirty-state detection;
- save button state;
- calling the Studio API client on explicit `Update`.

`packages/studio/src/ui` owns any reusable editor primitive needed by the
feature. Feature code must not use raw `<textarea>`, `<button>`,
`contenteditable`, or ad hoc controls directly.

### UI Design Gate

Before implementing the browser UI slices, use the front-end designer /
Product Design skill workflow for the prompt editor and reference-selection
dialog changes. This is required even though the feature is primarily a data
mutation flow, because the dialog introduces a richer editor surface and a new
explicit footer action.

The UI implementation must reread and follow:

- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- the general frontend guidance in `AGENTS.md`

Design requirements:

- Use local Shadcn-style primitives from `packages/studio/src/ui` for visible
  controls, including `Button`, `Dialog`, `Tabs`, tooltip, and selection
  controls.
- Keep `Update` immediately to the left of `Close` with the existing
  `DialogFooter` spacing rhythm. Do not crowd the buttons, create uneven
  margins, or add one-off footer layout classes when a shared primitive or
  existing footer pattern fits.
- Preserve Studio's app-wide primary/yellow focus and selection language for
  editable references, keyboard focus, hover, and pressed states.
- Use Studio theme tokens for the editor surface and Prism theme CSS, including
  `--editor-bg`, `--editor-fg`, border, focus, and muted foreground tokens.
- Verify both light and dark themes. The prompt editor must not hard-code a
  light-only or dark-only palette.
- Keep the prompt editor embedded in the existing preview dialog. Do not copy
  the external viewer's whole `TextEditorDialog` shell or nest a second dialog.
- Keep the prompt editor size stable within the tab content: no footer overlap,
  no layout jump when text wraps, and no scroll bleed outside the dialog.
- Keep the References tab visually aligned with Shot Take reference cards:
  lower-right circular selection controls, clear selected/unselected states,
  and required references visibly selected but not editable.
- Use intentional copy only. Do not surface raw asset ids, dependency ids,
  filenames, or provider identifiers as new visible labels just to fill space.
- Verify desktop browser sizes only unless a future request explicitly asks for
  mobile support.

### Public Entrypoints

Add these Core contracts:

- `UpdateGenerationPreviewSpecInput`
- `GenerationPreviewPromptUpdate`
- `GenerationPreviewReferenceSelectionUpdate`
- `updateGenerationPreviewSpec(input): Promise<GenerationPreviewRequest>`

Shape:

```ts
export interface UpdateGenerationPreviewSpecInput {
  projectName?: string;
  homeDir?: string;
  specId: string;
  prompt: GenerationPreviewPromptUpdate;
  referenceSelections: GenerationPreviewReferenceSelectionUpdate[];
}

export interface GenerationPreviewPromptUpdate {
  authoredText: string;
  negativeText?: string | null;
}

export interface GenerationPreviewReferenceSelectionUpdate {
  dependencyId: string;
  selected: boolean;
}
```

Add this optional purpose-definition hook:

```ts
applyPreviewReferenceSelections?: (
  input: ApplyGenerationPreviewReferenceSelectionsInput
) => Promise<MediaGenerationSpec>;
```

The hook exists because reference-selection storage is purpose-owned. For
example, `cast.character-sheet` stores dependency inclusion overrides in
`referenceSelections.dependencyInclusions`; the shared lifecycle service must
not know or mutate that purpose-specific shape.

Add this browser service:

- `updateGenerationPreviewSpec(input): Promise<StudioGenerationPreview>`

Add this Studio API route:

- `PATCH /studio-api/projects/:projectName/generation-previews/specs/:specId`

Request body:

```json
{
  "prompt": {
    "authoredText": "User-authored prompt text",
    "negativeText": "Optional negative prompt text"
  },
  "referenceSelections": [
    { "dependencyId": "cast-character-sheet:...", "selected": false }
  ]
}
```

Response body:

```json
{
  "preview": {}
}
```

The old route
`PATCH /generation-previews/specs/:specId/reference-inclusion` must be removed
in the same implementation slice. Do not keep a compatibility route.

### Prompt Contract

Update the generation preview prompt contract so Studio does not guess whether
the editable text is the stored prompt or provider-expanded prompt text.

Replace the current ambiguous prompt shape with:

```ts
export interface GenerationPreviewPrompt {
  authoredText: string;
  providerText: string;
  negativeText?: string;
}
```

Rules:

- `authoredText` is the text the editor shows and saves back to the saved spec.
- `providerText` is Core's provider-facing preview text after any accepted
  app-owned generation transform.
- `negativeText` is present only when the selected provider model input schema
  exposes `negative_prompt`. It remains an empty editable string when that
  model supports the field but the saved spec has no negative prompt yet.
- These fields are distinct contracts, not compatibility mirrors. If an
  implementation pass proves that `providerText` is unused by the UI and not
  needed for the current product surface, remove it instead of keeping a
  duplicate convenience field.

Core validation may require string type and non-empty prompt text where the
provider envelope requires it. It must not parse, score, repair, or validate
the creative meaning of prompt text.

### Internal Module Shape

Expected Core files:

- `packages/core/src/server/media-generation/lifecycle/preview-spec-update.ts`
  owns the shared read-update-rebuild flow for saved preview specs.
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
  stays thin and exports `updateGenerationPreviewSpec`.
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
  adds the optional `applyPreviewReferenceSelections` hook to the existing
  purpose definition object.
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
  owns cast-character-sheet reference selection updates through a focused
  function such as `applyCastCharacterSheetPreviewReferenceSelections`.
- `packages/core/src/server/generation-preview/validation.ts` owns validation
  for the updated preview prompt contract.

Expected Studio server files:

- `packages/studio/server/routes/generation-preview.ts` remains a thin Hono
  route.
- `packages/studio/server/routes/generation-preview.test.ts` covers request
  parsing, service delegation, and projected response shape.

Expected Studio browser files:

- `packages/studio/src/services/studio-generation-preview-api.ts` owns the
  browser API call.
- `packages/studio/src/features/generation-preview/generation-preview-draft.ts`
  owns pure draft-state helpers: initial draft, dirty check, reference selected
  lookup, and request-body construction.
- `packages/studio/src/features/generation-preview/generation-preview-prompt-editor.tsx`
  owns the Prompt tab editor composition.
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
  owns save orchestration and returned-preview replacement.
- `packages/studio/src/ui/syntax-text-editor.tsx` owns the reusable editor
  primitive that wraps `prism-react-editor`. It should expose a controlled
  `value`, `onValueChange`, `language`, `readOnly`, and sizing/class contract
  suitable for embedding inside existing Studio dialogs.
- `packages/studio/src/styles/prism-renku-light.css` and
  `packages/studio/src/styles/prism-renku-dark.css` port the external viewer's
  Prism theme CSS to Studio's current theme tokens. The implementation may
  instead co-locate equivalent CSS with the UI primitive if the project already
  has a stronger local styling convention, but feature code must not own Prism
  token overrides.
- `packages/studio/package.json` adds `prism-react-editor` intentionally as a
  Studio browser dependency.

### Domain Branching

The shared Core update service may branch only on stable envelope conditions:

- whether the spec exists;
- whether the owning purpose has a preview builder;
- whether the prompt update is valid;
- whether reference updates are present;
- whether the purpose definition registered
  `applyPreviewReferenceSelections`.

Purpose-specific reference rules must live in purpose-owned modules. The shared
service must not grow a switch over `cast.character-sheet`,
`shot.video-take`, `image.create`, or future purposes.

### Files Expected To Shrink Or Stay Thin

- `packages/studio/server/routes/generation-preview.ts` should stay a thin
  parser/delegator/serializer.
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
  should get save orchestration but should not absorb editor JSX, reference
  mapping rules, request-body construction, and error formatting into one body.
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts` should
  continue delegating to focused lifecycle modules.

### Explicitly Forbidden Shape

Do not:

- add React-local rules that decide how a purpose stores reference selections;
- let the Studio route mutate `specJson` directly;
- add a generic JSON patch endpoint for media generation specs;
- keep the old cast-specific reference route as a compatibility path;
- add a broad purpose switch in Studio server or React code;
- add a broad purpose switch in Core that mutates purpose-specific reference
  shapes;
- add prompt content validation beyond envelope type/presence checks;
- import shot-specific feature components into the generic generation-preview
  feature;
- use raw browser controls in feature code;
- hand-roll the prompt editor as a plain textarea after the
  `prism-react-editor` dependency and implementation pattern have been
  confirmed;
- import `prism-react-editor` directly from generation-preview feature code
  instead of through the local UI primitive;
- add generic markdown parsing, formatting, or preview logic that tries to
  understand prompt contents;
- skip the front-end designer / Product Design review for the UI slices;
- add one-off spacing, focus, hover, or theme classes that conflict with the
  Studio frontend guidelines.

Stop and revise this plan before implementation continues if:

- the Core update service starts accumulating purpose-specific reference JSON;
- the route needs to know about `referenceSelections.dependencyInclusions`;
- the prompt editor starts parsing markdown semantics as runtime validation;
- the prompt editor reverts to a textarea because the dependency was missed
  rather than because a deliberate product decision replaced the rich editor;
- the UI cannot meet Studio spacing, theme, focus, or desktop dialog guidelines
  without changing the component shape;
- the dialog host becomes a large component that owns editor UI, reference UI,
  API shape, and state derivation at once;
- keeping both `authoredText` and `providerText` becomes a convenience mirror
  instead of a real distinction.

## Contracts

### Core Client Contract

Update `packages/core/src/client/generation-preview.ts`:

- replace `GenerationPreviewPrompt.text` with
  `GenerationPreviewPrompt.authoredText`;
- replace `GenerationPreviewPrompt.negativePrompt` with
  `GenerationPreviewPrompt.negativeText`;
- add `GenerationPreviewPrompt.providerText`;
- keep `GenerationPreviewReferenceSelectionControl` as the UI-facing reference
  editability contract;
- keep `generationSpecId` as the saved-preview update gate.

Update all preview builders and validation fixtures directly. Do not accept the
old prompt field names as alternate input.

### Core Server Contract

Update `packages/core/src/server/project-data-service-contracts.ts`:

- add `UpdateGenerationPreviewSpecInput`;
- add `GenerationPreviewPromptUpdate`;
- add `GenerationPreviewReferenceSelectionUpdate`;
- add `updateGenerationPreviewSpec` to `ProjectDataService`.

Update `packages/core/src/server/project-data-service-wiring/media-generation.ts`
to expose the new service.

The service must return a fresh `GenerationPreviewRequest`, not only a
`MediaGenerationSpecRecord`, so the dialog can replace its current preview
without closing.

### Purpose Definition Contract

Update `MediaGenerationPurposeDefinition` with an optional
`applyPreviewReferenceSelections` hook.

The hook input should include:

- `projectName`
- `homeDir`
- `specRecord`
- `referenceSelections`

The hook returns the next `MediaGenerationSpec` only. The shared lifecycle
service remains responsible for calling the purpose `updateSpec(...)` and
rebuilding the preview through `buildPreview(...)`.

Initial required implementation:

- `cast.character-sheet` must support editable reference updates because it
  already exposes editable reference controls in the preview.

Future purpose support:

- A purpose may expose editable references only after Core can update that
  purpose's durable reference-selection model.
- React must not mark arbitrary references editable by guessing from media kind
  or asset relationship.

### Studio API Contract

Replace:

```text
PATCH /studio-api/projects/:projectName/generation-previews/specs/:specId/reference-inclusion
```

with:

```text
PATCH /studio-api/projects/:projectName/generation-previews/specs/:specId
```

The new route body contains both prompt and reference draft state. Empty
`referenceSelections` is valid and means "update the prompt only."

Route-level validation may check only:

- body is an object;
- `prompt.authoredText` is a string;
- `prompt.negativeText`, when present, is a string or null;
- `referenceSelections` is an array;
- each `dependencyId` is a non-empty string;
- each `selected` is a boolean.

All purpose and spec validity checks belong to Core.

### Browser Service Contract

Replace `updateCastCharacterSheetPreviewReference(...)` with
`updateGenerationPreviewSpec(...)`.

Do not keep the old service function as a wrapper or alias.

### UI Contract

The dialog footer order is:

```text
[estimate footer]                         [Update] [Close]
```

`Update` behavior:

- visible for saved previews with `generationSpecId`;
- disabled while there are no local changes;
- disabled or unavailable for previews without `generationSpecId`;
- shows pending state while the request is in flight;
- persists prompt and reference changes together;
- leaves the dialog open on success;
- replaces the local preview with the returned preview on success;
- resets dirty state after success;
- shows a structured error banner on failure;
- does not trigger when the user only checks/unchecks a reference;
- uses the existing `Button` primitive and dialog footer spacing conventions;
- aligns visually with `Close` without cramped margins, uneven gaps, or a
  custom command-bar style that differs from nearby Studio dialogs.

`Close` behavior:

- continues closing the dialog;
- local unsaved changes are discarded in this slice;
- do not add an unsaved-changes confirmation unless product explicitly asks for
  it.

Prompt editor behavior:

- edits `preview.finalPrompt.authoredText`;
- preserves line breaks;
- uses the local `SyntaxTextEditor` primitive backed by `prism-react-editor`;
- sets the editor language to Markdown for prompt text;
- supports syntax highlighting, select/copy/paste, word wrap, and normal
  editor undo/redo keybindings through the Prism editor setup;
- respects Studio light/dark theme tokens and app-wide focus treatment;
- remains contained inside the existing Prompt tab without overlapping tabs,
  estimate footer content, `Update`, or `Close`;
- uses a 75/25 vertical split when `negativeText` is present, with the authored
  prompt receiving the larger region;
- does not reserve negative-prompt space when the selected model schema has no
  `negative_prompt` property;
- does not parse prompt content for meaning;
- does not autosave.

Reference draft behavior:

- initializes from `preview.references[].selected`;
- only references with
  `selectionControl.editable === true` and
  `selectionControl.required !== true` can be toggled;
- required references remain visually selected and untoggleable;
- toggles update local state only;
- selected state shown on cards comes from the local draft when present;
- request body sends final `selected` booleans by `dependencyId`;
- reference cards keep the shared lower-right circular selection-control
  language from Shot Take references.

## Implementation Slices

### Slice 1: Core Prompt Contract And Preview Builders

Update `GenerationPreviewPrompt` in
`packages/core/src/client/generation-preview.ts`.

Update builders:

- `packages/core/src/server/generation-preview/saved-image-preview.ts`
- `packages/core/src/server/media-generation/purposes/image-create.ts`
- `packages/core/src/server/media-generation/purposes/image-edit.ts`
- `packages/core/src/server/media-generation/purposes/lookbook-image.ts`
- `packages/core/src/server/media-generation/purposes/lookbook-sheet.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/purposes/cast-profile.ts`
- `packages/core/src/server/media-generation/purposes/location-environment-sheet.ts`
- `packages/core/src/server/media-generation/purposes/location-hero.ts`
- `packages/core/src/server/media-generation/purposes/scene-storyboard-sheet.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/final-specs.ts`

Update validation:

- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/generation-preview/validation.test.ts`

Shape-preservation rule:

- Do not add compatibility acceptance for old `finalPrompt.text` or
  `finalPrompt.negativePrompt`.
- Do not introduce prompt semantic checks.

### Slice 2: Core Saved Preview Update Service

Add
`packages/core/src/server/media-generation/lifecycle/preview-spec-update.ts`.

Responsibilities:

- read the saved spec with `readMediaGenerationSpec`;
- require the owning purpose definition;
- require a `buildPreview` hook;
- apply `prompt.authoredText` to the saved spec's prompt field;
- apply `prompt.negativeText` only when the saved spec owns negative prompt
  state;
- delegate reference changes to
  `definition.applyPreviewReferenceSelections` when reference updates are
  present;
- call the purpose `updateSpec(...)`;
- rebuild and return a `GenerationPreviewRequest`.

Update:

- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/core/src/server/project-data-service-wiring/media-generation.ts`
- `packages/core/src/server/index.ts`

Shape-preservation rule:

- The service must be a lifecycle service, not a new generic state patch API.
- The service may update only the prompt fields and preview reference
  selections named in the typed request.

### Slice 3: Purpose-Owned Reference Update Hook

Add the optional hook to
`packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`.

Implement the initial hook in
`packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`.

Reuse the current cast-character-sheet reference inclusion logic, but change
the input from one `dependencyId` plus one inclusion override to a list of
final selected booleans. The cast module should translate:

- selected equals default included -> remove override;
- selected true when default is false -> `include`;
- selected false when default is true -> `exclude`.

Validation:

- reject unknown dependency ids with a structured `ProjectDataError`;
- reject required reference changes;
- collect all invalid reference updates before failing when practical;
- do not inspect image contents or prompt text.

Remove the old exported
`updateCastCharacterSheetReferenceInclusion` flow after the shared service is
in place.

Shape-preservation rule:

- The cast module may know `CastCharacterSheetReferenceSelections`.
- The shared lifecycle service, Studio route, and React code may not.

### Slice 4: Studio Server Route

Update `packages/studio/server/routes/generation-preview.ts`.

Changes:

- replace the old `reference-inclusion` route with the new saved-preview update
  route;
- parse the typed request body;
- call `projectData.updateGenerationPreviewSpec`;
- project the returned preview through `buildStudioGenerationPreview`;
- keep `projectErrorResponse` as the structured error boundary.

Update:

- `packages/studio/server/routes/generation-preview.test.ts`
- `packages/studio/server/testing/fake-project-data-service.ts`

Shape-preservation rule:

- Route code must not branch by preview purpose.
- Route code must not compute reference inclusion overrides.

### Slice 5: Browser Service And Draft Model

Update `packages/studio/src/services/studio-generation-preview-api.ts`:

- remove `updateCastCharacterSheetPreviewReference`;
- add `updateGenerationPreviewSpec`.

Add `packages/studio/src/features/generation-preview/generation-preview-draft.ts`.

Draft helper responsibilities:

- create a draft from a `StudioGenerationPreview`;
- expose `promptDraft`;
- expose `referenceSelectionDraftByDependencyId`;
- derive selected state for a reference;
- calculate dirty state;
- build the update request body;
- reset draft from a returned preview.

Shape-preservation rule:

- Keep pure draft helpers outside React components so the dialog host remains
  readable and testable.

### Slice 6: Prompt Editor UI

Before coding this slice, run the front-end designer / Product Design review
workflow for the intended dialog composition. Treat that review as part of the
implementation input, alongside the frontend architecture docs.

Add
`packages/studio/src/features/generation-preview/generation-preview-prompt-editor.tsx`.

Add `prism-react-editor` to `packages/studio/package.json` as the rich editor
dependency used by the external Renku viewer.

Add a domain-neutral `packages/studio/src/ui/syntax-text-editor.tsx` primitive.
It should:

- import `Editor` from `prism-react-editor`;
- import `BasicSetup` from `prism-react-editor/setups`;
- import the Markdown grammar from
  `prism-react-editor/prism/languages/markdown`;
- import the JSON grammar as well if the primitive will be reused for structured
  preview text soon, matching the external viewer implementation;
- import `prism-react-editor/layout.css`;
- import `prism-react-editor/search.css` only if search is enabled for this
  embedded editor;
- apply Studio-owned Prism theme CSS using the existing `--editor-bg` and
  `--editor-fg` tokens;
- expose controlled `value` and `onValueChange` props rather than storing draft
  prompt text internally;
- support `readOnly`, `language`, `wordWrap`, and class/sizing props;
- avoid toolbar buttons in this slice unless product explicitly asks for
  formatting commands.

Port the external viewer's Prism theme approach into Studio:

- either add `packages/studio/src/styles/prism-renku-light.css` and
  `packages/studio/src/styles/prism-renku-dark.css`, or add equivalent
  editor-scoped CSS beside the UI primitive;
- keep the CSS scoped behind `.prism-light` and `.prism-dark` parent classes;
- use Studio's existing editor theme tokens from
  `packages/studio/src/styles/theme.css`.

The generation-preview feature should consume only the local
`SyntaxTextEditor` primitive. It should not import `prism-react-editor`
directly.

Update:

- `packages/studio/src/features/generation-preview/generation-preview-prompt-panel.tsx`
  or replace it with the new editor component;
- `packages/studio/src/features/generation-preview/generation-preview-tabs.tsx`.

Shape-preservation rule:

- Feature code must not contain raw form controls.
- The editor must not parse markdown or prompt content as runtime validation.
- Visual styling must come from Studio primitives, variants, and theme tokens,
  not scattered one-off class strings.

### Slice 7: Reference Draft UI

Update:

- `packages/studio/src/features/generation-preview/generation-preview-reference-grid.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-reference-card.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-tabs.tsx`

Behavior:

- cards receive selected state from the draft model;
- toggles call a local draft callback only;
- no network request happens from the reference card;
- disabled/pending state is driven by the dialog update request, not per-card
  immediate save.

Shape-preservation rule:

- Reuse `ImageOverlayCard` and `ImageSelectionControl`, or extract a
  domain-neutral UI primitive if the Shot Take reference card behavior needs to
  become shared.
- Do not import `SceneShotReferenceCard` from the movie-studio feature into the
  generation-preview feature.

### Slice 8: Dialog Update Action

Update:

- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-dialog.tsx`

Behavior:

- add `Update` immediately left of `Close`;
- wire `Update` to the new browser service;
- keep the dialog open after success;
- replace preview state from the response;
- clear dirty state after success;
- keep the currently selected tab after success unless the returned preview no
  longer supports that tab;
- show errors through the existing update error banner pattern.

Shape-preservation rule:

- Keep save orchestration shallow. If the host component starts mixing draft
  construction, request body assembly, editor rendering, reference rendering,
  and response mapping, split before continuing.

## Tests And Guardrails

### Core Tests

Update:

- `packages/core/src/server/generation-preview/validation.test.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-service.test.ts`
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.test.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.test.ts`

Coverage:

- preview validation accepts the new prompt contract;
- preview validation rejects old prompt field names;
- `updateGenerationPreviewSpec` updates authored prompt text and rebuilds the
  preview;
- `updateGenerationPreviewSpec` rejects reference updates when a purpose has no
  reference-update hook;
- cast-character-sheet reference updates translate selected booleans into
  durable inclusion overrides;
- unknown dependency ids fail with structured diagnostics;
- required references cannot be unchecked;
- prompt text remains opaque: tests assert stored strings, not creative
  contents.

### Studio Server Tests

Update:

- `packages/studio/server/routes/generation-preview.test.ts`

Coverage:

- `PATCH /generation-previews/specs/:specId` delegates to
  `updateGenerationPreviewSpec`;
- request includes prompt and reference selections;
- response includes projected browser URLs;
- malformed request bodies return structured errors;
- the route does not preserve the old `reference-inclusion` path.

### Browser Service Tests

Add or update:

- `packages/studio/src/services/studio-generation-preview-api.test.ts` if the
  package already follows this pattern for API-client tests, or cover the API
  call through the dialog host test if no service-specific pattern exists.

Coverage:

- sends `PATCH` to the new route;
- includes the Studio API token;
- serializes prompt and reference selections;
- reads structured API errors through `readStudioApiError`.

### React Feature Tests

Update:

- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.e2e.test.tsx`

Coverage:

- prompt editor initializes from `finalPrompt.authoredText`;
- prompt editor uses the local syntax editor surface rather than the old
  read-only prose display or a plain textarea;
- editing prompt text does not call `fetch`;
- checking or unchecking an editable reference does not call `fetch`;
- `Update` sends one request containing both prompt and reference changes;
- `Update` does not close the dialog;
- successful update replaces the preview and clears dirty state;
- failed update keeps the dialog open and shows the error banner;
- previews without `generationSpecId` do not offer an enabled update action;
- required references are visible but not toggleable;
- non-editable references are visible but not toggleable.

Add focused UI primitive tests if the project has an established pattern for
testing local UI wrappers:

- `SyntaxTextEditor` renders editable Markdown text;
- `onValueChange` receives updated text;
- `readOnly` mode does not advertise editing actions;
- tests assert behavior and accessible surface, not fragile
  `prism-react-editor` internal class names.

### Architecture Guardrails

Existing guardrails already help:

- `packages/studio/src/architecture.test.ts` forbids raw browser controls in
  feature code.
- Core architecture tests protect package ownership boundaries.

Add focused tests only if implementation creates a new risk that can be tested
without freezing private helper names. Acceptable guardrails:

- a behavior test proving Studio route code delegates to ProjectDataService
  instead of mutating spec JSON;
- a behavior test proving unknown reference ids fail before persistence;
- an import-boundary test if any browser code is tempted to import server-only
  Core modules.
- an import-boundary test if generation-preview feature files are tempted to
  import `prism-react-editor` directly instead of the local UI primitive.

Do not add architecture tests that hard-code private function names, component
names, or complete purpose inventories.

## Documentation

Update current documentation if the implementation changes the public preview
contract:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/frontend.md` only if the reusable
  `SyntaxTextEditor` primitive becomes part of the frontend architecture.
- `docs/cli/commands.md` if CLI preview output examples include the old
  prompt contract.

Check the sister skills project only if agent-facing preview examples or media
generation instructions mention the old prompt fields:

- `/Users/keremk/Projects/aitinkerbox/studio-skills`

Do not edit historical plans merely to rename prompt fields.

## Final Verification

Focused verification:

```bash
pnpm --filter @gorenku/studio-core test -- generation-preview validation spec-service purpose-lifecycle-registry cast-character-sheet --run
pnpm --filter @gorenku/studio test -- generation-preview --run
pnpm --filter @gorenku/studio test -- server/routes/generation-preview.test.ts --run
```

Contract and static checks:

```bash
rg -n "finalPrompt\\.text|finalPrompt\\.negativePrompt|reference-inclusion|updateCastCharacterSheetPreviewReference" packages
# Should return no matches; feature code must import the local UI primitive.
rg -n "prism-react-editor" packages/studio/src/features
# Should find the Studio wrapper/styles/dependency.
rg -n "SyntaxTextEditor|prism-react-editor" packages/studio/src/ui packages/studio/src/styles packages/studio/package.json
pnpm --filter @gorenku/studio-core test:typecheck
pnpm --filter @gorenku/studio test:typecheck
```

Root verification when the implementation touches Core contracts used by CLI,
Studio server, and browser tests:

```bash
pnpm check
```

Manual desktop verification:

- Start Studio on a desktop viewport.
- Open a saved generation preview with editable references.
- Edit the prompt.
- Confirm the prompt editor has Markdown syntax highlighting and normal
  select/copy/paste plus undo/redo keyboard behavior.
- Confirm the prompt editor fits inside the Prompt tab without overlapping the
  tab bar, estimate footer, `Update`, or `Close`.
- Confirm light and dark themes both use Studio editor/theme tokens correctly.
- Toggle at least one optional reference.
- Confirm reference selection controls match the Shot Take lower-right circular
  control language.
- Confirm no network request fires until `Update`.
- Confirm `Update` and `Close` have proper dialog-footer spacing and alignment.
- Click `Update`.
- Confirm the dialog remains open.
- Confirm the returned preview reflects the saved prompt and reference state.
- Close and reopen the preview.
- Confirm the saved prompt and reference state persisted.

Architecture-shape review:

- inspect `git diff --stat`;
- inspect any newly large or heavily modified files;
- confirm `packages/studio/server/routes/generation-preview.ts` remains thin;
- confirm `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
  remains thin;
- confirm no Studio React code imports server-only Core modules;
- confirm no route-local or React-local code knows purpose-specific reference
  storage fields;
- confirm no prompt content validation was added;
- confirm the UI slices used the front-end designer / Product Design workflow;
- confirm the implementation follows `docs/architecture/frontend.md` and
  `docs/architecture/reference/front-end-guidelines.md`;
- confirm no one-off spacing, focus, or theme classes bypass reusable Studio UI
  primitives where a primitive or shared variant should exist;
- confirm no compatibility route, wrapper, alias, or re-export stub was kept
  for the old reference update path.

## Completion Checklist

### Review Area

- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.
- [x] Confirm the UI still follows the Generation Preview redesign direction
      from plan `0111`.
- [x] Confirm prompt strings and media artifacts remain opaque to Studio
      runtime validation.

### Architecture And Contracts

- [x] Update `GenerationPreviewPrompt` deliberately to separate editable
      authored prompt text from provider-facing preview text.
- [x] Update Core preview validation to accept only the current prompt
      contract.
- [x] Add `UpdateGenerationPreviewSpecInput`.
- [x] Add `GenerationPreviewPromptUpdate`.
- [x] Add `GenerationPreviewReferenceSelectionUpdate`.
- [x] Add `updateGenerationPreviewSpec` to ProjectDataService.
- [x] Add the optional purpose definition reference-selection update hook.
- [x] Keep reference-selection storage rules inside owning purpose modules.
- [x] Remove the cast-specific preview reference update service path instead of
      preserving it.
- [x] Keep package-boundary diagnostics structured.
- [x] Avoid compatibility shims, aliases, and fallback branches.

### Core Implementation

- [x] Add the focused preview spec update lifecycle module.
- [x] Update prompt fields in every preview builder.
- [x] Derive negative-prompt visibility from the selected provider model schema.
- [x] Keep a supported negative prompt editable after it is cleared.
- [x] Apply prompt updates through Core and existing purpose `updateSpec`
      validation.
- [x] Implement cast-character-sheet reference selection updates in the cast
      purpose module.
- [x] Reject unknown reference dependency ids before persistence.
- [x] Reject required reference uncheck attempts before persistence.
- [x] Rebuild and return a fresh preview after successful update.
- [x] Delete obsolete cast-specific reference inclusion update code.

### Studio Server Implementation

- [x] Replace the old `reference-inclusion` route with the new saved-preview
      update route.
- [x] Parse only envelope fields in the route.
- [x] Delegate all domain validation and persistence to ProjectDataService.
- [x] Project returned Core previews through `buildStudioGenerationPreview`.
- [x] Return structured errors through the existing route error boundary.

### Studio Browser Implementation

- [x] Use the front-end designer / Product Design workflow before implementing
      the UI slices.
- [x] Reread `docs/architecture/frontend.md` and
      `docs/architecture/reference/front-end-guidelines.md` before UI coding.
- [x] Replace the old browser API client function with
      `updateGenerationPreviewSpec`.
- [x] Add pure draft helpers for prompt and reference state.
- [x] Add `prism-react-editor` to `packages/studio/package.json`.
- [x] Add the local `SyntaxTextEditor` UI primitive around
      `prism-react-editor`.
- [x] Port or recreate the Prism light/dark theme CSS against Studio theme
      tokens.
- [x] Add the prompt editor surface using `SyntaxTextEditor`.
- [x] Use a 75/25 authored/negative prompt layout only when the selected model
      supports a negative prompt.
- [x] Use local UI primitives for all controls.
- [x] Verify button spacing, footer alignment, focus rings, hover states, and
      selected states follow Studio UI guidelines.
- [x] Verify the prompt editor is polished in both light and dark themes.
- [x] Confirm generation-preview feature code does not import
      `prism-react-editor` directly.
- [x] Keep reference toggles local until `Update`.
- [x] Add `Update` immediately to the left of `Close`.
- [x] Keep the dialog open after successful update.
- [x] Reset dirty state after successful update.
- [x] Show update failures without closing the dialog.
- [x] Ignore update responses and errors after a newer preview supersedes the
      request that produced them.
- [x] Keep saved-preview update disabled or unavailable for previews without
      `generationSpecId`.

### Tests And Guardrails

- [x] Update Core preview contract tests.
- [x] Add Core lifecycle update tests.
- [x] Add purpose-owned reference update tests.
- [x] Update Studio server route tests.
- [x] Update or add browser API tests.
- [x] Add focused `SyntaxTextEditor` tests if local UI primitive tests are
      available.
- [x] Update generation preview dialog host tests for explicit update behavior.
- [x] Test that prompt edits flow through the syntax editor without autosave.
- [x] Keep architecture/static tests focused on stable boundaries rather than
      private implementation names.
- [x] Run the shape-review checks listed in Final Verification.

### Documentation

- [x] Update current media-generation docs if the prompt contract changes.
- [x] Update current Studio coordination or CLI docs if examples expose the old
      prompt shape.
- [x] Check `studio-skills` for current agent-facing preview examples if the
      contract changes.
- [x] Do not edit historical plans merely for naming sweeps.

### Final Verification

- [x] Run focused Core tests.
- [x] Run focused Studio server and browser tests.
- [x] Run package typechecks for touched packages.
- [x] Run `pnpm check` if Core contract changes touch CLI or cross-package
      fixtures.
- [x] Run `rg` checks for retired prompt fields and route names.
- [x] Run `rg` checks for direct `prism-react-editor` imports in feature code.
- [x] Manually verify the desktop dialog update flow.
- [x] Manually verify Markdown syntax highlighting and normal editor keyboard
      behavior in the prompt editor.
- [x] Manually verify prompt editor containment, dialog-footer button spacing,
      and light/dark theme behavior.
- [x] Manually verify reference controls match the Shot Take selection-control
      language.
- [x] Review `git diff --stat` and inspect large changed files.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
