# 0147 Preserve Codex Generation Specs On Images

Status: Implemented
Date: 2026-07-17

## Summary

Save the ordinary `GenerationSpec` used for a Codex-built-in image generation,
link the generated AssetFile to that saved spec, and show the saved request when
the user opens Image Revision for the image.

The complete product flow is:

1. The agent saves a normal `GenerationSpec` before calling Codex image
   generation.
2. The spec says that execution is agent-external and stores the actual provider
   and model used. The current workflow uses `codex` and `gpt-image-2`, but Core
   does not hardcode or allowlist that pair.
3. The agent generates the image and imports it with the saved spec id.
4. Core records the spec id on the generated AssetFile.
5. When the user opens Image Revision, Studio shows the original prompt, values,
   references, provider, and model from that saved spec.
6. The user may edit the image through the existing Renku-managed `image.edit`
   workflow. The current image is the source image, and the user chooses a
   Renku-supported model, prompt, and settings exactly as they do for any other
   image edit.

Nothing else is added.

## Scope

This plan includes only:

- one execution-kind field on `GenerationSpec` so Core can distinguish a
  Renku-managed request from an agent-external request;
- ordinary GenerationSpec persistence for agent-external requests;
- an optional source-spec id on the existing generated-image attachment command;
- a GenerationSpec link on the AssetFile;
- read-only display of that source request in Image Revision;
- the existing Renku-managed Image Revision Edit flow using the current image as
  its source;
- a headless CLI path so the agent can save, preview, generate, and attach even
  when Studio is not running;
- the corresponding `renku:media-producer` workflow update.

This plan does not include:

- a GenerationRun, receipt, estimate, approval token, cost, or fake output record
  for Codex execution;
- a Codex execution adapter in Engines;
- a generic external-executor framework, registry, discovery API, callback, or
  availability service;
- hardcoded Codex provider/model validation in Core;
- an external Regenerate or Save Request action in Image Revision;
- automatic Codex execution from Studio;
- image-copy behavior or generation-source copying;
- hashes, spec revision tokens, reference digests, pixel inspection, or checks
  attempting to prove that the image matches the saved spec;
- new attachment destinations;
- derivative lineage for storyboard crops or other transformed files;
- changes to audio or video generation;
- mobile work.

## Context

This change preserves the accepted separation between request authoring,
execution, and attachment:

- `GenerationSpec` is the saved request.
- A Renku-managed request may create a GenerationRun.
- A Codex request is executed by the agent and creates no Renku GenerationRun.
- An AssetFile may still record which saved request produced it.

Relevant current decisions:

- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`;
- `docs/decisions/0040-use-agent-media-execution-policy-for-external-built-in-image-generation.md`;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/decisions/0051-keep-generation-authoring-incomplete-and-reference-slots-agent-directed.md`.

Decision 0040 already keeps Codex execution outside Engines. Decision 0047
currently says an external attachment has no saved spec provenance, so a small
new ADR must narrow only that statement.

## Architecture Shape Gate

Implementation must keep this change inside the existing owners. No new
framework, registry, or broad dispatcher is needed.

### Core ownership

`packages/core/src/client/generation.ts` owns the saved request contract.

Add one required field to `GenerationSpec`:

```ts
executionKind: "renku-managed" | "agent-external";
```

Keep the existing `model?: GenerationModelIdentity` field unchanged. It stores
the provider and model for either execution kind. Core stores arbitrary authored
provider/model strings and does not special-case `codex` or `gpt-image-2`.

The existing generation modules remain the owners:

- `packages/core/src/server/generation/specs.ts` saves both execution kinds using
  the existing create/update/read/list commands;
- `packages/core/src/server/generation/previews.ts` builds a readable Preview for
  an external spec without asking Engines to assemble a provider payload;
- `packages/core/src/server/generation/estimates.ts` and `runs.ts` remain
  Renku-managed only and return a structured error if called with an
  agent-external spec;
- `packages/core/src/server/generation/attachments.ts` accepts an optional
  `sourceSpecId`, checks that it names an agent-external spec for the same purpose
  and target, and links it to the new AssetFile.

No new provider registry, execution service, or purpose dispatcher is allowed.

### AssetFile ownership

`packages/core/src/server/schema/assets.ts` adds one nullable source spec id to
the existing AssetFile row. The attachment transaction writes that id directly.
The existing managed-run provenance table remains unchanged. No snapshot,
second table, or image-copy behavior is added.

### Image Revision ownership

Keep the existing bounded workflow under:

- `packages/core/src/server/image-revision-workflow/source.ts` reads either the
  managed run snapshot or the external saved spec;
- `packages/core/src/server/image-revision-workflow/draft.ts` continues to create
  an ordinary Renku-managed `image.edit` spec with the current AssetFile as its
  source reference;
- `packages/core/src/server/image-revision-workflow/service.ts` exposes the saved
  source request alongside the existing Edit context;
- `packages/core/src/client/image-revision-workflow.ts` owns that resource shape.

Image Revision must not execute Codex, create an external Save Request action,
or reinterpret the original external values as Renku model settings. The saved
Codex request is read-only context. The editable request remains the existing
Renku-managed `image.edit` request.

### CLI, Studio, and skill ownership

- `packages/cli` adds `--source-spec <spec-id>` to the existing direct generated
  image import path and returns Preview data even when Studio is not running.
- `packages/studio` only renders the source request and continues to send normal
  Image Revision Edit intent to Core.
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/`
  creates the external spec before invoking Codex, records the actual
  provider/model identity used, and attaches the result with `--source-spec`.

### Public entrypoints

Use the existing public entrypoints:

- generation spec create/update/show/list;
- generation preview show;
- generation media attachment/import;
- Image Revision context, preview, estimate, and run.

Only `sourceSpecId` and the new read-only source-request projection are added.
Do not add a Codex-specific command or a second Image Revision service.

### Forbidden implementation shape

Stop and revise the plan if implementation starts adding:

- a Codex or external provider branch to Engines;
- a generic executor interface or registry;
- fake run, receipt, estimate, cost, approval, or output data;
- prompt or image content validation;
- hashes or revision-matching machinery;
- a new external Regenerate/Save Request workflow;
- a new source-copy workflow;
- purpose-specific copies of the same external attachment logic;
- business rules in CLI, Studio routes, or React components;
- a broad switchboard in `packages/core/src/server/index.ts` or project-data
  service wiring.

`packages/core/src/server/index.ts` must remain a thin public entrypoint.

## Contracts

### GenerationSpec

The current provider/model shape remains intact:

```ts
export interface GenerationSpec {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  executionKind: "renku-managed" | "agent-external";
  model?: GenerationModelIdentity;
  values: Record<string, JsonValue>;
  references: GenerationReferenceSelection[];
  title?: string;
}
```

Examples:

```json
{
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_member_1" },
  "executionKind": "agent-external",
  "model": { "provider": "codex", "model": "gpt-image-2" },
  "values": { "prompt": "Create a quiet natural-light portrait." },
  "references": []
}
```

`codex` and `gpt-image-2` are example data written by the current agent workflow,
not Core constants and not validation rules.

Spec create and update keep their current structural validation. Core does not
inspect prompt wording, invent values, or validate an external model against the
Engines catalog.

### Preview behavior

For `agent-external` specs:

- Preview returns the saved prompt, values, and ordered references;
- Preview may apply the existing purpose-owned deterministic preparation used by
  that purpose;
- Preview does not return an Engines provider payload, price, or Run action;
- `generation preview show --json` returns the Preview to the caller whether or
  not Studio is running;
- if Studio is running, the same command may also deliver the Preview to Studio.

There is no informational warning merely because execution is agent-external.

### Attachment input and persistence

The existing direct generated-image attachment input gains:

```ts
sourceSpecId?: string;
```

`receipt` and `sourceSpecId` are mutually exclusive.

When `sourceSpecId` is supplied, Core checks only what is needed to maintain the
relationship:

- the spec exists in the same project;
- `executionKind` is `agent-external`;
- its purpose and target match the focused attachment command.

The normal attachment path continues to validate the image file and destination.
Core does not revalidate the external provider request or attempt to prove that
the pixels match the spec.

The new AssetFile stores only the external GenerationSpec id. The existing
`asset_file_generation` table remains unchanged for Renku-managed runs. An
ordinary imported image still has neither link.

### Image Revision

Image Revision context exposes the saved source request when available:

```ts
sourceGenerationRequest: GenerationSpec | null;
```

For a Codex-generated image, Studio displays the saved provider, model, prompt,
values, and references as read-only source information.

The Edit workflow remains Renku-managed:

- the selected AssetFile is the fixed source-image reference;
- the user chooses from current Renku-supported image-edit models;
- the user authors the edit prompt and supported model settings;
- Preview, estimate, approval, Run, and attachment use the existing managed
  Image Revision path;
- the edited output receives normal Renku-run provenance.

This plan does not enable Regenerate for a Codex source. It does not create a
Codex Save Request action.

### Structured errors

Use existing generation, target, and attachment diagnostics where they already
fit. Add only the minimum focused diagnostics needed for:

- attempting Renku estimate/Run on an agent-external spec;
- supplying both receipt and source spec;
- supplying a missing, non-external, wrong-purpose, or wrong-target source spec.

Do not add a warning for valid agent-external specs.

## Database Migration

Update the Drizzle TypeScript schemas first and generate the migration with
Drizzle Kit.

`media_generation_spec` gains a required `execution_kind` column. Existing rows
migrate to `renku-managed`. Existing provider and model columns remain unchanged.

`asset_file` gains one nullable `source_generation_spec_id` column. Drizzle can
apply both additions with two direct `ALTER TABLE ... ADD` statements. Existing
Codex images are not backfilled.

## Implementation Slices

### Slice 1: Save external GenerationSpecs

- Add `executionKind` to the public spec and database schema.
- Migrate current specs to `renku-managed`.
- Update managed callers directly.
- Save and read `agent-external` specs through the existing spec commands.
- Build external Preview data without calling Engines validation.
- Let Preview JSON return headlessly.

Completion condition: the agent can save and inspect one external spec containing
its actual provider, model, prompt, values, and references.

### Slice 2: Link the generated image to the spec

- Add `sourceSpecId` to the existing direct generated-image attachment input and
  CLI option.
- Check project, execution kind, purpose, target, and receipt/source-spec
  exclusivity in Core.
- Store the spec id on the AssetFile inside the existing attachment transaction.
- Preserve the current managed receipt/run path unchanged.

Completion condition: Image Revision can read the saved external spec linked by
the attached AssetFile.

### Slice 3: Show the source and keep normal Renku Edit

- Resolve the linked external spec in Image Revision source context.
- Project the source request to Studio as read-only information.
- Keep the existing image as the `image.edit` source reference.
- Keep Renku model selection, prompt/settings editing, Preview, estimate, Run,
  and output attachment on the existing managed path.
- Do not add external Regenerate or Save Request behavior.

Completion condition: opening Edit on a Codex-generated image shows the saved
Codex request and can produce an edited image through a normal Renku-supported
image-edit model.

### Slice 4: Update the agent workflow and documentation

- Update the media-producer skill to save the spec before Codex execution.
- Record the actual provider/model used without Core allowlisting a fixed pair.
- Attach the generated direct output with `--source-spec`.
- Update the current architecture, CLI, and workflow documentation.
- Add a small ADR narrowing Decisions 0040 and 0047 only for saved external spec
  provenance.

## Tests And Guardrails

Add focused tests for:

- managed and agent-external GenerationSpec round trips;
- current managed estimate and Run behavior remaining unchanged;
- external Preview returning the saved request without an Engines payload;
- Preview JSON working when Studio is not running;
- attaching with a valid external source spec;
- rejecting receipt plus source spec;
- rejecting missing, managed, wrong-purpose, and wrong-target source specs before
  attachment writes;
- reading the linked external spec in Image Revision;
- displaying the source request without treating its values as Renku settings;
- creating a Renku-managed `image.edit` request with the current image as source;
- choosing current Engines-supported image-edit models and controls;
- running the edited image through the existing managed workflow;
- leaving images without generation provenance unchanged.

Architecture tests must protect stable package/import boundaries only. Do not add
source-text tests for private function names, command inventories, or implementation
helpers.

## Documentation

Update only current documentation:

- add a concise ADR for external spec provenance;
- update `docs/architecture/data-model-and-storage.md`;
- update `docs/architecture/media-generation.md`;
- update `docs/cli/commands.md` for `executionKind`, headless Preview JSON, and
  `--source-spec`;
- update the installed `renku:media-producer` workflow and its one external image
  example.

Documentation must describe the simple sequence: save spec, execute in Codex,
attach image with spec, inspect source request, edit through Renku.

## Final Verification

Run focused Core, CLI, and Studio tests first. Then run:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

The focused integration test covers saving, previewing, attaching, and opening
Image Revision for an agent-external request. Existing managed-generation and
Image Revision tests cover the unchanged Renku execution path. No real project
or paid provider run is required for verification.

Inspect `git diff --stat` and the complete diff. Confirm no unrelated formatting
churn, new executor framework, broad dispatcher, or oversized owning-layer file
was introduced. Confirm `packages/core/src/server/index.ts` remains thin.

## Completion Checklist

### Review Area

- [ ] The implemented behavior is limited to saving, linking, displaying, and
  Renku-editing a Codex-generated image.
- [ ] The implementation preserves Core, Engines, CLI, Studio, and skill
  ownership boundaries.
- [ ] The final file/module shape matches the Architecture Shape Gate.
- [ ] No new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [ ] `GenerationSpec.executionKind` distinguishes managed and external requests.
- [ ] Existing `GenerationSpec.model` continues to store provider/model identity.
- [ ] Core does not hardcode or allowlist `codex` / `gpt-image-2`.
- [ ] Engines remains unaware of agent-external execution.
- [ ] No fake run, receipt, price, estimate, approval, or output is created.
- [ ] The AssetFile may link to an external saved spec.
- [ ] Images without a saved request still have no source spec link.
- [ ] Package-boundary failures use structured diagnostics.

### GenerationSpec And Preview

- [ ] Existing specs migrate to `renku-managed`.
- [ ] External specs save and round-trip through existing spec commands.
- [ ] External specs preserve authored prompt, values, references, provider, and
  model without semantic inspection.
- [ ] External Preview does not invoke Engines provider validation.
- [ ] Preview JSON works without Studio running.
- [ ] Valid external specs do not produce a useless execution warning.

### Attachment And Persistence

- [ ] The existing attachment command accepts `sourceSpecId`.
- [ ] Receipt and source spec are mutually exclusive.
- [ ] Core checks external kind, purpose, and target before writes.
- [ ] The existing attachment path performs file and destination validation once.
- [ ] The source spec id persists atomically with the AssetFile relationship.
- [ ] Existing managed run provenance remains unchanged.
- [ ] No image-copy or derivative-lineage behavior was added.

### Image Revision And Studio

- [ ] Image Revision reads the linked external spec.
- [ ] Studio shows the saved provider, model, prompt, values, and references as
  read-only source information.
- [ ] The current AssetFile is the fixed source for `image.edit`.
- [ ] The user can choose current Renku-supported image-edit models and settings.
- [ ] Preview, estimate, approval, Run, and attachment stay on the existing
  Renku-managed Edit path.
- [ ] The edited image receives normal managed run provenance.
- [ ] No external Regenerate or Save Request action was added.
- [ ] Studio uses local shadcn controls and intentional visible copy.

### CLI And Agent Workflow

- [ ] CLI spec JSON accepts and emits `executionKind`.
- [ ] CLI direct generated-image import accepts `--source-spec`.
- [ ] Preview JSON returns even when Studio delivery is unavailable.
- [ ] The media-producer skill saves the spec before Codex execution.
- [ ] The skill records the actual external provider/model used.
- [ ] The skill attaches the direct generated output with `--source-spec`.
- [ ] No Codex-specific Core command or generic external-executor framework was
  added.

### Tests And Documentation

- [ ] Focused Core generation and provenance tests pass.
- [ ] Focused CLI tests pass.
- [ ] Focused Image Revision and Studio tests pass.
- [ ] Architecture tests protect stable boundaries without implementation-name
  needles.
- [ ] The concise ADR and current architecture/CLI documentation are updated.
- [ ] The installed media-producer skill and example are updated.

### Final Verification

- [ ] The external save/attach/inspect integration flow passes.
- [ ] The ordinary Renku-managed generation flow still passes.
- [ ] The Renku-managed Image Revision Edit flow passes for a Codex-sourced image.
- [ ] `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` pass.
- [ ] `git diff --stat` and the complete diff contain no unrelated formatting
  churn.
- [ ] New and heavily modified files remain focused and reviewable.
- [ ] `index.ts` files remain thin entrypoints.
- [ ] No checklist item was satisfied by accepting a generic framework,
  speculative feature, or unreviewable code structure.
