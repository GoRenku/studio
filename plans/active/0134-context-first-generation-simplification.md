# 0134 Provider-Valid Generation Core Replacement

Status: completed
Date: 2026-07-11

## Summary

Build the small, strict, provider-valid Engines/Core foundation and replace the
current backend media-generation architecture. The companion product-integration
plan is `0135-generation-purpose-guides-and-product-integration.md`.

Renku Studio should help users and AI agents understand the project, find useful
media, construct a provider request, validate it, estimate it, preview it, and
run it. It should not decide creative dependencies, select references, plan
prerequisite generations, repair invalid intent, or substitute defaults.

The replacement follows one distinction:

> Studio is permissive about creative intent and strict about provider
> executability.

Any project image, audio, or video may be used for any creative purpose. A
generation is valid only when its actual provider model, values, and exact media
inputs can be assembled into a payload that passes the provider model schema.
Incomplete or invalid requests may be saved and edited. They receive actionable
structured diagnostics when the user or agent asks to validate, estimate,
approve, or run them. They are never sent to a provider until valid.

Deletion and simplification across both plans is a primary deliverable. The
current codebase grew substantial complexity that is not serving a product
purpose. Combined completion of Plans `0134` and `0135` requires a very
significant reduction in both production code and conceptual complexity,
demonstrated by the final diff and architecture review. There is no
line-count percentage or maximum-line hard gate; line counts are evidence, not
the specification.

## Context

Accepted constraints retained by this plan:

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md` and
  `plans/active/0103-opaque-ai-artifacts-and-prompts.md` keep creative contents
  opaque to Studio runtime code;
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
  keeps saved editing state and explicit output import separate;
- `docs/decisions/0009-use-structured-diagnostics-at-package-boundaries.md`
  governs agent-readable provider-readiness feedback;
- `docs/decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md` and
  `docs/architecture/reference/drizzle-migrations.md` govern database changes;
- `docs/decisions/0012-store-project-file-references-as-project-relative-paths.md`
  and the project file/asset architecture govern exact reference identity;
- current Studio desktop behavior is a hard implementation acceptance input;
  accepted product guidance and surface behavior are owned by Plan `0135`.

Accepted decisions that this plan proposes to supersede or narrow must be named
in ADR `0047`, especially:

- `0032` shared dependency graph;
- `0038` scoped Shot reference projections;
- `0039` Shot sheet reference selection;
- `0042` purpose cost projections;
- `0044` media-generation module boundaries;
- `0045` Generation Preview purpose bindings.

ADR `0047` must distinguish the deleted dependency/planning contracts from the
retained Studio interaction behavior those contracts currently feed. Passing a
new backend test is not sufficient if the UI loses sections, slots, alternate
pickers, previews, playback, revision actions, selection scope, or save feedback.

The real migration and manual verification target is
`$HOME/renku-movies/urban-basilica`. Do not use the obsolete in-repository sample
project.

## Product Principles

### Provide Context, Not Creative Rules

Core may return:

- target and project facts useful to the user or agent;
- available Character Sheets, Location Sheets, Lookbook media, dialogue audio,
  Shot inputs, other project assets, and project-local files;
- exact asset/file ids, media kind, MIME type, owner, role, and provenance;
- the approved purpose reference guide with sections, slots, candidates, and
  Additional References actions.

Core must not decide:

- which reference is appropriate;
- whether a purpose needs a Lookbook, Character Sheet, Location Sheet, prop,
  design document, or prior generation;
- whether a missing creative reference should be generated;
- whether an active, selected, first, recommended, or previous asset should be
  used, except for the explicitly approved Cast Profile, Location Hero, and
  Storyboard Sheet product defaults;
- whether a prompt or generated artifact is creatively correct.

Suggestion groups affect presentation only. They never affect validation.

### Preserve Editing State; Validate Before Generation

A saved `GenerationSpec` is editable authored state. It may have:

- no selected provider model yet;
- missing provider fields;
- references not yet assigned to provider media fields;
- values or assignments that became incompatible after changing model;
- references whose files were later moved or deleted.

Saving preserves this state so the user can continue later. Save/update checks
only the storage envelope, ownership, and guide-placement structure needed to
reopen the editor reliably. It does not perform provider-readiness validation or
alter authored values.

Guide-placement structure means that selection ids are unique, referenced
section/slot/subject placements exist in the purpose guide, a `one` slot does not
contain two choices, and Additional References use the universal additional
placement. Empty slots, excluded selections, absent model/provider fields,
unassigned provider fields, and provider-incompatible values remain saveable.

Before estimate, approval, or run, an executable request must identify:

- one real provider model endpoint;
- provider field values accepted by that model's input schema;
- every exact media reference supplied to the provider;
- the exact provider media field receiving each reference;
- a purpose/target whose output media kind matches the provider model output.

Core and Engines validate the complete provider payload for explicit validation,
estimate, approval, and run. Run always revalidates immediately before the
external call, so a deleted file or changed provider catalog fails without
wasting a provider request.

Examples:

- a Character Sheet may use a Location Sheet through any compatible image-input
  model;
- an image-edit model that requires `image_urls` is invalid without an image;
- a text-to-image model whose schema has no image input rejects an image;
- unsupported parameters or too many media inputs are invalid;
- Studio never switches models, removes inputs, clamps values, or rewrites the
  request to make it pass.

### Every Generation Is Independent

A generation has only immediate inputs and immediate outputs. It never creates,
plans, prices, schedules, or imports another generation.

If the agent needs another artifact first, it runs that generation separately,
imports the result if needed, and explicitly selects the resulting file in the
next request.

### Feedback Instead Of Fallbacks

When a request is invalid, return all independent actionable issues in one
validation report. Each issue should identify the field/input, explain the
provider contract, and suggest the direct correction.

Do not add:

- model fallback;
- provider fallback;
- input substitution;
- default reference selection;
- automatic provider-field assignment;
- parameter clamping or unknown-field stripping;
- prompt repair or augmentation;
- dependency generation;
- old-schema repair or compatibility reading;
- semantic retry through a different request.

This plan adds no new automatic provider retry behavior. Existing provider SDK
transport behavior is outside this refactor and must not change request meaning.

## Fixed Decisions

These decisions are architecture gates:

1. Remove all generation dependency management, including read-only dependency
   inventories and recursive estimates.
2. Persist incomplete `GenerationSpec` editing state without provider
   validation. Validate only when an operation needs an executable provider
   request.
3. Use the actual provider and model endpoint as the model identity. Do not add a
   Renku route id or input-mode abstraction.
4. Store ordinary provider field values in `values` and exact project reference
   selections separately in `references`. Each selection retains its purpose
   guide placement and may remain unassigned to a provider field while editing.
5. Before execution, every reference intended for the provider names the actual
   provider media field it populates. Engines owns field classification and
   payload assembly.
6. Use one persisted `GenerationSpec` contract for editing. Do not create a
   parallel draft type, executable-spec table, or synchronization layer. Agents
   can save partial specs and call validation when ready for feedback.
7. Every purpose owns a minimal reference guide describing Studio sections,
   named guidance slots, candidate sources, selection cardinality, and optional
   guidance. Every purpose permits multiple arbitrary Additional References from
   the complete project catalog as a universal product rule. These declarations
   drive guidance only; they never declare domain-required inputs.
8. AI Production explicitly chooses a provider model and maps selected Shot
   references to provider media fields before validation.
9. Purpose owns target/output identity, context, and its reference guide. Plan
   `0135` adds explicitly accepted fixed/recommended product settings and model
   presentation. Purpose still does not own provider payload requirements,
   provider validation, cost, request repair, or import dispatch.
10. Generation output remains separate from explicit focused domain import.
11. Existing purpose-specific generation specs/runs are removed by a one-way
    development migration. Runtime does not recognize old JSON.
12. Existing Shot dependency/reference-policy machinery is removed, but explicit
    user selections and their visible UI placement are preserved through the
    one-way development migration. Ambiguous migration data fails with a report;
    it is never guessed. No runtime translation layer remains.
13. Purpose-specific prompt transforms are removed except for the accepted
    `scene.storyboard-sheet` workflow defined in Plan `0135`.
14. Plan `0135` owns the approved purpose guides and treats missing guide
    configuration as an implementation failure with no runtime fallback.
15. Provider schema defaults remain provider-owned. An omitted optional value is
    omitted from the provider payload so the external provider applies its own
    declared default. Core, Studio, CLI, and agents must not copy a displayed
    provider default into authored state or invent a Renku default.
16. An estimate covers exactly one currently assembled provider request, with
    all immediate inputs already resolved. Remove recursive estimates,
    dependency estimates, and graph totals. Plan `0135` owns pricing-card and
    AI Production presentation cleanup.
17. The boundary between Plans `0134` and `0135` is intentionally non-runnable.
    Plan `0134` replaces the Engines/Core contracts and schema and deletes the
    old backend. Plan `0135` updates all CLI, Studio, and Skill consumers and
    restores workspace-wide build and runtime verification. No compatibility
    code may bridge the checkpoints.

## Non-Goals

This plan does not:

- build an automatic workflow engine, DAG, task planner, or queue;
- validate creative relevance or generated media contents;
- preserve old generation contracts or commands;
- move dependency logic into Studio Skills or agent instructions;
- redesign unrelated Cast, Location, Lookbook, screenplay, or asset domains;
- add generic project-state patch APIs;
- optimize or test mobile layouts.

## Plan Boundary And Intermediate State

Purpose inventory, fixed and recommended Studio settings, curated model
presentation, reference guides, external-media attachment behavior, Storyboard
Sheet golden behavior, Studio/CLI projection, audio migration, and restoration
of the complete runnable product are owned by
`plans/active/0135-generation-purpose-guides-and-product-integration.md`.

Plans `0134` and `0135` are two review documents for one replacement program.
They are implementation checkpoints, not independently runnable releases.

Plan `0134` owns the destructive backend replacement. At its completion:

- Engines and Core use only the new generic generation contract and database
  schema;
- obsolete Core dependency, lifecycle, purpose-provider, preview-binding, cost,
  Shot planning/reference-policy, and route/input-mode modules are deleted;
- the Drizzle migration is generated and verified on copied project data but is
  not applied to the real `urban-basilica` project;
- `packages/engines` and `packages/core` pass their focused build, typecheck,
  lint, architecture, and test suites;
- CLI, Studio, and Studio Skills may still import removed contracts and are not
  expected to compile or run until Plan `0135` updates them.

That deliberately non-runnable workspace boundary is accepted. It must be
short-lived and explicit: the final Plan `0134` report lists every remaining
CLI/Studio/Skill caller as Plan `0135` work. Do not add aliases, compatibility
types, dual schemas, translation readers, temporary routes, or fallback logic to
make the intermediate checkpoint runnable.

## Code-Reduction Evidence And Complexity Gate

Before implementation, check in a production-file manifest covering:

- `packages/core/src/server/media-generation/**`;
- `packages/core/src/server/generation-preview/**`;
- generation contracts under `packages/core/src/client/**`;
- generation commands under `packages/cli/src/commands/**`;
- generation routes/projections under `packages/studio/server/**`;
- Studio generation preview, request editing, reference selection, planning,
  hooks, and API code;
- Shot Video code used only for generation planning/reference policy;
- consumers of removed dependency and purpose-specific contracts elsewhere.

Exclude tests, fixtures, migrations, generated metadata, docs, and vendored
code. Tests should also shrink, but production and test counts are reported
separately. The manifest establishes evidence and review scope; it does not
create a numeric acceptance target.

Combined Plan `0134` + `0135` completion requires a reviewer to see a very
significant reduction in both production code and complexity:

- substantially more production code deleted than added;
- dependency planning, recursive estimation, pricing-card projection,
  purpose/provider duplication, and related state families deleted rather than
  renamed or moved;
- fewer public contracts, persistence shapes, services, routes, hooks, and UI
  state machines in the final architecture;
- surviving large or branch-heavy files inspected for hidden consolidation;
- no excluded folder, adapter, Skill, or Engines module containing relocated
  policy;
- baseline/final line and file counts reported as supporting evidence, with no
  pass/fail percentage.

If the diff is not obviously and significantly simpler under those measures,
the slice fails architecture review regardless of its line count.

## Current Architecture Removal Map

This is the combined-program deletion map. Plan `0134` physically deletes the
obsolete Engines/Core backend paths. Plan `0135` deletes or replaces the CLI,
Studio server, React, and Skill callers that remain broken at the intermediate
checkpoint.

### Delete Entirely

- `packages/core/src/server/media-generation/dependencies/**`;
- `packages/core/src/server/media-generation/lifecycle/purpose-definitions/**`;
- dependency service, draft, selector, inventory, plan, checklist, and pricing
  modules;
- dependency ids/kinds/slots and purpose dependency files;
- purpose-specific preview bindings;
- purpose-specific spec/model/validate/create/update/prepare/estimate/run service
  entries;
- Shot Video planning, preflight, required/default/override inclusion policy,
  input-policy, dependency-selection, and graph estimate code;
- Core/Engines dependency and production-plan surfaces in Plan `0134`;
- CLI/Studio dependency and production-plan surfaces in Plan `0135`;
- tests whose accepted behavior is removed.

### Replace Directly

- purpose-specific client spec unions with one `generation.ts` contract;
- Core purpose/provider modules with generic generation services and one small
  context/reference-guide definition file per purpose;
- Generation Preview purpose builders with one provider-payload projection;
- broad `ProjectDataService` generation inventories with focused commands;
- Shot reference policy maps with exact guide-placed selections and one authored
  include/exclude boolean;
- Studio purpose-specific generation drafts with one local editor state.

### Retain And Narrow

- Engines provider catalogs, provider schemas, pricing, execution, input-file
  upload/loading, request hashing, and receipts;
- generic spec/run database concepts;
- exact-request live approval;
- domain-neutral UI preview/card controls;
- existing Studio reference sections, cards, grids, alternate pickers, preview/
  playback, Image Revision actions, save feedback, and desktop layouts;
- Shot take authoring ownership of guide-placed selections before a provider
  request is finalized;
- focused output import/attachment commands;
- asset-file generation provenance that remains valid after migration.

## Architecture Shape Gate

### Ownership

`packages/core` owns:

- generic purpose/target/output contracts;
- generic context and reference-guide projection contracts;
- reference catalog projection;
- exact project-file resolution;
- exact editable spec persistence;
- preview, estimate, approval, run recording, and focused import commands.

`packages/engines` owns:

- actual provider/model catalog;
- provider JSON schemas;
- classification of provider fields as text/parameter/media inputs;
- media field type/cardinality;
- full provider payload assembly and validation;
- pricing, execution, uploads, and output normalization.

CLI and Studio adapters parse/serialize and render only. They contain no
purpose/reference/provider rules.

### Maximum Core Layout

```text
packages/core/src/
  client/
    generation.ts

  server/generation/
    purposes.ts
    context.ts
    references.ts
    specs.ts
    validation.ts
    previews.ts
    estimates.ts
    runs.ts
```

This is a ceiling. Do not create a file that is only a pass-through. There is
no dependency tree or parallel lifecycle definition. Plan `0135` owns the one
purpose-definition tree and must keep it outside these generic service files.

### Public Core Commands

- `buildGenerationContext`;
- `listGenerationReferences`;
- `listGenerationModels`;
- `validateGenerationSpec`;
- `createGenerationSpec`;
- `updateGenerationSpec`;
- `readGenerationSpec`;
- `listGenerationSpecs`;
- `buildGenerationPreview`;
- `estimateGeneration`;
- `runGeneration`;
- `readGenerationRun`;
- focused domain import commands.

Core `index.ts` files export contracts/commands only.

### Purpose Contract Seam

The foundation defines stable `GenerationPurpose`, `GenerationTarget`,
`GenerationContext`, and `GenerationReferenceGuide` contracts. Plan `0135` owns
the one purpose descriptor tree, product settings, model presentation, candidate
queries, and guide definitions. Generic validation must never call that tree.

### Forbidden Shape

Stop and redesign if implementation introduces:

- generation dependency management in any package;
- a Renku route/input-mode layer above provider models;
- purpose-specific provider payload builders or model lists in Core;
- parallel draft/executable spec contracts or persistence;
- automatic provider fallback, provider-field assignment, or parameter repair;
  approved initial product settings/selections live only in Plan `0135`;
- request repair or fallback;
- context/reference-guide queries during provider validation;
- a `required`, `defaultSelected`, generation-purpose, cost, or provider-field
  property in a purpose guide;
- a second guide declaration in Studio, CLI, Skills, or another Core tree;
- a generic slot dependency resolver, recursive guide resolver, or guide pricing
  service;
- a domain-relation/candidate-source mini-language that recreates case-specific
  purpose logic as a generic rules engine; keep mechanical candidate queries in
  the owning purpose definition;
- missing-guide fallback behavior;
- provider schema duplication in Core or Studio;
- compatibility readers for old generation JSON;
- a god service, broad switchboard, or parallel contract family.

## Provider Model Contract

Use the existing provider/model endpoint as identity. Extend Engines' existing
model input descriptor rather than creating a route catalog:

```ts
interface GenerationModelInputFieldDescriptor {
  name: string;
  label: string;
  kind: GenerationModelInputFieldKind;
  productSettingKind?: 'aspect-ratio' | 'quality';
  required: boolean;
  defaultValue?: GenerationModelInputValue;
  allowedValues?: GenerationModelInputScalarValue[];
  minimum?: number;
  maximum?: number;
  description?: string;
  media?: {
    acceptedKinds: Array<'image' | 'audio' | 'video'>;
    cardinality: 'one' | 'many';
    minimum: number;
    maximum: number;
  };
}

interface GenerationModelDescriptor {
  provider: string;
  model: string;
  outputMediaKind: 'image' | 'audio' | 'video';
  fields: GenerationModelInputFieldDescriptor[];
}
```

Rules:

- `name` is the actual provider field, such as `prompt`, `text`, `image_urls`,
  `start_image_url`, or `audio_urls`;
- `media` exists only for file-backed provider fields;
- `productSettingKind` exists only when the field implements one of the narrow
  Studio product settings accepted in Plan `0135`; Engines owns this mapping;
- Engines derives/maintains this metadata with the provider schema it already
  owns;
- Core/Studio do not guess media fields by name;
- provider schema defaults may be displayed as provider information but are not
  inserted into authored values, local editor state, saved specs, preview
  payloads, approval hashes, or outbound payloads merely because the user left
  the field untouched. The external provider applies omitted optional defaults;
- if the user or agent explicitly authors a value equal to the provider default,
  it is retained and sent because it is authored intent;
- model listing may filter by output media kind or provider capability only,
  never by creative purpose policy.

Provider descriptors and the full provider schema are the only source of hard
input requirements. This includes:

- required first frame, last frame, source image/video, reference collection,
  or audio fields;
- conditional rules such as “last frame requires first frame”;
- mutually exclusive fields such as frame inputs versus general reference
  images;
- scalar/array cardinality and minimum/maximum counts;
- media kind, MIME/format, dimensions, duration, and file-size constraints when
  deterministically knowable before upload;
- required prompt/text and all non-media parameter constraints.

The purpose guide may display slots named First Frame and Last Frame, but those
names do not create a requirement. Selecting a provider endpoint whose schema
requires first/last-frame fields does. If the selected endpoint does not support
an included reference, validation reports the actual provider-field conflict and
does not reinterpret the reference or choose another endpoint.

Provider/purpose/reference separation examples and their product-facing tests
are maintained in Plan `0135`. The foundation rule is mechanical: provider
schemas determine executability; purpose guide placement never does.

## Generic Generation Contract

```ts
interface GenerationSpec {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  model?: {
    provider?: string;
    model?: string;
  };
  values: Record<string, JsonValue>;
  references: GenerationReferenceSelection[];
  title?: string;
}

interface GenerationReferenceSelection {
  id: string;
  placement:
    | {
        kind: 'slot';
        sectionId: string;
        slotId: string;
        scope?: {
          kind: string;
          id: string;
        };
        subject?: {
          kind: string;
          id: string;
        };
      }
    | { kind: 'additional' };
  included: boolean;
  providerField?: string;
  reference: GenerationReference;
}

type GenerationReference =
  | {
      kind: 'asset-file';
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'project-file';
      projectRelativePath: ProjectRelativePath;
    };
```

An ad-hoc reference has no special generation semantics. If Renku generated the
media through `image.create`, that earlier generation retains its own spec and
the output is explicitly attached as an exact reference. If a user supplies
external media, it has no Renku generation spec and is attached directly through
the existing focused target-owned media boundary. It remains opaque and is not
promoted to reusable project catalog media. Do not add an upload-session model,
synthetic generation spec, or fake provenance for external media.

`values` contains provider fields that are not file-backed media fields. This
includes prompt/text, negative prompt, duration, size, quality, output count,
voice id, and complex provider objects when supported.

`references` preserves the exact file, visible guide placement, subject scope,
and authored order needed to reopen the Studio UI without flattening it. A
selection with `placement.kind === 'additional'` belongs to the universal
Additional References collection. Multiple ordered selections may share a
provider array field. A scalar provider field accepts exactly one.

`id` is a stable selection identity used by save/remove/reorder operations. It
is not a dependency id and has no generation semantics. `placement` controls UI
projection only. `providerField` controls provider payload assembly only. The
two are intentionally independent.

`included` is explicit user/agent intent needed by the existing Studio controls.
Excluding a selection keeps the chosen file and its slot placement so it can be
included again without repicking. It replaces the current required/default/
override machinery with one boolean. Only included selections enter provider
validation and payload assembly.

Labels, MIME type, media kind, owner, role, provenance, thumbnails, and playback
URLs are resolved projections, not duplicated authored spec state.

Validation rejects:

- missing/unknown provider or model;
- purpose target/output mismatch;
- unknown fields;
- authored `values` for media fields;
- included reference with no provider-field assignment;
- reference assigned to a non-media field;
- wrong media kind;
- missing required media/text/parameter fields;
- invalid scalar/enum/object values;
- too few/many media inputs;
- unsafe/missing project files;
- provider payload schema failure.

Validation does not reject a reference based on its guide section/slot, asset
role, owner, purpose, candidate membership, or creative meaning. Empty guide
slots do not participate in validation.

This is the only saved editing contract. It deliberately represents both early
partial work and a request that may be executable. There is no second draft
contract and no second persisted executable-spec shape. CLI/agents may save it
at any point and submit it to validation when they want readiness feedback.

## Validation And Provider Payload

```ts
type GenerationValidationReport =
  | {
      valid: true;
      spec: GenerationSpec;
      diagnostics: DiagnosticIssue[];
    }
  | {
      valid: false;
      diagnostics: DiagnosticIssue[];
    };
```

Validation flow:

1. Validate the current generic envelope, purpose target, and output kind.
2. Load the selected provider model and its provider schema from Engines.
3. Validate authored non-media `values`.
4. Resolve every exact reference to a safe project file.
5. Group ordered reference selections by actual provider field.
6. Check field existence, media kind, scalar/array shape, and cardinality.
7. Build logical provider values for those files.
8. Assemble the complete provider payload.
9. Validate the full payload against the provider schema.
10. Return all independent issues or the unchanged authored spec marked valid.
    Validation does not normalize or repair it. Keep the assembled payload,
    resolved local paths, and transport-only details inside Core/Engines.

No step reads context, reference-guide sections/slots/candidates, project
defaults, or previous specs. It reads only the saved spec, included exact
references, resolved files, and selected provider descriptor/schema.

Payload assembly preserves omission. It does not materialize schema defaults
before validation, estimation, approval hashing, or execution. Tests must cover
an untouched defaulted field remaining absent all the way to the provider
adapter, as well as an explicitly authored equal value remaining present.

`createGenerationSpec` and `updateGenerationSpec` do not call this path. They
preserve partial authored state after storage-envelope, owner, and guide
placement structure checks.
Explicit validation, estimate, and approval use this path for feedback. Run
always calls it again and never invokes a provider after a predictable failure.

## Context And Reference Catalog Seam

The foundation exposes paginated exact reference catalog items with reference
identity, meaningful label, media/MIME, owner, role, and provenance. Filters are
mechanical only: media kind, owner kind/id, asset role, and text search. It never
selects, truncates, or interprets creative media.

Plan `0135` owns purpose sections, slots, candidates, target-owned external
attachments, current selections, browser URLs, and Studio/CLI projection. Generic
provider validation reads only the spec's included exact references and never
queries context, guide placement, candidates, or slot occupancy.

## Preview, Estimate, Approval, And Run

`GenerationPreview` is a projection of saved or unsaved editing state:

- provider/model identity;
- all authored provider values;
- purpose guide sections/slots in approved order;
- exact reference selections in authored order, including excluded and
  provider-unassigned selections;
- resolved media/MIME information where available;
- editing/display warnings such as a referenced file no longer being available.

The UI obtains schema-derived controls from `listGenerationModels` and obtains
price/approval from `estimateGeneration`; Preview does not duplicate either.

Studio server adds safe `browserUrl` values to reference/catalog items. HTTP URLs
are never persisted.

Preview does not require provider readiness. Empty guide slots, missing models,
unassigned references, and incomplete values remain visible and editable. A
provider-payload projection is shown only after explicit validation succeeds;
its absence does not prevent the rest of Preview from rendering.

Estimate prices only the one validated provider payload, assuming all exact
immediate inputs are already resolved. It never reads guide slots, walks a
reference's provenance/dependencies, prices missing creative work, or aggregates
other generations. Pricing remains available in the explicit estimate/approval
flow only; no generation, reference, dependency, or model card displays a price
tag or badge.

The exact-request approval hash covers provider/model, complete logical provider
payload, ordered reference file content digests, and output-affecting values.
Changing a file in place invalidates the token just like changing a field.

If the accepted approval workflow requires a price and pricing cannot be
computed, estimate fails with a structured error and run is unavailable. Do not
treat an unknown required price as zero or silently permit execution.

Run revalidates, verifies approval, executes once, records the exact spec/payload
snapshot and receipt, and does not import outputs automatically.

## Persistence And Migration

Retain `media_generation_spec` and `media_generation_run` as generic concepts.

`media_generation_spec` keeps:

- `id`, `purpose`, `target_kind`, `target_id`, nullable `provider`, nullable
  `model`, `title`, `values_json`, `references_json`, `created_at`, and
  `updated_at`.

Each authored field has one stored representation. Do not also store a complete
mutable `spec_json` mirror.

`media_generation_run` keeps the immutable validated spec snapshot, provider
request snapshot, estimate/approval facts, outputs, receipt/diagnostics, and
timestamps. The snapshot is run provenance, not mutable mirrored state. Remove
`model_choice`; add no route id or convenience projection mirrors.

Migration:

1. Update the Drizzle TypeScript schema.
2. Generate structural SQL with Drizzle Kit.
3. Document the intentional custom deletion step.
4. Delete obsolete spec/run rows rather than translating old JSON.
5. Allow documented cascades to remove obsolete generation provenance links
   while retaining imported assets/files.
6. Convert explicit Shot General, Lookbook, Cast, Location, dialogue, and custom
   reference selections into the stable section/slot ids declared by Plan
   `0135` under **Stable Guide Placement Identifiers**, retaining exact files,
   subject scope, order, and include/exclude intent.
7. Fail the migration with a report when an old explicit selection cannot be
   resolved unambiguously. Do not select a replacement or silently drop it.
8. Add no runtime old-shape recognition.
9. Back up and inspect `urban-basilica` before applying.

This plan updates the source-of-truth Drizzle schema, generates/reviews the
migration, and applies it to copied project data for verification. The real
`urban-basilica` database remains backed up and unmigrated until Plan `0135`
restores all public callers and performs the real-project verification. The
repository code and the real project database are therefore intentionally at
different schema generations between the two plans.

## Intermediate Runtime Boundary

This plan replaces and exports the generic Core commands and removes the old
Core generation runtime. It does not add HTTP, CLI, or Studio adapters. Existing
adapters may be broken because their imported contracts no longer exist; that is
the explicit handoff state, not a compatibility requirement.

Plan `0135` owns thin HTTP/CLI adapters, purpose descriptors, Studio behavior
preservation, Skill changes, real-project migration application, and
workspace-wide runtime restoration. No public old or new generation workflow
is required to run at the Plan `0134` checkpoint.

## Structured Diagnostics

Use `@gorenku/studio-diagnostics`. Validation collects all independent issues.
Save/update reports only storage-envelope, ownership, or persistence errors. It
does not emit provider-readiness errors. Estimate/approval/run return the
collected validation issues and make no provider call when the request is not
executable.

Use a small boundary taxonomy rather than one top-level error code per possible
provider-schema failure:

- Core envelope/target/reference failures;
- Engines model/payload-schema failures;
- existing pricing, approval, execution, and provider failures.

Reuse current accepted structured codes where they fit. Add a code only when a
caller needs to distinguish a genuinely different remediation. Provider-schema
issues may share one stable boundary code while carrying distinct paths and
messages; do not maintain a parallel catalog of every provider constraint.

Each issue includes a precise path such as `values.prompt`,
`references.2.providerField`, or `references.2.reference`, plus a direct mechanical
correction. The message may explain a model field or limit; it must not choose a
replacement model/reference or rewrite creative intent.

Do not add warnings about creative relevance. Warnings are limited to actionable
provider/runtime facts such as provider deprecation. Missing information needed
for safe execution, including a required price, is an error rather than a
warning. Plan `0135` guide notices are a separate non-blocking presentation
contract, not validation diagnostics.

## Implementation Slices

No dual runtime is allowed. Plan `0134` replaces the backend contracts directly
and accepts that public adapters are broken until Plan `0135` migrates them.

### Slice 0: Baseline, Feature Inventory, ADR

- check in the production line-count manifest and deletion map;
- inventory user-visible behavior separately from internal abstractions;
- add ADR `0047-use-context-first-provider-valid-generation.md`;
- record generation/provenance rows affected in `urban-basilica`;
- accept the generic contracts and destructive migration.

Exit: foundation contracts are accepted and ADR `0047` records the deliberate
non-runnable handoff to Plan `0135`.

### Slice 1: Engines Model Descriptor And Payload Validation

Expected owners:

- `packages/engines/src/generation/contracts.ts`;
- `generation/catalog/model-input-descriptors.ts`;
- existing model catalog/schema loaders;
- existing payload validation/input-file modules.

Work:

- extend existing model field descriptors with media metadata;
- classify aspect-ratio and quality fields for the Plan `0135` generic product
  settings binder;
- classify all retained image/audio/video provider media fields;
- assemble payloads from `values` plus included, provider-assigned exact
  references;
- reject conflicting authored media fields;
- validate complete payloads with provider schemas;
- preserve omitted optional provider defaults through validation, pricing, and
  execution so the external provider applies them;
- use the same payload for pricing and execution;
- delete superseded Shot Video route/input-mode capability layers.

Exit: every retained provider endpoint can be described, validated, priced, and
run without Core purpose/model logic.

### Slice 2: Generic Core Contract And Database Reset

Expected owners:

- `packages/core/src/client/generation.ts`;
- `server/schema/media-generation.ts`;
- `server/database/access/media-generation.ts`;
- generated Drizzle migration.

Work:

- add the generic spec/reference-selection/guide/context/preview/run contracts;
- remove purpose-specific generation spec/model/report unions;
- replace `model_choice` with direct provider/model spec fields and remove the
  duplicated complete spec JSON blob;
- generate schema migration and custom data deletion;
- migrate explicit old Shot selections into approved guide placements and fail
  with a report on ambiguity;
- update fixtures directly with no old-shape loader.

Exit: partial generic specs round-trip exactly; no provider validation runs on
save/update.

### Slice 3: Remove Backend Dependency Architecture

- classify dependency folders, services, hooks, slots/selectors, inventories,
  drafts, plans, pricing, diagnostics, commands, projections, fixtures, and tests
  by Plan `0134` backend deletion versus Plan `0135` adapter deletion;
- prove the generic foundation has no imports from those capabilities;
- remove dependency checks from the new generic spec create/update path;
- delete obsolete Core dependency, lifecycle, purpose-provider, preview-binding,
  recursive estimate, Shot planning/reference-policy, and Engines
  route/input-mode modules and their removed-behavior tests;
- remove old Core client contracts, ProjectDataService wiring, and package
  exports rather than preserving them for callers.

Exit: no old generation backend is compiled or exported. Remaining broken
CLI/Studio/Skill imports are listed precisely for Plan `0135`.

### Slice 4: Minimal Core Generation Services

Implement:

- paginated exact reference listing;
- Engines model listing;
- complete execution-readiness validation;
- exact create/update/read/list without provider-readiness gating;
- generic preview;
- current-request estimate;
- exact approval/run recording.

Exit: provider/model validation changes touch Engines only, and generic Core
services contain no purpose-specific payload logic.

### Slice 5: Foundation Handoff

- prove every generic Core command can be exercised without purpose-specific
  payload builders or dependency services;
- export the accepted Core contracts and commands for Plan `0135` callers;
- publish the exact broken-caller inventory to the companion plan, grouped by
  CLI, Studio server, React, fixtures/tests, docs, and Studio Skills, with each
  removed import/contract mapped to its direct generic replacement or deletion;
- do not add temporary routes, aliases, compatibility readers, dual schemas, or
  dual writes.

Exit: Engines/Core are complete and focused tests pass; public generation
surfaces are intentionally unavailable until Plan `0135`.

### Slice 6: Foundation Shape Review

- generate final production-file manifest;
- audit excluded folders and Skills for moved complexity;
- inspect all surviving large files and thin entrypoints;
- compare baseline/final files, lines, public contracts, persistence shapes,
  services, routes, hooks, and UI state machines;
- verify that the removed complexity was deleted instead of consolidated into a
  smaller number of large switchboards;
- stop for architecture redesign if the backend replacement is not plainly
  simpler and ready for product integration. The combined very-significant-reduction gate
  is completed in Plan `0135`; no percentage threshold decides it.

## Tests And Guardrails

### Provider Validity

Every invalid example below may still be saved and reopened unchanged. Failure
applies to validation/estimate/approval/run, never ordinary save/update.

- unknown or absent provider/model can be saved, then validation/estimate/run
  rejects it;
- missing required prompt/text can be saved, then validation/estimate/run
  rejects it;
- image-edit without required image can be saved, then validation/estimate/run
  rejects it;
- text-to-image with an image can be saved, then validation/estimate/run rejects
  it;
- wrong media kind/field can be saved, then validation/estimate/run rejects it;
- included reference with no provider-field assignment can be saved, then
  validation/estimate/run rejects it;
- provider-required first-frame/last-frame/source/reference/audio fields fail
  when their actual assigned inputs are missing;
- provider conditional and mutually-exclusive media-field rules fail before any
  provider call;
- an empty Character/Location/Lookbook guidance slot does not fail when the
  provider payload is otherwise valid;
- scalar media field with multiple included references fails;
- array field preserves input order and enforces limits;
- unknown/invalid values fail provider schema validation;
- every predictable failure makes zero provider API calls;
- compatible arbitrary project media succeeds regardless of purpose/owner/role;
- explicit validation, estimate, approval, and run check the same assembled
  payload;
- changed files/catalog invalidate before provider execution.

### No Fallback Or Creative Policy

- validation never queries context, reference guides, candidates, or slot
  occupancy;
- exact references never substitute primary/selected files;
- model changes never auto-map/drop references or rewrite values;
- Core accepts the same provider-compatible file across unrelated purposes;
- no child generation/plan/price is created;
- prompts and provider values are preserved exactly;
- invalid candidates remain invalid until user/agent changes them.

### Companion Surface Guardrails

Context/reference-guide correctness, Studio characterization, curated models,
fixed/recommended settings, Storyboard behavior, and CLI projection are tested in
Plan `0135`. Foundation tests here must expose enough exact metadata for those
surface tests without implementing product policy in adapters.

### Persistence And Migration

- generic specs/runs round-trip provider/model/values/reference placement,
  subject scope, order, include/exclude state, provider assignment, and exact
  files;
- partial and provider-invalid create/update round-trip without correction;
- save/update does not call Engines provider validation;
- save rejects only unrenderable structural state such as unknown guide
  placement, duplicate selection id, or two choices in a `one` slot;
- empty slots, excluded choices, missing model, and provider-unassigned choices
  remain saveable;
- old JSON is absent and unrecognized after migration;
- imported assets/files survive documented generation-row deletion;
- explicit old Shot selections migrate to the same visible guide placements;
- ambiguous old selections fail migration with a report and no replacement;
- obsolete provenance links and Shot dependency-policy state are removed as
  documented.

### Architecture

- generic validation returns all actionable issues and performs no write;
- Plan `0134` adds no CLI/HTTP/Studio adapter; Plan `0135` restores those
  surfaces directly on the new contracts;
- Core generation cannot import provider SDKs or Studio code;
- Plan `0135` purpose context files cannot import provider payload/execution
  code;
- pricing cannot import execution;
- architecture tests protect capabilities/import paths, not private names or
  complete inventories.

## Documentation

- accept the backend replacement and non-runnable handoff in ADR `0047`;
- rewrite current generic generation architecture and persistence references;
- update the architecture-test registry for the generic boundary;
- leave purpose, CLI, Studio workflow, and Skill documentation to Plan `0135`;
- update directly conflicting active plans and leave historical docs unchanged.

## Final Verification

Run:

```bash
pnpm build:core
pnpm test:engines
pnpm --dir packages/core test
pnpm --dir packages/core lint
pnpm --dir packages/engines lint
```

With `urban-basilica`, inspect the existing generation rows, explicit Shot
selections, and provenance links before migration. Exercise generic spec
round-trip, migration, and provider validation on a copied project database.
Do not apply the migration to the real project. Plan `0135` owns end-to-end
Studio/CLI purpose scenarios and real-project migration application.

Workspace-wide `pnpm build`, `pnpm test:cli`, Studio tests, and `pnpm check` are
not Plan `0134` acceptance commands. Their generation-related failures are the
expected handoff inventory; unrelated failures remain defects. Plan `0135` must
restore all root commands before completion.

Review `git diff --stat`, complete diff, foundation manifest, large files, thin
`index.ts` entrypoints, deleted backend trees, remaining adapter callers, and all
excluded folders for moved complexity. Plan `0135` verifies final adapter
replacement and combined reduction.

## Completion Evidence

Completed on 2026-07-12.

- Core: build, lint, 161 tests, and test type-check pass.
- Engines: build, lint, 703 tests, and test type-check pass.
- The old Core/Engines generation backend and client contract families are
  physically absent.
- The manifest scope fell from 188 production files / 52,319 lines to 69 files /
  16,950 lines at this checkpoint; counts are review evidence, not a quota.
- Drizzle migration `0052_context-first-generation.sql` was applied to a fresh
  copy of Urban Basilica. It produced schema generation 42, 13 generic Shot
  specs, 31 exact references, 30 version-3 take states, no retired generation
  state paths, `quick_check=ok`, and no foreign-key violations.
- The live Urban Basilica database remains unmigrated and its verified backup
  remains at
  `$HOME/renku-movies/urban-basilica/.renku/backups/project.sqlite.before-0134-20260712.sqlite`.
- Every remaining CLI, Studio, and Studio Skills caller is assigned in
  `docs/architecture/reference/context-first-generation-caller-handoff.md`.

## Completion Checklist

### Review And Architecture

- [x] Accept Fixed Decisions and ADR `0047`.
- [x] Confirm Studio is creatively permissive and provider-strict.
- [x] Confirm partial specs can be saved without provider validation.
- [x] Confirm every provider execution passes full payload validation
      immediately before the external call.
- [x] Confirm every generation has immediate inputs/outputs only.
- [x] Confirm final files match the Architecture Shape Gate.
- [x] Confirm no god service, route layer, parallel purpose tree, compatibility
      layer, or fallback was added.

### Code Reduction

- [x] Check in/review baseline manifest and deletion classification.
- [x] Prove the foundation does not import or recreate dependency capabilities.
- [x] Hand the combined deletion inventory to Plan `0135`.
- [x] Use counts as evidence, not a quota; complete the combined reduction gate
      only after Plan `0135` product integration.

### Contracts And Engines

- [x] Add generic provider/model/values/reference-selection spec contract.
- [x] Extend existing model field descriptors with media metadata.
- [x] Add Engines-owned aspect-ratio/quality setting-field classification for
      the Plan `0135` generic binder.
- [x] Use actual provider field names; add no route/input-mode mapping layer.
- [x] Assemble and schema-validate the complete provider payload in Engines.
- [x] Once valid, use one assembled payload for provider-payload preview,
      pricing, approval, and execution.
- [x] Keep provider defaults out of authored values.
- [x] Preserve omitted provider-defaulted fields through local state, saved spec,
      preview, approval hashing, and outbound payload assembly; send an equal
      value only when explicitly authored.
- [x] Enforce provider-required, conditional, mutually-exclusive, count, media,
      format, size, dimension, duration, and parameter rules where knowable
      before the provider call.
- [x] Define direct replacements for purpose-specific spec/model/report unions
      and Core payload builders without exposing parallel public contracts.

### Core

- [x] Implement generic references, models, editable create/update/read/list,
      preview, validation, estimate, approval, run, and run-read internals.
- [x] Save/update partial authored state without provider validation or repair.
- [x] Validate before estimate/approval/run and make no provider API call on
      failure.
- [x] Always revalidate immediately before run, even after prior successful
      validation or estimate.
- [x] Resolve exact files without substitution.
- [x] Never query context, reference guides, candidates, or slot occupancy during
      provider validation.
- [x] Keep generic services independent from Plan `0135` purpose definitions.
- [x] Keep output import explicit and focused.
- [x] Keep Core entrypoints thin.

### Implementation Slices

- [x] Complete baseline/ADR, Engines descriptors, generic contracts, dependency
      removal, generic services, handoff, and foundation shape
      review.
- [x] Export only the accepted generic Core contracts and commands needed by
      Plan `0135`.
- [x] Split modules before adding branches that mix validation, persistence,
      pricing, execution, or result formatting.

### Dependency And Fallback Removal

- [x] Classify dependency folders/contracts/hooks/plans/pricing/tests for
      Plan `0134` backend deletion or Plan `0135` adapter deletion.
- [x] Prove generic foundation code has no dependency-planning imports.
- [x] Add no parameter repair/clamping, unknown-field stripping, semantic retry,
      old-shape recognition, or obsolete diagnostics.
- [x] Physically delete the old Core/Engines backend paths and removed-behavior
      tests in Plan `0134`.

### Companion Contract Handoff

- [x] Expose exact context/reference/model metadata required by Plan `0135`.
- [x] Keep purpose settings, curated models, UI, CLI, and Skills in the companion
      plan.
- [x] Record every broken CLI/Studio/Skill caller for Plan `0135` without adding
      a temporary adapter, alias, or second runtime.
- [x] Map each removed backend export to direct caller replacement or deletion
      work; do not leave unresolved “fix callers later” buckets.

### Database

- [x] Update Drizzle schema and generate migration with Drizzle Kit.
- [x] Document custom deletion and inspect/back up `urban-basilica`.
- [x] Review affected spec/run/provenance/Shot state and apply the migration only
      to a copied project database.
- [x] Preserve imported assets/files.
- [x] Encode the reviewed Shot selection migration and ambiguity failure rules.
- [x] Leave real-project migration application and old-row deletion to Plan
      `0135` product integration.
- [x] Add no migration-at-read or compatibility path.

### Intermediate Product Boundary

- [x] Leave purpose descriptors, Studio UI, CLI adapters, Skills, and complete
      public runtime restoration to Plan `0135`.
- [x] Accept and document that public generation surfaces do not compile or run
      at the Plan `0134` checkpoint.
- [x] Add no compatibility layer to hide the deliberate intermediate break.

### Tests And Documentation

- [x] Add provider-validity, no-fallback, persistence, and migration tests listed
      above.
- [x] Add stable package/import-boundary tests.
- [x] Keep architecture tests free of private helper/inventory names.
- [x] Add the foundation half of ADR `0047` and update current generic generation
      architecture docs.
- [x] Leave purpose/UI/CLI/Skill documentation to Plan `0135`.
- [x] Leave historical plans/ADRs unchanged.

### Final Verification

- [x] Run Engines/Core-focused build/test/lint commands; do not require root,
      CLI, or Studio verification at this checkpoint.
- [x] Exercise generic spec round-trip and validation on copied
      `urban-basilica` data.
- [x] Review foundation diff, deletion inventory, and all large files.
- [x] Confirm no old backend, second runtime, compatibility adapter, or
      real-project migration application exists.
- [x] Confirm every remaining broken public caller is assigned to Plan `0135`.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no checklist item relies on unreviewable code structure.
- [x] Only then mark the plan complete.
