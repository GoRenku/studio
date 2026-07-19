# 0150 Read-Only Generation Request Inspector And Agent-Owned Image Editing

Status: proposed
Date: 2026-07-19

## Summary

Remove the Studio Image Revision authoring and execution workflow in full. The
current Regenerate/Edit dialog becomes a read-only Generation Request inspector
that shows the exact saved prompt, selected references, and configuration for a
generated image. It has no mode switch, editable fields, estimate, Preview
Update, live-run action, or attachment side effect. Its only footer action is
`Close`.

Image editing remains a supported generation capability. The ownership moves to
the user-and-agent loop:

1. the agent authors an ordinary `image.edit` `GenerationSpec` with the exact
   original AssetFile selected in the locked source-image slot;
2. the existing Generation Preview dialog shows the edit prompt, references,
   and configuration before any paid or external generation begins;
3. after the user approves the request, the agent executes it through either a
   Renku-managed image route or Codex `gpt-image-2`;
4. the agent shows the generated image in Codex before attaching it;
5. only after the user accepts that result does the agent import it into its
   intended Cast, Location, or Lookbook destination as a new generated asset;
6. the original asset and AssetFile remain present and unchanged.

This plan also fixes the existing mutable `agent-external` Preview Update
contract. Studio's HTTP adapter currently requires a non-empty
`modelFamilyId`, even though Core's external update path does not use a managed
model family. That prevents a mutable Codex-authored request from being updated
through the existing Generation Preview. The route must accept an omitted model
family and leave the execution-kind decision to Core; Core must continue to
require a model family for managed requests.

The inspector must work for every valid saved request, including requests that
selected a one-off project file such as `research/helmet.jpg` and requests whose
saved model is no longer in the current provider catalog. Extend the existing
Generation Preview response instead of creating inspector-only reference or
configuration DTOs: represent asset-file and project-file references as a
tagged union, project project files through a safe authenticated browser URL,
and add a historical configuration mode that renders saved model identity and
values without requiring current authoring descriptors.

This slice also makes **Location Sheet** the only current product name. Current
runtime code, public contracts, database values, storage paths, tests,
documentation, and source skills use `location-sheet`, `locationSheet`,
`location.sheet`, and `locations/<handle>/location-sheets/` as appropriate to
their boundary. The four `environment_sheet` relationships and related asset
types/paths in the one local `urban-basilica` database are converted once under
the existing backup-protected project migration flow. Runtime code does not
recognize the old spelling after conversion.

The work is one product slice. Do not first leave a stripped Image Revision API
behind and then add a second inspector API. Replace callers directly, delete the
obsolete revision contracts, and retain only the generic generation capabilities
that the agent workflow actually uses.

## Product Decision

Studio is an inspection and approval surface for generated-image source
requests. It is not an image-editing workbench.

The two relevant experiences have deliberately different responsibilities:

| Experience | What the user reviews | What it can change | What happens when it closes |
| --- | --- | --- | --- |
| Generation Request inspector | The request that produced an already attached image | Nothing | Nothing |
| Generation Preview | A newly authored request, including an `image.edit` request | The existing mutable Preview fields while the spec is a draft | Nothing is generated or attached merely by closing |

The inspector is therefore not a disabled editor. It is a read-only projection
rendered with the shared request presentation components. Config values use the
same composed field styling as the current dialog, but they are static value
surfaces rather than disabled dropdowns. Disabled interactive controls would
look like broken inputs and would imply that an edit mode still exists.

For agent-owned editing, request approval and output approval are separate:

- **Request approval** occurs after the existing Generation Preview exposes the
  exact prompt, original-image reference, other references, and configuration.
- **Output approval** occurs after generation when Codex displays the actual
  image to the user and before `renku media import` is called.

Neither approval may be inferred from the other. A good request can still
produce an unacceptable image, and showing an output must not silently attach
or replace anything.

## Review Findings After This Decision

The earlier image-generation review found six issues. Removing Studio revision
authoring changes their disposition as follows:

| Prior finding | Disposition in this plan |
| --- | --- |
| Mutable `agent-external` Preview Update is rejected because the Studio route requires `modelFamilyId` | **Still valid, P1.** Fix the shared Preview Update contract because the agent must be able to review and revise a Codex request before freezing it. |
| Unknown revision modes fall through to Edit | **Eliminated by deletion.** Delete `ImageRevisionMode`, its parser, and all revision draft endpoints. Do not add a retired-mode rejection path. |
| Regenerate preserves the original `image.edit` source as a locked edit source | **Eliminated by deletion.** A newly agent-authored `image.edit` request explicitly selects the exact source AssetFile. |
| A revision route/model change can carry incompatible configuration defaults | **Eliminated by deletion.** The agent authors a normal provider-valid request; existing Preview validation remains authoritative. |
| Additional Regenerate references may be cloned without usable prompt mentions | **Eliminated by deletion.** The agent owns the new prompt and exact reference mentions; Studio runtime does not inspect prompt meaning. |
| The disabled Regenerate reason is inaccessible from the mode switch | **Eliminated by deletion.** There is no mode switch or unavailable Regenerate state. |

Removing the revision workflow exposes one additional architecture requirement:
generic attachment currently requires the generating request's purpose and
target to equal the destination import purpose and target. A correct
`image.edit` request instead targets the source Asset, while the accepted result
must be imported back to a destination such as `location.sheet` targeting a
Location. Without a focused Core rule, an agent can generate the edit but cannot
attach it with accurate provenance. This plan adds that rule in Core rather than
bypassing generic import or recreating the old revision attachment service.

## Intended User Experience

### Inspect an existing generated image

- Generated-image cards on the current Cast Character Sheet, Location Sheet,
  Lookbook Image, and Lookbook Sheet surfaces expose an inspection action.
- The action uses a view/document-search icon and the accessible label
  `View generation request`; it must not use a pencil icon or Edit copy.
- Opening it loads the source request for the exact AssetFile selected on the
  card.
- The dialog title is `Generation Request`. Do not interpolate asset ids,
  AssetFile ids, project-relative paths, filenames, kebab-case role names, or
  generated fallback titles into visible copy.
- The existing `Prompt`, `References`, and `Config` tabs remain.
- Prompt text is the exact authored value and is not editable.
- References show only references that were selected for the source request.
  No chooser, selection toggle, empty eligible slot, or replacement action is
  rendered.
- Config shows the exact projected provider/model and saved configuration. Each
  value has the composed field styling of the current controls, but the value is
  text inside non-interactive structure. There are no dropdown chevrons,
  `disabled` controls, inputs, selects, or focusable field affordances.
- There is no Regenerate/Edit switch, no estimate, no diagnostics-driven run
  state, no Cancel button, and no generation action.
- The footer contains one explicit `Close` button. The standard dialog close
  icon, Escape, and outside-click behavior may also close because there is no
  pending mutation to protect.
- Loading and structured read errors remain inside the dialog. An error offers
  only Close; it does not propose Regenerate or Edit as a fallback.

The card action is present only when the card's current asset is generated and
the surface has the exact AssetFile identity needed by the read command. Core
still validates provenance when the dialog opens. Do not add a derived
`canInspectGenerationRequest` field merely to avoid handling a structured
not-found response.

### Edit an image with the agent

The user asks the Codex agent to edit a specific image. The agent then:

1. reads current project context and resolves the exact source Asset and
   AssetFile;
2. authors a new draft `GenerationSpec` with:
   - purpose `image.edit`;
   - target `{ kind: 'asset', id: <sourceAssetId> }`;
   - the exact source AssetFile selected in the `source/source-image` slot;
   - the user-requested edit prompt and any additional references;
   - either a Renku-managed image model/route or the external
     `codex/gpt-image-2` execution identity;
3. opens the unchanged Generation Preview experience and asks for request
   approval;
4. freezes the exact approved request at the existing live-execution boundary;
5. executes through Renku or Codex;
6. displays the generated image in Codex and asks whether to attach it;
7. imports it only after explicit output acceptance, using the destination's
   actual purpose and target plus the managed receipt or frozen external source
   spec;
8. reports the newly attached asset without deleting, discarding, overwriting,
   or auto-selecting the source asset.

If the user rejects the output, the file remains unattached generation output.
The agent may author another request or retry the frozen exact request according
to the existing lifecycle, but it must not mutate a frozen request or silently
attach the rejected image.

## Scope

### In scope

- Replace Studio Image Revision with a read-only Generation Request inspector.
- Reuse the existing request prompt, reference, and config presentation.
- Replace the domain-neutral MediaCard Edit action contract with an Inspection
  action contract at the current generated-image call sites.
- Add a Core-owned exact source-request projection for an AssetFile.
- Extend the existing Generation Preview reference contract to represent both
  `asset-file` and `project-file` references, including safe browser media
  projection and unavailable-reference presentation.
- Add a historical Generation Preview configuration mode that preserves the
  saved provider/model identity and authored values after catalog removal.
- Add a thin authenticated Studio GET route and browser service for that
  projection.
- Delete all Image Revision draft, preview, estimate, run, mode, and direct
  attachment contracts and implementations.
- Delete the unused `image.editOutput` project-asset-file destination. The
  current usage scan finds no caller outside its own destination declaration
  and registry entry. This deletion does not remove the `image.edit` generation
  purpose.
- Preserve `image.edit` in purpose declarations, model routing, validation,
  preview, estimate, managed execution, external-spec lifecycle, and prompt
  guidance.
- Extend generic `attachGenerationMedia` provenance validation with one narrow
  cross-purpose rule for a validated `image.edit` request returning to the
  exact current destination that owns its source asset.
- Make Lookbook image/sheet membership the sole Lookbook ownership source and
  stop generic attachment persistence from creating a duplicate `project_asset`
  relationship for Lookbook media.
- Rename every current Environment Sheet product contract to Location Sheet,
  convert the local development database and durable paths once, and remove
  dual-role/type handling from runtime code.
- Fix mutable external Generation Preview updates without weakening managed
  request validation.
- Update the media-producer skill and evals for request approval, output review,
  and attachment.
- Update current architecture documentation and record the product/ownership
  change in a new ADR.
- Verify the desktop experience with the real `urban-basilica` project.

### Explicit non-goals

This plan does not:

- remove `image.edit` from `GenerationPurpose`;
- remove or weaken its required source-image reference slot;
- add a Studio chat panel, agent implementation, Codex executor, provider
  adapter, or callback protocol;
- add a second output-preview dialog inside Studio;
- change the existing Generation Preview layout, request navigation, approval
  event, or live-run approval contract beyond the external model-family bug;
- add a generic arbitrary-purpose provenance override to media import;
- let CLI or Studio server decide whether a source asset belongs to a Cast
  Member, Location, or Lookbook;
- attach an edited image directly from an HTTP route or React component;
- overwrite an AssetFile, mutate the original asset, discard the original, or
  automatically select the edited result;
- parse, score, repair, rewrite, or validate prompt meaning;
- inspect generated pixels to decide whether an edit is acceptable;
- infer references from prompt text or require prompt mentions;
- add compatibility aliases for Image Revision endpoints, types, hooks, or
  component names;
- retain `environment_sheet`, `location_environment_sheet`,
  `location.environmentSheet`, `environmentSheetGuidance`,
  `environment-sheets/`, or Environment Sheet copy in current runtime code,
  public contracts, tests, current documentation, or source skills;
- add read-time repair, dual-role matching, a fallback spelling, or a diagnostic
  whose purpose is to recognize the retired Location Sheet names;
- rewrite opaque prompt text, generated media, or saved creative guidance merely
  because authored historical content contains the words “environment sheet”;
- add tests whose only purpose is to recognize retired Image Revision names or
  routes;
- add mobile behavior or mobile verification;
- edit completed historical plans merely to update terminology.

## Context

### Accepted decisions and architecture

The implementation is constrained by:

- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`;
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`;
- `docs/decisions/0040-use-agent-media-execution-policy-for-external-built-in-image-generation.md`;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0043-use-explicit-live-provider-run-approval.md`;
- `docs/decisions/0044-use-media-generation-module-boundaries.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/decisions/0049-use-request-scoped-generation-reference-choices.md`;
- `docs/decisions/0053-use-one-configurable-studio-media-card.md`;
- `docs/decisions/0055-preserve-agent-external-generation-specs-on-images.md`;
- `docs/decisions/0056-freeze-generation-specs-at-live-execution.md`;
- `docs/decisions/0057-use-model-routed-human-readable-generation-prompts.md`;
- `docs/decisions/0036-use-unsliced-location-sheets.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/reference/drizzle-migrations.md`;
- `docs/architecture/structured-diagnostics.md`;
- `plans/active/0147-agent-external-generation-specs-and-asset-sources.md`;
- `plans/active/0148-generation-spec-lifecycle-and-source-request-projection.md`;
- `plans/active/0149-image-generation-review-and-model-routed-prompt-authoring.md`.

Decision 0058, created by this plan, supersedes only the Image Revision product
surface and attachment path described by Decisions 0055 and 0057. It does not
supersede external source-spec provenance, freeze-at-live-execution, model-routed
prompt authoring, or the generic Generation Preview contract.

Decision 0059, also created by this plan, records Location Sheet as the only
current product contract. It supersedes current-contract clauses in Decisions
0024, 0032, 0036, 0039, and 0041 that still name Environment Sheet roles, resource
keys, or paths. Those ADRs may retain obsolete wording only where it explains a
historical state; their current-direction sections and all current architecture
references must point to Decision 0059 and use Location Sheet terminology.

### Current implementation boundaries

- `packages/core/src/server/image-revision-workflow/` owns the current source,
  Regenerate/Edit draft, preview, estimate, run, and direct attachment path.
- `packages/core/src/client/image-revision-workflow.ts` exposes the retired
  public DTOs.
- `packages/core/src/server/generation/attachments.ts` owns generic focused
  media attachment and currently enforces exact purpose/target provenance.
- `packages/core/src/server/generation/attachment-destinations.ts` owns current
  destination projection.
- `packages/core/src/server/generation-preview-resource/update.ts` owns Preview
  Update intent and already branches by execution kind inside Core.
- `packages/core/src/server/generation-preview-resource/references.ts` rejects
  every saved `project-file` reference even though `GenerationReference`
  supports that valid source kind.
- `packages/core/src/server/generation-preview-resource/configuration.ts`
  returns empty authoring/config data for a managed model that no longer exists
  in the current catalog; that is valid for an editable draft but incomplete for
  historical inspection.
- `packages/core/src/server/generation/attachment-persistence.ts` writes both a
  Lookbook membership record and a project-level asset relationship, even
  though Lookbook resources use the membership record as their ownership source.
- `packages/studio/server/routes/image-revisions.ts` and
  `packages/studio/server/projections/image-revision.ts` adapt the current
  revision workflow.
- `packages/studio/src/features/image-revision/` owns the current dialog.
- `packages/studio/src/features/generation-request-editor/` already owns the
  shared prompt, reference, and configuration composition.
- `packages/studio/src/ui/media-card/` owns the domain-neutral card action
  contract.
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/`
  owns the agent-facing generation workflow.

Use `/Users/keremk/renku-movies/urban-basilica` for realistic read-only context
and desktop verification. Automated tests must use fixtures or temporary project
copies and must not mutate the real project.

Verified current `urban-basilica` evidence:

- managed run `media_generation_run_98gv7dsb`, attached to
  `asset_file_edka9uq2`, contains the valid project-file reference
  `research/helmet.jpg`;
- four active Location relationships use `environment_sheet` with asset type
  `location_environment_sheet`, while one newer relationship already uses the
  intended `location-sheet`/`location-sheet` contract;
- active Location Sheet files still live under
  `locations/<handle>/environment-sheets/`;
- seven Lookbook Images and one Lookbook Sheet use direct Lookbook membership,
  while `project_asset` has zero active rows.

These are development-data conversion inputs, not reasons to keep parallel
runtime contracts. The implementation applies the one-way Location Sheet
conversion to the real project only after the migration and filesystem-copy
preflight pass on a temporary project copy.

## Architecture Shape Gate

### Ownership overview

`packages/core` owns both durable rules introduced by this plan:

- resolving the exact saved generation request for an AssetFile; and
- deciding whether an `image.edit` output may be attached to a focused domain
  destination.

Core also owns the existing contracts corrected by this plan:

- safe resolution of a project-file generation reference;
- historical projection of a saved request without current catalog membership;
- Location Sheet naming, relationship roles, asset types, Location Design keys,
  resource fields, and durable file allocation; and
- the single ownership record used for Lookbook media.

Studio server remains an HTTP adapter. React remains a projection consumer.
Studio Skills owns the user-and-agent workflow sequence and creative prompt
authoring. Engines continues to own provider schemas and execution adapters.

The intended Core module shape is:

```text
packages/core/src/client/
  asset-file-generation-request.ts

packages/core/src/server/asset-file-generation-request/
  service.ts             public read command orchestration only
  source.ts              active Asset/AssetFile and provenance resolution
  projection.ts          exact saved-spec to Generation Preview projection
  service.test.ts

packages/core/src/server/generation-preview-resource/
  references.ts          shared asset-file/project-file reference projection
  configuration.ts       current editable authoring configuration
  historical-configuration.ts
                         saved model/value projection independent of catalog

packages/core/src/server/generation-reference-file/
  service.ts             safe project-file media resolution
  service.test.ts

packages/core/src/server/generation/
  attachments.ts         thin attachment orchestration and persistence call
  attachment-provenance.ts
                         bounded exact-match vs image-edit provenance dispatch
  image-edit-attachment-provenance.ts
                         exact source slot and destination ownership rule
  attachment-destinations.ts
                         existing focused destination projection
  attachment-persistence.ts
                         existing persistence implementation
```

`asset-file-generation-request/source.ts` resolves exactly one source request:

- managed provenance uses the immutable GenerationRun `specSnapshot` recorded
  for the exact AssetFile;
- external provenance uses the exact frozen `sourceGenerationSpecId` recorded
  on the exact AssetFile;
- no provenance, conflicting managed/external provenance, a missing referenced
  run/spec, a mutable external source spec, a discarded asset/file, or an
  asset/file mismatch fails with a structured Core diagnostic.

`projection.ts` delegates to the existing generic Generation Preview builders
with explicit historical presentation intent. It must not duplicate
provider/model/config/reference projection or invent a second source-request
schema.

`generation-preview-resource/references.ts` projects the two existing
`GenerationReference` variants into one tagged shared response. It may retain a
normalized project-relative path only in Core's server-to-adapter data shape so
Studio can create an authenticated browser URL. The browser response must not
expose that path as visible copy. A missing saved reference remains represented
as unavailable; it does not fail the entire inspector.

`historical-configuration.ts` builds the read-only configuration sections from
the saved spec model identity and exact browser-safe saved values. A current
Engines model descriptor may enrich a label, but catalog membership is not
required. Existing Preview safety still excludes secrets, provider upload URLs,
and other non-display payload data. The module does not create editable controls
or provider defaults.

`generation-reference-file/service.ts` reuses Core's normalized
project-relative-path, supported-media-kind, existence, realpath, and
project-containment checks. It returns Node-side file resolution metadata to the
thin Studio server and never exposes arbitrary absolute paths to the browser.

`attachments.ts` remains the public Core attachment orchestrator. It resolves
the destination, delegates provenance validation, validates destination-specific
invariants such as Lookbook kind, calls persistence, and formats the report. It
must shrink when provenance logic is extracted; it must not gain the new
relationship matrix inline. For Lookbooks, report construction reads the exact
new `lookbook_image` or `lookbook_sheet` membership and its AssetFile rather than
requiring a project-level relationship that the Lookbook does not own.

`attachment-provenance.ts` is a bounded dispatcher with exactly two current
paths:

1. ordinary exact purpose-and-target provenance;
2. the intentional `image.edit`-to-owner-destination bridge.

The dispatcher chooses from the validated saved spec or run snapshot, not from
provider names, prompt contents, filenames, or UI input. If another
cross-purpose attachment case appears during implementation, stop and revise
this plan before adding a third ad hoc branch.

`image-edit-attachment-provenance.ts` owns the complete exceptional rule. It may
read Core domain records and asset relationships. It does not persist assets,
copy files, resolve HTTP payloads, format CLI output, or inspect pixels/prompts.

### Public entrypoints

Add one Core read command:

```ts
readAssetFileGenerationRequest({
  projectName,
  assetId,
  assetFileId,
}): Promise<AssetFileGenerationRequest>
```

The client contract is:

```ts
interface AssetFileGenerationRequest {
  kind: 'assetFileGenerationRequest';
  assetId: string;
  assetFileId: string;
  preview: GenerationPreviewResourceData;
}
```

The identifiers support exact request/caller correlation and are never rendered
as fallback copy. The preview is the existing shared projection.

Refine the existing Preview reference type directly. Keep the current shared
common fields, but replace the asset-only top-level identity with an exact
reference discriminator:

```ts
type GenerationPreviewResourceReference =
  | GenerationPreviewReferenceCommon & {
      reference: {
        kind: 'asset-file';
        assetId: string;
        assetFileId: string;
      };
      availability: 'available' | 'unavailable';
      browserUrl?: string;
    }
  | GenerationPreviewReferenceCommon & {
      reference: { kind: 'project-file' };
      availability: 'available' | 'unavailable';
      browserUrl?: string;
    };
```

Core's `GenerationPreviewResourceData` variant for `project-file` additionally
carries the normalized `projectRelativePath` required by the Studio adapter.
`buildGenerationPreviewResource` consumes that server-side path and removes it
from the browser response while adding `browserUrl` only when the file is
available. Update existing consumers directly to read the tagged identity; do
not retain top-level `assetId`/`assetFileId` mirrors.

Project-file labels are intentional domain copy, not basenames:

- a selected slot uses the current reference-guide slot label;
- an additional selected reference uses `Project reference`;
- an unavailable project file uses the same label and an unavailable visual
  state without exposing its path or filename.

Add one Core server read command for the browser media route:

```ts
resolveGenerationProjectFileReference({
  projectName,
  projectRelativePath,
}): Promise<ResolvedGenerationProjectFileReference>
```

The Node-only result contains the resolved absolute path, media kind, and MIME
type after Core validates normalization, supported media, existence, realpath,
and project containment. It is not a browser contract.

`packages/core/src/client/index.ts` and
`packages/core/src/server/index.ts` remain intentional package entrypoints and
may add only the new client contract and the two focused server read-command
exports. They contain no resolution, validation, projection, or dispatch logic.

The Studio server adds one authenticated resource route:

```text
GET /studio-api/projects/:projectName/assets/:assetId/files/:assetFileId/generation-request
```

It returns:

```ts
{
  generationRequest: Omit<AssetFileGenerationRequest, 'preview'> & {
    preview: GenerationPreviewResource;
  };
}
```

The route reads path parameters, calls Core, applies the existing Studio browser
URL projection to references, serializes the response, and translates structured
errors. It owns no provenance or ownership rule.

Add one authenticated media route for available project-file references:

```text
GET /studio-api/projects/:projectName/generation-reference-file?path=<encoded-project-relative-path>
```

The route passes the encoded value to
`resolveGenerationProjectFileReference`, streams only Core-approved media, and
uses private caching. It performs no path joining, extension guessing, symlink
handling, or ownership decisions locally. Missing, unsupported, traversal, and
symlink-escape cases return the standard structured response and never expose an
absolute path.

Keep the existing public generation commands unchanged:

- `createGenerationSpec`;
- `updateGenerationSpec`;
- `freezeGenerationSpec`;
- `buildGenerationPreview`;
- `estimateGeneration`;
- `runGeneration`;
- `attachGenerationMedia`.

The CLI surface also remains unchanged. Agent attachment continues to use:

```text
renku media import --purpose <destination-purpose> --target <destination-target> ...
```

with either the existing managed receipt input or the existing external
`--source-spec` input. Do not add `image edit attach`, `replace`, `revision`,
`destination-purpose`, or provenance-override flags.

### Studio module shape

The intended Studio files are:

```text
packages/studio/server/routes/
  asset-file-generation-requests.ts
  asset-file-generation-requests.test.ts
  generation-reference-files.ts
  generation-reference-files.test.ts

packages/studio/server/http/
  generation-reference-file-response.ts

packages/studio/src/services/
  studio-asset-file-generation-request-api.ts
  studio-asset-file-generation-request-api.test.ts

packages/studio/src/features/generation-request-inspector/
  generation-request-inspector-dialog.tsx
  generation-request-inspector-dialog.test.tsx
  generation-request-inspector-provider.tsx
  generation-request-inspector-provider.test.tsx
  use-generation-request-inspector.ts
  use-generation-request-inspector-resource.ts
  use-generation-request-inspector-resource.test.tsx
```

`generation-request-inspector-provider.tsx` owns only dialog session state and
the context hook. Its public open input is:

```ts
interface OpenGenerationRequestInspectorInput {
  projectName: string;
  assetId: string;
  assetFileId: string;
}
```

It must not retain owner-specific target unions, modes, mutable drafts,
estimates, live-run state, or attachment callbacks.

`use-generation-request-inspector-resource.ts` owns the asynchronous read,
loading/error state, stale-response protection, and reset when a different exact
AssetFile opens. It does not cache durable project state or infer eligibility.

`generation-request-inspector-dialog.tsx` composes the existing
`GenerationRequestEditor` with `readOnly={true}`, no controls, no model control,
and no mutation callbacks beyond inert value handlers required by the shared
component contract. If those inert callbacks make the shared contract unclear,
refine `GenerationRequestEditor` into a discriminated editable/read-only prop
contract; do not create a pass-through wrapper merely to hide them.

The domain-neutral MediaCard contract becomes:

```ts
interface MediaCardInspectionAction {
  label: string;
  onInspect: () => void;
}
```

`MediaCardProps.inspectionAction` replaces `editAction` directly. The local UI
primitive renders a view/document-search icon and invokes `onInspect`; it does
not import generation concepts. Update all current callers and tests in the same
slice. Do not retain `MediaCardEditAction` as an alias.

### Destination ownership matrix

The Core image-edit bridge supports only current focused image destinations:

| Destination import purpose | Destination target | Required current source ownership |
| --- | --- | --- |
| `cast.character-sheet` | exact `castMember` | source asset is related to that Cast Member with role `character-sheet` |
| `cast.profile` | exact `castMember` | source asset is related to that Cast Member with role `profile` |
| `location.sheet` | exact `location` | source asset is related to that Location with role `location-sheet` |
| `location.hero` | exact `location` | source asset is related to that Location with role `hero` |
| `lookbook.image` | exact `lookbook` | source asset has an active `lookbook_image` membership belonging to that exact Lookbook |
| `lookbook.video-sheet` | exact production `lookbook` | source asset has an active `lookbook_sheet` membership belonging to that exact production Lookbook |
| `lookbook.storyboard-sheet` | exact storyboard `lookbook` | source asset has an active `lookbook_sheet` membership belonging to that exact storyboard Lookbook |

For every row, provenance must also prove that:

- the saved source request purpose is exactly `image.edit`;
- its target is exactly the source asset;
- the `source/source-image` selection identifies that same active source asset
  and the exact active source AssetFile;
- both the selected source Asset and its exact AssetFile have `image` media
  kind; inconsistent Asset/AssetFile media kinds fail before any copy or write;
- for managed execution, the supplied path is an exact output in the supplied
  run receipt;
- for external execution, the supplied source spec is `agent-external` and
  frozen;
- the destination relationship or Lookbook membership still exists at
  attachment time;
- the destination's normal target-kind and Lookbook-kind rules still pass.

No relationship-role substring matching is allowed. Use exact current domain
roles and membership records. Do not preserve `environment-sheet` or another
retired role as a fallback. For Lookbooks, the membership record is the sole
owner record; do not also consult or create `project_asset`. The one-way
Location Sheet conversion runs before current runtime verification, so live
development data is not a reason to add an alias.

### Location Sheet current contract and one-way conversion

Use these names as the only current contract:

| Boundary | Current name |
| --- | --- |
| Product term | Location Sheet |
| Generation purpose | `location.sheet` |
| Location relationship role | `location-sheet` |
| Asset type | `location-sheet` |
| Project asset-file destination | `location.sheet` |
| Location Design field | `locationSheetGuidance` |
| Director/resource fields | `locationSheetCount`, `missingLocationSheetLocationIds`, `everyLocationHasLocationSheet` |
| Studio helpers | `locationSheetAssets`, `locationSheetCompositeUrl`, `locationSheetAspectRatio`, `locationSheetPreviewImages` |
| Durable folder | `locations/<location-handle>/location-sheets/` |
| Dependency/resource keys | `location-sheet:<...>` in the scopes that currently require them |

Update callers directly across Core, CLI, Studio, tests, current docs, and the
source `production-designer`/`media-producer` skills. Delete dual-role/type
arrays and every current runtime branch that recognizes the old spelling. Do
not add a compatibility module, adapter, alias, fallback, or old-name
diagnostic.

Generate a custom one-way Drizzle migration through Drizzle Kit:

```bash
pnpm drizzle-kit generate --config drizzle.config.ts \
  --custom --name=location_sheet_contract
```

Run it from `packages/core`. The expected next migration is
`packages/core/drizzle/0062_location_sheet_contract.sql`; use the actual
Drizzle-generated number if concurrent migration work changes the sequence.
The migration is custom because table structure is unchanged while owned data
values and JSON keys require conversion. It must:

- rewrite active and discarded `location_asset.role` values to
  `location-sheet`;
- rewrite Location Sheet `asset.type` values to `location-sheet`;
- rewrite owned `asset_file.project_relative_path` values from
  `environment-sheets/` to `location-sheets/` and replace obsolete
  environment-sheet filename segments where present;
- rename the owned `design.environmentSheetGuidance` key to
  `design.locationSheetGuidance` in every `location_design.document_json`
  revision while preserving the array values exactly;
- update other owned persisted contract keys/resource identifiers only when the
  repository scan proves they are still stored in current tables;
- leave prompts, titles, generated media, provider payloads, run snapshots, and
  other opaque creative contents unchanged;
- advance `PRAGMA user_version` from 48 to 49 because the new runtime reads only
  the current names.

Before applying the migration to `urban-basilica`, build a collision-checked
manifest of active files under `locations/*/environment-sheets/`. Copy each
file to its exact new `locations/*/location-sheets/` path first, preserving the
old directory in a filesystem backup. Apply the migration with:

```bash
renku project migrate urban-basilica
```

Use the verified database backup reported by Core. After `PRAGMA quick_check`,
path resolution, asset count, relationship count, and Studio read verification
all pass, remove the old durable directories. Do not build a reusable runtime
file migration service for this single pre-customer project.

Historical Drizzle SQL/snapshots and historical ADR reasoning may retain the
obsolete spelling when they describe the one-way conversion or past state.
Current production code, browser/CLI contracts, tests, active architecture
documentation, and source skills may not.

### Diagnostic contracts

Use existing asset, AssetFile, target-kind, Lookbook-kind, frozen-spec, and
managed receipt diagnostics where their meanings remain exact. Add these focused
Core codes for new failure meanings:

- `CORE_ASSET_FILE_GENERATION_REQUEST_NOT_FOUND` — the exact AssetFile has no
  managed run or frozen external source request to inspect;
- `CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_INVALID` — provenance is
  conflicting, incomplete, points to a missing record, or is mutable;
- `CORE_IMAGE_EDIT_ATTACHMENT_SOURCE_INVALID` — the generating `image.edit`
  request does not select the exact active source Asset and AssetFile, or either
  selected record is not image media;
- `CORE_IMAGE_EDIT_ATTACHMENT_DESTINATION_MISMATCH` — the source asset is not
  currently owned by the exact requested destination and role/membership;
- `CORE_IMAGE_EDIT_ATTACHMENT_DESTINATION_UNSUPPORTED` — the destination is not
  in the focused image ownership matrix;
- `CORE_GENERATION_PREVIEW_MODEL_FAMILY_REQUIRED` — a managed Preview Update
  omits the required model family.

The existing generic provenance-conflict, receipt-output, mutable-external-spec,
target-kind, and Lookbook-kind codes remain authoritative where applicable.
Collect related validation issues before a write when the current boundary
already supports diagnostic collection. Every invalid image-edit attachment
must fail before file copy, owner-record creation, asset insert, relationship
insert, or provenance insert.

Do not create diagnostics for retired Image Revision modes, endpoints, DTOs, or
role aliases.

### Files expected to disappear

Delete these obsolete production boundaries and their focused tests:

```text
packages/core/src/client/image-revision-workflow.ts
packages/core/src/server/image-revision-workflow/
packages/studio/server/projections/image-revision.ts
packages/studio/server/routes/image-revisions.ts
packages/studio/server/routes/image-revisions.test.ts
packages/studio/src/features/image-revision/
packages/studio/src/services/studio-image-revisions-api.ts
```

Remove their imports, public exports, route registration, provider wiring,
fixtures, and current tests. Replace integration coverage with tests of the
current inspector and generic agent-owned generation path. Do not keep retired
names in architecture source-text tests.

Also delete:

```text
packages/core/src/server/project-asset-files/destinations/image-edit.ts
```

and remove `image.editOutput` from the destination union and registry. The
current usage scan finds no production caller. This is a project-file placement
shortcut belonging to the deleted revision path, not the `image.edit`
generation purpose.

### Files expected to remain thin

- Core client/server `index.ts` files remain export-only entrypoints.
- `project-data-service-wiring/generation.ts` adds only focused delegation to
  `readAssetFileGenerationRequest` if the command is exposed through
  `ProjectDataService`.
- `packages/studio/server/routes/projects.ts` only registers the new route and
  removes the old one.
- `packages/studio/src/app/app.tsx` only swaps the dialog provider.
- Cast, Location, and Lookbook feature components only create the exact
  inspector open input; they do not read provenance.
- CLI media-import handlers continue parsing flags, calling Core, and formatting
  the report.
- `GenerationRequestEditor` continues composing shared presentation and does not
  learn asset provenance or agent workflow rules.

### Forbidden implementation shape and stop conditions

Stop and revise this plan before implementation continues if any of the
following begins to happen:

- the old Image Revision service is renamed or wrapped instead of deleted;
- the inspector retains a draft, estimate, run, revision mode, or attachment
  API “for later”;
- React or the Studio route reads generation tables or decides source
  ownership;
- `attachments.ts` grows a Cast/Location/Lookbook relationship switch inline;
- the image-edit bridge becomes a generic `allowPurposeMismatch` flag;
- CLI accepts arbitrary destination/provenance overrides;
- Preview projection throws merely because a valid saved reference is a
  `project-file`, exposes its path/filename as visible copy, or lets Studio
  perform project path safety checks outside Core;
- historical inspection depends on a saved model still existing in the current
  Engines catalog or silently replaces saved values with current defaults;
- Lookbook attachment creates or requires both a Lookbook membership and a
  project-level asset relationship;
- current runtime code recognizes both Location Sheet and Environment Sheet
  roles, types, fields, destinations, helper names, or folder paths;
- a single function validates receipt/spec, resolves owner records, copies the
  file, persists assets, and formats a response;
- `index.ts` contains implementation logic;
- the shared config panel uses disabled `Select`, raw `<select>`, raw `<input>`,
  or another interactive control for read-only values;
- a runtime validator examines prompt words, prompt mentions, reference image
  contents, or generated pixels;
- old endpoint/type/component names are retained as compatibility aliases;
- tests hard-code private helper names or a complete inventory of allowed
  functions as source-text needles;
- another cross-purpose attachment case is added without redesigning the
  bounded provenance dispatch;
- a checklist item can be satisfied only by accepting a large catch-all file or
  function.

## Contracts

### AssetFile source-request projection

`readAssetFileGenerationRequest` validates the active Asset and exact active
AssetFile before resolving provenance. It projects the immutable saved request,
not current provider catalog defaults and not a newly synthesized edit draft.

Managed source:

- read the exact `asset_file_generation` record;
- require its GenerationRun;
- project `run.specSnapshot` even if the original saved spec record later has a
  different lifecycle state;
- retain the run snapshot's exact prompt, references, model, values, and target.

External source:

- read `asset_files.sourceGenerationSpecId`;
- require execution kind `agent-external` and a non-null `frozenAt`;
- project that saved exact spec unchanged;
- do not invent a run, receipt, estimate, or managed model family.

The Core projection may resolve domain labels and reference metadata required by
the existing `GenerationPreviewResourceData`. It must not expose project-relative
paths, provider upload URLs, filenames, or raw ids as visible labels. It must not
interpret or sanitize arbitrary authored values beyond the existing Generation
Preview envelope contract.

Saved references:

- available asset-file and project-file references project through the shared
  tagged reference contract and receive an authenticated browser URL;
- unavailable references remain visible as unavailable selected references so
  one missing file does not erase the rest of the historical request;
- project-file paths remain Core/Studio-server transport data only and never
  become a title, label, tooltip, or fallback copy;
- regular editable Generation Preview and the historical inspector consume the
  same reference response contract.

Historical configuration:

- render saved provider, model, route, and every browser-safe saved non-prompt
  authored value even when the current catalog has no matching descriptor;
- preserve exact saved primitive, list, and dimensions values;
- use a current descriptor only to enrich a human-readable label;
- do not synthesize current defaults, editable controls, allowed-value lists, or
  model-family selection for a retired model;
- preserve the existing Preview rule that secrets, provider upload URLs, and
  non-display provider payload data never enter browser configuration;
- keep regular editable Preview behavior unchanged.

### Read-only request editor contract

Refine shared component props only as much as necessary to express two explicit
states:

- editable Preview: existing controls and callbacks;
- read-only inspector/frozen Preview: values and tabs, no mutation callbacks.

In read-only mode:

- prompt editor receives `readOnly` and preserves the exact string;
- reference grid receives `editable={false}` and renders only current/selected
  references;
- config always renders `GenerationRequestConfigPanel`, not
  `GenerationRequestControlsPanel`;
- diagnostics may be displayed if they are part of the saved generic preview,
  but they must not enable corrective actions;
- the component renders no estimate or footer action itself.

The config panel's visible rows remain derived from
`preview.configuration.sections`. Do not reconstruct values from provider
schemas in React.

### Preview Update model-family contract

Change the shared update input from required to optional:

```ts
modelFamilyId?: string
```

The Studio browser client omits it when no managed family is present. The Studio
route validates it as a non-empty string only when supplied and forwards it
unchanged. The route must not load the spec or branch on execution kind.

Core owns the branch:

- `renku-managed`: require `modelFamilyId`, resolve the selected family and
  provider-valid route, or return
  `CORE_GENERATION_PREVIEW_MODEL_FAMILY_REQUIRED` before mutation;
- `agent-external`: ignore managed family routing and update the exact supported
  external envelope fields through the existing external path.

Do not use a blank-string sentinel, default family, provider-name inference, or
fallback to the existing model.

### Image-edit attachment provenance contract

`attachGenerationMedia` still receives destination intent. For example, an
edited Location Sheet is imported with:

```text
purpose: location.sheet
target: location:<location-id>
```

Its provenance may identify a source request with:

```text
purpose: image.edit
target: asset:<source-asset-id>
```

That mismatch is accepted only when the exact source reference and current
destination ownership matrix prove that the edit returns to the source asset's
own eligible destination. The persisted new asset uses the destination purpose,
target, role, resource keys, and owner-record behavior. Its provenance points to
the managed GenerationRun or frozen external source spec that produced it.

This is not a purpose conversion. It is a focused attachment authorization
rule. The source spec remains `image.edit`; the attachment report remains the
destination purpose and target; neither value is rewritten or duplicated.

Refine the internal attachment destination/persistence contract so ownership is
discriminated rather than always represented as an asset relationship:

- Cast and Location destinations persist one exact target relationship;
- Lookbook destinations persist one exact `lookbook_image` or `lookbook_sheet`
  membership and no `project_asset` row;
- Lookbook attachment reports are built from the new membership plus its Asset
  and AssetFile, not from `readAssetRelationship(... target: project)`;
- the public attachment report continues returning the attached media and
  Lookbook owner record without adding a convenience mirror of project
  ownership.

Update generic Lookbook attachment tests and any current fixtures that expect a
project relationship. Do not migrate the valid existing Lookbook membership
rows into `project_asset`; the membership tables remain the source of truth.

## Implementation Slices

### Slice 1 — Record the ownership decision

Add:

- `docs/decisions/0058-make-studio-image-editing-agent-owned.md`.
- `docs/decisions/0059-use-location-sheet-as-the-only-current-contract.md`.

The ADR must state:

- Studio's attached-image action is read-only source-request inspection;
- Regenerate/Edit authoring and execution are deleted from Studio;
- new image edits are ordinary agent-authored `image.edit` requests;
- request approval and output approval are separate;
- accepted outputs attach as new assets and never replace the source;
- the focused Core provenance bridge is the only accepted purpose/target
  mismatch;
- Decisions 0055 and 0057 remain authoritative for external source persistence,
  lifecycle, prompt authoring, and Preview, but their Image Revision UI sections
  are superseded.

Add a short supersession note to Decisions 0055 and 0057 rather than rewriting
their historical reasoning.

Decision 0059 must state:

- Location Sheet is the only current product term and contract;
- the relationship role and asset type are both `location-sheet`;
- the project asset-file destination is `location.sheet` and durable files use
  `locations/<handle>/location-sheets/`;
- Location Design and resource contracts use `locationSheet*` names;
- local development data is converted once and runtime code has no old-spelling
  compatibility;
- opaque saved creative contents and historical migration/ADR text are not
  rewritten merely for terminology.

Update current-direction clauses in Decisions 0024, 0032, 0036, 0039, and 0041
to use Location Sheet, and add short notes that Decision 0059 supersedes their
retired role/resource/path spellings. Preserve old wording only where the ADR is
explicitly describing historical context.

### Slice 2 — Make Location Sheet the only current contract

Perform the complete direct rename described in the Architecture Shape Gate.
Expected current-contract areas include:

- Core client Location Design schemas/types and director/resource reports;
- Core location access, dependency checks, generation reference slots,
  attachment destinations, project asset-file destination union/registry/path
  allocation, and generated-media attachment details;
- CLI help, reports, integration fixtures, and current command documentation;
- Studio location asset filtering/helpers, titles, route fixtures, component
  tests, and E2E fixtures;
- current data-model, domain-vocabulary, project-file/storage, generation, and
  video-capability architecture references, including
  `docs/architecture/README.md`;
- the source `production-designer` skill and affected media-producer guidance.

Generate the custom Drizzle migration and regression fixture described above.
The migration test must prove exact conversion of relationship roles, asset
types, paths, and Location Design keys; unchanged unrelated records; unchanged
opaque creative values; and schema generation 49.

Apply the filesystem-copy and database migration procedure first to a temporary
copy of `urban-basilica`. After focused/root tests pass against current code,
stop project writers, apply the same verified procedure to the real project,
record backup paths and before/after counts, validate all referenced files, and
only then remove its retired durable directories.

Finish with a current-surface search. Obsolete wording may remain only in
historical Drizzle migrations/snapshots, historical ADR explanations, completed
plans, opaque authored project data, and the one-way migration that converts the
old values.

### Slice 3 — Add the Core AssetFile generation-request read model

Add the client contract and focused server module named in the Architecture
Shape Gate. Extend the shared tagged Preview reference contract, add historical
configuration projection, and add the safe project-file resolver. Wire the
commands through the public Core server entrypoint and, if needed by Studio,
`ProjectDataService`.

Tests must cover:

- a managed AssetFile projects the immutable run snapshot;
- a frozen external AssetFile projects the exact external spec;
- asset-file and project-file references use the same tagged Generation Preview
  projection;
- an available project file receives Core-approved media metadata and an
  intentional non-filename label;
- a missing saved project file renders as an unavailable selected reference
  without failing the complete request;
- unsupported media, traversal, and symlink escape fail in the focused file
  resolver without exposing an absolute path;
- a saved managed request whose model is absent from the current catalog still
  renders the exact provider/model identity and all saved authored values;
- current catalog descriptors may enrich historical labels but are not required;
- asset/file mismatch, discarded records, absent provenance, conflicting
  provenance, missing run/spec, and mutable external provenance fail with
  structured diagnostics;
- no failure path writes project state;
- prompt and media contents are never semantically inspected.

### Slice 4 — Add the thin Studio resource route and browser client

Add the generation-request GET route, project-file media GET route, projection
response, browser client, and focused tests. Wire both routes in
`packages/studio/server/routes/projects.ts`.

The route test must prove:

- exact project/asset/file path parameters reach Core;
- asset-file reference browser URLs use the existing Studio asset-file URL
  projection;
- available project-file references receive the authenticated project-file
  browser URL while the browser DTO and visible label omit the path/filename;
- missing project files produce an unavailable reference card, while traversal,
  unsupported media, and symlink-escape requests fail through the standard
  structured boundary;
- structured Core failures are serialized through the standard error boundary;
- no route-local provenance, owner, path-containment, or media-kind validation
  exists.

The browser service test must prove authenticated GET behavior and standard
Studio API error decoding.

### Slice 5 — Build the read-only Generation Request inspector

Add the feature module and swap its provider into `app.tsx`.

Update the shared request editor only where required to make read-only state
explicit. Update `GenerationRequestConfigPanel` so each label/value row retains
the polished control-grid spacing and value-field surface without interactive
semantics. Preserve existing file formatting and avoid a broad visual rewrite.

Replace current generated-image card call sites:

- Cast Character Sheet media;
- Location Sheet media;
- Lookbook Image media;
- Production and Storyboard Lookbook Sheet media.

If current Profile or Location Hero cards already expose the shared action, wire
them too. Do not add new card copy or an action to surfaces that do not expose an
exact AssetFile identity.

Component tests must prove:

- one `Generation Request` title;
- Prompt, References, and Config tabs remain available;
- exact prompt text is read-only;
- only selected references render and no Choose/toggle action exists;
- available asset-file and project-file references render through their exact
  tagged browser URL, and an unavailable saved reference remains visible without
  crashing the dialog;
- Config contains no combobox, textbox, switch, slider, or disabled interactive
  field;
- retired/unavailable saved model identity and values remain visible as static
  historical configuration;
- there is no Regenerate/Edit tab, estimate, Cancel, Update, Generate,
  Regenerate, or Edit action;
- the explicit footer action is `Close`;
- Escape, standard close chrome, outside click, and Close all dismiss;
- loading/error state cannot mutate or run anything;
- changing the exact AssetFile resets stale request state.

### Slice 6 — Replace the MediaCard Edit action with Inspection

Update the domain-neutral UI contract, action rendering, card composition, and
all callers/tests directly:

- `editAction` becomes `inspectionAction`;
- `MediaCardEditAction` becomes `MediaCardInspectionAction`;
- `onEdit` becomes `onInspect`;
- the pencil icon becomes the selected document/view inspection icon;
- labels come from the feature caller and use `View generation request` for this
  workflow.

Do not retain old prop/type names, a deprecated alias, or a wrapper component.
Confirm other MediaCard consumers compile after the direct contract update.

### Slice 7 — Delete Studio Image Revision end to end

Delete the files listed in the Architecture Shape Gate and remove:

- Core client/server exports;
- ProjectData/service wiring unique to revision;
- Studio route registration and projection;
- browser service calls;
- app provider and feature hooks;
- owner-specific `ImageRevisionTarget` construction at card call sites;
- revision-specific fixtures and integration assertions;
- tests for modes, draft construction, estimate, run, and direct attachment.

Delete the unused `image.editOutput` destination module, union member, registry
entry, and focused tests. Run a final usage scan afterward to confirm the
obsolete destination did not survive anywhere in current runtime code.

Do not add tests asserting that retired route strings or private names are
absent. Current inspector and generic generation behavior are the contract.

### Slice 8 — Add focused image-edit attachment provenance

Extract provenance validation from `generation/attachments.ts` into the focused
modules named above while preserving ordinary exact-match behavior.

Implement both managed and external image-edit cases against the ownership
matrix. Reuse Core domain access modules; do not duplicate relationship or
Lookbook business rules in CLI/Studio.

Refine generic attachment persistence in the same slice so Lookbook media
creates only its exact Lookbook membership. Update report construction and
ordinary same-purpose Lookbook attachment tests together; do not leave the
duplicate `project_asset` write as unrelated cleanup.

Tests must prove:

- managed `image.edit` receipt output attaches to the exact source Cast,
  Location, and Lookbook destination as a new generated asset;
- a frozen external `image.edit` source spec can attach through
  `--source-spec`/Core import with the same result;
- the exact managed path must be a run output;
- the exact source AssetFile must be the selected source-image reference;
- the selected source Asset and exact AssetFile must both be active image media;
- managed and external requests with a non-image source or inconsistent
  Asset/AssetFile media kinds fail before any copy or write;
- a different AssetFile in the same asset is rejected;
- Location Sheet ownership recognizes only `location-sheet` after the one-way
  conversion;
- exact active Lookbook membership authorizes existing valid Images/Sheets even
  when no `project_asset` row exists;
- attaching new Lookbook media creates exactly one membership and zero
  `project_asset` rows;
- wrong destination id, Cast/Location role, Lookbook membership, Lookbook kind,
  purpose, or target is
  rejected before any write;
- missing/discarded source asset or file is rejected before any write;
- mutable external spec and receipt/source-spec conflicts remain rejected;
- unsupported destination purposes do not acquire the bridge;
- ordinary same-purpose attachment remains unchanged;
- attachment creates a new asset/file and provenance record;
- the source asset/file and its relationships remain unchanged;
- no output is auto-selected and no prior asset is discarded.

Add CLI integration coverage through the existing `renku media import` command
for one managed and one external case. The CLI must exercise Core behavior
without adding flags or business rules.

### Slice 9 — Fix external Generation Preview updates

Make `modelFamilyId` optional across:

- the Core Preview Update input;
- `ProjectDataService` wiring;
- the Studio generation-preview route body;
- the Studio browser service request;
- draft/request builders that currently manufacture a blank or required value.

Core tests must prove:

- a mutable external spec updates its exact prompt/reference/value envelope
  without a model family;
- a managed spec without a model family fails with the focused structured code
  before its revision or timestamp changes;
- a managed spec with a valid family keeps current route-resolution behavior;
- a frozen managed or external spec remains immutable.

Studio route tests must prove the adapter accepts omission, rejects a supplied
empty value, and forwards the optional value without execution-kind branching.

### Slice 10 — Update the agent media-production workflow

Update the canonical source skill at:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/
```

Review and update at least:

- `SKILL.md`;
- `references/workflow.md`;
- `references/image-prompt-authoring.md`;
- `references/reference-visible-image-prompting.md`;
- `evals/image-prompt-routing/forward-test-cases.md`;
- any current sample spec or forward eval that demonstrates image editing.

The instructions must distinguish:

- a new request based on an earlier prompt from the retired Studio Regenerate
  action;
- a true `image.edit` request with the exact original AssetFile reference;
- managed Renku execution from external Codex `gpt-image-2` execution;
- request approval from generated-output approval;
- generation from attachment;
- rejected/unattached outputs from accepted/imported outputs.

Examples must use the destination's real import purpose and target while passing
the managed receipt or frozen external source spec. They must explicitly show
the generated image in Codex and obtain acceptance before media import.

Do not edit the installed plugin cache as the source of truth. Change the sister
project and use its documented validation/packaging workflow.

Also update the source `production-designer` skill and its Location Design
reference so its description, workflow, handoff copy, and
`locationSheetGuidance` contract use Location Sheet exclusively. Validate both
skill folders. Do not retain an Environment Sheet alias or teach agents to emit
the retired JSON key.

### Slice 11 — Update current architecture and test documentation

Update current references that describe Image Revision as a product surface:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- `docs/architecture/frontend.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/reference/context-first-generation-foundation-manifest.md`;
- `docs/architecture/reference/studio-coordination-events.md` if its current
  action/resource-key table still names Image Revision;
- `docs/architecture/test-execution-strategy.md` where current test suites are
  enumerated;
- `docs/product/design-guidelines.md` where the current MediaCard action anatomy
  still prescribes Edit;
- `docs/architecture/README.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/video-generation-model-capabilities.md`;
- `docs/cli/commands.md`.

Document:

- AssetFile source-request inspection;
- the unchanged generic Preview and generation lifecycle;
- agent-owned `image.edit` authoring and execution;
- the focused attachment provenance bridge;
- the MediaCard inspection action contract;
- the absence of Studio image-revision mutation endpoints;
- Location Sheet as the only current role/type/field/path terminology;
- direct Lookbook membership as the only Lookbook media ownership record.

Add an explicit supersession/narrowing note to Decision 0053: `MediaCard` now
supports Inspection in place of the removed Edit action, and current action
placement guidance must name Inspection. Update
`project-asset-storage-conventions.md` both for the `location-sheets/` directory
and to remove the deleted `image.editOutput` destination.

Do not rewrite completed plans 0133, 0148, or 0149. They remain implementation
history; Decision 0058 and current architecture docs state the accepted
direction.

## Tests And Guardrails

### Core behavior tests

- Source-request projection for managed and external AssetFiles.
- Exact run snapshot rather than mutable/current spec projection.
- Frozen external-spec requirement.
- Available and unavailable saved project-file reference projection.
- Safe project-file resolution rejects traversal, unsupported media, and
  symlink escape.
- Historical saved model/config projection when current catalog membership is
  unavailable.
- Structured provenance failures with zero writes.
- Existing prompt/reference/config values preserved exactly.
- Exact source-image AssetFile selection for `image.edit` attachment.
- Active image media-kind validation for both the selected source Asset and
  exact AssetFile, including inconsistent-record failures.
- Managed output-path receipt verification.
- Exact owner role or Lookbook membership verification.
- Location Sheet role/type/path/Location Design one-way migration regression.
- Lookbook attachment creates membership without `project_asset` and reports
  the attached media from that membership.
- New asset creation with original preservation.
- Ordinary focused attachments unchanged.
- Managed Preview Update family required; external family omitted.

### Studio server tests

- Authenticated generation-request GET route.
- Exact parameter forwarding and browser URL projection.
- Authenticated project-file media route with Core-owned containment checks.
- Structured error translation.
- Optional Preview Update `modelFamilyId` transport.
- No execution-kind or owner validation in routes.

### Studio component tests

- Read-only prompt/reference/config behavior.
- One Close footer action and no generation actions.
- Inspection action icon, accessible name, and callback.
- Generated card opens exact AssetFile request.
- Saved project-file reference and retired-model request remain inspectable.
- Non-generated cards do not misleadingly expose the action; an invalid
  generated provenance record produces the structured inspector read error.
- Loading, error, stale response, tab, focus, Escape, and close behavior.
- Config is visually composed but has no interactive field roles.

### CLI and integration tests

- Existing spec create/preview/freeze/run/import sequence for managed
  `image.edit`.
- Existing spec create/preview/freeze/external-generate/import sequence for
  Codex provenance.
- Output rejection represented by no import call and no project mutation in
  skill evals; runtime does not need a rejection record.
- Media import mismatch fails before writes with structured diagnostics.
- Lookbook import does not create a parallel project relationship.

### Architecture guardrails

- Core runtime tests prove invalid attachment fails before persistence.
- Existing import-boundary tests continue to prevent React from importing Core
  server/database code and routes from owning domain rules.
- Studio feature code uses local shadcn controls only.
- The domain-neutral MediaCard module imports no generation feature or Core
  server module.
- Any static guard names a stable forbidden capability or import boundary, not
  private helper names or a complete command inventory.
- Do not add old Image Revision names as compatibility sentinels.
- Current runtime/tests/source skills contain no retired Environment Sheet
  contract names; historical migration/ADR text and opaque creative data are
  excluded from this guard.
- No Preview consumer assumes every reference has asset ids, and no Studio
  route performs project-file path resolution outside Core.
- Review function/file size and nesting in the newly extracted provenance
  modules; split before they become a new owning-layer monolith.

## Documentation

Create:

- `docs/decisions/0058-make-studio-image-editing-agent-owned.md`.
- `docs/decisions/0059-use-location-sheet-as-the-only-current-contract.md`.

Update the current architecture references listed in Slice 11 and the canonical
media-producer and production-designer skills listed in Slice 10.

The documentation must consistently use these terms:

- **Generation Request inspector** — read-only Studio view of an attached
  AssetFile's exact source request;
- **Generation Preview** — existing review/edit surface for a new draft request;
- **image edit** — ordinary `image.edit` generation purpose authored and
  executed by the agent workflow;
- **output approval** — user acceptance of the actual generated image before
  attachment;
- **attachment** — import of an accepted output as a new destination asset.
- **Location Sheet** — the only current name for a Location-owned production
  reference image, using role/type `location-sheet` and durable folder
  `location-sheets/`.

Avoid using “revision” as the current runtime concept. Historical ADRs and plans
may retain it when explaining the superseded design.

## Final Verification

### Focused automated verification

Run after the relevant slices:

```bash
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm lint:core
pnpm lint:cli
pnpm lint:studio
pnpm type-check:core
pnpm type-check:cli
pnpm build:core
pnpm build:cli
pnpm build:studio
pnpm check:architecture
```

Run the media-producer guide validation from the sister project:

```bash
node skills/media-producer/scripts/validate-image-prompt-guides.mjs --project urban-basilica
```

Run the standard skill validators for both changed source skills and the focused
Core migration regression. Apply the Location Sheet conversion to a temporary
copy before touching the real project.

Run focused unit and integration files directly during implementation when
faster feedback is useful, but do not substitute them for the package commands
above.

### Root verification

Because this slice changes Core contracts, CLI import behavior, Studio server,
React, docs, and the sister skill, complete with:

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e:studio:smoke
```

### Manual desktop verification

Use the current desktop Studio and the real `urban-basilica` project:

1. open a generated Location Sheet and confirm the card action reads
   `View generation request` and does not use a pencil;
2. open the inspector and compare Prompt, References, and Config with the saved
   source request;
3. inspect `asset_file_edka9uq2` and confirm its `research/helmet.jpg` reference
   renders through the project-file reference card instead of failing the
   request;
4. inspect a fixture saved with a removed model descriptor and confirm its exact
   saved model identity and values remain visible;
5. confirm prompt and references cannot be changed;
6. confirm Config looks like the current composed fields but has no dropdown or
   focusable control;
7. confirm no Regenerate/Edit switch, estimate, Cancel, or run action exists;
8. close with the footer Close action, header close icon, Escape, and outside
   click;
9. repeat for managed and external-source images where fixtures/data exist;
10. author an `image.edit` request with the agent against an exact Location Sheet
   AssetFile and inspect it in the unchanged Generation Preview;
11. execute once through an available managed Renku image route and once through
   Codex `gpt-image-2` when live cost approval is explicitly granted;
12. confirm Codex displays each generated output before attachment;
13. reject one output and verify no new attached asset appears;
14. accept one output, import it to the exact destination, and verify both the
    source and new image remain visible;
15. open the new image's inspector and confirm it shows the `image.edit` prompt,
    exact original reference, and execution configuration;
16. inspect Cast and Lookbook card behavior for the same read-only action;
17. confirm every current Location Sheet remains visible after conversion, new
    files allocate under `location-sheets/`, and no current UI/CLI response uses
    Environment Sheet terminology;
18. edit and attach one existing Lookbook Image or Sheet with no
    `project_asset` row, then confirm the new asset has exactly one Lookbook
    membership and still no project relationship.

Desktop-first verification only. Do not add or report mobile findings.

### Architecture-shape review

Before completion:

```bash
git diff --stat
git diff --check
```

Then inspect the complete diff and specifically inspect:

- `generation/attachments.ts` after provenance extraction;
- the new `attachment-provenance.ts` and
  `image-edit-attachment-provenance.ts` files;
- every new AssetFile generation-request module;
- shared reference and historical-configuration projection modules;
- the Core project-file resolver and thin Studio media route;
- Location Sheet contract callers, migration SQL/test, and the recorded
  `urban-basilica` conversion manifest;
- Lookbook attachment persistence/report changes;
- `GenerationRequestEditor` and config-panel changes;
- MediaCard contract/action changes;
- Core and Studio `index.ts`/route-registration files;
- all deleted Image Revision callers;
- the sister-project skill diff.

Confirm:

- no generated build artifacts entered source folders;
- no unrelated formatting churn occurred;
- no new god file, catch-all helper, broad dispatcher, or nested purpose chain
  was introduced;
- Core owns every durable provenance and owner rule;
- Studio server and CLI remain thin;
- React remains a projection consumer;
- `index.ts` files remain thin intentional entrypoints;
- the old revision implementation was deleted rather than wrapped;
- the generic `image.edit` purpose and exact-source contract remain intact;
- no checklist item was satisfied by accepting unreviewable code structure.
- current runtime code and active contract docs contain no Environment Sheet
  aliases or alternate spellings.

## Completion Checklist

### Review Area

- [ ] Reconfirm that Studio image editing is removed, not merely disabled.
- [ ] Reconfirm that the inspector is read-only and has no hidden mutation or
      run path.
- [ ] Reconfirm that generic `image.edit` remains supported for managed and
      external agent workflows.
- [ ] Reconfirm request approval and output approval are separate workflow
      gates.
- [ ] Reconfirm rejected output is never attached automatically.
- [ ] Reconfirm every valid saved asset-file/project-file request remains
      inspectable even when a reference or current model descriptor is
      unavailable.
- [ ] Reconfirm Location Sheet is the only current product contract and no
      compatibility spelling survives in runtime code.
- [ ] Reconfirm Lookbook membership is the single ownership source for Lookbook
      Images and Sheets.
- [ ] Confirm the implementation preserves accepted architecture boundaries.
- [ ] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [ ] Add `AssetFileGenerationRequest` to the Core client contract.
- [ ] Add `readAssetFileGenerationRequest` as the focused Core read command.
- [ ] Resolve managed provenance from the exact run snapshot.
- [ ] Resolve external provenance from the exact frozen source spec.
- [ ] Keep source-request projection on the existing Generation Preview data
      contract.
- [ ] Replace the asset-only Preview reference shape with the shared tagged
      asset-file/project-file contract and update callers directly.
- [ ] Add Core-owned safe project-file media resolution and the thin
      authenticated Studio media route.
- [ ] Keep unavailable saved references visible without failing the complete
      inspector.
- [ ] Add historical configuration projection that does not require current
      model catalog membership.
- [ ] Add the authenticated AssetFile generation-request GET route.
- [ ] Keep route behavior limited to parsing, Core delegation, browser URL
      projection, serialization, and structured error translation.
- [ ] Replace MediaCard Edit with the domain-neutral Inspection action directly.
- [ ] Remove all old MediaCard Edit aliases and caller props.
- [ ] Keep `attachGenerationMedia` as the public attachment command.
- [ ] Add the bounded exact-match/image-edit provenance dispatcher.
- [ ] Keep the complete cross-purpose image-edit rule in the focused Core
      module.
- [ ] Enforce the exact source AssetFile and current destination ownership.
- [ ] Use `lookbook_image`/`lookbook_sheet` membership as the sole Lookbook
      authorization and persistence owner.
- [ ] Stop generic Lookbook attachment from creating or requiring
      `project_asset`.
- [ ] Rename all current Location Sheet roles, types, destinations, JSON/resource
      fields, helpers, keys, and durable paths directly.
- [ ] Generate and test the custom one-way Location Sheet migration through
      Drizzle Kit with schema generation 49.
- [ ] Preserve ordinary same-purpose provenance behavior.
- [ ] Make Preview Update `modelFamilyId` optional at transport boundaries.
- [ ] Require a model family for managed Preview Update in Core.
- [ ] Permit omission for external Preview Update in Core.
- [ ] Add all focused structured diagnostics named by this plan.
- [ ] Ensure every invalid attachment fails before any write or file copy.
- [ ] Update public contracts directly with no compatibility shims.
- [ ] Keep durable business rules in Core rather than Studio, CLI, or Skills.

### Inspector Implementation

- [ ] Add the inspector provider, hook, resource loader, dialog, and tests.
- [ ] Use only exact `projectName`, `assetId`, and `assetFileId` as open input.
- [ ] Reuse Prompt, References, and Config shared presentation.
- [ ] Render prompt text read-only without changing its exact value.
- [ ] Render selected references only, with no chooser or toggle.
- [ ] Render available project-file references through the authenticated media
      URL without showing paths or filenames.
- [ ] Render unavailable saved references as quiet unavailable cards.
- [ ] Render config through static composed value surfaces.
- [ ] Render saved retired-model identity and exact authored values.
- [ ] Remove all dropdown, textbox, switch, slider, and disabled-input semantics
      from inspector Config.
- [ ] Use the quiet `Generation Request` title without identifier fallbacks.
- [ ] Add one explicit Close footer action.
- [ ] Preserve standard non-mutating close behavior.
- [ ] Cover loading, error, stale response, focus, tabs, and close behavior.
- [ ] Add the inspection action to the current eligible generated-image cards.
- [ ] Avoid adding invented card labels or raw identifiers.

### Image Revision Removal

- [ ] Delete Core Image Revision client contracts.
- [ ] Delete Core Image Revision source/draft/preview/estimate/run/attachment
      implementation and tests.
- [ ] Remove Core public exports and service wiring unique to revision.
- [ ] Delete Studio revision routes, projections, and route tests.
- [ ] Delete Studio revision browser service.
- [ ] Delete Studio Image Revision feature files and tests.
- [ ] Remove Image Revision provider wiring from the app.
- [ ] Replace all owner-specific revision target construction at card call sites.
- [ ] Replace old integration scenarios with current inspector/agent-edit
      scenarios.
- [ ] Delete the obsolete `image.editOutput` destination union member, registry
      entry, module, and focused tests.
- [ ] Confirm the final usage scan has no surviving `image.editOutput` caller.
- [ ] Do not add compatibility endpoints, aliases, wrappers, or retired-name
      sentinels.

### Agent-Owned Image Edit And Attachment

- [ ] Keep `image.edit` in generation purpose declarations and provider routing.
- [ ] Keep its exact locked source-image slot contract.
- [ ] Support a Renku-managed edit request and receipt.
- [ ] Support a frozen Codex `gpt-image-2` external request and source spec.
- [ ] Validate the exact source AssetFile selected by the request.
- [ ] Require both the selected source Asset and exact AssetFile to be active
      image media before any copy or write.
- [ ] Validate every supported destination against the current ownership matrix.
- [ ] Recognize only `location-sheet` for Location Sheet ownership after the
      one-way conversion.
- [ ] Authorize Lookbook media from exact active membership without a project
      relationship.
- [ ] Reject wrong Cast, Location, Lookbook, role, membership, kind, purpose, or
      target before writes.
- [ ] Require an exact managed run output path.
- [ ] Require a frozen external source spec.
- [ ] Attach accepted output as a new generated asset with accurate provenance.
- [ ] Preserve the original asset, file, relationships, and selected state.
- [ ] Avoid adding new CLI flags or business logic.
- [ ] Add managed and external CLI integration coverage through current media
      import.

### Studio Skills And Agent Surface

- [ ] Update the canonical media-producer `SKILL.md`.
- [ ] Update the canonical production-designer skill and Location Design
      reference to use `locationSheetGuidance` and Location Sheet terminology.
- [ ] Update current workflow and image-prompt references.
- [ ] Update image-edit samples and forward evals.
- [ ] Require exact original AssetFile selection.
- [ ] Require existing Generation Preview before paid/external execution.
- [ ] Require explicit request approval.
- [ ] Require the generated image to be displayed in Codex.
- [ ] Require explicit output acceptance before attachment.
- [ ] Explain how to leave rejected output unattached.
- [ ] Show the destination's real purpose/target at import.
- [ ] Cover both Renku-managed and Codex `gpt-image-2` paths.
- [ ] Avoid editing the installed plugin cache as the source of truth.
- [ ] Run the media-producer prompt-guide validator.

### Tests And Guardrails

- [ ] Add Core managed/external source-request projection tests.
- [ ] Add available/unavailable project-file projection and safe-media resolver
      tests.
- [ ] Add retired-model historical configuration snapshot coverage.
- [ ] Add no-provenance/conflict/missing/mutable structured-failure tests.
- [ ] Add no-write assertions for every invalid attachment class.
- [ ] Add exact source AssetFile tests.
- [ ] Add managed/external non-image and inconsistent Asset/AssetFile media-kind
      failure tests with zero writes.
- [ ] Add ownership-matrix success and failure tests.
- [ ] Add Lookbook membership-only persistence/report tests with zero
      `project_asset` rows.
- [ ] Add the Location Sheet one-way migration regression and current-surface
      no-alias scan.
- [ ] Add source-preservation and new-asset assertions.
- [ ] Add managed/external Preview Update tests.
- [ ] Add Studio route and browser-client tests.
- [ ] Add inspector dialog/provider/resource tests.
- [ ] Add MediaCard Inspection action tests.
- [ ] Update current feature integration tests.
- [ ] Add or update architecture/static tests only for stable boundaries and
      forbidden capabilities.
- [ ] Do not hard-code private implementation names or old APIs in architecture
      tests.
- [ ] Run the shape-review checks listed in Final Verification.

### Documentation

- [ ] Add Decision 0058 with explicit supersession scope.
- [ ] Add Decision 0059 with the single current Location Sheet contract and
      one-way conversion scope.
- [ ] Add short supersession notes to Decisions 0055 and 0057.
- [ ] Update current clauses and add supersession notes to Decisions 0024, 0032,
      0036, 0039, and 0041 where they prescribe retired Location Sheet names.
- [ ] Narrow Decision 0053 from MediaCard Edit to Inspection.
- [ ] Update current media-generation architecture docs.
- [ ] Update caller-handoff and purpose-binding references.
- [ ] Update frontend and MediaCard guidance.
- [ ] Update the product design guidelines so MediaCard action anatomy names
      Inspection rather than the removed Edit action.
- [ ] Update data-model, domain-vocabulary, project-file/storage, CLI, and
      generation references to Location Sheet-only naming.
- [ ] Remove `image.editOutput` and retired Location Sheet paths from
      `project-asset-storage-conventions.md`.
- [ ] Update coordination/test documentation that names the retired workflow.
- [ ] Use the accepted inspector/Preview/image-edit/output-approval terminology.
- [ ] Do not edit completed historical plans for a naming sweep.

### Final Verification

- [ ] Run focused Core, CLI, and Studio tests.
- [ ] Run focused lint, type-check, build, and architecture checks.
- [ ] Run sister-skill validation.
- [ ] Apply and verify the Location Sheet conversion on a temporary project
      copy before the real sample project.
- [ ] Stop project writers, apply the backup-protected migration to
      `urban-basilica`, verify the manifest/counts/paths, then remove retired
      durable directories.
- [ ] Record the Core database backup path, filesystem backup, and before/after
      Location Sheet counts.
- [ ] Run root `pnpm check`.
- [ ] Run root unit and integration tests.
- [ ] Run root build and Studio desktop smoke test.
- [ ] Complete managed and external manual desktop scenarios with explicit live
      cost approval.
- [ ] Verify rejected output remains unattached.
- [ ] Verify accepted output attaches without replacing the source.
- [ ] Verify project-file references and retired-model configuration remain
      inspectable.
- [ ] Verify existing Lookbook media without project relationships can be
      edited/attached and new Lookbook media creates no project relationship.
- [ ] Review `git diff --stat` and the complete diff.
- [ ] Inspect all new or heavily modified files for size, focus, and nesting.
- [ ] Confirm `index.ts` files remain thin entrypoints.
- [ ] Confirm no unrelated formatting churn or build artifacts exist.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [ ] Only then mark the plan complete.
