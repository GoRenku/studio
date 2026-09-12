# 0205 Durable Shot Plan Generation References

Status: implemented
Date: 2026-09-12

## Summary

Register agent-prepared image, video, and audio references as durable Assets
associated with the exact Shot Plan before putting them into a generation
request. Previs references also retain the exact revision. Reuse the current
Asset model, storage allocation, request markers, Preview, and Trash.

The motivating failure is Urban Basilica Scene 02, Shot Plan
`shot_plan_vhrjk7x7`: the continuation request has three real temporary files
that Preview cannot display because they have no active AssetFile registration.

## Review Attention

- New command: `renku shot-plan reference import`, for existing local media,
  including deterministic derivatives. It does not generate or extract media.
- Extend the existing Plan Assets surface to display audio and video references;
  rename its image-only public names and routes directly. This is necessary to
  make the requested registered references findable, rather than merely fixing
  the request dialog.
- Preserve Project ownership plus weak Shot Plan authorship. “Tied to the Plan”
  does not introduce a new AssetOwner variant or cascading revision ownership.
- No database schema change, new generation purpose, Settings, provider gate,
  generation job, dependency graph, or automatic reference import during reads.
- Existing generated-image attachment purposes continue to require truthful
  generation provenance. A locally extracted frame or excerpt is imported
  without fabricated generation provenance.
- Completed local correction copies three files into canonical storage and
  changes only the pending continuation request's matching `$file` values.
  Preserve temporary originals, selected takes, master Previs, and historical
  generation provenance. No deletion or paid generation is included.
- Assumption: the existing weak authorship model is the intended meaning of
  association. Revision deletion does not acquire new cascading behavior.
- User accepted implementation and local repair on 2026-09-12. Both are complete.

## Requirements And Scope

| Requirement | Source | Owner and acceptance |
| --- | --- | --- |
| Persist new references tied to the Previs Shot Plan | Explicit user request | Core import writes Asset, AssetFile, Plan authorship, exact revision |
| Preview the actual selected files | Reported failure | Existing reference resolver receives canonical registered paths; image/video/audio all render |
| Prevent the agent workflow from repeating this omission | User asks whether Skills caused it | Media Producer instructions and forward eval require preparation, registration, then request authoring |
| Make attached references discoverable | Existing Plan Assets product contract | Extend existing References group to all three media kinds |
| Preserve truthful metadata and safe writes | Architecture and integrity rules | No invented provider receipt; transaction and file rollback; path, media, Plan/revision envelope checks |
| Explain unavailable references | Existing structured diagnostics contract and observed silent placeholder | References tab shows authored labels and unavailable state |

Non-goals: reference extraction in Core, creative interpretation, automatic
selection, copying existing Cast/Location/Prop references into each Plan,
provider-specific reference requirements, clip segmentation changes, a lineage
schema, revision-owned folders, and global repair of historical requests.

## Context And Evidence

- `media-producer/references/workflow.md` explicitly demonstrates a temporary
  `$file` reference (`tmp/scratch/reference.png`) before Preview.
- `media-producer/references/shot-plan-video/scene-segmentation.md` tells the
  agent to store excerpts in `tmp/media/` and record source facts, but supplies
  no step to register the chosen derivative before request authoring.
- `media-producer/references/shot-plan-video/blender-previs.md` documents
  revision attachment for output videos, not multimodal input derivatives.
  Both the installed plugin and sister repository contain the relevant gap.
- `packages/core/src/server/media-generation-review/local-media.ts` requires
  an active AssetFile row AND an existing file, both for projection and serving.
  Keep this boundary. Preview must not become an arbitrary temporary-file server.
- `generation/attachment-destinations.ts` and client `media-attachments.ts`
  restrict `shot-plan.video-reference` to images. `generation/attachments.ts`
  requires generation provenance for that Asset type.
- `shot-plan-previs/generation-source.ts` currently accepts a supplied revision
  only for video-generation attachment. The persisted Asset already supports
  `authoredFromShotPlanId` and `previsRevisionId`.
- `shot-plan-image-assets/projection.ts` filters to image media; the React
  collection likewise renders only image files. Fixing registration alone
  would leave audio/video references absent from the Plan Assets tab.
- The request dialog renders unavailable cards with no media or activation;
  diagnostics currently appear only under Configuration.
- Read-only inspection of `continuation-sep12-request.json` found nine markers.
  All nine files exist. The three temporary-reference HTTP endpoints each return
  `CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND`.
- ADR 0088 establishes exact request references, Project-owned Plan reference
  Assets, weak authorship, and the existing grouped Assets tab. Storage conventions
  keep ordinary existing input dependencies at their original destinations.
- Plans 0203 and 0204 are implemented baselines: preserve their segmentation,
  raw take selection, source attribution, and playback behavior. This plan fills
  their derivative-registration gap without rewriting those historical plans.
- Follow AGENTS.md, naming/coding practices, architecture/reference frontend
  guidelines, structured diagnostics, and opaque-artifact ADR 0041.

### Alternatives Considered

1. **Skill changes using unchanged commands:** insufficient. Current reference
   attachment cannot represent an audio/video excerpt and requires generation
   provenance for the image case.
2. **Extend current Asset and Plan Assets owners:** selected. Add a focused
   import operation for prepared references and reuse their durable representation.
3. **Introduce revision-owned reference entities or serve arbitrary tmp paths:**
   unnecessary. Existing authorship and AssetFile storage satisfy this request.

## Contracts And Product Behavior

### Local Reference Import

```bash
renku shot-plan reference import \
  --project urban-basilica \
  --shot-plan shot_plan_vhrjk7x7 \
  --previs-revision <exact-reviewed-revision-id> \
  --source tmp/media/continuation-sep12/selected-clip-last-frame.png \
  --media-kind image \
  --title "Selected Clip 1.3 — final frame" \
  --summary "Extracted frame 286 from the exact selected source Asset/File." \
  --json
```

Public service: `ProjectDataService.importShotPlanReference`.
`ImportShotPlanReferenceInput` contains `projectName?`, `homeDir?`,
`shotPlanId`, `previsRevisionId?`, `sourceProjectRelativePath`,
`mediaKind: 'image' | 'video' | 'audio'`, required authored `title`, and optional
`summary`. `ShotPlanReferenceImportReport` contains `valid: true`, `asset: Asset`,
`resourceKeys: string[]`, and the existing project identity envelope
`{ projectName, id, projectFolder }`. The returned AssetFile path is authoritative.

Core validates the active Plan and exact revision relationship before writes.
For a Previs Plan, the revision is required; for other Plan types it is omitted.
Core validates the safe source path, existing regular file, supported media
envelope, and agreement with the supplied kind using existing file primitives.
No filename inference chooses a Plan or revision. No content analysis is added.

Store a normal Project-owned `shot_plan_video_reference` Asset with the supplied
media kind and exact weak authorship. The existing type names the reference's
video-generation use, not the input's media kind. Store `origin: external` under
the existing non-generation import convention, null generation provenance, and
the authored summary. There is no new origin value or provenance schema.

Use the current Plan root `scenes/<scene>/<NN>-shot-plan/`, the existing external
filename allocator and collision handling, and the existing AssetFile write-set
and transaction rollback. Copy bytes; leave the source intact. Do not register
temporary paths in place. Each explicit import creates an independent Asset;
reuse an already returned Asset on resumption instead of silently deduplicating.

Source Asset/File ids, extraction frame/sample intervals, and derivative time
maps are agent-authored facts in the existing summary. They do not become
runtime-parsed instructions or new relational dependencies. Generated reference
images continue through `renku media import` with exact provider provenance;
extend its existing revision validation to accept Plan reference-image purposes
so those inputs can also retain explicit revision association.

### Plan Assets And Preview

Rename `ShotPlanImageAssets` to `ShotPlanAssets`, with corresponding
`ReadShotPlanAssetsInput`, `DiscardShotPlanAssetInput`, `ShotPlanAssetGroup`,
`readShotPlanAssets`, and `discardShotPlanAsset`. Preserve current four group
roles and ordering. First Frames, Last Frames, and Storyboards remain image-only;
the Reference group permits image/video/audio and is labeled **References**.
The Plan-wide collection contains its associated references across revisions,
consistent with the existing Plan-wide Assets tab; no revision filter is added.

Replace the existing `/screenplay/shot-plans/:shotPlanId/image-assets` routes
with `/screenplay/shot-plans/:shotPlanId/assets` (GET and DELETE `/:assetId`).
Rename the resource key to `surface:shotPlan:<id>:assets`, including all writers,
Trash restore invalidation, service DTOs, and consumers. No alias routes remain.

Reuse MediaCard image preview, video preview, audio playback, and Trash controls.
Imported derivatives have no generation-inspection action because they have no
generation request. References do not become raw video takes or Dialogue Takes.
Neither import nor browsing changes any selection.

Keep the exact ordered `$file`/`reviewLabel`/`promptMention` request contract.
On unavailable cards, show the authored label plus “Reference unavailable.”
Place existing reference diagnostics in References so users need not discover
them under Configuration. Improve the existing Core warning suggestion to cover
registration as well as restoring or replacing a missing file; do not invent a
new missing-file policy. Historical inspection remains readable with warnings.
Preview reads remain side-effect-free and do not auto-import missing Assets.

### Skills Workflow

1. Resolve exact Plan/revision and selected source media as today.
2. Prepare/extract and inspect candidate references in `tmp/media/`.
3. Import each chosen new derivative with `shot-plan reference import`. Reuse
   existing registered inputs directly; do not copy subject sheets into the Plan.
4. Author the request with returned canonical AssetFile paths and the final
   ordered reference labels/mentions. Preserve source facts in the Asset summary.
5. Open Preview and inspect its structured availability result. Resolve an
   unavailable intended input before asking for generation confirmation. Do not
   silently omit it. This is agent workflow guidance, not Engines ownership of
   Project registration or semantic reference eligibility.
6. After confirmation reread the edited request and execute through the existing
   provider workflow. Persist exact submitted canonical paths in output provenance.

## Architecture Shape Gate

- Extend and directly rename Core `server/shot-plan-image-assets/` to
  `server/shot-plan-assets/`: `projection.ts` owns collection projection,
  `discard.ts` owns exact-Plan Trash delegation, and new `reference-import.ts`
  owns the focused import validation and transaction orchestration. `index.ts`
  only exports this bounded API. Client contracts live in `client/shot-plan-assets.ts`.
- Reuse Asset ownership, database access, file persistence/rollback primitives;
  do not route local imports through a fake generated-media request.
- Generalize the existing storage destination `shotPlan.videoReferenceImage` to
  `shotPlan.videoReference`, with the implementation file
  `project-asset-files/destinations/shot-plan-video-reference.ts`. Update its
  current generation/image-edit callers and registry directly. Preserve role
  validation: only the `reference` role accepts audio/video.
- Extract the reusable Plan/revision relationship check inside the existing
  `shot-plan-previs/generation-source.ts`; generation purpose acceptance stays
  in generation attachment validation, while reference import calls the shared
  relationship check. No CLI-local revision policy.
- Add `cli/src/commands/shot-plan-reference-command.ts` as a focused parser and
  service adapter registered by the existing Shot Plan command entrypoint.
- Existing Studio `server/routes/shot-plans.ts` remains a thin projection/Trash
  adapter. No new HTTP import endpoint is needed for this agent-driven workflow.
- Rename frontend collection and hook files to `shot-plan-assets.tsx` and
  `use-shot-plan-assets.ts`; update existing service contracts/API and detail-page
  caller. Keep media-kind presentation in a small three-kind branch using local
  UI primitives, with no ownership decisions in React.
- Limit dialog changes to `media-generation-reference-card.tsx` and
  `media-generation-request-view.tsx`; availability remains a Core projection.
- No new dispatcher is needed. Existing storage registry gets the direct
  destination rename; existing Plan command dispatch gets one focused handler.
- Stop if this requires new Asset ownership tables, a generic dependency graph,
  Core media extraction, provider-specific logic, a broad mutation API, or new
  lifecycle policy. Do not accumulate import logic inside the generation dispatcher.

## Implementation Slices

1. **Core import and storage:** implement the new input/report and import command;
   generalize destination, reuse relation validation, preserve generated-image
   provenance requirements, wire the focused service, and test atomicity.
2. **CLI and collection:** register the import parser; rename and extend the
   existing Plan Assets projection, route, DTO, resource key, React view and hook.
   Trace image/video edit, import and Trash invalidation callers during renames.
3. **Request feedback:** retain availability checks, improve warning suggestion,
   and show unavailable labels/diagnostics in References.
4. **Skills and docs:** update authoring sequence, examples and forward evals in
   the sister repository; deliver through its existing release/install workflow
   when authorized. Do not edit only the installed cache and declare success.
5. **Local correction:** after implementation acceptance and verification, import
   the three exact files below using the confirmed revision. Back up the pending
   request, replace its three marker paths using returned paths, preserve prompt,
   labels, mentions, modality order and configuration, then reopen Preview.

## Urban Basilica Correction

Pending request: `tmp/operations/media-generation/continuation-sep12-request.json`.

| File relative to Project | Kind | Intended association |
| --- | --- | --- |
| `tmp/media/continuation-sep12/selected-clip-last-frame.png` | image | Exact target Plan/revision; source Clip 1.3 final frame |
| `tmp/media/council-h3/speaker-drawing-previs-clip-2.mp4` | video | Exact target Plan/revision; submitted Previs excerpt |
| `tmp/media/continuation-sep12/urban-delivery-reference.wav` | audio | Exact target Plan/revision; source Clip 1.3 delivery excerpt |

Reread source identities and revision through current CLI before correction; do
not infer from a title or assume latest. No database-wide scan, historical
provenance rewrite, temporary cleanup, master replacement, or paid execution.

## Tests And Guardrails

- Core: all three kinds persist exact bytes, active AssetFile, Project ownership,
  Plan/revision authorship, null generation provenance and authored summary.
- Core: missing/invalid Plan or revision, wrong Plan/revision relationship,
  unsupported/mismatched media envelope and unsafe/missing source fail before
  durable writes; collision allocation and rollback preserve source/prior files.
- Core: no take, Dialogue selection, or display selection mutation; projection
  includes the new kinds only in References; discard and restore use current
  Asset lifecycle and refresh the collection; image and video continuation retain
  applicable authorship using existing edit paths.
- Core integration: import each kind, author markers from returned paths, obtain
  available Preview references and served bytes. Historical unavailable markers
  still produce warnings. Generated-image attachments still require provenance.
- CLI: flag parsing, exact Core delegation, report and structured-error rendering.
- HTTP: renamed collection endpoints serialize Core; representative registered
  reference serving works without weakening the active-AssetFile requirement.
- UI: image opens, video plays, audio plays; derivatives lack fake request
  inspection; unavailable card names its input; diagnostics appear in References.
- Skills forward eval: recreate the reported continuation with three derivative
  modalities; prove registration precedes request/Preview and no fictitious
  provider receipt is authored. Add resumption/reuse and existing-sheet cases.
- Keep the invalid-state matrix in Core; adapter tests do not repeat it. Protect
  imports and runtime effects, not source-text private function inventories.

## Documentation

- New ADR: `0099-register-prepared-shot-plan-references.md` (reserve/check next
  number before writing). Narrow ADR 0088's image-only collection scope with a
  short notice linking to the new decision; preserve its original reasoning.
- Update `docs/architecture/project-asset-storage-conventions.md`, current
  data-model/reference docs and CLI help for reference import and multimodal Assets.
- Sister repo: Media Producer `SKILL.md`, `references/workflow.md`,
  `references/shot-plan-video/blender-previs.md`,
  `references/shot-plan-video/scene-segmentation.md`, and Blender
  `references/ai-handoff.md` must teach/link the same registration step.
- Update Media Producer `evals/shot-plan-video/forward-test-cases.md`,
  `segmentation-preparation-review.md`, and executable fixtures relevant to local
  input paths. General workflow examples should use returned registered paths.
- State that temporary preparation precedes durable registration for selected
  inputs; temporary QA/rejected candidates remain temporary.

## Final Verification

Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` in Studio. In the
sister skills repository run `pnpm test:media-generation` and relevant release
tests if release tooling changes (no tooling change is planned). No installation
or paid-provider tests are required for implementation verification.

Verify the active installed runtime and skill versions before the local repair;
source changes alone do not update the plugin already loaded by another task.
At desktop size, inspect the exact pending request: all nine references must be
available; open the new image, play the video and audio, then inspect the Plan
Assets tab and confirm the three registered references are present. Check that
the current selected clip and master Previs remain unchanged.

Review full diff and `git diff --stat`; inspect every large/heavily changed file,
thin indexes, destination/command registration, and absence of formatting churn,
compatibility exports, adapter business logic or unrelated working-tree edits.

## Completion Checklist

### Review And Architecture

- [x] User accepts import command, multimodal Assets surface, weak authorship and local correction scope.
- [x] Core owns registration and relation checks; no schema, ownership or dependency expansion.
- [x] Module layout matches the Shape Gate; indexes and adapters remain thin.
- [x] Directly rename affected image-only contracts/routes without aliases.

### Implementation

- [x] Import image/video/audio with safe copy, exact authorship and rollback.
- [x] Require the exact revision for Previs reference imports.
- [x] Preserve truthful provenance and allow explicit revision on generated reference images.
- [x] Generalize the existing reference storage destination and update its callers.
- [x] Wire CLI import, service report and resource refresh.
- [x] Extend existing References group and its image/video/audio preview controls.
- [x] Preserve first/last-frame and storyboard image-only behavior and take selection.
- [x] Update Trash discard/restore and edit consumers for the renamed resource contract.
- [x] Display unavailable reference labels and diagnostics in the References tab.

### Skills And Documentation

- [x] Registration-before-request is explicit in shared workflow and Previs segmentation guidance.
- [x] Existing registered subject inputs are reused; selected derivatives are imported once.
- [x] Source facts persist in summaries without fabricated generation provenance.
- [x] Forward eval reproduces all three missing-reference modalities and resumption.
- [x] Accepted ADR, storage docs and CLI help reflect the change.
- [x] Installed skill/runtime adoption is verified before declaring the agent workflow fixed.

### Tests And Local Verification

- [x] Core success, boundary failure, collision, rollback, lifecycle and selection tests pass.
- [x] CLI and HTTP delegation/serialization tests pass.
- [x] UI tests cover all three media kinds and unavailable-state feedback.
- [x] Studio root checks and sister skill validation pass; unrelated failures are reported distinctly.
- [x] Back up pending request; import the exact three files with verified revision/source identity.
- [x] Change only pending request marker paths and verify all nine inputs resolve.
- [x] Desktop Preview and Assets tab display/play the three references.
- [x] No source deletion, historical provenance mutation, selection change or paid generation occurred.
- [x] Inspect complete diff, large files and thin indexes; remove unrelated formatting churn.
- [x] No checklist item is satisfied through an unreviewable code structure.

## Execution Evidence

Implemented and verified on 2026-09-12 after explicit user acceptance.
No automatic plan review was run.

- Studio `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` pass.
  The check includes architecture and test type checks. Sister repository
  `pnpm test:media-generation` passes. Forward-evaluation instructions now cover
  the three modalities and resumption; no separate autonomous-agent eval was run.
- The seven changed skill files were updated in the sister source repository and
  copied into the installed local Renku plugin, then verified byte-identical.
  No remote plugin release or release-tooling change was needed. A running task
  that already loaded old instructions must reread the updated guidance.
- Rebuilt the local CLI and restarted Studio to load the updated Core service.
- Imported image `asset_ghx3fphk`, video `asset_8aahtwgn`, and audio
  `asset_uywwzrgy`, associated with Plan `shot_plan_vhrjk7x7` and exact revision
  `previs_revision_gdpsye6c`. Canonical files are in
  `scenes/02/02-shot-plan/`. All copied bytes match their temporary originals.
- Backed up the pending request as
  `tmp/operations/media-generation/continuation-sep12-request-before-reference-registration.json`.
  Verified that only three `$file` values changed in the pending request.
- Preview reports all nine references available and no diagnostics. All nine
  media URLs return HTTP 200 with bytes matching their registered files.
- Desktop verification opened the new image, played the video and audio, and
  confirmed all three appear in the Plan Assets References group.
- Full Previs reads before and after repair are identical. Source files, selected
  clips, master Previs and historical generation provenance are preserved.
- Reviewed the changed module layout, thin entrypoints, direct contract renames,
  and diff. `git diff --check` passes in both repositories. No paid generation,
  schema change, dependency installation, source deletion, or commit occurred.
