# 0047 Use Context-First Provider-Valid Generation

Date: 2026-07-12

Status: accepted

## Context

Renku Studio's media-generation runtime accumulated two different kinds of
policy in one system:

- project context and reference presentation intended to help a person or
  agent make a creative choice;
- provider requirements that determine whether one concrete request can be
  executed.

Dependency graphs, purpose-specific spec unions, route/input-mode mappings,
recursive estimates, and provider payload builders blurred those concerns.
They also made purpose guidance behave like a hard creative requirement even
when a provider could accept a different project file.

Creative prompts and media remain opaque under Decision `0041`. Persisted
editing state and explicit output import remain separate under Decision `0020`.

## Decision

Renku Studio will provide project context and reference guidance without
deciding creative dependencies. Provider model schemas are the sole source of
execution requirements.

One persisted `GenerationSpec` stores:

- purpose and exact target;
- optional actual provider/model endpoint identity;
- explicitly authored non-media provider values;
- ordered exact project references, their optional UI guide placement, and
  optional authored provider media-field assignment;
- optional authored title.

The saved contract represents incomplete editing state as well as executable
state. Presence in the reference list means inclusion. Create and update
validate only the durable envelope and structurally readable placement. Current
purpose guides and candidate lists are presentation projections, not persistence
validation. Core does not invoke provider validation, insert provider defaults,
repair values, assign media fields, select references, or switch models.

Estimates consume pricing inputs only: provider, model, output media kind,
explicitly authored pricing values, provider-owned pricing defaults where the
pricing contract supplies them, and intended input-media counts. Estimation
does not resolve files, require creative prompts or references, assemble an
executable provider payload, or invoke execution validation. Missing pricing
facts produce an ordinary price-unavailable diagnostic without mutating the
spec.

Before provider-payload preview or execution, Core resolves every included
exact file without substitution. Engines classifies actual provider fields,
assembles one logical payload, and validates the complete payload against the
selected provider schema. Run repeats that validation immediately before the
provider boundary. Pricing approval and execution readiness remain separate
contracts.

Every generation has immediate inputs and outputs only. Estimates price one
request. Outputs are attached through focused domain import commands; a run
never plans or imports another generation.

Purpose descriptors own target/output identity, context, product presentation,
and optional typed reference guides. Every guide slot is one nullable UI choice
and has no provider field, requiredness, default-selection, generation-purpose,
or cost semantics. Every purpose permits ordered Additional References.
Generic provider validation never reads context, guide sections, candidates,
selections, or slot occupancy.

Provider values are absent until authored. In particular, duration has no
Studio default: `Unspecified` presents authored absence and is not an `Auto`
value. Provider omission behavior belongs to the provider contract, while
Engines reports schema-invalid omission only during payload preview or run.

Engines continues to own the actual provider/model catalog, JSON schemas,
provider field metadata, media cardinality, product-setting field
classification, pricing, uploads, and execution. Renku route ids and input-mode
abstractions are removed rather than translated.

Plan `0134` replaces the source-of-truth project schema and generates the
one-way development migration while deleting the old Engines/Core backend.
Plan `0136` updates public callers and applies that migration to real projects.
No compatibility path bridges those implementation slices. Obsolete generation
spec/run rows are deleted rather than read through a compatibility path.
Explicit Shot selections are migrated only when exact files and guide
placements are unambiguous; ambiguity aborts with a report. Imported assets and
files survive even when obsolete generation provenance links cascade away.

The existing Preview, Image Revision, Scene Dialogue Audio, and Shot Video Take
experiences use focused Core resources that compose the same generic lifecycle.
They do not define second spec/run types. Shot take design state remains a
separate version-3 domain contract with generation values and exact references
stored only in the active generic spec.

## Superseded And Narrowed Decisions

This decision supersedes the generation dependency graph in Decision `0032`,
the scoped Shot reference-policy contracts in Decisions `0038` and `0039`, and
purpose cost projections in Decision `0042`.

It narrows Decision `0044`: Engines keeps catalog, pricing, validation, and
execution ownership, but Core's dependency, lifecycle, cost-registry, and
purpose-provider module families are removed. It narrows Decision `0045`:
Generation Preview remains a user interaction, but purpose-specific preview
bindings and provider payload builders are replaced by the generic spec,
reference guide, and validated payload projection.

## Preserved Product Behavior

Removing those backend contracts does not authorize removal of the Studio
interaction behavior they currently feed. Plan `0136` must preserve the
desktop Preview and Regenerate/Edit dialogs, reference sections and slots,
alternate pickers, media preview and playback, Image Revision actions, Shot
scope, save feedback, and explicit estimate/approval/run flow. Intentional UI
changes are limited to those accepted in that companion plan.

## Consequences

- Any compatible project image, audio, or video can serve any creative purpose.
- Invalid and incomplete specs can be saved and reopened exactly.
- Predictable provider failures return structured diagnostics before a provider
  call and never mutate authored intent.
- Provider defaults remain omitted unless explicitly authored.
- Changing provider/model pricing inputs can change the price-approval token.
  Creative values, ordered references, and file contents still require a new
  validation, Preview, estimate review, and explicit live-run confirmation,
  but may preserve the token when their pricing facts are unchanged.
- Studio, CLI, and Skills consume Core contracts and do not duplicate purpose or
  provider rules.
- There is no compatibility reader, dual write, fallback model, request repair,
  recursive estimate, dependency generation, or parallel public runtime.
- External attachments remain target-owned and have no synthetic spec or
  provenance. Exact outputs attached with a matching receipt retain their real
  earlier generation run.
- Studio retains its pre-cutover desktop experience except for the approved
  removal of non-current-request pricing, the AI Production Status column, and
  the two Location/Lookbook **Assets** labels.
