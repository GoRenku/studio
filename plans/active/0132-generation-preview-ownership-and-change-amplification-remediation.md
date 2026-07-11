# 0132 Generation Preview Ownership And Change-Amplification Remediation

Status: proposed
Date: 2026-07-10

## Summary

Refactor Generation Preview so a change to prompt projection, editable preview
fields, or browser save coordination does not require edits across unrelated
purpose implementations, the global project service, a universal Studio fake,
and several pass-through React components.

The current implementation is behaviorally correct and tested, but it exposes
missing ownership boundaries:

- nine image-purpose builders repeat the same authored/provider prompt
  projection;
- shared lifecycle code mutates purpose-specific spec fields such as
  `negativePrompt` and sequences purpose-specific reference updates;
- `MediaGenerationPurposeDefinition` grows one optional hook for each new
  preview-editing capability;
- `purpose-lifecycle-registry.ts` is a 962-line composition switchboard;
- `ProjectDataService` is a 1,863-line, roughly 304-method interface;
- `ProjectsRouteProjectData` manually lists 121 methods and casts through
  `unknown`;
- the 1,818-line Studio fake changes when one unrelated service method is
  added;
- browser draft, pending, error, and stale-request state is threaded through
  the preview host, dialog, tabs, and panels.

The smallest useful scope is Generation Preview and the media-generation
composition boundary it directly exercises. This plan does not attempt to
split every `ProjectDataService` domain or refactor every Studio route. It does:

- give Generation Preview a focused Core service owner;
- make preview build/update one cohesive purpose capability;
- move purpose lifecycle definition wiring out of the central registry body;
- centralize common image prompt projection;
- remove Generation Preview commands from `ProjectDataService` and the
  universal Studio fake;
- introduce a narrow Studio route command port;
- move browser editor request/draft coordination into one feature-owned hook;
- add stable import and runtime guardrails that protect these boundaries.

This is an architecture remediation. It must preserve the current visible
prompt editor, conditional negative-prompt editor, 75/25 prompt layout,
editable Cast Character Sheet references, explicit `Update` action, structured
errors, provider preview construction, and stale-response protection.

## Context

Accepted decisions and current architecture references:

- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `docs/decisions/0044-use-media-generation-module-boundaries.md`
- `docs/decisions/0045-use-generation-preview-purpose-bindings.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/generation-preview-purpose-bindings.md`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/structured-diagnostics.md`
- `docs/architecture/architecture-test-registry.md`
- `docs/architecture/naming-guidelines.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `plans/active/0108-media-generation-module-boundary-refactor.md`
- `plans/active/0114-generation-preview-contract-verification-remediation.md`
- `plans/active/0115-generation-preview-saved-spec-builders-completion.md`
- `plans/active/0131-generation-preview-prompt-editor-and-reference-update.md`

Current implementation surfaces:

- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/server/generation-preview/`
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
- `packages/core/src/server/media-generation/lifecycle/preview-spec-update.ts`
- `packages/core/src/server/media-generation/purposes/`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/core/src/server/project-data-service-wiring/shared-media-generation.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/studio/server/routes/generation-preview.ts`
- `packages/studio/server/routes/projects.ts`
- `packages/studio/server/testing/fake-project-data-service.ts`
- `packages/studio/src/features/generation-preview/`
- `packages/studio/src/services/studio-generation-preview-api.ts`

The real sample movie remains:

- `$HOME/renku-movies/urban-basilica`

The current uncommitted Generation Preview implementation is the behavioral
baseline for this plan. Do not preserve its internal hook names or file paths
as compatibility surfaces. Update callers directly and delete replaced paths
in the same implementation slice.

## Problem Statement

### Repeated Image Prompt Projection

Current image-purpose builders repeat:

```ts
authoredPrompt: specRecord.spec.prompt,
providerPrompt: providerPreviewPromptText(
  plan.payload,
  specRecord.spec.prompt
),
```

The shared saved-image preview path owns `finalPrompt`, so purpose bindings
should not know that the public prompt contract contains both authored and
provider-facing text. Purpose bindings should provide the authored prompt and
provider payload; the shared preview path should derive the public projection.

### Shared Lifecycle Mutates Purpose Specs

`preview-spec-update.ts` currently:

- structurally checks for `prompt`;
- assigns `spec.prompt`;
- asks a purpose capability hook whether `negativePrompt` is supported;
- assigns or deletes `negativePrompt` through a cast;
- conditionally calls a different purpose hook for reference selections;
- then calls the generic `updateSpec` operation.

This splits one user intent across shared and purpose-specific mutation logic.
It also makes every new editable field another lifecycle interface method or
branch. The owning purpose must apply the complete semantic preview update and
persist it through its focused spec command.

### Central Lifecycle Registry Is A Switchboard

`purpose-lifecycle-registry.ts` currently owns both the registry map and nearly
all purpose-to-lifecycle adaptation. It imports context, model, spec,
dependency, preview, and run implementations for every purpose.

The registry should index complete definition objects. Purpose-specific
adaptation should live in one definition-binding module per purpose, so adding
one capability to one purpose does not expand a central implementation file.

### Generation Preview Depends On The God Service

The three Generation Preview commands are exposed through `ProjectDataService`.
That forces one command addition through the global contract, global wiring,
Studio projects-route `Pick`, and universal fake.

Generation Preview already has a clear domain owner under Core. Its public
commands should be exported from that owner and injected into adapters through
narrow command ports. The rest of `ProjectDataService` is out of scope, but
Generation Preview must stop extending it.

### Browser Coordination Is Prop-Drilled

The host owns coordination events, draft state, update requests, pending state,
errors, dirty checks, reference toggles, prompt edits, and stale-response
invalidation. That state then passes through the dialog and tabs.

The host should own only the live coordination event and dialog visibility. A
feature-owned editor hook should own the editing session. Presentational
components should receive only the values and callbacks they render.

## Goals And Change-Amplification Tests

The architecture is successful when all of these statements are true:

1. Changing the shared image prompt projection touches the shared saved-image
   preview module and its tests, not every image-purpose binding.
2. Adding one purpose-specific editable preview field touches that purpose's
   preview update module and public browser/editor contract only; it does not
   add another method to the shared lifecycle definition.
3. The shared Generation Preview service does not import purpose modules,
   inspect purpose-specific spec fields, or branch by purpose id.
4. The lifecycle registry imports purpose definition bindings, not context,
   spec, provider, run, or preview implementation modules directly.
5. Adding a Generation Preview HTTP command does not change
   `ProjectDataService`, `ProjectsRouteProjectData`, or
   `fake-project-data-service.ts`.
6. Changing request race or draft coordination changes the feature editor hook
   and its tests, not the event host and every presentation layer.
7. Public contract changes still update real consumers and package-local test
   fixtures. Compile-time fan-out at genuine public boundaries remains
   intentional and visible.

## Non-Goals

This plan does not:

- change visible Generation Preview product behavior;
- change the current prompt, negative prompt, reference, Config, diagnostics,
  or estimate presentation;
- add autosave or change the explicit `Update` interaction;
- make draft previews editable;
- add new editable provider parameters;
- validate, rewrite, embellish, score, or semantically parse prompt text;
- change media-generation spec schemas or database storage;
- add database migrations;
- split every method out of `ProjectDataService`;
- redesign unrelated Studio routes or test fakes;
- merge the cost and lifecycle registries;
- add dynamic plugin registration or runtime discovery for generation
  purposes;
- add compatibility aliases, re-export stubs, fallback routes, or old command
  names;
- introduce a generic durable-state patch API;
- add architecture tests that enumerate private functions, definition files,
  purpose implementations, or retired names.

## Architecture Shape Gate

### Package Ownership

`packages/core/src/server/generation-preview` owns:

- public saved and draft preview build commands;
- the saved-preview update command;
- preview request envelope validation;
- shared image preview envelope construction;
- authored/provider prompt projection;
- the cohesive purpose preview capability contract;
- dispatch from a public preview command to the selected purpose definition.

`packages/core/src/server/media-generation/lifecycle` owns:

- the common purpose definition contract outside preview-specific details;
- the thin purpose registry map;
- one lifecycle definition-binding module per purpose;
- context, model, spec, dependency, and run orchestration unrelated to preview
  rendering/editing.

Purpose implementations own:

- validating their saved spec type;
- resolving purpose context and references;
- selecting/building provider plans;
- checking model-specific editable field support;
- applying the complete preview update to their spec;
- persisting through their existing focused `update*Spec` command.

`packages/studio/server` owns:

- HTTP envelope parsing;
- token enforcement;
- calling the narrow Core Generation Preview command;
- browser URL projection;
- structured error serialization.

`packages/studio/src/features/generation-preview` owns:

- the current live preview editing session;
- prompt/reference draft state;
- dirty and pending state;
- request/error handling;
- stale-request invalidation;
- composition of presentational prompt, reference, Config, diagnostics, and
  estimate surfaces.

### Target Core Layout

```text
packages/core/src/server/
  generation-preview/
    authored-prompt-update.ts
    contracts.ts
    purpose-preview.ts
    service.ts
    saved-image-preview.ts
    provider-preview-prompt.ts
    projection.ts
    validation.ts
    configuration/

  media-generation/
    lifecycle/
      purpose-definition.ts
      purpose-lifecycle-registry.ts
      purpose-definitions/
        cast-character-sheet.ts
        cast-profile.ts
        cast-voice-sample.ts
        image-create.ts
        image-edit.ts
        location-environment-sheet.ts
        location-hero.ts
        lookbook-image.ts
        lookbook-sheet.ts
        scene-dialogue-audio.ts
        scene-storyboard-sheet.ts
        shot-video-take.ts
      context-service.ts
      dependency-service.ts
      model-service.ts
      run-service.ts
      spec-service.ts

    purposes/
      cast-character-sheet.ts
      cast-character-sheet-preview.ts
      ...
      shot-video-take/
        provider/
          negative-prompt-support.ts
        specs/
          generation-preview.ts
          final-specs.ts
```

`purpose-definitions/*.ts` are lifecycle composition bindings, not
compatibility wrappers. Each file may:

- import one purpose's focused implementation entrypoints;
- adapt generic lifecycle input to that purpose's typed input;
- construct one `MediaGenerationPurposeDefinition` object.

They must not:

- re-export purpose implementation functions;
- contain provider payload construction;
- contain spec validation or persistence logic;
- branch across multiple purposes;
- become alternate public entrypoints.

No `index.ts` is added under `purpose-definitions`. The lifecycle registry
imports each binding directly. The only public package entrypoint remains
`packages/core/src/server/index.ts`, and it may export the accepted public
Generation Preview commands and types only.

### Target Purpose Definition Shape

Move `MediaGenerationPurposeDefinition` and related input types from the
registry implementation into:

- `packages/core/src/server/media-generation/lifecycle/purpose-definition.ts`

The definition contains one cohesive optional preview capability:

```ts
export interface MediaGenerationPurposePreview {
  build(
    input: MediaGenerationPreviewBuildInput
  ): Promise<GenerationPreviewRequest>;
  update?(
    input: ApplyMediaGenerationPreviewUpdateInput
  ): Promise<MediaGenerationSpecRecord>;
}

export interface MediaGenerationPurposeDefinition {
  // existing context/model/spec/dependency/run capabilities
  preview?: MediaGenerationPurposePreview;
}
```

`ApplyMediaGenerationPreviewUpdateInput` contains:

- `projectName?: string`;
- `homeDir?: string`;
- the current `MediaGenerationSpecRecord`;
- `prompt: GenerationPreviewPromptUpdate`;
- `referenceSelections: GenerationPreviewReferenceSelectionUpdate[]`.

Delete these field-specific lifecycle hooks:

- `supportsPreviewNegativePrompt`;
- `applyPreviewReferenceSelections`.

Do not replace them with more field-specific booleans or callbacks. A purpose
either exposes one complete preview update command or remains preview-read-only.

### Target Generation Preview Service

`packages/core/src/server/generation-preview/service.ts` owns these existing
public commands:

- `buildMediaGenerationPreview`;
- `buildDraftMediaGenerationPreview`;
- `updateGenerationPreviewSpec`.

The service may:

- validate the public update envelope;
- read the saved spec record;
- look up its purpose definition;
- require `definition.preview.build` or `definition.preview.update`;
- call the purpose update command;
- rebuild the preview from the returned persisted record.

The service must not:

- import any module under `media-generation/purposes`;
- inspect `prompt`, `negativePrompt`, reference-selection storage, or another
  purpose spec field;
- load provider schemas;
- branch on purpose id, media kind, or provider model;
- call a generic durable-state patch command;
- persist a caller-assembled `MediaGenerationSpec` directly.

`media-generation/lifecycle/spec-service.ts` returns to spec lifecycle only. It
must not own preview build/update commands after this plan.

`packages/core/src/server/generation-preview/contracts.ts` owns these public
server-side command inputs:

- `BuildMediaGenerationPreviewInput`;
- `BuildDraftMediaGenerationPreviewInput`;
- `GenerationPreviewPromptUpdate`;
- `GenerationPreviewReferenceSelectionUpdate`;
- `UpdateGenerationPreviewSpecInput`.

Move them out of `project-data-service-contracts.ts`, update callers directly,
and export them only through the intentional package server `index.ts`.

### Purpose-Owned Preview Updates

Prompt-only purposes register a focused update created by:

- `createAuthoredPromptPreviewUpdate` in
  `generation-preview/authored-prompt-update.ts`.

That factory is deliberately narrow. It may:

- require a typed spec with `prompt: string`;
- reject negative prompt or reference updates for a prompt-only purpose;
- replace the authored prompt exactly;
- call the purpose's focused typed update-spec command.

It must not gain an option bag for negative prompts, references, provider
parameters, model ids, or arbitrary spec patches. A purpose with additional
editable fields implements a focused custom preview update instead.

Cast Character Sheet preview behavior moves to:

- `packages/core/src/server/media-generation/purposes/cast-character-sheet-preview.ts`.

It owns:

- Cast Character Sheet preview construction;
- editable reference option projection;
- authored prompt application;
- required/unknown reference diagnostics;
- dependency inclusion override construction;
- persistence through `updateCastCharacterSheetSpec`.

Shot Video Take preview behavior moves to:

- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/generation-preview.ts`.

It owns:

- Shot Video Take preview construction;
- authored and provider prompt projection;
- negative prompt application and clearing;
- persistence through `updateShotVideoTakeSpec`.

Selected-model negative-prompt support moves to:

- `packages/core/src/server/media-generation/purposes/shot-video-take/provider/negative-prompt-support.ts`.

Both Shot Video Take preview construction and preview update call that one
purpose-owned schema capability function. The shared lifecycle and Studio UI do
not inspect model schemas.

### Shared Image Prompt Projection

`buildSavedImageGenerationPreview` accepts:

- the exact authored prompt;
- the provider payload;
- the existing model, project, target, reference, and configuration inputs.

It derives `finalPrompt.providerText` internally through the existing
provider-preview prompt projection. Remove `providerPrompt` from
`BuildSavedImageGenerationPreviewInput`.

Purpose bindings remain responsible for context, provider plan selection,
target/title data, and durable reference ids. They do not construct the public
`GenerationPreviewPrompt` shape.

### Thin Purpose Registry

`purpose-lifecycle-registry.ts` is allowed to contain only:

- direct imports of `purpose-definitions/*.ts` objects;
- the ordered definition array;
- the purpose-id map;
- list/require/assert functions over that map.

It must not import purpose context, spec, provider, run, dependency, or preview
implementation modules directly.

No dynamic runtime registration is introduced. The registry remains explicit
and deterministic, but its implementation stays small and reviewable.

### Narrow Adapter Ports

Remove these methods from `ProjectDataService` and shared project-data wiring:

- `buildMediaGenerationPreview`;
- `buildDraftMediaGenerationPreview`;
- `updateGenerationPreviewSpec`.

Callers import the public Core Generation Preview commands from
`@gorenku/studio-core/server` or receive them through a narrow adapter runtime.

The Studio route option is:

```ts
export interface CreateGenerationPreviewRouteOptions {
  updateGenerationPreviewSpec?: typeof coreUpdateGenerationPreviewSpec;
  requireToken: MiddlewareHandler;
  generationPreviewProjection?: StudioGenerationPreviewProjection;
}
```

The route defaults to the Core command when no test override is supplied.
`createProjectsRoute` does not add this command to `ProjectsRouteProjectData`.
The universal fake does not implement it.

The CLI generation command runtime gets one narrow preview command port for:

- `buildMediaGenerationPreview`;
- `buildDraftMediaGenerationPreview`.

Do not add the complete Generation Preview service to the global structured
command runtime used by unrelated command families.

### Browser Editor Session

Add:

- `packages/studio/src/features/generation-preview/use-generation-preview-editor.ts`.

The hook owns:

- draft creation/reset for the current event id;
- authored and negative prompt edits;
- reference toggles;
- dirty-state calculation;
- pending state;
- API update calls;
- returned-preview replacement;
- structured error display state;
- stale response/error invalidation.

`GenerationPreviewDialogHost` owns only:

- listening for `renku:generation-preview-requested`;
- storing the current event detail;
- dialog open/close state.

`GenerationPreviewDialog` invokes the editor hook for the current event and
composes the dialog. `GenerationPreviewTabs` and its panels remain
presentational and receive the smallest explicit props they render.

Do not add a React context unless the final explicit prop path still crosses
more than one non-owning intermediate component after the hook extraction.
Do not create a generic editor-state provider.

### Existing Files Expected To Shrink Or Disappear

- `media-generation/lifecycle/preview-spec-update.ts`: delete after its command
  moves to `generation-preview/service.ts` and purpose updates move to owners.
- `media-generation/lifecycle/spec-service.ts`: remove preview build/update
  behavior and imports.
- `media-generation/lifecycle/purpose-lifecycle-registry.ts`: shrink to the
  registry map and lookup operations.
- `media-generation/purposes/cast-character-sheet.ts`: remove preview build and
  preview reference update behavior moved to `cast-character-sheet-preview.ts`.
- `shot-video-take/specs/final-specs.ts`: remove preview build/update support
  moved to `specs/generation-preview.ts`.
- `project-data-service-contracts.ts`: remove Generation Preview methods, while
  leaving unrelated service debt untouched.
- `project-data-service-wiring/shared-media-generation.ts`: remove Generation
  Preview wiring.
- `studio/server/testing/fake-project-data-service.ts`: remove Generation
  Preview behavior.
- `generation-preview-dialog-host.tsx`: shrink to event/dialog hosting.

### Explicitly Forbidden Shapes

Do not:

- replace several field-specific hooks with a generic arbitrary spec patch;
- let the shared Generation Preview service assign purpose spec fields;
- let Studio send `referenceSelections.dependencyInclusions` or another durable
  storage shape;
- create one preview update function with a purpose `switch`;
- create a broad preview factory with callbacks for every possible field;
- move the 962-line registry body into one differently named file;
- create non-`index.ts` re-export stubs for moved modules;
- add `index.ts` barrels under purpose definitions or Shot Video Take folders;
- make purpose definition bindings contain business logic;
- introduce a second global service object that mirrors `ProjectDataService`;
- add Generation Preview commands to unrelated CLI runtimes;
- make React enforce model schema or durable reference rules;
- add source-text architecture tests that list function names, definition file
  names, or all purposes.

### Architecture Stop Conditions

Stop implementation and revise this plan if:

- `generation-preview/service.ts` needs a purpose id or provider-model branch;
- the shared authored-prompt updater gains support for another editable field;
- a purpose definition binding starts validating specs or building payloads;
- the lifecycle registry still imports purpose implementation modules after the
  definition move;
- one purpose update returns an arbitrary caller-persisted state patch;
- moving preview commands off `ProjectDataService` creates a second god service;
- the browser hook starts rendering JSX or interpreting Core business rules;
- a small prompt projection change still requires edits to all image-purpose
  bindings after the shared path is complete;
- the registry, service, Cast preview, Shot preview, or browser hook becomes a
  new monolith merely because it has the correct owner name.

## Contracts

### Contracts Retained

Retain the current browser-safe contracts unless implementation proves a
behavioral defect:

- `GenerationPreviewRequest`;
- `StudioGenerationPreview`;
- `GenerationPreviewPrompt`;
- `GenerationPreviewPromptUpdate`;
- `GenerationPreviewReferenceSelectionUpdate`;
- `UpdateGenerationPreviewSpecInput`;
- `buildMediaGenerationPreview`;
- `buildDraftMediaGenerationPreview`;
- `updateGenerationPreviewSpec`.

No old aliases are kept if a contract move changes its import owner. Update
callers directly.

### New Internal Contracts

Add:

- `MediaGenerationPurposePreview`;
- `ApplyMediaGenerationPreviewUpdateInput`;
- `MediaGenerationPreviewBuildInput` under the Generation Preview owner;
- `GenerationPreviewCommandPort` in the CLI generation command module only;
- the feature-local return type `GenerationPreviewEditor` for
  `useGenerationPreviewEditor`.

`GenerationPreviewEditor` is a feature controller result, not a public DTO. It
contains only current draft/status/action fields used by the dialog and must
not mirror the whole `StudioGenerationPreview` object.

### Diagnostics

Preserve or deliberately rename structured diagnostics for:

- invalid prompt update envelopes;
- unsupported preview updates;
- unsupported negative prompts for the selected model schema;
- unknown reference dependency ids;
- required reference deselection;
- unsupported purpose preview construction.

Diagnostic codes remain Core-owned and stable for the current contract. Do not
add diagnostics for removed hooks, old routes, or obsolete service methods.

## Implementation Slices

### Slice 1: Extract Lifecycle Definition Contracts And Bindings

Expected files:

- add `media-generation/lifecycle/purpose-definition.ts`;
- add the twelve `media-generation/lifecycle/purpose-definitions/*.ts` binding
  modules named in the target layout;
- reduce `purpose-lifecycle-registry.ts` to imports, array, map, and lookups;
- update lifecycle services and tests to import definition types from the new
  contract owner;
- update purpose modules that currently import types from the registry.

Preserve all context, model, validation, spec, dependency, preparation, cost,
and run behavior. This slice is a structural move only.

Delete no old import path until every caller imports the new owner directly.
Then delete the old in-registry type declarations in the same slice.

### Slice 2: Introduce The Cohesive Purpose Preview Capability

Expected files:

- add `generation-preview/purpose-preview.ts`;
- update `purpose-definition.ts` to use `preview?:
  MediaGenerationPurposePreview`;
- update purpose definition bindings from `buildPreview` to `preview.build`;
- add `generation-preview/authored-prompt-update.ts`;
- implement prompt-only preview update bindings;
- add `cast-character-sheet-preview.ts` with Cast build/update behavior;
- add `shot-video-take/specs/generation-preview.ts` with Shot build/update
  behavior;
- add `shot-video-take/provider/negative-prompt-support.ts`;
- delete `supportsPreviewNegativePrompt` and
  `applyPreviewReferenceSelections` from the lifecycle definition;
- remove shared purpose-field mutation from `preview-spec-update.ts`.

The complete prompt/reference update for one purpose must reach its focused
typed update-spec command through one purpose preview update handler.

### Slice 3: Centralize Shared Image Prompt Projection

Expected files:

- update `generation-preview/saved-image-preview.ts`;
- update its focused tests;
- update image-purpose preview bindings once to stop supplying
  `providerPrompt`;
- update `generation-preview-purpose-bindings.md` examples.

After this slice, the shared image path derives `providerText` from the authored
prompt and provider payload. Purpose bindings must not construct
`GenerationPreviewPrompt`.

Run a complete diff inspection after this slice. If the change introduces new
format-only churn across purpose files, remove it before continuing.

### Slice 4: Move Public Preview Commands To The Generation Preview Owner

Expected files:

- add `generation-preview/service.ts`;
- add `generation-preview/contracts.ts` and move the preview command input
  contracts out of `project-data-service-contracts.ts`;
- move saved build, draft build, and saved update command orchestration there;
- remove preview behavior from `media-generation/lifecycle/spec-service.ts`;
- delete `media-generation/lifecycle/preview-spec-update.ts`;
- update `packages/core/src/server/index.ts` to export the commands from their
  actual owner;
- update Core tests to import the actual owner directly when they test internal
  behavior.

No forwarding module remains under lifecycle.

### Slice 5: Remove Generation Preview From ProjectDataService

Expected files:

- remove the three preview methods from
  `project-data-service-contracts.ts`;
- remove their entries from
  `project-data-service-wiring/shared-media-generation.ts`;
- update CLI generation command runtime and handlers to use the narrow
  `GenerationPreviewCommandPort`;
- update CLI tests with a narrow preview port;
- change the Studio Generation Preview route to inject the Core update command
  directly;
- remove `updateGenerationPreviewSpec` from `ProjectsRouteProjectData`;
- remove Generation Preview behavior from
  `fake-project-data-service.ts`;
- keep the Generation Preview route test self-contained with a local command
  fake and package-local preview fixture.

Do not refactor unrelated ProjectDataService methods or Studio subroutes in
this slice.

### Slice 6: Consolidate The Browser Editor Session

Expected files:

- add `use-generation-preview-editor.ts` and focused tests;
- keep pure request/draft projection in `generation-preview-draft.ts`;
- shrink `generation-preview-dialog-host.tsx` to event and visibility
  ownership;
- let `generation-preview-dialog.tsx` compose the hook and dialog;
- reduce pass-through props in `generation-preview-tabs.tsx` where the hook
  extraction makes them unnecessary;
- keep prompt/reference panels presentational;
- preserve the existing narrow API client in
  `studio-generation-preview-api.ts`.

The stale-response test must exercise a new preview event arriving before an
older update request resolves.

### Slice 7: Package-Local Fixtures And Architecture Guardrails

Expected files:

- add a Core Generation Preview request fixture under a test-only Core testing
  folder if three or more Core tests still duplicate the full contract;
- add one Studio feature-local `StudioGenerationPreview` fixture shared by the
  draft and editor integration tests;
- add one Studio server route fixture only if existing
  `server/testing/route-fixtures.ts` is the accepted owner;
- do not export test fixtures from package public `index.ts` files;
- add import-boundary and runtime shape tests described below;
- remove obsolete preview behavior from the universal fake.

Fixtures provide valid defaults and explicit overrides. Tests that verify the
public prompt contract must still assert the full relevant shape instead of
hiding it behind defaults.

### Slice 8: Documentation And Accepted Decision

Expected files:

- add `docs/decisions/0047-use-purpose-owned-generation-preview-editing.md`;
- update `docs/architecture/generation-preview-purpose-bindings.md`;
- update `docs/architecture/media-generation.md`;
- update `docs/architecture/frontend.md` if the editor-session ownership is a
  reusable feature pattern;
- update `docs/architecture/architecture-test-registry.md`;
- update current CLI documentation only if its implementation contract changes
  visibly to agents or maintainers.

Do not edit completed historical plans for naming sweeps. This plan and the ADR
record the new architecture.

## Tests And Guardrails

### Core Behavior Tests

Prove:

- every previewable purpose still builds a valid preview;
- prompt-only purposes update only the exact authored prompt;
- prompt-only purposes reject negative prompt and reference updates before a
  write;
- Cast Character Sheet applies prompt and reference changes in one purpose
  update;
- Cast required and unknown reference selections fail before persistence;
- Shot Video Take exposes negative prompt editing only when the selected
  provider model schema supports `negative_prompt`;
- Shot Video Take can add, clear, and re-add a negative prompt;
- an unsupported selected model rejects a forged negative prompt update before
  persistence;
- the service rebuilds the preview from the returned persisted record;
- a purpose without `preview.update` remains read-only;
- draft preview construction does not expose a saved update command.

### Registry And Import-Boundary Tests

Add stable architecture checks that prove:

- `generation-preview/service.ts` does not import
  `media-generation/purposes` or `@gorenku/studio-engines`;
- `purpose-lifecycle-registry.ts` imports only lifecycle definition bindings,
  client contracts, diagnostics, and map/registry infrastructure;
- `purpose-definitions` modules do not import Studio, CLI, HTTP, or browser
  code;
- cost modules do not import the new Generation Preview service;
- purpose definition coverage still matches accepted lifecycle purpose ids at
  runtime;
- each preview update command is registered through the public preview
  capability shape, without an architecture test listing implementation
  function names.

Import checks may protect stable folder boundaries. They must not list every
definition file, helper function, or purpose implementation name.

### Studio Server Tests

Prove:

- the PATCH route parses the current update envelope;
- the route invokes only its injected narrow Core command;
- it projects the returned preview through the existing Studio projection;
- malformed HTTP envelopes return structured request errors;
- Core diagnostics serialize through the existing route error boundary;
- the route test does not construct or import the universal
  `ProjectDataService` fake.

### CLI Tests

Prove:

- saved preview display calls the narrow saved-preview command;
- draft preview display calls the narrow draft-preview command;
- project lookup remains in the existing project-data runtime;
- generation preview payload delivery to Studio is unchanged;
- unrelated command handlers do not require a Generation Preview command port.

### Browser Tests

Prove:

- the hook resets draft state for a new event id;
- prompt and reference edits remain local until `Update`;
- dirty state clears after a successful update;
- errors remain visible without closing the dialog;
- a stale success cannot replace a newer preview;
- a stale error cannot appear on a newer preview;
- model-supported negative prompts keep the 75/25 layout when empty;
- models without negative prompt support reserve no negative prompt space;
- draft previews remain read-only;
- required references remain selected and non-editable.

### Change-Amplification Review

Perform these manual review exercises against the final diff:

1. Trace a hypothetical new image prompt projection field. Confirm the common
   image bindings would not all require edits.
2. Trace a hypothetical Shot-only editable prompt field. Confirm no shared
   lifecycle interface method would be added.
3. Trace a hypothetical new Generation Preview route command. Confirm the
   global project service, projects-route `Pick`, and universal fake would not
   change.
4. Trace a stale-request handling change. Confirm the event host and prompt/
   reference panels would not own request sequencing.

These are review exercises, not brittle source-text tests.

## Documentation

Update current documentation to state:

- Generation Preview is a focused Core service boundary, not part of the
  general project-data service contract;
- purpose definitions expose one cohesive preview capability;
- purpose-owned update handlers apply and persist the full semantic preview
  update;
- shared image preview construction owns authored/provider prompt projection;
- selected-model negative prompt support remains purpose/provider-schema owned;
- Studio routes use a narrow command port;
- browser editing-session coordination belongs in a feature hook;
- presentation-only Markdown tokenization still preserves opaque prompt
  contents.

The new ADR must explain why field-specific lifecycle hooks and shared union
mutation were rejected. It should extend, not supersede, ADR 0045's shared
image preview and purpose-binding decision.

## Final Verification

Run focused checks during each slice:

```bash
pnpm --dir packages/core exec vitest run \
  src/server/generation-preview \
  src/server/media-generation/lifecycle \
  --pool=forks

pnpm --dir packages/cli exec vitest run \
  src/commands/generation-command-handlers.test.ts

pnpm --dir packages/studio exec vitest run \
  server/routes/generation-preview.test.ts \
  src/features/generation-preview/generation-preview-draft.test.ts

pnpm --dir packages/studio exec vitest run \
  --config vitest.integration.config.ts \
  src/features/generation-preview/generation-preview-dialog-host.e2e.test.tsx
```

Run package and root verification:

```bash
pnpm build:core
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm check
```

Run `pnpm test` when the focused suites and root checks pass. If CLI localhost
tests fail only because the sandbox forbids binding `127.0.0.1`, rerun the CLI
suite with the required approval and record that distinction.

Manual verification:

- open a saved image preview and update its prompt;
- open a Cast Character Sheet preview and update prompt plus reference
  selections together;
- open a Shot Video Take whose model schema supports `negative_prompt` and add,
  clear, and re-add the negative prompt;
- open a model without `negative_prompt` and confirm no space is reserved;
- trigger a newer preview while an older update is pending and confirm the
  newer preview remains active;
- confirm draft previews remain read-only;
- confirm prompt text round-trips exactly and syntax highlighting does not
  change authored contents.

Final architecture-shape review:

- inspect `git diff --stat` and the complete diff;
- inspect every new or heavily modified file;
- confirm `purpose-lifecycle-registry.ts` is a thin registry;
- confirm `generation-preview/service.ts` is thin orchestration;
- confirm Cast and Shot preview modules remain focused;
- confirm `ProjectDataService` and the universal fake lost preview methods;
- confirm no `index.ts` gained implementation logic;
- confirm no compatibility re-export files remain;
- confirm no formatter rewrote unrelated existing files;
- confirm the implementation did not merely move the god switchboard into a
  new owner-named file;
- perform all four change-amplification review exercises.

## Completion Checklist

### Review Area

- [ ] Confirm the implementation preserves Core, adapter, and browser ownership
      boundaries.
- [ ] Confirm Generation Preview has one focused Core owner.
- [ ] Confirm centralized preview ownership did not become a monolithic
      implementation.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no new broad dispatcher, catch-all helper, or god file was added.
- [ ] Confirm visible behavior from plan 0131 remains unchanged.
- [ ] Confirm the work is a direct refactor with no compatibility layer.

### Architecture And Public Contracts

- [ ] Add `MediaGenerationPurposePreview`.
- [ ] Add `ApplyMediaGenerationPreviewUpdateInput`.
- [ ] Nest preview build/update under `MediaGenerationPurposeDefinition.preview`.
- [ ] Remove `supportsPreviewNegativePrompt`.
- [ ] Remove `applyPreviewReferenceSelections`.
- [ ] Retain the current public Generation Preview request/update contracts
      unless a documented defect requires a deliberate direct rename.
- [ ] Export public preview commands from the Generation Preview owner.
- [ ] Move public preview command inputs to
      `generation-preview/contracts.ts`.
- [ ] Remove preview command input declarations from
      `project-data-service-contracts.ts`.
- [ ] Remove preview commands from `ProjectDataService`.
- [ ] Remove preview commands from shared project-data wiring.
- [ ] Keep package-boundary diagnostics structured.
- [ ] Add no old-name errors, aliases, shims, or fallback command paths.

### Lifecycle Registry Shape

- [ ] Add `purpose-definition.ts` as the definition contract owner.
- [ ] Add one lifecycle definition-binding module per current purpose.
- [ ] Move generic-to-purpose input adaptation out of the registry body.
- [ ] Reduce `purpose-lifecycle-registry.ts` to binding imports, array, map, and
      lookup operations.
- [ ] Keep definition bindings free of domain validation and persistence logic.
- [ ] Add no `purpose-definitions/index.ts` barrel.
- [ ] Update callers directly to the definition contract owner.
- [ ] Confirm cost registry ownership remains unchanged.

### Core Generation Preview Implementation

- [ ] Add `generation-preview/service.ts`.
- [ ] Move saved preview build orchestration into the service.
- [ ] Move draft preview build orchestration into the service.
- [ ] Move saved preview update orchestration into the service.
- [ ] Delete lifecycle `preview-spec-update.ts`.
- [ ] Remove preview behavior from lifecycle `spec-service.ts`.
- [ ] Add the narrow authored-prompt update strategy.
- [ ] Keep the authored-prompt strategy limited to authored prompt only.
- [ ] Make purpose update handlers persist through focused typed spec commands.
- [ ] Ensure the shared service never persists a purpose spec assembled by an
      adapter or broad patch API.

### Shared Image Preview Projection

- [ ] Remove caller-supplied `providerPrompt` from the shared image preview
      input.
- [ ] Derive provider-facing prompt text inside the shared image preview path.
- [ ] Keep purpose bindings responsible for context, target/title, provider
      plan, and durable references.
- [ ] Keep image model Config rows schema/payload driven.
- [ ] Confirm a shared prompt projection change no longer requires edits to all
      image-purpose bindings.

### Cast Character Sheet Preview

- [ ] Add `cast-character-sheet-preview.ts`.
- [ ] Move Cast preview construction into that owner.
- [ ] Move prompt/reference update application into that owner.
- [ ] Keep required/unknown dependency validation purpose-owned.
- [ ] Keep durable dependency inclusion storage purpose-owned.
- [ ] Persist through `updateCastCharacterSheetSpec`.
- [ ] Remove moved preview logic from `cast-character-sheet.ts`.

### Shot Video Take Preview

- [ ] Add `shot-video-take/specs/generation-preview.ts`.
- [ ] Move Shot preview construction into that owner.
- [ ] Move authored/negative prompt update behavior into that owner.
- [ ] Add `provider/negative-prompt-support.ts`.
- [ ] Reuse one selected-model schema capability function for preview and
      update.
- [ ] Persist through `updateShotVideoTakeSpec`.
- [ ] Remove moved preview behavior from `final-specs.ts`.
- [ ] Keep negative prompt space conditional on the selected provider model
      schema.

### Studio Server And CLI Adapters

- [ ] Inject the Core update command directly into the Generation Preview route.
- [ ] Remove the preview update command from `ProjectsRouteProjectData`.
- [ ] Remove Generation Preview behavior from the universal Studio fake.
- [ ] Keep the route HTTP-only and free of purpose branches.
- [ ] Keep Studio browser URL projection unchanged.
- [ ] Add the narrow CLI `GenerationPreviewCommandPort`.
- [ ] Keep preview build commands out of unrelated CLI runtimes.
- [ ] Update CLI callers directly with no compatibility runtime field.

### Studio Browser Implementation

- [ ] Add `use-generation-preview-editor.ts`.
- [ ] Move draft lifecycle into the hook.
- [ ] Move pending/error/update request state into the hook.
- [ ] Move stale success and stale error invalidation into the hook.
- [ ] Keep the host limited to coordination event and visibility ownership.
- [ ] Keep the dialog focused on composition.
- [ ] Keep tabs and panels presentational.
- [ ] Preserve the 75/25 prompt/negative prompt layout.
- [ ] Preserve read-only draft previews.
- [ ] Add no React model-schema or durable-reference business rules.
- [ ] Add no generic feature context unless the Architecture Shape Gate's prop
      condition is met.

### Test Fixtures And Guardrails

- [ ] Add package-local preview fixture builders only where duplication remains.
- [ ] Do not export test fixtures from public package entrypoints.
- [ ] Remove preview setup from the universal Studio fake.
- [ ] Add Core prompt-only update behavior tests.
- [ ] Add Cast combined update behavior tests.
- [ ] Add Shot negative prompt add/clear/re-add tests.
- [ ] Add forged unsupported negative prompt rejection coverage.
- [ ] Add route tests with a local narrow command fake.
- [ ] Add CLI narrow-port tests.
- [ ] Add browser hook stale success/error tests.
- [ ] Add import-boundary tests for the shared preview service.
- [ ] Add import-boundary tests for the thin lifecycle registry.
- [ ] Keep architecture tests free of private helper names and complete purpose
      inventories.
- [ ] Run the change-amplification review exercises.

### Documentation And ADR Work

- [ ] Add ADR 0047 for purpose-owned Generation Preview editing.
- [ ] Update Generation Preview purpose-binding architecture.
- [ ] Update media-generation architecture.
- [ ] Update frontend architecture if the editor-session hook becomes a current
      pattern.
- [ ] Update the architecture-test registry.
- [ ] Update current CLI docs only when the maintainer/agent contract changes.
- [ ] Do not edit completed plans for naming sweeps.

### Final Verification

- [ ] Run focused Core Generation Preview tests.
- [ ] Run focused Cast and Shot preview tests.
- [ ] Run focused Studio route and browser tests.
- [ ] Run CLI generation command tests.
- [ ] Run `pnpm build:core`.
- [ ] Run `pnpm test:core`.
- [ ] Run `pnpm test:cli`.
- [ ] Run `pnpm test:studio`.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm test` after focused suites pass.
- [ ] Complete the desktop manual verification matrix.
- [ ] Review `git diff --stat` and the complete diff.
- [ ] Inspect every new or heavily modified file.
- [ ] Confirm `purpose-lifecycle-registry.ts` remains a thin registry.
- [ ] Confirm `generation-preview/service.ts` remains thin orchestration.
- [ ] Confirm Cast and Shot preview owners are focused and reviewable.
- [ ] Confirm `index.ts` files contain exports only.
- [ ] Confirm no re-export stubs or compatibility modules remain.
- [ ] Confirm no unrelated formatting churn remains.
- [ ] Confirm no checklist item was satisfied by moving the same monolith into
      a differently named file.
- [ ] Confirm all four change-amplification goals pass manual review.
- [ ] Only then mark this plan complete.
