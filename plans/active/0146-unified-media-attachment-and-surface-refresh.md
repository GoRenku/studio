# 0146 Unified Media Attachment And Surface Refresh

Status: complete
Date: 2026-07-17

## Summary

Fix the regression where a successful media attachment reaches the running
Studio server but the open browser surface does not refresh because Core emits
an unrecognized resource key.

Implement the string resource-key contract accepted in
`docs/decisions/0054-use-string-resource-keys-for-studio-projection-invalidation.md`:

- one current owner-surface key for each durable attachment;
- no separate `assets:*` keys;
- no nonexistent Cast Design or Location Design surface keys;
- Core mutation reports own project identity and resource keys;
- CLI and Studio server adapters forward Core reports;
- browser features reload through the shared resource-refresh hook.

Remove the duplicated single-image persistence in normal generation attachment
and Image Revision. Keep Scene Beat storyboard, Cast Voice, and Scene Dialogue
Audio persistence specialized because they write different domain records.

## Context

The linked task
`codex://threads/019f6f11-36d7-7b21-87a8-9c992156692e` proved that the durable
attachment and live server notification succeeded. The browser stayed stale
because Core emitted `cast:<id>`, `location:<id>`, or `visual-language`, while
the browser consumed different keys. Scene Dialogue Audio has the same mismatch
with `scene:<id>:dialogue-audio`.

The current attachment and Image Revision implementations also duplicate:

- Asset and Asset File insertion;
- owner-relationship insertion and sort order;
- Lookbook image/sheet membership insertion;
- provenance insertion;
- filesystem rollback;
- relationship id-prefix selection;
- Cast, Location, and Lookbook destination construction;
- resource-key construction.

Accepted constraints:

- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`;
- `docs/decisions/0031-use-studio-server-owned-coordination-delivery.md`;
- `docs/decisions/0044-use-media-generation-module-boundaries.md`;
- `docs/decisions/0054-use-string-resource-keys-for-studio-projection-invalidation.md`;
- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/coding-practices.md`;
- `docs/architecture/naming-guidelines.md`;
- `docs/architecture/reference/front-end-guidelines.md`.

Packages in scope:

- `packages/core`;
- `packages/cli`;
- `packages/studio/server`;
- `packages/studio/src`;
- `packages/studio/e2e`.

Use `$HOME/renku-movies/urban-basilica` only for read-only contract inspection
and manual verification against a disposable copy or fixture.

## Fixed Scope

### Attachment resource keys

| Workflow | Required resource keys |
| --- | --- |
| `lookbook.image` | `surface:visual-language:lookbook:<lookbookId>` |
| `lookbook.video-sheet` | `surface:visual-language:lookbook:<lookbookId>` |
| `lookbook.storyboard-sheet` | `surface:visual-language:lookbook:<lookbookId>` |
| `cast.character-sheet` | `surface:castMember:<castMemberId>` |
| `cast.profile` | `surface:castMember:<castMemberId>` |
| `location.sheet` | `surface:location:<locationId>` |
| `location.hero` | `surface:location:<locationId>` |
| `scene.storyboard-sheet` | `surface:scene:<sceneId>:beats` |
| `cast.voice-sample` attachment/removal/registration | `surface:castMember:<castMemberId>` |
| `scene.dialogue-audio` | `surface:scene:<sceneId>:dialogue-audio` |
| Cast Character Sheet Image Revision | `surface:castMember:<castMemberId>` |
| Location Sheet Image Revision | `surface:location:<locationId>` |
| Lookbook image/sheet Image Revision | `surface:visual-language:lookbook:<lookbookId>` |

Ordinary `image.create` and `image.edit` run outputs are not project
attachments. They emit no project-resource refresh until an owning workflow
persists an attachment.

### Removals

Remove these resource-key forms from production producers, consumers, and Core
package exports:

- `assets:list`;
- `assets:project`;
- `assets:castMember:<id>`;
- `assets:location:<id>`;
- `assets:sequence:<id>`;
- `assets:scene:<id>`;
- `surface:castDesign:<id>`;
- `surface:locationDesign:<id>`;
- attachment literals `cast:<id>`, `location:<id>`, and `visual-language`;
- Dialogue Audio literal `scene:<id>:dialogue-audio`.

Remove the unused Cast Design browser resource path. Preserve Cast Design
documents, commands, database access, and `readCastContext`.

Remove the unused `REFERENCE_IMAGE_MEDIA_PURPOSE` and
`ReferenceImageMediaImportReport` client contracts and their package-entrypoint
exports. No command or Core attachment implementation consumes them;
`reference.image` is not a current generation or attachment workflow.

### Out of scope

- provider execution and generation estimates;
- prompt, reference, and creative-artifact contracts;
- generation-purpose or Asset-role renaming;
- database schema changes or migrations;
- automatic attachment of ordinary generation outputs;
- mobile behavior;
- unrelated resource-key renaming;
- a new cache, event type, notifier, browser store, or compatibility layer.

## Architecture Shape Gate

### Ownership

- Core generation code owns attachment validation and persistence.
- Core Studio coordination code owns resource-key construction.
- Core mutation commands return project-aware reports with resource keys.
- CLI handlers parse arguments, call Core, and pass successful mutation reports
  to the existing notifier.
- Studio server routes call Core and serialize Core responses.
- the shared Studio resource-refresh hook owns browser event listening and
  project filtering.
- mounted feature panels own API reloads.

### Module shape

```text
packages/core/src/server/generation/
  attachment-destinations.ts
  attachment-persistence.ts
  attachment-persistence.test.ts
  attachments.ts
  attachments.test.ts
  scene-storyboard-attachments.ts

packages/core/src/server/image-revision-workflow/
  attachment.ts
  service.test.ts

packages/core/src/server/studio-coordination/
  resource-keys.ts
  resource-keys.test.ts
```

No new `index.ts` is added. The two new attachment modules are internal Core
modules and are not exported from `packages/core/src/server/index.ts`.

### Destination contract

`attachment-destinations.ts` owns this internal contract:

```ts
interface GeneratedMediaAttachmentDestination {
  file: ProjectAssetFileDestination;
  target: AssetTarget;
  lookbookMembership?: {
    kind: 'image' | 'sheet';
    lookbookId: string;
  };
  resourceKeys: string[];
}
```

It exports only these internal factories:

- `castCharacterSheetAttachmentDestination`;
- `castProfileAttachmentDestination`;
- `locationSheetAttachmentDestination`;
- `locationHeroAttachmentDestination`;
- `lookbookImageAttachmentDestination`;
- `lookbookSheetAttachmentDestination`.

Each factory accepts only its owner id and optional file-title hint. It
constructs the current file destination, relationship target, optional
Lookbook membership, and ADR 0054 resource key. Relationship and file roles do
not belong to the destination: normal attachment selects its purpose-owned
roles, while Image Revision preserves the validated source role. The factories
perform no database or filesystem work.

### Persistence contract

`attachment-persistence.ts` owns these internal contracts:

```ts
interface PersistGeneratedMediaAttachmentInput {
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
  now: string;
  sourceProjectRelativePath: string;
  destination: GeneratedMediaAttachmentDestination;
  asset: {
    type: string;
    mediaKind: 'image' | 'audio' | 'video';
    title: string;
    oneLineSummary?: string;
    origin: string;
  };
  fileRole: string;
  relationshipRole: string;
  provenanceReceipt?: unknown;
}

interface PersistedGeneratedMediaAttachment {
  assetId: string;
  assetFileId: string;
  relationshipId: string;
  ownerRecord?: {
    kind: 'lookbookImage' | 'lookbookSheet';
    id: string;
  };
}

function persistGeneratedMediaAttachment(
  input: PersistGeneratedMediaAttachmentInput
): PersistedGeneratedMediaAttachment
```

The function owns one database transaction plus the project-file write set. It
allocates the Asset, Asset File, relationship, and optional Lookbook membership
ids; derives the relationship id prefix from `destination.target`; inserts the
Asset, Asset File, relationship, optional Lookbook membership, and optional
provenance; and rolls back copied files when the transaction fails.

It contains no purpose switch, target switch, provider logic, resource-key
construction, public report formatting, or notification delivery.

### Caller responsibilities

`generation/attachments.ts`:

- validates normal purpose, target, Lookbook kind, and provenance;
- selects one destination factory plus the purpose-owned Asset metadata,
  relationship role, and `primary` file role;
- calls `persistGeneratedMediaAttachment`;
- reads the persisted relationship and project identity;
- returns `GenerationMediaAttachmentReport`.

`image-revision-workflow/attachment.ts`:

- validates revision target and source-owner role;
- selects one destination factory;
- preserves source Asset type, title, summary, and relationship role;
- uses the validated source role for both file and relationship roles;
- calls `persistGeneratedMediaAttachment`;
- returns imported ids and destination resource keys.

`scene-storyboard-attachments.ts` remains a separate atomic batch write because
it inserts multiple Assets and per-Beat storyboard records.

Cast Voice and Scene Dialogue Audio remain in their current owning Core modules.

### Files that must shrink or disappear

- `generation/attachments.ts` loses shared transaction, destination, and
  relationship-prefix implementation.
- `image-revision-workflow/attachment.ts` loses all duplicated persistence and
  relationship-prefix implementation.
- `media-import-command-handlers.ts` loses the unused
  `listMediaImportPurposeHandlers()` inventory.
- `use-studio-coordination.ts` loses the no-op Cast design invalidation pass and
  key parser.
- the unused Cast Design browser projection is removed from:
  - `packages/core/src/client/resources.ts`;
  - `packages/core/src/client/index.ts`;
  - `packages/core/src/server/resources/cast-design.ts`;
  - `packages/core/src/server/project-data-service-contracts.ts`;
  - `packages/core/src/server/project-data-service-wiring/design-resources.ts`;
  - `packages/core/src/server/index.ts`;
  - `packages/studio/server/routes/navigation.ts`;
  - `packages/studio/server/routes/projects.ts`;
  - `packages/studio/server/testing/fake-project-data-service.ts`;
  - `packages/studio/src/services/studio-project-contracts.ts`;
  - `packages/studio/src/services/studio-project-assets-api.ts`.
- E2E page objects lose manual `renku:studio-resource-changed` dispatch helpers.

### Forbidden implementation shapes

- no per-purpose attachment files or destination registry;
- no public generic attachment write API;
- no purpose or provider branches in attachment persistence;
- no database writes in destination factories;
- no resource-key literals in CLI or Studio server adapters;
- no browser compatibility matching for removed keys;
- no broad project refresh fallback;
- no second notification path or feature-owned browser event listener;
- no source-text architecture tests that inventory private helpers;
- no changes to unrelated dirty workspace files.

Stop implementation if either new attachment module starts owning more than its
responsibility above or if a removed key is retained to avoid updating a caller.

## Contracts

### Core resource-key catalog

Remove:

- `studioAssetResourceKey`;
- `studioCastMemberAssetsResourceKey`;
- `studioLocationAssetsResourceKey`;
- `studioSurfaceResourceKeyForAssetTarget`;
- `studioResourceKeysForAssetTarget`;
- `studioCastDesignResourceKey`;
- `studioLocationDesignResourceKey`.

Add as Core-internal module exports, not package entrypoint exports:

```ts
studioAssetTargetSurfaceResourceKeys(target: AssetTarget): string[]
studioSceneDialogueAudioSurfaceResourceKey(sceneId: string): string
```

`studioAssetTargetSurfaceResourceKeys` returns:

- Cast Member target: `[studioCastMemberSurfaceResourceKey(castMemberId)]`;
- Location target: `[studioLocationSurfaceResourceKey(locationId)]`;
- project, Sequence, and Scene targets: `[]`.

Lookbook and Scene Beat attachment code uses the exact existing Lookbook and
Scene Beats builders because `AssetTarget` does not identify those projections.

The trash `assetRelationship` definition reconstructs its `AssetTarget` from
the stored owner kind and id, then calls this mapper for discard and restore.
The standalone `asset` trash definition returns no resource key. No
`assets:list` literal remains.

### Core Asset mutation reports

Add to `packages/core/src/client/assets.ts`:

```ts
interface AssetReferenceUpdateReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    id: string;
    name: string;
    projectFolder: string;
  };
  asset: Asset;
  resourceKeys: string[];
}

interface DisplayAssetMutationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    id: string;
    name: string;
    projectFolder: string;
  };
  asset: Asset | null;
  resourceKeys: string[];
}
```

Export both report types from the intentional Core client and server package
entrypoints. Remove `REFERENCE_IMAGE_MEDIA_PURPOSE` and
`ReferenceImageMediaImportReport` from those same entrypoints.

Change project data service methods:

- `updateAssetReference` returns `AssetReferenceUpdateReport`;
- `setCastProfileDisplayAsset` returns `DisplayAssetMutationReport`;
- `clearCastProfileDisplayAsset` returns `DisplayAssetMutationReport` with
  `asset: null`;
- `setLocationHeroDisplayAsset` returns `DisplayAssetMutationReport`;
- `clearLocationHeroDisplayAsset` returns `DisplayAssetMutationReport` with
  `asset: null`;
- `discardAsset` preserves its current recoverable report shape but replaces
  its dead `assets:list` key with the owner surface keys.

The CLI `asset reference-update` command passes the Core report directly to the
existing notifier and removes its additional project-shell read. Its public
JSON remains `{ asset, resourceKeys, warnings }`; `CLI045` remains a CLI-owned
warning appended during output formatting.

Studio Asset routes use these fixed responses:

- display-asset `POST` and `DELETE` return `DisplayAssetMutationReport`
  unchanged;
- Asset relationship `DELETE` returns `RecoverableMutationReport` unchanged.

Studio client adapters preserve their feature-facing return values: setters
return `report.asset`, clear operations return `void`, and delete operations
return the requested Asset id after a successful report. Routes and client
adapters do not derive resource keys.

### Browser matching

Update the shared matcher module:

- Cast overview and detail match `navigation:cast` and current Cast Member
  surfaces only;
- Location overview and detail match `navigation:locations` and current
  Location surfaces only;
- Lookbook matching uses the general Lookbook collection key or the exact
  current Lookbook id; it does not match every Lookbook prefix;
- Scene Beats, Sequence storyboard, and Act storyboard recognize the affected
  `surface:scene:<sceneId>:beats` key;
- Scene Dialogue Audio recognizes
  `surface:scene:<sceneId>:dialogue-audio`;
- no matcher accepts removed `assets:*`, Cast/Location design surfaces, or
  abbreviated attachment keys.

## Implementation Slices

### Slice 1: Resource-key contract and regression tests

Files:

- `packages/core/src/server/studio-coordination/resource-keys.ts`;
- `packages/core/src/server/studio-coordination/resource-keys.test.ts`;
- `packages/core/src/server/studio-coordination/index.ts`;
- `packages/core/src/server/index.ts`;
- add `packages/core/src/server/generation/attachments.test.ts`;
- add `packages/core/src/server/generation/scene-storyboard-attachments.test.ts`;
- `packages/core/src/server/image-revision-workflow/service.test.ts`;
- `packages/core/src/server/commands/cast-voice-commands.test.ts`;
- `packages/core/src/server/commands/department-design-commands.test.ts`;
- add `packages/core/src/server/scene-dialogue-audio-workspace/context.test.ts`.

Work:

1. Add failing report-key tests for every workflow in the Fixed Scope table.
2. Add the two new internal builders.
3. Remove obsolete builders and package exports.
4. Make Cast and Location design-document commands return navigation plus the
   real owner surface, without design-surface keys.
5. Update all Core producers directly.

### Slice 2: Shared single-image persistence

Files:

- add `generation/attachment-destinations.ts`;
- add `generation/attachment-persistence.ts`;
- add `generation/attachment-persistence.test.ts`;
- update `generation/attachments.ts`;
- update `image-revision-workflow/attachment.ts`.

Work:

1. Implement the six fixed destination factories.
2. Implement `persistGeneratedMediaAttachment` exactly as specified.
3. Migrate normal attachment to the shared modules.
4. Migrate Image Revision to the shared modules.
5. Delete duplicated persistence, destination, rollback, and id-prefix code.
6. Cover successful Cast, Location, and Lookbook writes plus transaction/file
   rollback.

### Slice 3: Specialized producers and Core mutation reports

Files:

- `generation/scene-storyboard-attachments.ts`;
- `commands/cast-voice-commands.ts`;
- `scene-dialogue-audio-workspace/context.ts`;
- `trash/trash-object-registry.ts`;
- `client/assets.ts`;
- `client/index.ts`;
- `commands/update-asset-reference.ts`;
- `commands/display-asset-commands.ts`;
- `commands/discard-asset.ts`;
- `project-data-service-contracts.ts`;
- `project-data-service-wiring/assets.ts`;
- add `commands/update-asset-reference.test.ts`;
- `commands/display-asset-commands.test.ts`;
- add `commands/discard-asset.test.ts`.

Work:

1. Return the fixed Scene Beats key from storyboard attachment.
2. Return the Cast Member surface from Cast Voice writes and restoration.
3. Return the fixed Dialogue Audio surface key.
4. Implement the two Asset mutation reports.
5. Move project identity and owner-surface key construction into Core commands.
6. Update every project data service caller to the new return shapes.

### Slice 4: Browser and server cleanup

Files:

- `packages/studio/src/hooks/use-studio-resource-refresh.ts`;
- `packages/studio/src/hooks/use-studio-resource-refresh.test.ts`;
- `packages/studio/src/features/movie-studio/cast/cast-member-panel.test.tsx`;
- `packages/studio/src/features/movie-studio/cast/cast-overview-panel.test.tsx`;
- `packages/studio/src/features/movie-studio/locations/location-panel.test.tsx`;
- `packages/studio/src/features/movie-studio/visual-language/lookbook-panel.test.tsx`;
- `packages/studio/src/features/movie-studio/scenes/scene-panel.test.tsx`;
- `packages/studio/src/features/movie-studio/sequences/sequence-panel.test.tsx`;
- `packages/studio/src/features/movie-studio/acts/act-storyboard-panel.test.tsx`;
- `packages/studio/src/app/use-studio-coordination.ts`;
- `packages/studio/src/services/studio-project-assets-api.ts`;
- `packages/studio/server/routes/assets.ts`;
- `packages/studio/server/routes/assets.test.ts`;
- every Cast Design browser projection file listed in the Architecture Shape
  Gate.

Work:

1. Update matchers to the fixed contract.
2. Scope Lookbook matching to the current Lookbook id.
3. Remove the no-op invalidation pass.
4. Remove the Cast Design browser projection end to end.
5. Make Asset routes serialize Core-owned reports.
6. Update server fakes and route tests directly.

### Slice 5: CLI and production-path E2E

Files:

- `packages/cli/src/commands/asset-command.ts`;
- add `packages/cli/src/commands/asset-command.test.ts`;
- `packages/cli/src/commands/media-import-command-handlers.ts`;
- `packages/cli/src/commands/media-import-command-handlers.test.ts`;
- `packages/cli/src/commands/studio-resource-event-command.test.ts`;
- `packages/cli/tests/integration/cli-workflows.test.ts`;
- `packages/studio/package.json`;
- add `packages/studio/e2e/fixtures/studio-e2e-cli.ts`;
- `packages/studio/e2e/fixtures/studio-e2e-project.ts`;
- `packages/studio/e2e/tests/regression/media-and-trash.regression.spec.ts`;
- `packages/studio/e2e/tests/smoke/media-card-surface.smoke.spec.ts`;
- `packages/studio/e2e/pages/media-surface-page.ts`;
- `packages/studio/e2e/pages/movie-studio-page.ts`.

Work:

1. Remove `listMediaImportPurposeHandlers()`.
2. Keep the single Scene Storyboard document branch; route every other visual
   media import through `attachGenerationMedia`.
3. Use Core Asset mutation reports directly in the CLI.
4. Assert successful mutations notify the live server exactly once.
5. Add the CLI package to Studio E2E dependency builds.
6. Add `studio-e2e-cli.ts`, which runs
   `packages/cli/dist/cli.js media import --json` with `process.execPath`, the
   test home, and the current project, purpose, target, source, and title.
7. Replace `importAdditionalCastProfileImage` and
   `importAdditionalLocationSheet` with `writeStudioE2eImageSource`, which only
   writes the supplied project-relative PNG source inside the E2E project.
8. Replace both manual Core attachment plus browser event dispatch cases with
   the real CLI while their target surfaces remain open.
9. Assert the new Cast and Location media appear without browser reload or
   route navigation.

### Slice 6: Current documentation

File:

- `docs/architecture/reference/studio-coordination-events.md`.

Work:

1. Replace retired resource-key examples with ADR 0054 keys.
2. Document the attachment matrix and production delivery path.
3. Do not edit historical plans.

## Tests And Guardrails

### Required behavior tests

- every normal attachment purpose returns its exact fixed key;
- normal attachment and Image Revision return the same key for the same owner;
- Scene Storyboard attachment returns only the Scene Beats key;
- Cast Voice attachment/removal/registration returns the Cast Member key;
- Dialogue Audio returns its prefixed surface key;
- generic project, Sequence, and Scene Asset mutations return no invented asset
  key;
- shared persistence writes Asset, file, relationship, Lookbook membership, and
  provenance correctly;
- failed persistence leaves no database rows or copied files;
- Image Revision preserves source metadata and relationship role;
- Asset update/display/discard reports contain project identity and Core-owned
  keys;
- Studio routes return those Core report keys unchanged;
- browser matchers reject all removed keys;
- the exact Lookbook matcher does not refresh an unrelated Lookbook;
- Scene, Sequence, and Act storyboard projections refresh for the affected
  scene;
- CLI notification retains missing-runtime no-op and `CLI026` warning behavior.

### Required E2E behavior

The desktop Playwright cases must:

1. open a current owner Assets surface;
2. run the real CLI attachment command;
3. use the running Studio server notification endpoint and browser polling;
4. show the new Cast and Location media without `page.reload()`, route
   navigation, or a test-authored browser event.

Core tests cover every attachment purpose. The two existing Cast and Location
live-refresh cases exercise the production CLI/server/browser path.

### Architecture guardrails

- exact key strings are tested as public coordination contracts;
- no permanent source-text tests inventory private factory names or purpose
  lists;
- Core public entrypoints do not export the new persistence modules or internal
  builders;
- CLI and Studio server production code contain no attachment-key literals;
- only the shared browser hook installs the production resource-change listener;
- every remaining key touched by this plan has a current producer and matcher;
- no compatibility aliases, fallback reloads, or duplicate notifiers remain.

## Final Verification

Focused tests:

```bash
pnpm --dir packages/core exec vitest run \
  src/server/generation/attachments.test.ts \
  src/server/generation/attachment-persistence.test.ts \
  src/server/generation/scene-storyboard-attachments.test.ts \
  src/server/image-revision-workflow/service.test.ts \
  src/server/commands/cast-voice-commands.test.ts \
  src/server/commands/department-design-commands.test.ts \
  src/server/commands/update-asset-reference.test.ts \
  src/server/commands/display-asset-commands.test.ts \
  src/server/commands/discard-asset.test.ts \
  src/server/scene-dialogue-audio-workspace/context.test.ts \
  src/server/studio-coordination/resource-keys.test.ts

pnpm --dir packages/cli exec vitest run \
  src/commands/asset-command.test.ts \
  src/commands/media-import-command-handlers.test.ts \
  src/commands/studio-resource-event-command.test.ts

pnpm --dir packages/studio exec vitest run \
  src/hooks/use-studio-resource-refresh.test.ts \
  src/features/movie-studio/cast/cast-member-panel.test.tsx \
  src/features/movie-studio/cast/cast-overview-panel.test.tsx \
  src/features/movie-studio/locations/location-panel.test.tsx \
  src/features/movie-studio/visual-language/lookbook-panel.test.tsx \
  src/features/movie-studio/scenes/scene-panel.test.tsx \
  src/features/movie-studio/sequences/sequence-panel.test.tsx \
  src/features/movie-studio/acts/act-storyboard-panel.test.tsx

pnpm --dir packages/studio exec playwright test \
  e2e/tests/regression/media-and-trash.regression.spec.ts \
  --project=chromium-regression

pnpm --dir packages/studio exec playwright test \
  e2e/tests/smoke/media-card-surface.smoke.spec.ts \
  --project=chromium-smoke
```

Package and root verification:

```bash
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm test:integration
pnpm check
pnpm test
pnpm test:e2e:studio:smoke
```

Contract scans:

```bash
rg -n "assets:list|assets:castMember|assets:location|assets:project|assets:sequence|assets:scene|surface:castDesign|surface:locationDesign" \
  packages/core/src packages/cli/src packages/studio/src packages/studio/server

rg -n "listMediaImportPurposeHandlers|invalidateCastDesignResource|readCastDesignResource" \
  packages/core packages/cli packages/studio

rg -n "renku:studio-resource-changed" packages/studio/src packages/studio/e2e

git diff --stat
git diff --check
git diff -- plans/active/0146-unified-media-attachment-and-surface-refresh.md \
  docs packages/core packages/cli packages/studio
```

Architecture review:

- inspect the complete diff;
- confirm `attachments.ts` and Image Revision `attachment.ts` shrank;
- confirm attachment persistence has no purpose/target/resource-key switch;
- confirm destination factories have no persistence;
- confirm Scene Storyboard remains one atomic batch;
- confirm Core and coordination `index.ts` files remain thin;
- confirm no broad registry, cache, facade, compatibility path, or fallback
  refresh was introduced.

## Completion Checklist

### Review Area

- [x] Preserve the ownership boundaries in the Architecture Shape Gate.
- [x] Match the exact fixed module and contract shape.
- [x] Keep centralized persistence focused and non-monolithic.
- [x] Add no broad dispatcher, registry, facade, or god file.
- [x] Keep unrelated user workspace changes untouched.

### Resource-Key Contract

- [x] Add the two fixed internal builders.
- [x] Remove every listed obsolete builder, key, matcher, and package export.
- [x] Remove the unused `reference.image` client contract and exports.
- [x] Update all producers and consumers directly with no aliases.
- [x] Return one exact owner-surface key per attachment.
- [x] Return no generic asset key for project, Sequence, or Scene targets.
- [x] Replace Cast/Location design-surface keys with their owner surfaces.
- [x] Keep resource-key construction in Core.

### Shared Attachment Persistence

- [x] Add the six destination factories.
- [x] Add the single internal persistence function.
- [x] Share Asset, file, relationship, Lookbook membership, provenance, and
      rollback behavior.
- [x] Migrate normal attachment and Image Revision.
- [x] Delete duplicated persistence and destination logic.
- [x] Preserve normal validation and Image Revision source-role validation.
- [x] Keep Scene Storyboard, Cast Voice, and Dialogue Audio specialized.

### Core Mutation Reports

- [x] Add `AssetReferenceUpdateReport`.
- [x] Add `DisplayAssetMutationReport`.
- [x] Return project identity and keys from Core commands.
- [x] Update project data service contracts and callers directly.
- [x] Make `discardAsset` return owner-surface keys.
- [x] Remove CLI and Studio route post-mutation key derivation.

### Browser And Dead-Code Cleanup

- [x] Update Cast, Location, Lookbook, Scene, Act, Sequence, and Dialogue Audio
      matchers.
- [x] Remove the no-op Cast invalidation pass.
- [x] Remove the Cast Design browser projection end to end.
- [x] Preserve Cast Design documents, commands, and `readCastContext`.
- [x] Remove manual E2E event publishing helpers.
- [x] Keep the shared hook as the only production event listener.

### CLI And Delivery

- [x] Remove the unused media-import purpose inventory.
- [x] Preserve only the justified Scene Storyboard import branch.
- [x] Notify the running server exactly once after successful mutation.
- [x] Preserve missing-runtime no-op and `CLI026` behavior.
- [x] Exercise the real CLI/server/browser path in Playwright.
- [x] Prove Cast and Location attachments appear without browser refresh.

### Tests And Documentation

- [x] Add every required Core behavior test.
- [x] Add persistence rollback coverage.
- [x] Update CLI, server, matcher, feature, and E2E tests.
- [x] Avoid private-name and complete-inventory architecture tests.
- [x] Update current coordination references to ADR 0054.

### Final Verification

- [x] Run all focused commands.
- [x] Run package tests and integration tests.
- [x] Run `pnpm check`, `pnpm test`, and Studio smoke E2E.
- [x] Run all contract scans.
- [x] Review `git diff --stat`, `git diff --check`, and the complete diff.
- [x] Inspect every new or heavily modified file.
- [x] Confirm internal modules are not public exports.
- [x] Confirm no removed key or duplicate attachment path remains.
- [x] Confirm no checklist item was satisfied with unreviewable code structure.
- [x] Only then mark this plan complete.
