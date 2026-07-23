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
  database as a reason to keep or choose an obsolete product name.
- **Planning rule:** When the user confirms the current product contract and
  only pre-customer development data uses the old contract, plan one verified
  one-way data conversion, update every current caller and document directly,
  and remove the old value from runtime code. Do not add aliases, dual-role
  matching, fallback readers, or compatibility diagnostics.
- **Apply when:** Repository code and accepted docs disagree with the intended
  product name while the conflicting persisted state is limited to local sample
  projects that can be backed up and upgraded once.
- **Evidence to inspect:** Search current contracts, relationship roles, asset
  types, persisted JSON keys, storage paths, tests, documentation, sister
  skills, and the real sample database; keep obsolete wording only in the
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
