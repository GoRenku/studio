# 0148 Generation Spec Lifecycle And Source Request Projection

Status: complete
Date: 2026-07-18

## Summary

Make every saved `GenerationSpec` mutable only during authoring and permanently
freeze it when live execution begins. Apply the same lifecycle to
`renku-managed` and `agent-external` requests without inventing an external
GenerationRun, receipt, estimate, or provider adapter.

At the same time:

- move all durable GenerationSpec envelope validation into one Core-owned
  implementation used by create, update, freeze, and validate;
- keep execution-only Engines validation separate and managed-only;
- replace the raw `GenerationSpec` returned to Image Revision with a focused
  Core projection whose references contain meaningful domain labels rather than
  project paths, filenames, Asset ids, or AssetFile ids;
- make saved frozen Generation Previews read-only in Studio while retaining the
  Core mutation guard as the authoritative rule.

This plan deliberately does **not** add safety validation, filtering, redaction,
new value types, provider allowlists, or heuristics for arbitrary
`agent-external` values. Current external specs continue to use
`Record<string, JsonValue>`. The current Codex image-generation workflow has not
persisted secrets, absolute paths, or provider upload URLs in those values. If
that becomes an observed problem, it requires a separate design based on real
cases rather than speculative runtime heuristics.

The agent workflow must nevertheless record provenance accurately. For the
current Codex built-in image-generation tool, the agent-authored request value
is the exact prompt passed to the tool. That prompt must retain every reviewed
generation requirement, including requirements such as `16:9`, composition,
visual quality, format direction, and creative constraints. Selected image
inputs remain logical `GenerationReference` entries.

## Product And Lifecycle Decision

A saved GenerationSpec has one irreversible lifecycle boundary:

```text
draft (frozenAt = null)
  ├─ create, direct update, Preview Update, and reference edits are allowed
  ├─ estimate and simulation do not freeze the spec
  └─ live execution submission freezes the exact saved revision
          ↓
frozen (frozenAt = timestamp)
  ├─ read, preview, exact retry, and provenance attachment are allowed
  └─ every mutation is rejected by Core
```

Freeze at live submission rather than after output attachment. Once a request
has been submitted to a live executor, the request cannot be taken back and
must not change while the executor is producing an artifact. Waiting until
attachment would allow Preview Update to replace the saved request while a
managed provider or Codex is still generating from the earlier revision.

For `renku-managed` execution, Core freezes the exact saved revision immediately
before calling Engines. For `agent-external` execution, the agent explicitly
freezes the final reviewed spec immediately before invoking Codex image
generation. External attachment with `sourceSpecId` requires that frozen spec.

A live provider failure does not unfreeze the spec. The exact frozen request may
be retried. A changed request is authored as a new ordinary GenerationSpec; no
unfreeze, clone, fork, compatibility, or convenience-copy command is added.

## Explicit Non-Goals

This plan does not:

- change `GenerationSpec.values` or add `AgentExternalImageValues`;
- inspect value names or contents for tokens, credentials, paths, URLs, or
  provider terminology;
- reject, redact, filter, or hide arbitrary external values in Preview or Image
  Revision;
- parse or validate prompt contents;
- add provider/model allowlists for `codex` or `gpt-image-2`;
- add a Codex adapter, external executor registry, external GenerationRun,
  receipt, estimate, price, approval token, or callback protocol;
- persist an external spec snapshot on AssetFile;
- remove the existing immutable managed-run `specSnapshot`;
- create an executing state, unfreeze path, mutable revision history, or
  automatic draft-copy API;
- expose raw project paths, filenames, relationship role ids, Asset ids, or
  AssetFile ids as visible Image Revision reference copy;
- add architecture tests that name private functions, helpers, or command
  inventories as source-text needles.

This plan also does not add runtime validation that restricts external values
to `prompt`. The media-producer workflow and its evals own the expected current
Codex spec shape.

## Context

This plan follows and narrows:

- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/decisions/0055-preserve-agent-external-generation-specs-on-images.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/structured-diagnostics.md`;
- `docs/architecture/reference/drizzle-migrations.md`;
- `plans/active/0147-agent-external-generation-specs-and-asset-sources.md`.

Current implementation boundaries that constrain the change are:

- `packages/core/src/server/generation/specs.ts` owns saved spec commands;
- `packages/core/src/server/generation/validation.ts` owns managed execution
  readiness orchestration;
- `packages/core/src/server/generation/runs.ts` owns managed execution and run
  persistence;
- `packages/core/src/server/generation/attachments.ts` owns generation source
  checks for focused attachment;
- `packages/core/src/server/generation-preview-resource/update.ts` sends Preview
  Update intent through `updateGenerationSpec`;
- `packages/core/src/server/image-revision-workflow` owns Image Revision source
  resolution and client context;
- `packages/cli` remains a thin command surface over Core;
- `packages/studio` remains a projection consumer;
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/`
  owns the agent-external execution sequence.

The real development project at
`/Users/keremk/renku-movies/urban-basilica` currently contains agent-external
specs with existing external value shapes. Existing development records are not
rewritten by this plan. New media-producer instructions and evals use the
explicit current Codex spec shape defined below. Use the project read-only for
shape auditing; database migration behavior must be verified against temporary
database copies or migration fixtures rather than modifying the project during
automated tests.

## Architecture Shape Gate

### Ownership

`packages/core` owns all lifecycle, validation, persistence, and source-request
projection rules introduced by this plan.

The intended Core module shape is:

```text
packages/core/src/server/generation/
  spec-envelope.ts       one shared durable envelope validator
  spec-lifecycle.ts      irreversible freeze transition and mutability guard
  specs.ts               thin create/update/read/list saved-spec commands
  validation.ts          envelope-first validation orchestration plus managed
                         execution-readiness validation
  runs.ts                managed estimate/approval validation, exact freeze,
                         Engines execution, and run persistence
  attachments.ts         provenance relationship checks, including frozen
                         external source requirement

packages/core/src/server/image-revision-workflow/
  source.ts              source Asset/AssetFile/provenance resolution
  source-request.ts      read-only source-request projection and domain labels
  service.ts             workflow orchestration only
```

`spec-envelope.ts` is the only implementation of durable GenerationSpec
envelope rules. It returns collected structured issues and does not read
provider schemas, execute Engines, mutate SQLite, or project UI data.

`spec-lifecycle.ts` owns the irreversible draft-to-frozen transition and the
structured rejection of mutations after freeze. It does not perform purpose
dispatch, provider execution, attachment persistence, CLI formatting, or UI
projection.

`source-request.ts` owns the focused Image Revision projection. It preserves
the source spec's current arbitrary authored values unchanged, but replaces raw
reference identities with meaningful labels resolved from Core domain records.
It does not become a general sanitizer or duplicate Generation Preview
projection system.

### Public entrypoints

Core public services use these names:

- `createGenerationSpec`;
- `updateGenerationSpec`;
- `freezeGenerationSpec`;
- `readGenerationSpec`;
- `listGenerationSpecs`;
- `validateGenerationSpec`;
- `runGeneration`;
- `attachGenerationMedia`;
- `readImageRevisionContext`.

The CLI adds exactly one command:

```text
renku generation spec freeze --spec <generation-spec-id> --json
```

Managed callers do not invoke that CLI command. The managed `runGeneration`
service freezes automatically. The explicit command is the external executor's
authoritative handoff from authoring to execution.

`packages/core/src/server/index.ts` remains the only Core server package
entrypoint and may add only the focused public export. It must not contain
lifecycle logic, validation branches, command dispatch, or persistence code.

The existing CLI generation handler registry remains the bounded command
dispatcher. Adding the `spec freeze` handler must not introduce a second
dispatcher or a long conditional command chain.

### Persistence split

The Drizzle schema remains the source of truth. Add `frozen_at` to
`media_generation_spec`. Database access in
`packages/core/src/server/database/access/media-generation.ts` owns the
conditional row update used to freeze the exact expected revision.

The freeze write must be conditional on:

- the exact spec id;
- `frozen_at IS NULL`;
- the expected saved revision, using the current record's `updated_at` or a
  deliberately added revision column if timestamp equality proves inadequate
  during implementation.

Do not select a concurrency mechanism ad hoc in CLI, Studio routes, or React.
If `updated_at` cannot provide an unambiguous conditional update in focused
tests, stop and update this plan before adding a public revision field.

### Domain branches

The only lifecycle branch is execution ownership:

- managed live execution freezes inside the managed run workflow;
- external live execution freezes through the explicit Core command;
- estimate and simulation do not freeze;
- provenance attachment requires an already-frozen source.

No provider-, model-, purpose-, or destination-specific freeze registry is
needed. Existing focused attachment destination routing remains unchanged.

### Files expected to remain thin

- `packages/core/src/server/index.ts` remains exports only.
- `packages/core/src/server/project-data-service-wiring/generation.ts` remains
  thin wiring over focused Core services.
- `packages/cli/src/commands/generation-command-handlers.ts` keeps its bounded
  path-to-handler table and focused flag parsing.
- Studio server generation and Image Revision routes remain HTTP adapters with
  no lifecycle or label-selection rules.
- `packages/studio/src/features/image-revision/image-revision-source-request.tsx`
  renders the Core DTO and contains no reference resolution or identifier
  fallback logic.

### Forbidden implementation shape

Stop and revise the plan if implementation starts adding:

- duplicate purpose/target/reference envelope checks outside
  `spec-envelope.ts`;
- a generic validator manager, validation registry, lifecycle framework, or
  state-machine library;
- freeze logic in CLI handlers, HTTP routes, React hooks, or attachment adapters;
- an automatic unfreeze after provider failure;
- attachment-time silent freezing as a fallback for an external agent that
  omitted the explicit execution handoff;
- external value validation, sanitization, redaction, allowlists, or heuristics;
- a second source-spec snapshot for external images;
- raw reference ids or paths in the Image Revision client DTO;
- domain-label guessing from filenames, paths, role ids, or kebab-case
  identifiers;
- a new broad switch in `runs.ts`, `attachments.ts`, `service.ts`, or a public
  `index.ts`;
- a source-text architecture test that freezes current helper or command names.

## Contracts

### GenerationSpecRecord lifecycle

`GenerationSpec` remains unchanged. `GenerationSpecRecord` gains lifecycle
metadata:

```ts
interface GenerationSpecRecord {
  id: string;
  spec: GenerationSpec;
  frozenAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

`frozenAt === null` means the saved request is editable. A non-null value means
the request is permanently frozen. The lifecycle field belongs to the record,
not to `GenerationSpec`, because it describes persistence state rather than
provider request content.

All spec mutation paths call the same Core mutability guard before writing.
They fail with:

```text
CORE_GENERATION_SPEC_FROZEN
```

The diagnostic explains that a submitted generation request cannot be changed
and that a changed request must be saved as a new spec.

If a conditional freeze loses a revision race, fail without executing:

```text
CORE_GENERATION_SPEC_FREEZE_CONFLICT
```

The caller must reread, validate, and review the current saved request before
trying again. Do not silently freeze a newer revision.

### Shared envelope validation

`validateGenerationSpecEnvelope` owns the existing durable rules:

- execution kind is recognized;
- purpose matches the selected purpose contract;
- target kind matches the purpose contract;
- `values` is a JSON-safe record;
- provider fields are omitted or non-empty;
- asset-file references contain exact non-empty ids;
- project-file references are normalized project-relative paths;
- slot placements contain non-empty section, slot, and optional subject
  identities;
- one exact slot placement has at most one current selection.

It must collect all independent envelope issues that can be reported together.
Create, update, freeze, and validate all consume this same result. Small
boundary adapters may translate the issue collection into
`ProjectDataError`, but they must not reimplement any rule.

`validateGenerationSpec` performs the shared envelope stage for both execution
kinds. If an agent-external spec passes the envelope, validation succeeds
without Engines. A managed spec continues into the existing model, reference
resolution, file digest, provider payload assembly, output-kind, and Engines
schema checks.

`validateGenerationSpecForExecution` must not return an external-execution
diagnostic before the shared envelope has been evaluated. Estimate and run may
still reject external execution after the envelope succeeds.

No new validation applies to arbitrary external values beyond the existing
JSON-safe envelope rule.

### Agent-authored external request accuracy

The Studio runtime continues to accept arbitrary JSON-safe external values. The
`renku:media-producer` workflow owns the expected shape for the current Codex
built-in image-generation request:

```json
{
  "executionKind": "agent-external",
  "purpose": "location.sheet",
  "target": { "kind": "location", "id": "location_..." },
  "model": { "provider": "codex", "model": "gpt-image-2" },
  "values": {
    "prompt": "Create one polished 16:9 Location Sheet ..."
  },
  "references": [],
  "title": "Location Sheet"
}
```

`values` contains only `prompt` for this workflow. The prompt is the complete,
exact reviewed instruction sent to Codex and must preserve all requested
generation details. A requirement such as `16:9` therefore remains in the
prompt; reducing the structured value shape must never weaken or simplify the
prompt itself.

Selected source/reference images are stored as logical `GenerationReference`
entries in `references`. Purpose, target, title, provider, and model retain their
normal GenerationSpec fields. The agent reads the final saved spec after Preview
and sends `values.prompt` unchanged to Codex.

### Freeze command

`freezeGenerationSpec` accepts a saved spec id and returns the frozen
`GenerationSpecRecord`.

For the explicit external workflow it:

1. reads the current record;
2. requires `executionKind === "agent-external"`;
3. validates the shared envelope;
4. conditionally freezes the exact current revision;
5. returns the frozen record.

Calling freeze again for the same already-frozen record is an idempotent read
only when the record is unchanged; it must not change `frozenAt`. Supplying a
managed spec to the explicit external freeze command fails with the existing
external-execution boundary diagnostic or one focused structured diagnostic.
The implementation must choose and document one stable code rather than
leaving raw errors.

### Managed live execution

The managed run path validates the exact saved draft and conditionally freezes
that revision before the provider call. It uses the prepared execution spec
derived from that same saved revision. If freezing fails, Engines is not called
and no run is written.

An already-frozen managed spec may be executed again unchanged. Run must verify
that the supplied/prepared request still originates from that exact frozen
record rather than accepting a caller-provided replacement spec under the same
id.

Simulation does not freeze. Existing managed run `specSnapshot` persistence
remains unchanged and continues to record the exact prepared per-run request.

### Attachment provenance

Agent-external attachment with `sourceSpecId` requires:

- the source spec exists in the project;
- it is agent-external;
- it is frozen;
- purpose and target exactly match the focused attachment.

An otherwise valid but mutable external source fails before asset, file,
relationship, membership, or provenance writes with:

```text
CORE_GENERATION_ATTACHMENT_SOURCE_SPEC_MUTABLE
```

Managed receipt attachment continues to resolve the run and immutable run
snapshot. The source spec for new live managed runs is already frozen. Existing
managed provenance is backfilled by migration.

### Generation Preview authoring state

Replace the scalar `generationSpecId` Preview resource field with current saved
record context:

```ts
generationSpec?: {
  id: string;
  frozenAt: string | null;
};
```

Draft file-only previews omit `generationSpec` and remain read-only. Saved
draft previews expose `frozenAt: null` and remain editable. Saved frozen
previews expose the timestamp and render read-only.

Studio derives editability only from this Core projection. It hides the Update
action and disables prompt, configuration, and reference editing for frozen
previews. Core still rejects mutation independently so browser state cannot
bypass the lifecycle.

Update all callers directly to the new shape. Do not retain
`generationSpecId` as an alias or compatibility field.

### Image Revision source request

Replace `ImageRevisionEditorContext.sourceGenerationRequest: GenerationSpec |
null` with:

```ts
interface ImageRevisionSourceRequest {
  model?: GenerationModelIdentity;
  values: Record<string, JsonValue>;
  referenceLabels: string[];
}
```

The projection deliberately preserves current arbitrary values unchanged. It
does not validate or filter them.

Core resolves `referenceLabels` in saved order:

- an active asset-file reference contributes its Asset title when that title is
  non-empty and meaningful;
- a project-file reference contributes no visible label in this slice;
- an unavailable reference contributes no id, filename, path, role, or fallback
  copy;
- duplicate meaningful labels may be collapsed while preserving first
  occurrence order if repeated labels make the card misleading.

The source request does not expose `purpose`, `target`, `executionKind`, raw
reference selections, Asset ids, AssetFile ids, project-relative paths, or
filenames because Image Revision does not need them to render the read-only
request card.

Studio renders `model`, prompt and other values, and `referenceLabels`. If the
label list is empty, the References row is omitted. It must not reconstruct a
label from hidden identifiers.

## Database Migration

Update the Drizzle TypeScript schema first, then generate the next migration
after `0060` with Drizzle Kit from `packages/core`:

```bash
pnpm drizzle-kit generate --config drizzle.config.ts --name freeze_generation_specs
```

The generated migration adds nullable `frozen_at` to
`media_generation_spec`. Because current development data may already have
generation evidence, document and add the smallest intentional one-way SQL
backfill needed to set `frozen_at` for:

- specs referenced by non-simulated managed runs;
- specs reached through existing `asset_file_generation` provenance;
- agent-external specs referenced by `asset_file.source_generation_spec_id`.

Use the earliest durable execution/provenance timestamp available for each
spec. Do not infer generation from filenames, Asset titles, origins, target
relationships, or unlinked files. Specs with no durable execution or attachment
evidence remain drafts.

The migration advances the project schema generation because current runtime
reads `frozen_at` unconditionally. Verify the generated migration, Drizzle
snapshot, journal, and `PRAGMA user_version` according to the accepted migration
workflow. Any manual SQL backfill is an explicitly documented custom portion of
the generated migration, not a TypeScript migration runner.

## Implementation Slices

### Slice 1: Persist and enforce the lifecycle

Expected files:

- `packages/core/src/client/generation.ts`;
- `packages/core/src/server/schema/media-generation.ts`;
- `packages/core/src/server/database/access/media-generation.ts`;
- new `packages/core/src/server/generation/spec-lifecycle.ts`;
- `packages/core/src/server/generation/specs.ts`;
- generated Drizzle migration, snapshot, and journal files;
- focused schema and migration tests.

Add `frozenAt`, the conditional freeze write, shared mutability guard, structured
freeze diagnostics, and backfill. Keep database access free of purpose and
execution business logic.

Completion condition: direct Core updates cannot mutate a frozen record, and
existing run/attachment provenance migrates to frozen records.

### Slice 2: Centralize the envelope validator

Expected files:

- new `packages/core/src/server/generation/spec-envelope.ts`;
- `packages/core/src/server/generation/specs.ts`;
- `packages/core/src/server/generation/validation.ts`;
- focused spec and validation tests.

Move the existing structural checks rather than copying them. Run the common
stage for both execution kinds, then continue only managed requests into Engines
execution validation. Preserve partial authoring and arbitrary external JSON
values.

Completion condition: validate and create/update report the same purpose,
target, value-envelope, and reference-structure failures from one rule owner.

### Slice 3: Freeze at execution and external handoff

Expected files:

- `packages/core/src/server/generation/spec-lifecycle.ts`;
- `packages/core/src/server/generation/runs.ts`;
- `packages/core/src/server/generation/attachments.ts`;
- `packages/core/src/server/generation/attachment-persistence.ts` only if needed
  to preserve attachment transaction boundaries;
- `packages/core/src/server/project-data-service-wiring/generation.ts`;
- `packages/core/src/server/index.ts`;
- `packages/cli/src/commands/generation-command-handlers.ts` and focused tests;
- `packages/cli/src/cli.ts` only for current help/flag registration.

Freeze managed specs before live Engines execution, add the thin external freeze
command, and require frozen external provenance during attachment. Keep CLI and
service wiring shallow.

Completion condition: neither managed nor external live execution can use a
spec that remains mutable during generation, and attachment cannot link a
mutable source spec.

### Slice 4: Make Preview lifecycle-aware

Expected files:

- `packages/core/src/client/generation-preview-resource.ts`;
- `packages/core/src/server/generation-preview-resource/projection.ts`;
- `packages/core/src/server/project-data-service-wiring/generation.ts`;
- `packages/studio/src/features/generation-preview/*` focused consumers/tests;
- Studio generation Preview service/route fixtures that carry the changed DTO.

Replace `generationSpecId`, project saved record lifecycle, and make frozen
previews read-only. Do not implement lifecycle decisions in React.

Completion condition: saved drafts remain editable, saved frozen requests and
file-only previews have no Update path, and direct mutation still fails in Core.

### Slice 5: Project meaningful Image Revision source labels

Expected files:

- `packages/core/src/client/image-revision-workflow.ts`;
- new `packages/core/src/server/image-revision-workflow/source-request.ts`;
- `packages/core/src/server/image-revision-workflow/service.ts`;
- focused Core Image Revision tests;
- `packages/studio/src/features/image-revision/image-revision-source-request.tsx`;
- focused Studio component tests and server fixtures.

Return the focused source-request DTO, use Asset titles for asset-file reference
labels, keep project-file references quiet, and delete React identifier/path
fallbacks. Preserve external values unchanged.

Completion condition: Image Revision shows meaningful reference labels when
available and never renders raw reference paths or internal ids.

### Slice 6: Update current docs and agent workflow

Expected files:

- new `docs/decisions/0056-freeze-generation-specs-at-live-execution.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/cli/commands.md`;
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`;
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/workflow.md`;
- relevant media-producer evals/examples.

Document draft/frozen semantics and add the explicit freeze step immediately
before Codex image generation. Update the external example so the current
built-in Codex request uses `values: { prompt }`, with requirements such as
`16:9` retained inside that exact prompt, plus the normal logical references.
The ADR narrows Decision 0055 without adding external runs or snapshots.

Completion condition: architecture, CLI help, and agent instructions all use
the same save/edit/review/freeze/execute/attach sequence.

## Tests And Guardrails

### Core lifecycle tests

- Draft specs can be updated directly, through reference edits, and through
  Preview Update.
- `freezeGenerationSpec` freezes the exact expected revision.
- A concurrent/revision-mismatched freeze fails without changing the newer
  draft.
- Re-freezing the same record is idempotent and preserves the first `frozenAt`.
- Every update path returns `CORE_GENERATION_SPEC_FROZEN` before writing.
- A frozen spec can be read, previewed, retried unchanged, and attached.
- No unfreeze behavior exists.

### Validation tests

- Agent-external wrong-purpose and wrong-target envelopes fail validation.
- Create, update, freeze, and validate consume the same envelope issues.
- Independent structural envelope issues are collected where actionable.
- Agent-external values remain arbitrary JSON-safe records.
- External envelope validation does not call Engines.
- Managed validation still performs model, reference, output-kind, and provider
  schema checks after the common envelope stage.

### Agent workflow evals

- The current Codex built-in example uses exactly `values: { prompt }`.
- The exact prompt retains every reviewed generation requirement, including a
  requirement such as `16:9`.
- Logical image inputs remain under `references`.
- Reading the frozen spec supplies the exact unchanged prompt used for Codex
  generation.

### Execution and attachment tests

- Managed live execution freezes before the Engines call.
- A freeze conflict prevents provider execution and run persistence.
- Simulation does not freeze.
- An exact frozen managed spec can be run again.
- Provider failure leaves the submitted spec frozen and persists the existing
  failed-run evidence.
- External attachment rejects a mutable source spec before all attachment
  writes and filesystem commit.
- External attachment accepts a frozen same-purpose/same-target spec.
- Receipt/source-spec exclusivity and existing purpose/target checks remain.

### Migration tests

- The generated migration applies with foreign keys enabled.
- Existing spec rows gain nullable `frozen_at` without changing spec contents.
- Managed run provenance backfills the correct source spec.
- AssetFile generation provenance backfills the correct source spec.
- Linked external source specs are frozen.
- Unexecuted, unlinked specs remain drafts.
- The migration is idempotent through the normal Drizzle migration journal.

### Preview and Studio tests

- Saved draft Preview exposes mutable record context and Update remains
  available.
- Saved frozen Preview renders read-only and has no Update action.
- File-only Preview remains read-only.
- A forged browser update against a frozen spec still fails in Core.
- Existing desktop Preview authoring behavior remains unchanged for drafts.

### Image Revision projection tests

- Asset-file references display the meaningful Asset title.
- Project-file references do not display project-relative paths or filenames.
- Unavailable references do not fall back to ids or roles.
- Asset ids and AssetFile ids are absent from the client source-request DTO.
- No References row renders when no meaningful labels exist.
- Prompt and other arbitrary source values continue to display unchanged.
- Managed run snapshots and frozen external specs both use the same focused
  Image Revision source-request DTO.

### Architecture guardrails

Prefer behavior and import-boundary tests. Do not add source-text tests for
private lifecycle functions, validator names, CLI handler names, or an inventory
of allowed commands. A normal internal rename must not require changing an
architecture test.

No new static guardrail is needed for external-value safety because this plan
explicitly adds no such rule.

## Documentation

Add Decision 0056 to record:

- draft specs are mutable;
- live-submitted specs are permanently frozen;
- managed execution freezes automatically;
- external execution uses an explicit freeze handoff;
- failed live requests remain frozen and may be retried unchanged;
- external attachment requires frozen provenance;
- managed run snapshots remain;
- external specs remain linked directly without a second snapshot.

Update current media-generation architecture and reference docs with
`frozen_at`, the shared envelope validator, and the revised Preview lifecycle
contract. Update CLI docs for `generation spec freeze` and the changed Preview
resource shape where documented.

Update media-producer instructions and relevant evals to require:

```text
create/update → Preview → approval → read → freeze → Codex generation → attach
```

For the current built-in tool, the spec authored before that sequence contains
exactly `values: { prompt }` plus the normal logical references. The prompt
continues to carry all generation requirements, including `16:9` where the
request requires it. Correct current external examples to show that exact
shape.

State explicitly that this plan does not change arbitrary external values or add
secret/path/URL heuristics. Do not edit historical plans merely to retrofit the
new lifecycle wording.

## Final Verification

Run focused checks first:

```bash
pnpm --dir packages/core test
pnpm --dir packages/core type-check
pnpm --dir packages/cli test
pnpm --dir packages/studio test
pnpm --dir packages/studio type-check
```

Then run the root workspace checks:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Inspect the generated Drizzle migration, snapshot, journal, schema-generation
change, and focused migration regression tests. If realistic project data is
needed, operate on a temporary copy of the `urban-basilica` database and leave
the real project unchanged unless the user separately authorizes migration.

Inspect `git diff --stat` and the complete diff. Remove unrelated formatting
churn. Review every newly large or heavily modified file, especially
`specs.ts`, `validation.ts`, `runs.ts`, `attachments.ts`, Preview projection,
and Image Revision service code.

Confirm:

- `spec-envelope.ts`, `spec-lifecycle.ts`, and `source-request.ts` remain
  focused;
- `packages/core/src/server/index.ts` remains a thin entrypoint;
- project-data service wiring, CLI handlers, Studio routes, and React remain
  adapters/consumers;
- no lifecycle framework, validator registry, external-value guardrail,
  compatibility alias, or raw identifier projection was introduced;
- the owning layer did not become a god module merely because ownership moved
  into Core.

## Completion Checklist

### Review Area

- [x] Confirm the implementation preserves Core, Engines, CLI, Studio server,
      React, and Studio Skills ownership boundaries.
- [x] Confirm the implementation matches the draft-to-frozen lifecycle decided
      in this plan.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, lifecycle framework,
      validation registry, or god file was added.
- [x] Confirm the change does not introduce external-value safety validation or
      speculative provider rules.

### Architecture And Contracts

- [x] Keep `GenerationSpec` and `GenerationSpec.values` unchanged.
- [x] Add `GenerationSpecRecord.frozenAt` deliberately.
- [x] Add `freezeGenerationSpec` as the focused Core entrypoint.
- [x] Add `generation spec freeze --spec` as a thin CLI command.
- [x] Replace `generationSpecId` directly with the saved Preview record context;
      do not keep an alias.
- [x] Replace the raw Image Revision `GenerationSpec` with
      `ImageRevisionSourceRequest`; do not keep a duplicate legacy field.
- [x] Keep package-boundary failures structured with stable generation-prefixed
      diagnostic codes.
- [x] Keep durable lifecycle, envelope, provenance, and labeling rules in Core.
- [x] Keep Engines unaware of agent-external execution and freezing policy.
- [x] Keep Studio routes and CLI handlers free of business rules.
- [x] Keep React free of spec mutability and reference-label resolution rules.

### GenerationSpec Lifecycle

- [x] Add `frozen_at` to the Drizzle schema.
- [x] Generate the migration through Drizzle Kit.
- [x] Backfill only specs with durable run or attachment evidence.
- [x] Leave unexecuted/unlinked specs mutable.
- [x] Implement an exact conditional freeze write.
- [x] Reject every mutation after freeze.
- [x] Keep the first freeze timestamp stable.
- [x] Do not add unfreeze, clone, fork, or automatic draft-copy commands.
- [x] Allow exact retry and attachment of frozen specs.
- [x] Keep simulation mutable unless a later accepted workflow explicitly
      freezes its artifact provenance.

### Shared Envelope Validation

- [x] Move existing structural envelope rules into `spec-envelope.ts`.
- [x] Remove duplicated purpose/target/value/reference checks from callers.
- [x] Run the shared envelope stage for both execution kinds.
- [x] Skip only managed Engines execution validation for agent-external specs.
- [x] Preserve partial authoring behavior.
- [x] Preserve arbitrary JSON-safe external values.
- [x] Keep external-value accuracy in media-producer instructions/evals rather
      than adding a Studio runtime allowlist.
- [x] Collect independent structured issues where useful.
- [x] Ensure mutation commands enforce the same envelope even when callers did
      not run the standalone validate command first.

### Managed And External Execution

- [x] Freeze the exact saved managed revision before a live Engines call.
- [x] Prevent Engines execution and run writes after a freeze conflict.
- [x] Keep estimate and simulation from freezing drafts.
- [x] Keep live provider failures frozen.
- [x] Make explicit external freeze idempotent for an already-frozen exact
      record.
- [x] Require the media-producer workflow to freeze immediately before Codex.
- [x] Require the current Codex spec to use exactly `values: { prompt }` plus
      the normal logical references.
- [x] Preserve every reviewed generation requirement, including `16:9` when
      requested, inside the exact prompt.
- [x] Require frozen external provenance during attachment.
- [x] Preserve existing managed run snapshots and receipt provenance.
- [x] Do not add an external run, receipt, estimate, approval, callback, or
      executor abstraction.

### Preview And Studio

- [x] Project saved Preview lifecycle context from Core.
- [x] Keep saved draft Previews editable.
- [x] Make frozen saved Previews read-only.
- [x] Keep file-only Previews read-only.
- [x] Hide the Update action for frozen requests.
- [x] Disable prompt, configuration, and reference authoring for frozen
      requests.
- [x] Retain the Core write guard regardless of UI state.
- [x] Use existing local shadcn controls only.
- [x] Preserve desktop-first behavior and existing local formatting.

### Image Revision Source Request

- [x] Add the focused Core-owned `ImageRevisionSourceRequest` DTO.
- [x] Preserve model identity and arbitrary source values unchanged.
- [x] Resolve asset-file labels from meaningful Asset titles.
- [x] Keep project-file references visually quiet in this slice.
- [x] Omit unavailable references without identifier fallbacks.
- [x] Remove purpose, target, execution enum, raw references, ids, paths, and
      filenames from the client source-request DTO.
- [x] Delete React reference-label reconstruction.
- [x] Omit the References row when no meaningful labels exist.
- [x] Do not add value filtering, redaction, or safety heuristics to the
      projection.

### CLI And Agent Workflow

- [x] Register the freeze command in the existing bounded generation handler
      map.
- [x] Keep CLI parsing, Core invocation, and JSON formatting focused.
- [x] Update CLI help and command docs.
- [x] Update media-producer instructions to read the final spec, freeze it, and
      invoke Codex from that frozen result.
- [x] Correct the built-in Codex example so it uses exactly
      `values: { prompt }` and logical references.
- [x] Prove the example prompt still contains `16:9` and every other reviewed
      generation requirement.
- [x] Reject attachment when the external workflow omits freeze.
- [x] Update relevant media-producer evals for the new sequence.

### Tests And Guardrails

- [x] Add focused lifecycle and conditional-write tests.
- [x] Add shared envelope behavior tests for both execution kinds.
- [x] Add managed live-run freeze and simulation tests.
- [x] Add external freeze and attachment tests.
- [x] Add migration and backfill regression tests.
- [x] Add Preview draft/frozen read-only tests.
- [x] Add Core and Studio source-request label tests.
- [x] Prove no provider call or durable write occurs after a freeze conflict or
      invalid mutable attachment.
- [x] Protect stable import/runtime boundaries without private-name source-text
      needles.
- [x] Run the architecture-shape checks listed in Final Verification.

### Documentation

- [x] Add Decision 0056 for the accepted lifecycle.
- [x] Update current media-generation architecture and reference docs.
- [x] Update data-model/storage documentation for `frozen_at`.
- [x] Update CLI documentation for `generation spec freeze`.
- [x] Update the installed media-producer skill and relevant workflow/evals.
- [x] State explicitly that external-value safety validation remains out of
      scope.
- [x] Do not edit historical plans merely to retrofit current wording.

### Final Verification

- [x] Run focused Core, CLI, and Studio tests and typechecks.
- [x] Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [x] Inspect the generated migration, Drizzle snapshot, and journal.
- [x] Test realistic migration behavior on a temporary project database copy.
- [x] Review `git diff --stat` and the complete diff for unrelated formatting
      churn.
- [x] Inspect all new and heavily modified files for size, branching, nesting,
      and mixed responsibilities.
- [x] Confirm all `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item was satisfied by accepting an unreviewable Core
      module, broad dispatcher, catch-all helper, or hidden compatibility path.
- [x] Confirm no speculative external-value guardrails were introduced.
- [x] Only then mark the plan complete.
