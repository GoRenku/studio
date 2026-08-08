# Renku Plan Review Memory

This file stores reusable lessons from explicit user feedback on Renku Studio
plans. The `renku-plan-retrospective` skill maintains it, and the `renku-plan`
and `renku-plan-review` skills read it before planning or reviewing.

Accepted documents under `docs/` remain the source of truth. Memory entries are
attention cues and planning heuristics; they must not override a current product
or architecture decision.

## Learned Constraints

### 2026-08-08 — Model one-step undo as one previous value, not version history

- **User objection:** A simple Scene-owned set of Beats that could be regenerated
  and undone once became a versioned Beat Sheet system with durable sheet ids,
  base and created ids, an active pointer, iteration numbers, lineage traversal,
  history listing, and overlapping response fields. The product only needed
  “the regenerated Beats are bad; restore the set I had immediately before.”
- **Planning rule:** When the accepted recovery requirement is only one-step
  undo of a full replacement, store one current aggregate and at most one
  previous snapshot. A full replacement moves current to previous; restoration
  consumes that previous slot; focused edits mutate current in place. Do not add
  version ids, base links, active selection, iteration counters, history lists,
  arbitrary-version restore, or redo without a separate explicit requirement.
- **Apply when:** Planning reset, regenerate, replace, undo, or restore behavior
  for one Scene-owned or Project-owned aggregate whose users do not browse,
  compare, cite, branch, or retain several historical versions.
- **Evidence to inspect:** The exact undo action the user needs; whether more
  than the immediately previous value must survive; whether callers truly select
  among versions; current foreign keys and media ownership; and whether stable
  child ids already reconnect restored content to its dependent media.

### 2026-08-08 — Do not build generation lineage merely to name files

- **User objection:** A filesystem proposal turned a small filename need into
  numbered generation folders, monotonically allocated generation counters,
  edit-version suffixes, and implied Asset-series tracking. The added lineage
  model would require a large cross-Asset refactor even though the user only
  needed concurrent outputs for the same semantic object to have distinct,
  recognizable filenames.
- **Planning rule:** First decide whether a visible number communicates durable
  human order or only prevents filename collisions. Use persistent,
  insertion-safe, never-recycled numbering for user-addressed ordered domain
  objects such as Scenes, Shots, and Beats. When an object has no authored
  order or insertion semantics, such as creation-sequenced Shot Plans, prefer a
  simple monotonic counter with no reuse instead of forcing it through the
  ordered allocator. When a generated file
  only needs a discriminator, size the shortest human-distinguishable token
  against the expected maximum occupancy of the exact filename namespace,
  quantify the per-draw collision chance, and use a bounded collision-check and
  retry at the owning write boundary. Keep existing database provenance; do not
  add generation directories, editable version counters, Asset-series
  aggregates, or lineage registries without a separate current product
  requirement for them.
- **Apply when:** Planning generated media filenames, alternate candidates,
  image edits, regeneration, concurrency, or any proposal that introduces
  counters or nested folders solely to distinguish files.
- **Evidence to inspect:** The exact user-visible meaning of the suffix,
  expected same-name occupancy, alphabet size, retry count, atomic/exclusive
  write behavior, existing GenerationSpec/run/Asset provenance, concurrent
  attachment paths, collision behavior in the destination folder, and whether
  users ever need to sort, cite, restore, or navigate generations by that
  visible value.

### 2026-08-07 — Scope screenplay authority to the Project's actual source workflow

- **User objection:** A media-storage and Scene-numbering proposal first
  expanded one-way FDX ingestion into screenplay round-tripping concerns, then
  overcorrected by treating every Project as FDX-backed and deleting Renku's
  existing agent-authored screenplay creation, revision, and restore workflow.
  Renku is not a general screenplay editor, but users may still create a
  screenplay entirely with the screenplay-drafter agent without importing FDX.
- **Planning rule:** Distinguish two source-authority workflows. For an
  FDX-backed Project, the external editor owns canonical screenplay edits and
  Scene numbers; preserve the exact exported numbers as the future association
  key and do not let Renku content mutations diverge from that source. For an
  agent-authored Project with no FDX import record, retain the focused
  screenplay-drafter create, apply, and revision-restore workflow and let Core
  allocate stable Scene numbers for that workflow. Do not apply the constraints
  of either source mode to the other. FDX numbers remain required by default;
  Renku may fill missing numbers only when the Project preference permits it
  and the user explicitly requests that import fallback. Clearly state that a
  Renku-numbered fallback import cannot later be matched safely to newly
  numbered editor exports.
- **Apply when:** Planning FDX import, agent-authored screenplay workflows,
  Scene numbering, screenplay provenance, content-mutation gates, media folders
  keyed by Scene number, or future re-import association.
- **Evidence to inspect:** The Project's retained FDX import record, the
  screenplay-drafter create/apply/restore contract, current Core mutation
  commands, importer empty-target and one-import gates, exact FDX Scene numbers,
  Project Settings defaults, explicit per-import authorization, and whether a
  proposed rule is correctly scoped to FDX-backed or agent-authored Projects.

### 2026-08-06 — Design user-browsed folders for recognition, not database identity

- **User objection:** A media-storage plan used opaque Scene, Shot Plan, and
  Shot ids as directory names, then added deep technical layers such as
  `generations/`, `videos/`, `first-frames/`, and `last-frames/`. The resulting
  tree was internally unambiguous but hostile to a person browsing the project:
  users could not recognize a Scene, related Shot Plan media was scattered
  across subfolders, and paths became unnecessarily long.
- **Planning rule:** Treat a user-browsed project folder as a product surface.
  Start its design from the shortest human recognition path: use established
  human-facing numbers or concise names for navigational folders, keep media
  that users inspect together in one folder, and distinguish asset roles with
  short filenames when another directory would add no useful navigation. Do not
  expose opaque database ids or mirror internal generation taxonomy in folder
  depth merely because those values are convenient and stable in code. Resolve
  database identity through Core-owned metadata, not by asking users to decode
  paths.
- **Apply when:** Planning project files that users will open in Finder, asset
  destination rules, Scene or Shot Plan media placement, or any hierarchy with
  repeated single-purpose directory levels.
- **Evidence to inspect:** Draw the proposed tree with realistic values from
  `urban-basilica`; count the clicks from the project root to the media users
  inspect together; compare every folder segment with the names or numbers shown
  in Studio; and confirm Core can resolve collisions and durable identity
  without putting ids in user-visible paths.

### 2026-08-06 — Start cohesive settings as one versioned property bag

- **User objection:** A Project Settings plan turned thirteen simple workflow
  preferences into fourteen relational columns plus separate aggregate, patch,
  policy, resource, adapter, and validation interfaces. That made adding or
  versioning a setting require coordinated schema and contract expansion even
  though the settings are consumed as one cohesive document.
- **Planning rule:** Apply the simplicity rule before normalizing configuration.
  When settings are read and written together and no accepted query, join,
  uniqueness, or relational-integrity requirement needs individual columns,
  start with one project-local singleton containing one explicitly versioned
  JSON property bag. Keep its schema, defaults, validation, migration, and
  focused read/update command in Core, but do not create a column or public
  interface hierarchy for every preference. Add relational structure only when
  a concrete current requirement proves it necessary.
- **Apply when:** Planning Project preferences, feature flags, workflow policy,
  UI settings, or another small extensible configuration document whose values
  share one lifecycle and are not independently queried by SQLite.
- **Evidence to inspect:** Compare the requested behavior with the proposed
  column, type, patch, service, route, diagnostic, and test count; identify any
  real SQL query or integrity rule that requires normalization; inspect existing
  Core JSON-schema/AJV validation and Drizzle migration conventions; and require
  an explicit document-version and one-way upgrade story before accepting the
  design.

### 2026-08-06 — Start schema design from the project-local database scope

- **User objection:** A Project Settings plan said it would create one row “for
  every Project,” backfill every Project row, and key the new table by
  `project_id`, which made the design read like one shared database could hold
  several Projects. Renku actually gives each Project its own SQLite database;
  the home library only discovers those separate databases.
- **Planning rule:** Treat the project-local SQLite database as the existing
  Project ownership boundary. Model project-wide state as a true singleton,
  following the established `singleton_id = 1` pattern unless a concrete
  relationship inside that database needs another entity id. Describe schema
  creation and migration as operating on one project database at a time. Do not
  add redundant Project foreign keys or multi-project backfill language that
  implies tenant scoping the database already provides.
- **Apply when:** A plan adds Project-wide settings, configuration, status, or
  another one-per-Project aggregate; proposes a `project_id` owner column in a
  project-local database; or describes a migration as iterating over Projects
  rather than upgrading each selected database independently.
- **Evidence to inspect:** The canonical
  `<project-folder>/.renku/project.sqlite` path, the migration config's one
  `RENKU_PROJECT_DATABASE_PATH` target, `readProjectRecord`'s singleton read,
  existing singleton schemas such as `screenplay.singleton_id = 1`, and the
  library code that discovers separate Project folders/databases.

### 2026-08-03 — Define every public field in the plan that owns the model

- **User objection:** A backend data-model plan moved its actual interfaces to
  a supporting document and then used fields such as a string-array
  `storyFunction` without defining what they meant, who authored them, whether
  they came from import, or how consumers used them.
- **Planning rule:** The phase that implements a public model must contain its
  complete normative types and persistence mapping. Define every field,
  identity alias, discriminator, referenced union, input shape, and schema:
  meaning, owner, optionality, ordering, authorship/import source, validation,
  storage, and important consumer behavior. Do not use a supporting context
  document as the only owner, and do not present an interface as complete while
  leaving members unexplained or referenced types undefined.
- **Apply when:** A plan introduces or replaces a domain aggregate, shows a
  TypeScript/JSON interface, uses arrays or generic strings whose vocabulary is
  unclear, links to another document for “full definitions,” or names a closed
  operation/schema union without enumerating it.
- **Evidence to inspect:** The owning phase plan, every displayed field and
  referenced type, JSON Schemas, Drizzle columns and constraints, migration
  source values, real sample values, UI/projection consumers, import behavior,
  CLI authoring inputs, and sister-skill examples.

### 2026-08-03 — Preserve legacy data without preserving a legacy subsystem

- **User objection:** A screenplay redesign relaxed the existing Renku Scene-
  number allocator but still preserved its separate reservation registry, even
  though that registry was an initial product hack and the accepted import
  source already supplied the relevant Final Draft Scene Number semantics.
- **Planning rule:** When replacing a pre-customer subsystem with an
  authoritative domain or interchange-format concept, first decide the correct
  semantic owner and contract from the target workflow. Convert valid existing
  values into that contract, but do not retain the old registry, allocator,
  normalization, reservation, or lifecycle behavior merely because it already
  exists. Treat data preservation and architecture preservation as separate
  decisions.
- **Apply when:** A plan imports an industry format, replaces an acknowledged
  prototype or hack, or changes a direct entity property while proposing to
  retain an older companion registry/service behind it.
- **Evidence to inspect:** The external format's authoritative documentation,
  the exact persisted values and orphan/reservation rows in the real sample,
  current allocation and normalization code, entity ownership, ordering rules,
  and the ADR that must be superseded if the accepted target changes it.

### 2026-08-02 — Clarify the target instead of reflexively agreeing and redesigning

- **User objection:** After the user rejected a plan's model and naming, the
  agent reflexively agreed with the criticism and immediately began another
  from-scratch redesign without first understanding the desired ownership
  model or clarifying the choices exposed by that criticism. Agreement became
  a substitute for senior engineering judgment.
- **Planning rule:** Never say the user is right merely to absorb criticism or
  reduce friction. Separate verified defects from unresolved product choices,
  explain the evidence for each current assumption, challenge claims when the
  evidence points elsewhere, and ask focused questions whose answers materially
  determine the replacement. Do not rewrite a rejected plan until the intended
  outcome, ownership boundaries, and important tradeoffs are understood well
  enough that another blind attempt is unnecessary.
- **Apply when:** A user rejects a plan broadly, asks for a redesign from
  scratch, questions the meaning or ownership of several foundational fields,
  or introduces requirements that admit materially different domain models.
- **Evidence to inspect:** Re-read the user's exact objections, enumerate every
  disputed assumption and unanswered product choice, then compare the current
  implementation, accepted documentation, real project data, external-format
  evidence, and actual user-facing workflow before proposing a replacement.
  Confirm the user has answered the decisions that cannot be learned from
  evidence alone.

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
  matching, fallback readers, or compatibility diagnostics. When the user has
  explicitly scoped the conversion to one known local project with no users,
  do not demand distributable migration infrastructure, fleet-style upgrade
  behavior, or user-facing recovery machinery: keep the conversion narrow,
  one-time, and verified against that project. Schema changes must still follow
  the repository's accepted migration workflow, but the data-conversion design
  should match its actual local-only blast radius. Scope “no data”
  assumptions to the exact tables and migrations proven empty or unapplied;
  every populated table affected by a broader schema change needs an explicit
  preservation mapping and verification. Do not infer a current multi-file,
  multi-role, or otherwise broader domain contract from leftover sample rows:
  verify current writers, readers, accepted decisions, and skills first, then
  convert or remove development-only files that the current product no longer
  creates.
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
  detail. When the accepted work has independently implementable and reviewable
  delivery gates with different owners—such as a backend contract cutover, a
  UI restoration, a format importer, or an adjacent persisted-analysis
  redesign—use separately numbered plans with explicit dependencies and
  self-contained acceptance gates instead of one massive plan and checklist.
  A coordinated release or migration may still require multiple plans to pass
  before it is applied; separate plan ownership does not require a temporary
  runtime compatibility stage. Do not apply that split when the explicit
  requirement is one reusable mechanism or algorithm shared across several
  domain objects with the same behavior. In that case, keep the shared contract
  and algorithm visibly owned once, and use focused domain adapters only for
  genuinely different persistence or lifecycle boundaries; splitting the work
  must not fragment the shared implementation or invite parallel domain-specific
  copies. First compare the actual semantics: an explicitly unordered,
  creation-sequenced object may correctly use a focused monotonic counter
  instead of an insertion-aware ordered allocator. When
  that split would scatter or compress shared product reasoning, evidence,
  exact contracts, cross-surface behavior, or a
  common verification matrix, preserve those parts in one linked supporting
  design reference. Make clear that it is not another implementation plan:
  phase plans own sequencing and completion, while the shared reference keeps
  cross-cutting semantics inspectable without copying them into every plan.
  Once the user has decided an issue, rewrite the active plan around the
  accepted behavior. Remove rejected alternatives, decision-question labels,
  reviewer back-and-forth, and the chronology of how the plan evolved unless
  that history is itself required implementation context.
- **Apply when:** A small user-visible change produces many new response types,
  modes, services, dispatchers, diagnostics, routes, documentation edits, or
  repeated plan sections, or when simplification replaces exact requirements
  with phrases such as “update callers,” “update the skill,” or “test normally.”
  Also apply when one phase is explicitly allowed to leave another layer broken
  or when backend, UI, importer, migration, or agent work can reach meaningful
  completion in sequence without sharing one completion status. Apply when a
  foundational model change exposes a separate pre-existing subsystem defect
  that deserves its own contract, migration, and verification even if both
  changes must ship together. Apply the shared-reference check when several
  phase plans depend on the same detailed model, evidence base, fidelity
  boundary, UI regression contract, or agent workflow and the split drafts
  replace those details with brief summaries.
- **Evidence to inspect:** Compare the product request with every in-scope item,
  new concept, proposed file, validation, documentation target, verification
  step, and checklist group; identify existing owners that can be changed
  directly, then confirm no accepted requirement disappeared during compression.
  Compare the pre-split source with the phase plans, preserve cross-cutting
  material in a clearly linked supporting reference, and confirm every phase
  names the exact sections it depends on.
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

### 2026-08-02 — Use folders as module boundaries instead of filename prefixes

- **User objection:** A plan claimed to split a broad screenplay area but kept
  proposing groups of `screenplay-*` files directly under Core client, CLI
  commands, and Studio route folders. Correcting only the first example left the
  same structural mistake in the other affected layers.
- **Planning rule:** In an Architecture Shape Gate, express a domain boundary
  once as a folder, then organize multi-file concerns beneath it. Review every
  affected production-code tree—contracts, owning services, persistence,
  schemas, wiring, resources, adapters, and features—rather than fixing one
  representative list. Use an `index.ts` only as an intentional thin module
  entrypoint, do not leave compatibility re-exports, and do not overcorrect by
  creating a directory solely for each single production file.
- **Apply when:** A proposed file list repeats one domain prefix across several
  files in a broad parent folder, one dispatcher is being split into several
  sibling prefixed handlers, or a plan reorganizes Core while leaving the same
  flat grouping in CLI, HTTP, services, or UI.
- **Evidence to inspect:** Enumerate every proposed source tree and compare it
  with current import/registration boundaries. Check which concerns have
  multiple collaborating files, where callers should enter the module, whether
  old paths are deleted directly, and whether any planned `index.ts` contains
  behavior instead of exports or shallow composition.

### 2026-08-02 — Make non-owning container deletion match its flattening semantics

- **User objection:** A plan described Acts and Sequences as organization-only
  but allowed deletion only when empty, as though child Scenes were owned by the
  section. The expected behavior was to remove the wrapper, splice its direct
  children into the parent at the same position, and preserve their identity and
  order.
- **Planning rule:** When a container is explicitly non-owning, do not give its
  deletion contract ownership-like blockers or cascading behavior. Define one
  deterministic splice operation that removes only the wrapper, promotes direct
  children without recursively flattening child containers, and preserves
  surrounding order and descendant identity. Verify that durable dependencies
  belong to the children or another real owner before claiming deletion is free.
- **Apply when:** Planning optional sections, folders, groups, categories, or
  other organizational wrappers whose contents must remain valid when the
  wrapper is removed.
- **Evidence to inspect:** Ownership tables and unions, foreign keys, dependent
  document scopes, canonical ordering, move/delete command contracts, mixed
  sibling examples, and owning-layer tests for empty and non-empty deletion.

### 2026-08-02 — Trace every public union variant through all consumers

- **User objection:** A screenplay plan made the dialogue variant detailed but
  left the other Scene block kinds as a prose list, without proving their JSON
  Schema, persistence validation, sister-skill contracts, Narrative rendering,
  or downstream UI behavior. Broad phrases such as “update the UI” and “update
  affected skills” hid important work.
- **Planning rule:** When a plan introduces or replaces a discriminated union,
  enumerate every accepted variant and trace it end to end: public type, closed
  schema, persistence boundary, import/migration mapping, projections and agent
  context, adapter contract, user-visible presentation, samples/evals, and
  owning-layer tests. Shared envelopes are fine when variants have identical
  durable fields, but the discriminator, mapping, and exhaustive consumers must
  remain explicit. Name exact affected Skill/reference/sample families and UI
  surfaces instead of using catch-all follow-up language.
- **Apply when:** One union member receives a concrete type or renderer while
  siblings appear only in an enum/prose list, an importer supports several
  source element kinds, or a plan says “all consumers,” “the rest of the UI,”
  “affected examples,” or similar without an inspectable inventory.
- **Evidence to inspect:** Existing union/schema definitions, real persisted
  variant counts, importer source-element vocabulary, database JSON validators,
  context/plain-text projectors, React switches and keys, navigation/resource
  DTOs, downstream evidence anchors, and every sister-skill contract, sample,
  and eval that authors or consumes the union.
