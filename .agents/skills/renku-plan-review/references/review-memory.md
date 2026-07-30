# Renku Plan Review Memory

This file stores reusable lessons from explicit user feedback on Renku Studio
plans. The `renku-plan-retrospective` skill maintains it, and the `renku-plan`
and `renku-plan-review` skills read it before planning or reviewing.

Accepted documents under `docs/` remain the source of truth. Memory entries are
attention cues and planning heuristics; they must not override a current product
or architecture decision.

## Learned Constraints

### 2026-07-19 — Convert local development data instead of preserving obsolete contracts

- **User objection:** A review treated old values in the single local sample
  database as a reason to keep or choose an obsolete product name. A later plan
  made the opposite mistake: it applied a “no existing data” instruction about
  one never-created Shot-image schema to a cross-domain Asset refactor even
  though the sample project already contained Cast, Location, Lookbook,
  Storyboard, Dialogue Audio, and generic relationship rows.
- **Planning rule:** When the user confirms the current product contract and
  only pre-customer development data uses the old contract, plan one verified
  one-way data conversion, update every current caller and document directly,
  and remove the old value from runtime code. Do not add aliases, dual-role
  matching, fallback readers, or compatibility diagnostics. Scope “no data”
  assumptions to the exact tables and migrations proven empty or unapplied;
  every populated table affected by a broader schema change needs an explicit
  preservation mapping and verification.
- **Apply when:** Repository code and accepted docs disagree with the intended
  product name while the conflicting persisted state is limited to local sample
  projects that can be backed up and upgraded once, or when a new feature
  triggers consolidation of already-populated neighboring domain tables.
- **Evidence to inspect:** Search current contracts, relationship roles, asset
  types, persisted JSON keys, storage paths, tests, documentation, sister
  skills, the Drizzle journal and applied schema generation, and per-table rows
  in the real sample database. Identify duplicate Asset ownership and file-path
  cases before defining the conversion; keep obsolete wording only in the
  one-way conversion or explicit historical records.

### 2026-07-19 — Trace concepts to needs without erasing requirement detail

- **User objection:** A focused product request first expanded into a roughly
  two-thousand-line plan containing invented machinery and was then overcorrected
  into a shorter plan that made the requested UX, agent workflow, implementation
  shape, and checklist too vague. Line count was never the objective.
- **Planning rule:** Build a requirement ledger from explicit user needs,
  user-accepted findings, current documented rules, and hard boundaries. Trace
  it both ways: remove every unsupported behavior or mechanism, but preserve
  every accepted UX detail, workflow step, supported variant, data effect,
  implementation owner, verification, and checkable completion item. Prefer
  extending the existing owner and remove repeated explanation, not requirement
  detail. Once the user has decided an issue, rewrite the active plan around the
  accepted behavior. Remove rejected alternatives, decision-question labels,
  reviewer back-and-forth, and the chronology of how the plan evolved unless
  that history is itself required implementation context.
- **Apply when:** A small user-visible change produces many new response types,
  modes, services, dispatchers, diagnostics, routes, documentation edits, or
  repeated plan sections, or when simplification replaces exact requirements
  with phrases such as “update callers,” “update the skill,” or “test normally.”
- **Evidence to inspect:** Compare the product request with every in-scope item,
  new concept, proposed file, validation, documentation target, verification
  step, and checklist group; identify existing owners that can be changed
  directly, then confirm no accepted requirement disappeared during compression.
  Search the final plan for superseded option labels, unresolved-decision
  language, and explanations of rejected models that implementers no longer
  need.

### 2026-07-22 — Follow the repository's established implementation-plan structure

- **User objection:** A new active plan used an ad hoc format and omitted the
  architecture guidance and review structure present in the plan template and
  recent active plans.
- **Planning rule:** Before drafting, read `plans/PLAN_TEMPLATE.md` and inspect
  the section structure of the roughly ten most recent comparable active plans.
  Use the established sequence of summary, accepted scope or requirements,
  context and evidence, Architecture Shape Gate, named contracts,
  implementation slices, owning-layer tests and guardrails, documentation,
  final verification, and a comprehensive completion checklist. Adapt sections
  only when the work genuinely does not need them; never omit the Architecture
  Shape Gate for production-code changes.
- **Apply when:** Creating or substantially rewriting an active implementation
  plan, especially when an earlier draft grew its own requirement, decision,
  or review taxonomy.
- **Evidence to inspect:** Compare headings and checklist depth against the
  template and recent plans; verify that package ownership, intended module and
  file layout, public entrypoints, thin `index.ts` boundaries, forbidden code
  shapes, and architecture stop conditions are explicit before review.

### 2026-07-23 — Keep optional context references soft and warning-based

- **User objection:** A plan turned optional creative-context references into
  foreign-key and hard-validation rules, so later changes to the referenced
  creative document could invalidate otherwise usable durable work.
- **Planning rule:** First classify a reference as ownership/integrity or
  optional context. For optional context, preserve the authored identifier,
  allow the referenced object to change or disappear, resolve available context
  best-effort, and return structured stale/missing-reference warnings. Do not
  reject writes, fail reads, cascade-delete the referring object, or require the
  UI to repair it before the user or an agent can continue.
- **Apply when:** Durable project data points to versioned or mutable creative
  material only to help a user or agent understand context, especially when
  prompting or an explicit later update can compensate for missing context.
- **Evidence to inspect:** Confirm whether the relationship owns lifecycle or
  merely supplies guidance; inspect source revision/deletion behavior, proposed
  foreign keys and validators, read/report warning contracts, and whether an
  agent can receive the available context plus enough diagnostics to ask the
  user what to do next.

### 2026-07-23 — Separate normal workflow guidance from durable invariants

- **User objection:** A plan turned normal product behavior—such as not
  attaching meaningless simulation output and usually receiving one provider
  output—into additional data-layer rejection rules and output-count
  validation.
- **Planning rule:** Enforce only invariants needed to keep durable state
  coherent. Describe normal application or agent behavior without adding a
  validator when an unusual path can still be represented safely. In
  particular, do not create status-specific or provider-output-count machinery
  when attachment already identifies one exact file and the durable model owns
  one final Asset.
- **Apply when:** A requirement describes what the ordinary UI, CLI, agent, or
  provider path does most of the time but does not require corrupt or ambiguous
  durable state to be rejected.
- **Evidence to inspect:** For every proposed validation, identify the invalid
  persisted state it prevents, whether an existing envelope or identity check
  already protects that state, and whether the rule belongs to a caller's
  normal workflow instead.

### 2026-07-23 — Stop when revision planning turns into dependency infrastructure

- **User objection:** A proposed unified revision-owned Asset plan expanded a
  narrow product need into a large dependency-management and lifecycle system
  with little immediate product value, including machinery the product had
  intentionally removed before.
- **Planning rule:** Do not infer a cross-product revision or dependency
  framework from a purpose-specific media need. If the requirement cannot be
  satisfied simply within accepted current ownership boundaries, stop and
  return the unresolved product/architecture choice instead of designing a
  universal owner graph, dependency guard, copy framework, or reconciliation
  system.
- **Apply when:** A plan for a small owned media capability begins changing
  multiple existing owner kinds, discard paths, generation purposes, or
  lifecycle services in order to claim consistency.
- **Evidence to inspect:** Compare the proposed file, contract, migration, and
  validation count with the direct user-visible outcome. Remove the slice when
  the shared machinery is larger than the accepted product behavior or revives
  a previously rejected dependency model.

### 2026-07-26 — Inspect analogous owned-media paths before choosing the schema

- **User objection:** A Shot image plan mechanically copied generic Asset
  relationship columns, confused copying with sharing one Asset, and then
  proposed removing common Asset machinery too broadly without first comparing
  Cast profile images, Location hero images, storyboard images, Lookbook
  membership, lifecycle services, and skill workflows. A later correction still
  chose one of those inconsistent existing patterns and added another public
  Asset shape instead of recognizing that the repeated ownership and selection
  implementations themselves needed consolidation. Another revision treated
  batch Storyboard generation and slicing as a reason to preserve a separate
  durable Beat-image association even though each sliced image has the same
  owner, candidate, and canonical-selection behavior as a Shot image.
- **Planning rule:** Before designing an owned-media collection, trace the
  nearest existing examples through schema, public projection, Core mutation,
  file/provenance persistence, selection, copy, Trash, CLI, and agent guidance.
  When the same product concept already has several storage tables, public
  shapes, commands, or selection paths, do not select one flawed precedent or
  add a new adapter beside them. Identify one source of truth, move the existing
  owners to that model in the same architecture slice, and delete the duplicate
  paths. Keep focused domain-detail records only when they own real additional
  facts rather than mirroring generic ownership or selection. Require a current
  product need for every remaining column. Keep generation batching,
  compositing, slicing, and import orchestration outside the durable model once
  their outputs become ordinary owned media. Unless the product explicitly
  says “share,” copying creates independent entity, file, and path identities.
- **Apply when:** Adding a media candidate collection, selected image, owner
  membership, copy operation, or purpose-specific generation attachment,
  especially when two or more existing domains already implement similar
  collection or selection behavior differently.
- **Evidence to inspect:** Generic relationship tables and why their roles and
  ordering exist; purpose-specific child tables and why their extra columns
  exist; existing selection tables and commands; Asset/AssetFile write-sets,
  provenance, copy, and Trash primitives; duplicated Asset type versus
  relationship-role values; real project rows that store the same ownership
  twice; whether a focused record exists only because several outputs were
  generated or imported together; public response shapes, UI collection
  plumbing, CLI, and sister-skill call sequences.

### 2026-07-26 — Keep canonical display selection separate from generation choice

- **User objection:** A proposed unified Asset model put `selected` on every
  Asset without preserving that Profile, Hero, Lookbook card, Shot image, and
  Beat Storyboard image selection is a canonical representation choice, while
  Character Sheet, Location Sheet, Dialogue Audio Take, and other generation
  references are chosen independently by each generation request.
- **Planning rule:** Name and model selection by product scope rather than media
  kind. A canonical selection may exist only when the product defines one
  current representation for its subject, including one Storyboard image for a
  Beat as well as owner-level Profile, Hero, Lookbook card, and Shot images.
  Generation reference choices, including the exact Dialogue Audio Take, belong
  to the persisted GenerationSpec that consumes them and must never read,
  initialize, or mutate canonical representation state. A shared Asset
  collection model must preserve this distinction rather than making every
  image or audio Asset globally selectable.
- **Apply when:** Consolidating Asset ownership, adding a selected flag or
  command, defining media import selection, projecting generation candidates,
  or making a canonical image available to UI and downstream workflows.
- **Evidence to inspect:** Focused display-choice requirements and UI uses;
  the durable identity of nested subjects such as a Beat within a Beat Sheet;
  Asset type capabilities; `GenerationSpec.references`; purpose reference
  guides and exact AssetFile or Dialogue Audio Take selections;
  import-and-select commands; tests that prove one request can choose a
  different Character Sheet, Location Sheet, or Dialogue Audio Take without
  changing canonical representation state.

### 2026-07-26 — Design skill workflows around user intents, not command count alone

- **User objection:** Agent skills were made fragile by requiring several small
  CLI mutations for one accepted intent, while a simplistic cleanup risked
  collapsing meaningful generation safety and approval steps.
- **Planning rule:** Give one durable user intent one coarse Core/CLI operation
  when it can be atomic, such as importing and explicitly selecting an accepted
  image or creating an initial collection from one document. Keep separate
  calls when they represent real review, approval, execution, inspection, or
  later-edit boundaries. Add skill evals for unnecessary loops as well as for
  skipped safety gates.
- **Apply when:** A Studio skill repeatedly reads unchanged context, creates an
  aggregate object one child at a time, or performs a second mutation that was
  already explicit in the first command's user intent.
- **Evidence to inspect:** The owning Core transaction, CLI flag/document
  contract, existing Preview and approval workflow, aggregate context coverage,
  focused later-edit commands, and forward evals for both efficiency and
  correctness.

### 2026-07-23 — Keep plan review manual and user-controlled

- **User objection:** Automatic review loops repeatedly expanded a plan as each
  pass invented another edge case, consumed substantial time and tokens, and
  had no practical stopping condition.
- **Planning rule:** Plan creation and revision end after one bounded
  requirement, consistency, and simplification pass. Never dispatch a plan
  reviewer automatically. Run a review only when the user explicitly requests
  it, apply only feedback the user accepts, and do not initiate another pass
  without a new user request.
- **Apply when:** Creating or revising any active implementation plan, or after
  receiving review feedback that would broaden product behavior or architecture.
- **Evidence to inspect:** Check whether review was explicitly requested,
  whether each proposed correction traces to accepted requirements, and whether
  the plan is growing from reviewer-generated scenarios rather than product
  value.

### 2026-07-19 — Cover edge cases once at their owning layer

- **User objection:** Simplification must not reduce meaningful test coverage;
  the problem is repeating the same edge-case matrix at Core, HTTP, React, CLI,
  integration, and E2E layers.
- **Planning rule:** Keep comprehensive edge and invalid-state coverage at the
  layer that owns the rule. Test adapters for translation and UI for visible
  behavior, then use representative integration journeys instead of copying the
  owning layer's full matrix upward.
- **Apply when:** A plan lists the same missing, malformed, mismatch, lifecycle,
  or persistence cases under several test layers.
- **Evidence to inspect:** Map each test to the rule it proves and the package
  that owns that rule; remove cross-layer duplicates while retaining boundary-
  specific assertions.

### 2026-07-19 — Supersede ADRs without rewriting their history

- **User objection:** Changed decisions must remain discoverable, but an older
  ADR's original reasoning should not be edited to look as though the new
  direction had always applied.
- **Planning rule:** Record changed direction in a new ADR. Add only a concise
  notice near the top of each affected older ADR linking to the new ADR and
  stating that the old decision is superseded or narrowed; leave its historical
  body intact.
- **Apply when:** A plan removes or materially changes behavior previously
  accepted in one or more ADRs.
- **Evidence to inspect:** Read the current and older decision records, identify
  the exact supersession scope, and verify both the new ADR and discoverability
  notice are planned without a historical rewrite.

### 2026-07-30 — Separate obsolete workflow contracts from durable research

- **User objection:** A cleanup treated an entire skill subtree as stale and
  deleted researched Seedance and other provider-specific video guidance,
  examples, and eval material that was intentionally retained for the next
  workflow.
- **Planning rule:** Never use an old folder name as the deletion boundary when
  a skill path mixes executable workflow contracts with durable provider or
  creative research. Inventory each file, remove obsolete purposes, targets,
  commands, lifecycle rules, and executable envelopes, then refresh and re-home
  reusable provider guidance, examples, source provenance, and eval intent.
  Keep unsupported provider research inactive by excluding it from current
  route registries and executable fixtures rather than deleting it.
- **Apply when:** A plan removes or replaces an agent workflow whose folder also
  contains model-specific prompting research, vendor findings, golden or
  negative examples, or reusable evaluation scenarios.
- **Evidence to inspect:** Read the full skill subtree and its Git history;
  compare accepted prompt-ownership decisions, current provider capability
  research, exact route documentation, active model catalogs, route registries,
  samples, and evals; require every deleted file to have either a named
  successor or an explicit finding that it contains only an obsolete executable
  contract.
