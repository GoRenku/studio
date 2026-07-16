# Media Generation

Date: 2026-07-12

Status: current

Role: reference

## Accepted Contract

The browser-safe source is `packages/core/src/client/generation.ts`.

```ts
interface GenerationSpec {
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
  id: string;
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

The stable target kinds are `project`, `asset`, `lookbook`,
`castMember`, `location`, `scene`, `sceneDialogue`, and
`sceneShotVideoTake`. Every target is `{ kind, id }`; purpose descriptors
own any additional context lookup.

## Editing And Validation

`createGenerationSpec` and `updateGenerationSpec` accept partial state. They
validate:

- purpose and target-kind agreement with the supplied purpose contract on
  creation and exact immutable purpose/target identity on update;
- JSON-safe authored values;
- unique non-empty selection ids;
- normalized project-relative paths or complete exact asset/file ids;
- structurally complete slot placement and at most one current choice per exact
  slot.

They do not require provider/model identity, provider-required values, file
availability, provider-field assignments, current purpose-guide placement,
candidate membership, or typed domain ownership.

`validateGenerationSpec` performs execution readiness. It resolves exact
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
succeeds.

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
3. makes no provider call and writes no run for predictable failure;
4. executes once through Engines;
5. persists an immutable success, simulation, or provider-failure run with
   outputs, receipt, and diagnostics.

A provider failure after execution begins is a persisted failed run. A
predictable validation or approval failure is not.

## Database Generation 42

`media_generation_spec` columns:

```text
id, purpose, target_kind, target_id, provider, model, title,
values_json, references_json, created_at, updated_at
```

`media_generation_run` columns:

```text
id, spec_id, purpose, target_kind, target_id, provider, model,
spec_snapshot_json, provider_payload_json, estimate_json, approval_token,
status, outputs_json, receipt_json, diagnostics_json, started_at, completed_at
```

Migration `0052_context-first-generation.sql` is a documented custom Drizzle
migration. Its preflight reports
`CORE_GENERATION_MIGRATION_AMBIGUOUS_REFERENCE` when an explicit legacy Shot
selection cannot resolve to exactly one active file. Runtime code has no old
generation JSON reader.

The corrected copied Urban Basilica proof produced 13 generic Shot-selection
specs with 31 exact references and converted 23 provenance-backed historical
requests and runs to the current generic contract. It retained all 24
`asset_file_generation` links, advanced 30 take states to version 3, retained
84 asset files, passed `quick_check`, and had no foreign-key violations.
Unlinked drafts and obsolete purpose rows are deliberately not retained.

## Intermediate Boundary

Old purpose-specific Core contracts and backend modules are absent. The CLI,
Studio, and Skills caller inventory is
`context-first-generation-caller-handoff.md`. Plan `0135` must update or
delete every listed caller directly and restore root/product gates without
adding aliases, shims, dual schemas, or compatibility readers.

Decision history is recorded in
`../../decisions/0047-use-context-first-provider-valid-generation.md`.
