---
name: renku-plan-review
description: Review Renku Studio implementation plans for the balanced, architecture-correct response to current product needs. Use when the user asks to review, audit, critique, validate, or approve a plan in plans/active; asks whether a plan is overengineered, speculative, duplicative, underengineered, hacky, or incorrectly layered; or when renku-plan dispatches an independent reviewer subagent. Review plans rather than implementation diffs and work read-only unless the user explicitly asks to revise the plan.
---

# Renku Plan Review

Find whether a plan lands in the healthy middle between speculative machinery
and a short-sighted patch. The target is the smallest architecture-correct
change that fully serves the known product need.

Do not equate architectural correctness with more layers, and do not equate
simplicity with fewer files. Judge concepts, ownership, duplication, state,
change amplification, and evidence.

## Review Workflow

1. Resolve the repository root and plan path. Work read-only by default.
2. Read `AGENTS.md`, `plans/PLAN_TEMPLATE.md`, and the entire plan.
3. Read `references/review-memory.md` for lessons from prior user reviews.
4. Read `references/product-fit-and-complexity.md` completely.
5. Read `references/reuse-and-architecture.md` completely.
6. Read the current product and architecture documents relevant to the plan.
7. Inspect the existing implementation, callers, tests, and overlapping active
   plans. Do not review the proposal from its prose alone.
8. Compare reuse, focused refactoring, and a new bounded concept as credible
   alternatives.
9. Report actionable findings, or return the exact approval verdict.

## Canonical Context

Always read these for production-code plans:

- `docs/architecture/core-design-principles.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/naming-guidelines.md`

Load only the area-specific sources the plan touches:

- Product or UX: `docs/product/design-guidelines.md`,
  `docs/product/workflows.md`, `docs/product/vocabulary.md`, and relevant
  `docs/ui/` material.
- Frontend: `docs/architecture/reference/front-end-guidelines.md` and the
  relevant frontend ADRs.
- Data or storage: `docs/architecture/data-model-and-storage.md`,
  `docs/architecture/reference/project-storage-boundaries.md`, and the Drizzle
  migration guidance when schemas change.
- CLI: `docs/decisions/0004-use-human-first-cli-guidelines.md`,
  `docs/decisions/0026-use-thin-structured-cli-command-handlers.md`, and current
  CLI documentation.
- Studio server: the Hono and coordination references and relevant ADRs.
- Generation: the current media-generation architecture and accepted ADRs,
  taking care not to revive superseded planning models.
- Skills: `docs/architecture/reference/studio-skills.md` and the source skill in
  `$HOME/Projects/aitinkerbox/studio-skills` when its contract changes.

Use `.agents/skills/renku-code-quality-review/references/review-rubric.md` when
the plan needs detailed prospective checks for a touched implementation area.
The accepted repository documentation remains the source of truth if a local
rubric or remembered lesson conflicts with it.

## Required Review Tests

Apply all of these tests:

### Requirement And Simplification Gate

Reconstruct a requirement ledger before judging implementation detail. A major
plan item is justified only when it traces to:

- the user's explicit request;
- a review finding the user explicitly accepted;
- a current documented product rule; or
- a hard architecture, data-integrity, security, or operational boundary.

Audit the ledger in both directions. Every plan concept needs one of those
sources, and every accepted requirement must appear explicitly in the product
behavior, implementation shape or slice, appropriate test layer, and completion
checklist. A short plan that replaces exact requirements with vague umbrella
phrases is underengineered, not well simplified.

Flag every untraceable behavior, validation, state, service, route, wrapper,
diagnostic family, documentation campaign, or verification program as
overengineering. “It could happen,” “more robust,” “future-proof,” and
“consistent” are not sufficient evidence.

Apply an explicit simplification test: could the plan deliver the same complete,
safe product behavior with fewer concepts or less repeated explanatory prose?
If yes, require the smaller implementation shape. Never use this test to delete
exact UX behavior, workflow steps, supported surfaces or variants, approval
gates, data effects, public contracts, owning-layer edge coverage, or checklist
items. Plan length alone is neither a defect nor a success metric.

Do not create new product behavior for rare malformed, manually edited, or
hypothetical state unless the repository already treats it as a durable
invariant or a security boundary. A reviewer must not turn every imaginable
edge case into a new requirement.

### Product Traceability

Trace every major structure and contract to a current user-visible outcome,
domain invariant, or operational requirement. Flag machinery justified only by
possible future variants.

### Product Requirement Completeness

Compare the plan with the user's full request and every finding the user
explicitly accepted. Require precise, implementable statements for:

- the exact user surfaces and visible behavior being changed;
- values and data that must be preserved;
- workflow order, approval gates, and supported execution variants;
- the exact source skills, commands, or product contracts that carry agent-owned
  behavior;
- deletion and non-goal boundaries;
- observable success and failure behavior that the user actually requested.

Flag phrases such as “update generated callers,” “update the skill as needed,”
“handle errors normally,” “add relevant tests,” and “update current docs” when
they hide a decision the implementer still has to make. Thorough requirement
detail is not overengineering. Overengineering begins when the plan invents
additional runtime concepts or behavior not needed to implement those details.

### Existing-System Fit

Identify the current owner and nearest existing solution. Require the plan to
say whether it is reused, refactored, replaced, or deleted. Flag parallel state,
near-duplicate services, subtly different validators, convenience DTOs,
wrappers, and registries that leave two answers to the same question.

### Boundary Integrity

Verify durable rules live in Core, Engines owns provider facts, Studio server
and CLI stay thin, React consumes projections, and skills use supported CLI
contracts. Flag broad escape-hatch APIs even when they avoid immediate
duplication.

### Proportionality

Compare the number of new concepts, files, public contracts, state transitions,
and caller changes with the product behavior delivered. Require evidence for
new extension points and generic frameworks. Also flag local patches that defer
a necessary owning-layer refactor.

Pay particular attention when a focused request produces:

- a wrapper response that repeats route or existing contract fields;
- a new mode or state family for a fallback that existing data can express;
- one-method services, dispatchers, or response helpers around existing owners;
- a committed migration framework for one pre-customer local data correction;
- exhaustive documentation or ADR sweeps beyond current incorrect guidance;
- the same invalid-state matrix at Core, HTTP, React, CLI, integration, and E2E
  layers.

These are not automatically wrong, but the plan must prove why the smaller
reuse/refactor option cannot serve the current need.

### Test Coverage Without Duplication

Do not confuse simplification with weak tests. Require meaningful edge-case
coverage for real invariants at the layer that owns them:

- Core tests own domain, persistence, lifecycle, path-safety, and invalid-data
  matrices;
- server and CLI tests own parsing, delegation, serialization, and structured
  error translation;
- UI tests own visible content and interaction;
- integration and E2E tests own representative end-to-end journeys.

Flag missing owning-layer edge coverage as underengineering. Flag mechanical
repetition of the same edge matrix through upper layers as overengineering.
Upper layers need only enough failure coverage to prove their own boundary.

### ADR History

When a current decision changes, require a new ADR. Preserve the older ADR's
original reasoning and add only a concise notice near its top linking to the new
ADR and saying that the older decision is superseded or narrowed. Flag both
retroactive rewriting of ADR history and missing discoverability notices.

### Plan Executability

Verify the plan follows `plans/PLAN_TEMPLATE.md`, names public interfaces and
file ownership, includes the full Architecture Shape Gate, integrates cleanup
into implementation slices, protects stable boundaries in tests, and has a
comprehensive completion checklist.

The template does not require duplicated prose or a file per responsibility.
Accept a concise Architecture Shape Gate when it clearly names ownership,
public entrypoints, deletion, and stop conditions. A comprehensive checklist
must give each accepted behavior, contract, deletion, owning-layer test group,
ADR/doc action, and final verification a specific checkable item. Flag vague
checklists that merely say “implement,” “update,” or “test” a broad area. Do not
demand repetition of the same invalid test matrix across layers.

## Finding Standard

### Finding categories

Group actionable findings under these headings, in this order:

1. **Correctness And User Outcomes** — the plan would break a valid workflow,
   reject valid current data, lose or misrepresent information, contradict an
   accepted product behavior, or fail to deliver its stated outcome.
2. **Architecture And Contract Integrity** — the plan places behavior in the
   wrong owner, bypasses a required boundary, creates an unsafe mutation path,
   or contradicts a canonical contract without an immediate demonstrated user
   failure.
3. **Overengineering** — the plan adds speculative machinery, duplicate state,
   parallel ownership, unnecessary abstraction, or disproportionate concepts.
4. **Underengineering** — the plan uses a local patch, broad escape hatch,
   deferred owning-layer repair, or insufficient structure for the current
   requirement.
5. **Plan Completeness And Verification** — the plan leaves naming, file shape,
   cleanup, tests, documentation, evidence, or completion criteria too vague.

Assign each finding one primary category even when it has secondary effects.
Categorize by the main reason the plan must change. For example, put a duplicate
relationship check that rejects valid current Lookbook data under Correctness
And User Outcomes; explain duplicate ownership as the cause. Put a parallel
relationship with no demonstrated failure under Overengineering. Do not mix
overengineering and underengineering findings into a general correctness list.

Omit empty category headings when actionable findings exist. Before the final
verdict, include a one-line category count so the reader can distinguish product
or correctness blockers from proportionality feedback at a glance. When no
findings remain, return the exact approval verdict without empty sections.

Order findings by severity:

- `P1`: contradicts an accepted product or architecture rule, puts durable
  behavior in the wrong package, permits invalid durable state, or bypasses the
  shared domain contract.
- `P2`: creates material speculative complexity, duplicate ownership, parallel
  state, a broad generic API, or a short-sighted structure likely to force
  another refactor.
- `P3`: leaves important evidence, naming, cleanup, guardrails, or plan-format
  details too vague for implementation to remain reviewable.

Write for a product and engineering reader who has not already reconstructed the
implementation. Lead with the observable failure, not an internal mechanism.
Technical evidence supports the explanation; it must not replace the
explanation.

Use this structure for every finding:

1. **Plain-language title:** Name what fails or becomes incorrect and when. Do
   not use an architecture term such as "projection," "ownership matrix," or
   "bridge" as the only description of the problem.
2. **What happens:** Explain the triggering user action or project state, the
   expected behavior, and the actual behavior the plan would produce.
3. **Concrete example:** Walk through one realistic case with named domain data
   when available. For existing-data bugs, prefer a verified example from
   `urban-basilica` or a current fixture.
4. **User impact:** State the practical consequence: which task is blocked,
   which valid data is rejected, what becomes misleading, or what information
   is lost. Do not substitute "contract violation" or "ownership drift" for
   the consequence.
5. **Why the plan causes it:** Explain the relevant implementation or
   architecture mismatch in plain language. Define unavoidable repository terms
   on first use; for example, "Preview projection (the Core response used to
   render the preview)."
6. **Plan correction:** Give a specific plan-level change and describe the
   expected behavior after correction.
7. **Evidence:** Cite the plan and the repository sources with tight line
   references.

For example, prefer:

> **P1 — Opening the inspector fails for valid references to project files.**
> When a saved request uses a `project-file` reference, the inspector should
> show that reference. Instead, the shared preview reader rejects it, so the
> user sees an error and cannot inspect the request. A Character Sheet that used
> `research/helmet.jpg` is a concrete affected case. Extend the existing preview
> response to represent both supported reference kinds and test this saved-data
> path.

Avoid compressed wording such as "the reference projection lacks tagged-union
coverage" unless the same finding first explains the behavior and user impact.

In addition, each finding must include:

- the plan file and tight line reference;
- the concrete proposed behavior or omission;
- the product need or canonical boundary it fails;
- an example of how the problem manifests during implementation or the next
  likely change;
- the expected maintenance or product impact;
- a specific plan-level correction;
- the repository evidence supporting the finding.

Do not report a search hit, preference, or imagined future problem as a
finding. Do not demand a generic abstraction merely to avoid ordinary explicit
domain code. Do not demand a local shortcut merely to reduce file count.

Before reporting an edge-case finding, state which regular user workflow,
accepted requirement, existing invariant, or security boundary makes that case
material. If none exists, do not report it. When the concern only needs a test
at the owning layer, do not propose new runtime states or repeat the test at
every layer.

Before reporting an overengineering finding, separate the product acceptance
criterion from the proposed mechanism. Preserve the criterion and remove or
replace only the unsupported mechanism. Never recommend compressing a plan into
language too vague to implement or review.

## Verdict

Lead with findings. Keep summaries secondary.

When actionable findings remain, end with:

```text
Correctness: <count> | Architecture: <count> | Overengineering: <count> | Underengineering: <count> | Completeness: <count>
CHANGES REQUIRED — <count> actionable finding(s)
```

When no actionable findings remain, return:

```text
APPROVED — no actionable findings
```

After approval, mention only concrete residual risks, unresolved external
dependencies, or verification gaps. Do not invent a caveat to avoid a clear
verdict.
