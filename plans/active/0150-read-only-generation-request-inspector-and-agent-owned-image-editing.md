# 0150 Read-Only Generation Request Inspector And Agent-Owned Image Editing

Status: implemented
Date: 2026-07-19

## Summary

Replace Studio's Image Revision workflow with a read-only Generation Request
inspector. A generated-image card opens the saved prompt, selected references,
and configuration that produced that exact AssetFile. Nothing in the inspector
can edit, estimate, generate, or attach media.

Image editing remains available through the existing agent workflow. The agent
creates an ordinary `image.edit` request against the exact source AssetFile,
uses the existing Generation Preview for request approval, generates the image,
shows the result to the user, and imports it only after the user accepts it. The
accepted result becomes a new asset; the source remains unchanged.

The same implementation also corrects five current problems already accepted
as part of this work:

- valid saved `project-file` references must open in the inspector;
- saved model and configuration values must remain visible when a model is no
  longer in the current catalog;
- mutable external Preview requests must not require a managed model family;
- Lookbook media must use Lookbook membership without a duplicate
  `project_asset` relationship;
- Location Sheet must be the only current product name, with the one local
  `urban-basilica` database and files updated directly and no compatibility
  behavior left in the product.

## Product Behavior

### Inspect a generated image

- Replace the current Edit action on Cast Character Sheets, Location Sheets,
  Lookbook Images, and Production/Storyboard Lookbook Sheets. Do not add the
  action to Profile or Location Hero cards, which do not expose Image Revision
  today.
- The replacement action uses a view/document-search icon, the accessible label
  `View generation request`, and no pencil icon or Edit wording.
- Opening the action reads the source request for the exact AssetFile shown on
  that card. It does not infer a different file from the Asset or owner.
- The dialog title is exactly `Generation Request`; it does not append an id,
  filename, role, or generated fallback title.
- The existing `Prompt`, `References`, and `Config` tabs remain.
- Prompt shows the exact saved authored text and cannot be changed.
- References shows only references selected in the saved request. It has no
  candidate chooser, empty eligible slots, selection toggles, or replacement
  actions.
- Config shows the exact saved provider/model and values. It keeps the current
  composed field layout and visual treatment, but values render as static text
  rather than disabled inputs, selects, sliders, switches, or focusable controls.
- There is no Regenerate/Edit mode, estimate, Update, Generate, Regenerate,
  Edit, or Cancel action.
- The only explicit footer action is `Close`. The header close control, Escape,
  and outside click also close the dialog because it has no pending mutation.
- Loading and structured read errors remain inside the dialog. Errors offer
  Close and never fall back to an editing or generation action.

### Edit with the agent

1. The agent resolves the exact source Asset and AssetFile from current project
   context.
2. It authors a new `image.edit` GenerationSpec targeting that source Asset,
   with the exact AssetFile in the locked `source/source-image` slot, the user's
   edit prompt, and any deliberately selected additional references.
3. It selects either a supported Renku-managed image-edit route or the external
   `codex/gpt-image-2` identity requested by the user.
4. It saves the draft and opens the existing Generation Preview. The user can
   review the prompt, references, and configuration. Managed requests keep their
   current Preview editing behavior. For `agent-external` requests, Preview
   updates the prompt and reference slots only; changing provider/model or other
   saved values remains agent-authored through
   `renku generation spec update --spec <id> --file <spec.json>` followed by a
   new Preview. This plan does not add an external configuration editor.
5. Preview is a review stop, not execution approval. The agent waits for
   explicit request approval, then reads the saved revision again and freezes it
   at the existing live/external execution boundary.
6. It executes the approved request through Renku or Codex.
7. It displays the generated image in Codex and separately asks whether the
   result should be attached.
8. Only after output acceptance does it call the existing media import command
   with the destination's real purpose and target, plus the matching managed
   receipt or frozen external `--source-spec`.
9. Import creates a new generated asset and reports it. The original Asset,
   AssetFile, owner relationship/membership, and selected/display state remain
   unchanged; the new result is not automatically selected.

Closing a Preview or inspector never approves an output. Rejecting an output
means it is not imported. A changed request requires a new reviewed spec; the
agent never mutates a frozen request.

## Scope

In scope:

- replace Image Revision UI and APIs with read-only inspection;
- reuse the existing Generation Preview presentation and generation lifecycle;
- support existing `asset-file` and `project-file` references in inspection;
- show saved configuration without requiring a current model descriptor;
- fix external Preview Update's unnecessary `modelFamilyId` requirement;
- allow an accepted `image.edit` output to return to the current Cast,
  Location, or Lookbook owner of its exact source;
- make Lookbook membership its only media ownership record;
- directly rename current Environment Sheet contracts and the local sample data
  to Location Sheet;
- delete obsolete Image Revision and `image.editOutput` code;
- update the canonical media-producer source skill so it owns the complete
  managed/Codex image-edit review, execution, output-acceptance, and import
  workflow, with a focused forward evaluation;
- update the current docs, ADR notices, and source skills that would otherwise
  give incorrect instructions.

Not in scope:

- a new Studio editing or output-review experience;
- a new generation lifecycle, CLI command, provider adapter, or attachment API;
- compatibility aliases or readers for retired Image Revision or Environment
  Sheet names;
- semantic inspection of prompts or generated media;
- rewriting historical ADR reasoning or completed plans;
- mobile behavior.

## Current Evidence

- `packages/studio/src/features/image-revision/` and the matching Core/server
  modules own the workflow being removed.
- `packages/studio/src/features/generation-request-editor/` already owns the
  Prompt, References, and Config presentation.
- `packages/core/src/server/generation/references.ts` already resolves safe
  project-file references, media type, file existence, and project containment.
  The current Preview reference builder rejects that supported reference kind.
- `generation-preview-resource/configuration.ts` already renders external saved
  values but returns an empty managed configuration when the current model is
  missing.
- `generation/attachments.ts` already verifies managed receipts and frozen
  external source specs. Its exact purpose/target check is the part that blocks
  a valid `image.edit` result from returning to the source image's owner.
- `generation/attachment-destinations.ts` already owns destination mapping.
- Lookbook resource reads use `lookbook_image` and `lookbook_sheet`; generic
  persistence currently also writes an unnecessary `project_asset` row.
- `urban-basilica` currently contains four old Location Sheet relationships and
  paths, one already-current Location Sheet, and no active `project_asset` rows.
- `asset_file_edka9uq2` is the real saved-request example using
  `research/helmet.jpg`.

## Architecture Shape Gate

### Smallest accepted shape

| Existing owner | Change |
| --- | --- |
| Core generation Preview resource | Read the exact saved request for an AssetFile; extend the existing reference response for `project-file`; fall back to saved model/config values in the existing configuration builder. |
| Core generation references | Reuse the existing safe project-file resolver for the inspector media URL. Do not create a second path validator or availability model. |
| Core generation attachment | Add one focused `image.edit` exception that verifies the exact source and its current destination using existing destination and ownership reads. Keep current managed/external provenance validation. |
| Core attachment persistence and report | Persist either the current Cast/Location relationship or the current Lookbook membership. Never both for Lookbook media. Build the returned report from whichever owner record was actually created. |
| Studio server | Add thin authenticated GET handling for the saved request and project-file media. Parse, delegate, serialize, and translate errors only. |
| Studio React | Replace the existing revision provider/dialog with read-only inspection, reuse the request presentation, and update the four existing Edit call sites only. |
| MediaCard | Rename the current Edit action contract to Inspection and update callers directly. |
| Location Sheet contracts | Rename current roles, types, fields, resource keys, paths, UI copy, tests, docs, and source-skill guidance directly. |
| Studio source skills | Make media-producer the executable agent-owned image-edit workflow and update production-designer to emit only the current Location Sheet contract. |

### Public contracts

Add one Core read command:

```ts
readAssetFileGenerationRequest({
  projectName,
  assetId,
  assetFileId,
}): Promise<GenerationPreviewResourceData>
```

Return the existing Generation Preview resource directly. Do not add a wrapper
that repeats the Asset and AssetFile ids already present in the command and HTTP
route.

Refine `GenerationPreviewResourceReference` so its identity represents either:

- an `asset-file` with `assetId` and `assetFileId`; or
- a `project-file` whose project-relative path exists only in Core/server data
  and becomes an authenticated `browserUrl` in the Studio response.

Do not add a new missing/unavailable state. Existing saved references that
resolve normally render; an unresolved reference uses the existing structured
Preview error.

Add these authenticated Studio GET endpoints in one focused route module:

```text
/studio-api/projects/:projectName/assets/:assetId/files/:assetFileId/generation-request
/studio-api/projects/:projectName/generation-reference-file?path=<project-relative-path>
```

The project-file endpoint must reuse Core's existing normalization and
project-containment behavior. This basic file-serving boundary remains required;
the plan does not add other special missing-file behavior.

Keep the current Preview editing boundary explicit:

- managed Preview updates continue to edit prompt, references, model family,
  and supported parameters;
- external Preview updates may omit `modelFamilyId` and update only the prompt
  and reference slots already supported by Core;
- external provider/model or other non-prompt value changes use the existing
  agent/CLI saved-spec update followed by another Preview;
- do not add external model/config controls or accept ignored external parameter
  values merely for UI symmetry.

Keep `attachGenerationMedia` and `renku media import` unchanged. For
`image.edit`, Core permits the source request's Asset target to differ from the
import destination only when:

- the request selects that exact source AssetFile in `source/source-image`;
- the source Asset currently belongs to the requested Cast or Location through
  the role already mapped for the destination purpose, or belongs to the exact
  Lookbook through its current membership;
- all existing managed-receipt or frozen-external-spec checks pass.

Reuse existing attachment diagnostics where their meanings remain accurate.
Add a new structured code only if an existing code cannot explain a normal
failure to the CLI or Studio caller.

### Intended file changes

Add these focused production modules:

```text
packages/core/src/server/asset-file-generation-request.ts
packages/core/src/server/generation/image-edit-attachment.ts
packages/studio/server/routes/generation-requests.ts
packages/studio/src/services/studio-generation-requests-api.ts
packages/studio/src/features/generation-request-inspector/
  generation-request-inspector-dialog.tsx
  generation-request-inspector-provider.tsx
  use-generation-request-inspector.ts
```

- `asset-file-generation-request.ts` resolves the exact active AssetFile's
  managed run snapshot or frozen external source spec, then calls the existing
  Generation Preview resource builders. It does not define another browser DTO.
- `generation/image-edit-attachment.ts` owns only the exceptional comparison
  between an `image.edit` source Asset and the requested current destination.
  It reuses current destination, relationship, and Lookbook membership reads;
  it does not copy files, persist records, parse CLI/HTTP input, or dispatch
  arbitrary purpose conversions.
- `generation-requests.ts` contains the two authenticated GET handlers named
  above. It delegates all file safety and saved-request decisions to Core.
- `studio-generation-requests-api.ts` loads the inspector resource and applies
  standard Studio structured-error decoding.
- the inspector provider owns the exact `{ projectName, assetId, assetFileId }`
  open state; the hook owns the one asynchronous load and stale-response guard;
  the dialog owns the read-only presentation and close behavior.

Modify these existing owners directly:

- `generation-preview-resource/references.ts` and its client contract for the
  two real reference identities;
- `generation-preview-resource/configuration.ts` for saved-value fallback when
  the current catalog no longer describes the model;
- `generation/references.ts` to expose the existing approved project-file path
  to the server boundary without duplicating normalization or containment;
- `generation/attachments.ts` to retain ordinary exact-match behavior and call
  the focused image-edit validator only for the accepted exceptional case;
- `generation/attachment-persistence.ts` so Cast/Location returns a relationship
  owner while Lookbook returns a membership owner and never writes a project
  relationship;
- attachment report construction so Lookbook success reads the new membership,
  Asset, and AssetFile rather than requiring `readAssetRelationship(...project)`;
- the existing generation-request editor panels to render the inspector's
  selected-only References and static Config without changing editable Preview;
- existing MediaCard contract/action files and the exact Cast Character Sheet,
  Location Sheet, Lookbook Image, and Lookbook Sheet callers.

Add focused tests beside the new Core command, image-edit validator, Studio
route, browser API, and inspector dialog/provider behavior. Do not require a
separate test file for every internal hook when the observable feature test
covers the same React behavior.

Delete:

```text
packages/core/src/client/image-revision-workflow.ts
packages/core/src/server/image-revision-workflow/
packages/core/src/server/project-asset-files/destinations/image-edit.ts
packages/studio/server/projections/image-revision.ts
packages/studio/server/routes/image-revisions.ts
packages/studio/src/features/image-revision/
packages/studio/src/services/studio-image-revisions-api.ts
```

Remove associated exports, route registration, provider wiring, obsolete
fixtures, and `image.editOutput` registry/union entries. Do not leave wrappers,
aliases, or retired-name tests.

### Stop conditions

Stop and simplify before implementation continues if:

- the inspector creates another request/config/reference response instead of
  using the existing Generation Preview resource;
- project-file support creates a second path-safety implementation;
- attachment work introduces a generic dispatcher or arbitrary provenance
  override;
- adapters repeat Core ownership or generation validation;
- Location Sheet work introduces runtime old-name handling;
- the UI replacement grows into another editing state machine;
- one behavior is tested repeatedly at Core, server, UI, integration, and E2E
  without each layer exercising a different responsibility.

## Decisions And Documentation

Create two new ADRs because two accepted decisions change current direction:

- `0058-make-studio-image-editing-agent-owned.md` records removal of Studio
  Image Revision and agent-owned editing through the existing generation flow.
- `0059-use-location-sheet-as-the-only-current-contract.md` records Location
  Sheet as the only current name and the direct pre-customer data update.

Do not rewrite the reasoning in older ADRs. Add only a short notice near the top
of each affected ADR that names and links the newer decision:

- Decision 0058 supersedes the Image Revision parts of Decisions 0053, 0055,
  and 0057.
- Decision 0059 supersedes current Environment Sheet naming clauses in
  Decisions 0024, 0032, 0036, 0039, and 0041.

Update current documentation only where a repository search proves it still
prescribes the removed workflow or old name. This must include the accepted
review gaps:

- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/product/design-guidelines.md`;
- current media-generation guidance;
- current data-model, storage, and vocabulary guidance for Location Sheets;
- current CLI guidance if it names the retired workflow or old Location Sheet
  contract.

Historical ADR bodies and completed plans remain unchanged apart from the short
supersession notice on affected ADRs.

## Implementation Slices

### Slice 1 — Record the two decisions

Add Decisions 0058 and 0059, add concise supersession notices to the affected
older ADRs, and make no other edits to their historical reasoning.

### Slice 2 — Make the existing Preview resource usable for inspection

- add `readAssetFileGenerationRequest` using the exact managed run snapshot or
  exact frozen external source spec already recorded for the AssetFile;
- return the existing Generation Preview resource;
- support valid saved project-file references by reusing the current reference
  resolver and the smallest authenticated media route;
- update the existing configuration builder to display saved provider, model,
  and values when the current model descriptor is absent;
- make Preview Update `modelFamilyId` optional in transport and continue to
  require it in Core only for managed requests; preserve external Preview as a
  prompt/reference-slot update and keep saved provider/model/non-prompt values
  unchanged.

### Slice 3 — Replace Image Revision with inspection

- replace the current dialog/provider flow with the named inspector modules;
- keep the existing Prompt, References, and Config tabs, exact saved prompt,
  selected-only references, composed static Config fields, and standard close
  behavior defined under Product Behavior;
- replace MediaCard Edit with Inspection at the current Cast Character Sheet,
  Location Sheet, Lookbook Image, and both Lookbook Sheet call sites;
- remove all estimate, mode, draft, run, and direct attachment UI/API code;
- delete `image.editOutput` and all obsolete revision contracts and exports.

### Slice 4 — Attach agent-edited images through the existing import path

- add the narrow Core rule allowing `image.edit` output to return to the current
  owner of its exact source image;
- reuse existing receipt, frozen-spec, destination, role, membership, and
  persistence behavior;
- stop writing or requiring `project_asset` for Lookbook media;
- build Lookbook attachment reports from the membership and attached AssetFile;
- preserve the source Asset, AssetFile, owner records, and selected/display
  state while attaching the accepted result as a new unselected asset;
- update the canonical source files
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
  and `references/workflow.md` with the complete nine-step agent workflow under
  Product Behavior, including saved-spec update plus another Preview when an
  external provider/model or non-prompt value changes;
- update `references/image-prompt-authoring.md` and
  `references/reference-visible-image-prompting.md` only where current wording
  still treats Studio Regenerate as the workflow or omits the exact source;
- update `evals/image-prompt-routing/forward-test-cases.md` with one focused
  image-edit group covering the managed and Codex branches, exact source
  selection, Preview approval, displayed output, separate output acceptance,
  and receipt/source-spec import to the real destination;
- change the sister-project source skill, not the installed plugin cache, and
  run its documented prompt-guide validator.

### Slice 5 — Rename Location Sheet and update the local project

- use these current names at their owning boundaries:
  - product copy: `Location Sheet`;
  - purpose: `location.sheet`;
  - relationship role and asset type: `location-sheet`;
  - Location Design field: `locationSheetGuidance`;
  - resource/helper/key families: `locationSheet*` and `location-sheet:*`;
  - durable folder: `locations/<handle>/location-sheets/`;
- update current Core, CLI, Studio, tests, current docs, production-designer, and
  affected media-producer guidance directly; remove dual-name arrays and old-name
  branches rather than adding aliases;
- back up `urban-basilica/.renku/project.sqlite`;
- update its four old `environment_sheet` roles,
  `location_environment_sheet` asset types,
  `design.environmentSheetGuidance` JSON keys, and owned
  `environment-sheets/` AssetFile paths directly while preserving the values and
  unrelated project data;
- move its existing files from `environment-sheets/` to `location-sheets/`;
- verify the database counts and paths, open the project, and confirm all five
  current Location Sheets display and newly attached sheets allocate under the
  current folder;
- remove remaining current product references to the old name.

This is a one-time local development-data correction. Do not add a Drizzle
migration, schema-version change, runtime converter, compatibility reader, or
general migration framework.

### Slice 6 — Update current guidance and finish

- update only current docs shown by search to give wrong instructions;
- update the production-designer skill for Location Sheet terminology;
- validate the two changed source skills;
- run the focused and root verification below;
- inspect the final diff for unnecessary modules, repeated validation, and
  obsolete runtime paths.

## Test Strategy

Good edge-case coverage remains required. Each case belongs at the lowest layer
that owns the behavior; upper layers test only their own translation or user
experience.

### Core tests — complete behavior and edge coverage

- managed AssetFiles return the immutable run `specSnapshot`; frozen external
  AssetFiles return their exact saved source spec;
- missing provenance, conflicting managed/external provenance, discarded or
  mismatched Asset/AssetFile records, missing runs/specs, and mutable external
  specs fail through structured diagnostics;
- valid asset-file and project-file selections produce the shared reference
  response and exact browser media metadata;
- project-file traversal, unsupported media, missing files, and symlink escape
  fail in the existing Core reference/file-safety boundary; these cases are not
  reimplemented or repeated in Studio route tests;
- a missing current model still shows the exact saved provider/model identity
  and browser-safe saved values without creating current defaults;
- managed Preview Update still requires a model family; external Preview Update
  accepts omission, updates prompt/reference slots, and preserves provider/model
  and non-prompt values;
- table-driven attachment tests cover every supported Cast, Location, and
  Lookbook destination for both managed and frozen-external sources where the
  provenance branch differs;
- attachment rejects a different source AssetFile, wrong destination owner or
  role/membership, wrong Lookbook kind, wrong managed output, mutable external
  source, receipt/source-spec conflict, and unsupported destination before file
  copy or database persistence;
- Lookbook attachment creates the correct Image/Sheet membership, creates no
  `project_asset`, and returns a complete attachment report without a project
  relationship;
- successful attachment creates a new Asset/AssetFile while preserving the
  original file, owner records, and selected/display state.

Do not duplicate this invalid-data matrix in Studio route, React, CLI, and E2E
tests.

### Studio server tests — adapter behavior only

- exact route inputs reach the Core commands;
- reference browser URLs are serialized correctly;
- structured Core errors use the standard HTTP response;
- optional external `modelFamilyId` is forwarded without route-owned branching.

### React tests — user-visible behavior only

- the four current card surfaces open the exact AssetFile request with the
  inspection icon and accessible label;
- the existing Prompt, References, and Config tabs remain;
- prompt text is exact and read-only; References contains selected items only
  and no chooser/toggle; Config keeps composed field presentation with no
  interactive form roles;
- valid project-file and removed-model examples render;
- no Edit, Regenerate, estimate, update, or generation action remains;
- loading and structured error stay in the dialog; changing the exact file does
  not show stale data; footer Close, header close, Escape, and outside click
  close normally.

### Source-skill tests — agent workflow behavior

- the existing image-prompt guide validator passes;
- a managed image-edit forward case uses the exact source, Preview and request
  approval, displays the generated output, waits for output acceptance, and
  imports with the exact receipt and destination;
- a Codex `gpt-image-2` forward case reads and freezes the saved external spec,
  displays the generated output, waits for output acceptance, and imports with
  `--source-spec` and the exact destination;
- a rejected-output case stops before media import without inventing a durable
  rejection record.

### Integration and desktop verification

- one managed and one frozen-external edit exercise the existing import path;
- one Lookbook case proves membership-only persistence end to end;
- one compact Studio desktop pass verifies:
  1. the inspection action on Character Sheet, Location Sheet, Lookbook Image,
     and Lookbook Sheet cards;
  2. the exact title, three tabs, selected-only References, composed static
     Config fields, absence of generation controls, and all close paths;
  3. `asset_file_edka9uq2` rendering `research/helmet.jpg` and a removed-model
     fixture rendering its saved identity/values;
  4. one accepted agent edit attaching as a new unselected asset while the
     source remains unchanged;
  5. one Lookbook import returning normally with membership only;
  6. `urban-basilica` showing all five Location Sheets under the current name
     and paths after the direct data update.

Live paid generation is not required when fixtures cover the execution result
and import boundary. If a live run is explicitly approved during implementation,
one representative run is sufficient.

## Final Verification

Use focused tests while working, then complete with:

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e:studio:smoke
```

Run the documented validators for the changed media-producer and
production-designer source skills. Also run `git diff --check`, inspect the full
diff, and search current runtime/tests/docs/source skills for surviving Image
Revision and Environment Sheet contracts. Exclude historical ADR reasoning,
completed plans, and the direct one-time data-update record from that search.

## Completion Checklist

### Product and UX

- [ ] Cast Character Sheet cards replace Edit with `View generation request`.
- [ ] Location Sheet cards replace Edit with `View generation request`.
- [ ] Lookbook Image cards replace Edit with `View generation request`.
- [ ] Production and Storyboard Lookbook Sheet cards replace Edit with
      `View generation request`.
- [ ] Profile and Location Hero cards do not gain a new action as part of this
      slice.
- [ ] The action uses the selected inspection icon and no pencil/Edit wording.
- [ ] Each action opens the source request for the exact displayed AssetFile.
- [ ] The dialog title is exactly `Generation Request` with no generated suffix.
- [ ] Prompt, References, and Config remain the three tabs.
- [ ] Prompt shows the exact saved authored text and is not editable.
- [ ] References shows selected references only, with no chooser, empty slot,
      toggle, or replacement action.
- [ ] Config shows the exact saved model and values using composed static value
      surfaces and no form-control semantics.
- [ ] No mode switch, estimate, Update, Generate, Regenerate, Edit, or Cancel
      action remains.
- [ ] Footer Close, header close, Escape, and outside click close the inspector.
- [ ] Loading and structured errors remain inside the inspector and cannot lead
      to mutation or generation.

### Saved-request and Preview contracts

- [ ] Add `readAssetFileGenerationRequest` with the exact
      project/Asset/AssetFile input.
- [ ] Managed provenance reads the immutable GenerationRun snapshot for that
      AssetFile.
- [ ] External provenance reads the exact frozen source spec for that AssetFile.
- [ ] The command returns the existing `GenerationPreviewResourceData` without
      a wrapper response or repeated ids.
- [ ] Existing Preview reference contracts represent both `asset-file` and
      `project-file` identities.
- [ ] Existing Core project-file resolution supplies media metadata and enforces
      normalization and project containment for the authenticated media route.
- [ ] `asset_file_edka9uq2` and `research/helmet.jpg` render through the normal
      inspector response.
- [ ] Existing configuration code displays saved provider/model/values when the
      current catalog descriptor is absent.
- [ ] Saved-value fallback does not manufacture current defaults or editable
      authoring controls.
- [ ] External Preview Update may omit `modelFamilyId` through Core, server, and
      browser transport.
- [ ] External Preview Update changes only prompt/reference slots and preserves
      saved provider/model/non-prompt values; other external changes use the
      existing saved-spec update followed by another Preview.
- [ ] Managed Preview Update still requires and validates its model family in
      Core.

### Studio and deletion

- [ ] Add the focused Studio generation-request routes and browser API named by
      the Architecture Shape Gate.
- [ ] Studio routes only authenticate, parse, delegate, serialize URLs/media,
      and translate structured errors.
- [ ] Add the named inspector dialog, provider, and loading hook without another
      editing state machine.
- [ ] Update the shared request presentation only where read-only selected
      References and static Config need explicit support.
- [ ] Rename MediaCard `editAction`, `MediaCardEditAction`, and `onEdit` directly
      to the selected Inspection contract with no aliases.
- [ ] Delete the Core Image Revision client contract and server workflow.
- [ ] Delete Studio Image Revision routes, projections, API service, feature
      files, tests, exports, provider wiring, and owner-specific target builders.
- [ ] Delete the `image.editOutput` destination module, union/registry member,
      exports, and focused tests while preserving the `image.edit` purpose.
- [ ] No retired endpoint, compatibility wrapper, re-export facade, or old-name
      sentinel remains.

### Agent-owned editing and attachment

- [ ] `image.edit` targets the exact source Asset and locks the exact AssetFile
      in `source/source-image`.
- [ ] The existing Generation Preview remains the editable request-review stop.
- [ ] The agent waits for explicit request approval before managed or Codex
      execution.
- [ ] The approved saved revision is reread and frozen at the existing execution
      boundary.
- [ ] Managed editing uses the existing run/receipt path.
- [ ] Codex editing uses `codex/gpt-image-2`, a frozen external spec, and
      `--source-spec` rather than a fabricated receipt.
- [ ] The generated image is displayed in Codex before any attachment request.
- [ ] Explicit output acceptance is required separately from request approval.
- [ ] Rejected output remains unattached and creates no durable rejection model.
- [ ] Import uses the destination's actual purpose and exact Cast, Location, or
      Lookbook target.
- [ ] Core validates the exceptional `image.edit` source-to-current-owner match
      in the focused module named by the Architecture Shape Gate.
- [ ] Existing managed receipt and frozen external source-spec validation remain
      authoritative.
- [ ] Successful import creates a new generated Asset/AssetFile and preserves
      the source Asset, AssetFile, owner records, and selected/display state.
- [ ] The new edited asset is not automatically selected.
- [ ] Lookbook imports create exactly the correct Image/Sheet membership and no
      `project_asset` relationship.
- [ ] Lookbook attachment reports are built from membership plus Asset/AssetFile
      and succeed without a project relationship.

### Source skills

- [ ] Update the canonical media-producer `SKILL.md`, not the installed cache.
- [ ] Update `references/workflow.md` with the complete request approval,
      execution, output review, and import sequence, including the existing
      saved-spec update path for external provider/model/non-prompt changes.
- [ ] Update image-prompt guidance only where required for exact `image.edit`
      source selection and the removal of Studio Regenerate.
- [ ] Add managed and Codex cases to the focused image-edit forward-eval group.
- [ ] The managed eval imports with the exact receipt and real destination.
- [ ] The Codex eval freezes the reviewed spec and imports with
      `--source-spec` and the real destination.
- [ ] The eval distinguishes request approval from output acceptance and leaves
      rejected output unattached.
- [ ] Update production-designer and its Location Design reference to use
      Location Sheet and `locationSheetGuidance` only.
- [ ] Run the media-producer prompt-guide validator and standard validators for
      both changed source skills.

### Location Sheet current contract and local data

- [ ] Current copy uses `Location Sheet`.
- [ ] Current purpose remains `location.sheet`.
- [ ] Current relationship role and Asset type use `location-sheet`.
- [ ] Location Design uses `locationSheetGuidance`.
- [ ] Current resource/helper/key names use `locationSheet*` or
      `location-sheet:*` as appropriate.
- [ ] New durable files allocate under `locations/<handle>/location-sheets/`.
- [ ] Core, CLI, Studio, current tests/docs, and source skills remove old-name
      branches and aliases.
- [ ] Back up `urban-basilica/.renku/project.sqlite` before direct updates.
- [ ] Convert its four old roles, Asset types, Location Design keys, and owned
      AssetFile paths without changing unrelated or opaque creative data.
- [ ] Move existing durable files to `location-sheets/` and verify all database
      paths resolve.
- [ ] All five current Location Sheets display after the conversion.
- [ ] New Location Sheet attachment uses the current role/type/path.
- [ ] No Drizzle migration, schema-version change, runtime converter, fallback,
      old-name diagnostic, or compatibility alias is added.

### Tests and verification

- [ ] Core covers managed/external saved-request success and every invalid
      provenance class listed in Test Strategy.
- [ ] Core covers valid asset/project references and all project-file safety
      cases listed in Test Strategy.
- [ ] Core covers removed-model saved-value display and managed/external Preview
      Update behavior.
- [ ] Table-driven Core tests cover every supported attachment destination and
      both provenance branches where they differ.
- [ ] Core invalid attachment tests prove failure before file copy or database
      persistence.
- [ ] Core proves membership-only Lookbook persistence/reporting and complete
      source preservation.
- [ ] Studio server tests cover only delegation, browser media/URL serialization,
      structured-error translation, and optional model-family transport.
- [ ] React tests cover all four call sites and every inspector UX criterion
      without repeating Core's invalid-data matrix.
- [ ] Source-skill forward tests cover managed, Codex, and rejected-output agent
      behavior.
- [ ] Integration covers managed and frozen-external import plus one Lookbook
      membership-only case.
- [ ] The compact desktop pass covers the six user-visible scenarios listed in
      Test Strategy.
- [ ] Focused package checks and all root commands in Final Verification pass.

### ADRs and current documentation

- [ ] Add Decision 0058 for agent-owned image editing and Studio inspection.
- [ ] Add Decision 0059 for the Location Sheet-only current contract.
- [ ] Add concise Decision 0058 supersession notices to Decisions 0053, 0055,
      and 0057 without rewriting their historical bodies.
- [ ] Add concise Decision 0059 supersession notices to Decisions 0024, 0032,
      0036, 0039, and 0041 without rewriting their historical bodies.
- [ ] Current MediaCard/product guidance uses Inspection instead of Edit.
- [ ] Current storage guidance removes `image.editOutput` and uses
      `location-sheets/`.
- [ ] Current media-generation, data-model, storage, vocabulary, and relevant
      CLI guidance reflect the accepted direction where search proves them stale.
- [ ] Completed plans and unrelated historical ADR content remain unchanged.

### Final architecture review

- [ ] Inspect `git diff --stat`, `git diff --check`, and the complete diff.
- [ ] Inspect the new saved-request command, image-edit validator, Studio route,
      browser API, and inspector files for focus and size.
- [ ] Inspect changed attachment persistence/report code and all deleted Image
      Revision callers.
- [ ] Confirm Core owns path safety, provenance, ownership, persistence, and
      Location Sheet contract rules; adapters contain none of them.
- [ ] Confirm package `index.ts` files and Studio route registration remain thin.
- [ ] Confirm strong edge-case coverage exists at the owning layer without
      mechanical repetition through every upper layer.
- [ ] Confirm no unrequested runtime behavior, speculative abstraction, broad
      documentation sweep, unrelated formatting churn, or generated artifact
      entered the implementation.
- [ ] Confirm every accepted product requirement has a matching implementation
      item, test, and checklist item before marking the plan complete.
