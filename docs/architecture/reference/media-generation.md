# Media Generation

Date: 2026-07-12

Status: current

Role: reference

## Accepted Contract

The browser-safe source is `packages/core/src/client/generation.ts`.

```ts
interface GenerationSpec {
  executionKind: "renku-managed" | "agent-external";
  purpose: string;
  target: GenerationTarget;
  model?: { provider?: string; model?: string };
  values: Record<string, JsonValue>;
  references: GenerationReferenceSelection[];
  title?: string;
}
```

`values` contains actual non-media provider field names and authored values.
Optional provider-defaulted fields remain absent until explicitly authored.
Media fields are not stored in `values`; an exact reference may receive an
optional authored `providerField` assignment.

A reference is either an exact registered `assetId + assetFileId` pair or a
normalized project-relative file path. Resolution never chooses another file.

```ts
interface GenerationReferenceSelection {
  placement:
    | {
        kind: "slot";
        sectionId: string;
        slotId: string;
        subject?: { kind: string; id: string };
      }
    | { kind: "additional" };
  providerField?: string;
  reference: GenerationReference;
}
```

The stable target kinds are `project`, `asset`, `lookbook`, `castMember`,
`location`, `scene`, and `sceneDialogue`. Every target is `{ kind, id }`;
purpose descriptors own any additional context lookup.

`renku-managed` specs use Engines for validation, estimate, and execution.
`agent-external` specs preserve a request executed by the agent, such as a
Codex image request. They are saved and previewed normally but do not create a
Renku estimate, run, receipt, provider payload, or approval token.

The persisted record adds `frozenAt: string | null`. Draft records are editable.
Live submission freezes the exact saved revision permanently. Managed run does
this automatically; external execution uses `freezeGenerationSpec`. Estimate
and simulation do not freeze.

## Editing And Validation

Create, update, freeze, and standalone validate share one Core-owned durable
envelope validator. Create and update accept partial state. The validator checks:

- purpose and target-kind agreement with the supplied purpose contract on
  creation and exact immutable purpose/target identity on update;
- JSON-safe authored values;
- normalized project-relative paths or complete exact asset/file ids;
- structurally complete slot placement and at most one current choice per exact
  slot.

They do not require provider/model identity, provider-required values, file
availability, provider-field assignments, current purpose-guide placement,
candidate membership, or typed domain ownership.

For a Renku-managed spec, `validateGenerationSpec` performs execution readiness. It resolves exact
provider-assigned references, verifies file availability, asks Engines
to assemble the provider request, and returns all predictable provider-schema
and media-envelope issues without executing or writing a run.

Presence means inclusion; inactive reference alternatives are not persisted.
Unassigned references do not enter the provider payload. Validation never reads
context, guide candidates, or slot occupancy.

## Provider Model Descriptors

Engines descriptors expose each actual provider field with:

- field name, label, scalar/schema kind, required state, provider default, enum,
  and numeric bounds;
- optional product-setting classification for aspect ratio or quality;
- optional media metadata: accepted media kinds, cardinality, count limits,
  MIME types, byte/dimension/duration/aspect-ratio limits.

There is no Renku route id, input-mode id, purpose model union, or inferred
model-mode contract.

## Preview, Estimate, And Run

`buildGenerationPreview` preserves the exact spec, resolves its references for
display, and includes a provider payload only when readiness validation
succeeds. Agent-external Preview displays the saved prompt, values, references,
provider, and model without invoking Engines.

`estimateGenerationCost` consumes pricing inputs only: provider, model, output
media kind, available authored/provider pricing facts, and intended input-media
counts. It does not
resolve files, require prompts or references, assemble a provider payload, or
invoke execution validation. `estimateGeneration` adds a price approval token
for generic run flows; the token is based on provider, model, and estimated
price rather than creative prompt or file contents.

Absent provider values remain absent. Studio presents absent duration as
`Unspecified`, never authors `Auto` or a default value, and returns price
unavailable when exact pricing facts are insufficient.

`runGeneration`:

1. estimates and compares the supplied token with the current price;
2. repeats full execution validation;
3. conditionally freezes the exact saved revision for a live run;
4. makes no provider call and writes no run for predictable validation or freeze failure;
5. executes once through Engines;
6. persists an immutable success, simulation, or provider-failure run with
   outputs, receipt, and diagnostics.

A provider failure after execution begins is a persisted failed run. A
predictable validation or approval failure is not.

## Database Generation 48

`media_generation_spec` columns:

```text
id, purpose, target_kind, target_id, execution_kind, provider, model, title,
values_json, references_json, frozen_at, created_at, updated_at
```

`media_generation_run` columns:

```text
id, spec_id, purpose, target_kind, target_id, provider, model,
spec_snapshot_json, provider_payload_json, estimate_json, approval_token,
status, outputs_json, receipt_json, diagnostics_json, started_at, completed_at
```

Migration `0059_scene_beats_and_shot_authoring_reset.sql` removes the retired
Shot Video Take generation purposes, targets, specs, runs, provenance, and
Take-owned assets. The current generation runtime has no compatibility reader,
target parser, attachment route, or fallback for those contracts.

`asset_file_generation` remains the Renku-run provenance record. An AssetFile
may separately link to the agent-external GenerationSpec that produced it.
Image Revision reads that saved spec and uses the current image as the source
for a separate, Renku-managed `image.edit` request.

Generation Preview projects saved record context as
`generationSpec?: { id, frozenAt }`. File-only previews omit it. Frozen saved
previews are read-only. Image Revision projects original request context as
`{ model?, values, referenceLabels }`, resolving labels only from active Asset
titles and never exposing raw reference ids, paths, or filenames.

Decision history is recorded in
`../../decisions/0047-use-context-first-provider-valid-generation.md` and
`../../decisions/0055-preserve-agent-external-generation-specs-on-images.md`.
The irreversible lifecycle is recorded in
`../../decisions/0056-freeze-generation-specs-at-live-execution.md`.
