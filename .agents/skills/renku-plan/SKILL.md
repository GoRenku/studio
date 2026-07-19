---
name: renku-plan
description: Create, revise, and finalize Renku Studio implementation plans in plans/active using the repository plan template, current product documentation, architecture boundaries, implementation evidence, and an independent subagent review loop. Use when the user asks to plan a Studio product or engineering change, write a formal implementation plan, turn an investigation into an active plan, repair a plan that does not follow the current format, or prepare a plan for implementation. Do not use for a lightweight conversational task list or for implementing an already accepted plan.
---

# Renku Plan

Create an evidence-based active implementation plan, then run an independent
review loop until the plan has no actionable findings. Optimize for the smallest
architecture-correct response to the current product need.

Do not implement production code while using this skill unless the user
separately asks for implementation after accepting the plan.

## Planning Workflow

### 1. Establish The Planning Boundary

1. Resolve the repository root and read `AGENTS.md` completely.
2. Read `plans/PLAN_TEMPLATE.md` completely.
3. Read
   `../renku-plan-review/references/review-memory.md` before making design
   choices.
4. Build a requirement ledger before designing. Each planned outcome must trace
   to exactly one of:
   - the user's explicit product request;
   - a review finding the user explicitly accepted;
   - a current documented product rule;
   - a hard architecture, data-integrity, security, or operational boundary.
   Trace in both directions: every planned concept needs a requirement, and
   every accepted requirement must remain explicit in product behavior,
   implementation ownership, verification, and the completion checklist.
5. Restate the concrete product problem, intended user outcome, constraints,
   and explicit non-goals. Do not promote imagined edge cases or possible future
   needs into requirements.
6. Ask the user only when an unresolved product choice would materially change
   the plan. Do not use clarification to avoid inspecting the repository.

Preserve unrelated working-tree changes. Never overwrite an existing plan.

### 2. Build Evidence Before Designing

Inspect enough of the current system to explain why the proposed change is the
right change:

- read the relevant files in `docs/product/`, `docs/architecture/`,
  `docs/architecture/reference/`, `docs/ui/`, and `docs/decisions/`;
- inspect overlapping active plans and identify whether they are current,
  completed, superseded, or still constraining the work;
- trace the present implementation through its public contracts, owning
  package, adapters, callers, tests, and documentation;
- search for existing structures that already solve all or part of the need;
- inspect near-duplicate functions, types, projections, services, routes,
  hooks, and UI state before proposing another one;
- use the real `urban-basilica` project for relevant read-only evidence and
  realistic verification planning, never the obsolete in-repository sample.

Treat accepted product and architecture documentation as authoritative. When
the implementation and accepted documentation disagree, name the conflict in
the plan instead of silently planning around it.

### 3. Choose The Right-Sized Change

Compare these options explicitly in the reasoning before writing the plan:

1. reuse the existing contract unchanged;
2. refactor or extend the existing owner so it fits the product need;
3. introduce a new bounded concept because the existing model cannot represent
   the current requirement cleanly.

Prefer the option that introduces the fewest new concepts while preserving the
correct ownership boundary. A smaller diff is not simpler when it moves a
durable rule into React, a route, the CLI, or an agent instruction. A new
abstraction is not justified merely because future variants are imaginable.

For every proposed public type, state family, service, registry, dispatcher,
storage field, route, hook, or wrapper, identify:

- the current product requirement that needs it;
- the existing structure it reuses, changes, replaces, or deletes;
- why a focused refactor is insufficient;
- how callers reach the owning boundary;
- what prevents a parallel slightly-different solution from surviving.

Before writing the plan, run a simplification pass:

- remove every mechanism that cannot be traced to the requirement ledger;
- simplify mechanisms, not product requirements. Preserve exact UX surfaces,
  visible behavior, workflow steps, approval gates, supported variants, data
  effects, and explicitly accepted edge cases; do not replace them with umbrella
  phrases such as “update callers,” “handle normally,” or “update the skill”;
- prefer changing an existing owner over adding a parallel response, mode,
  service, validator, or state model;
- do not design special product behavior for rare malformed or manually edited
  state unless a hard boundary requires rejection;
- preserve strong edge-case tests for real invariants, but place them at the
  lowest owning layer; adapters and UI test only their own behavior rather than
  repeating the owning layer's matrix;
- do not turn a one-time pre-customer data correction into runtime migration,
  compatibility, or fallback machinery;
- remove repeated rationale, contracts, tests, docs, and checklist prose. Say a
  requirement once and reference it from later sections.

Do not optimize for line count. A plan must be as detailed as necessary to be
reviewable and implementable without making product or public-contract decisions
during coding. Treat concept count, unsupported scope, and repeated prose as
warning signals—not thorough product acceptance criteria. When a focused request
produces many new modules, public types, diagnostics, documentation edits, or
test matrices, show why each one is necessary. If the same complete outcome can
be implemented safely with fewer concepts, use the smaller shape without
deleting requirement detail.

### 4. Create The Active Plan

For a new plan, choose the next unused four-digit number under `plans/active/`,
use the current date and `Status: proposed`, and never fill a numbering gap by
overwriting or renaming another plan. When the user names an existing plan,
revise that plan directly and preserve its number and lifecycle status unless
the requested work changes that status. Do not create a second plan merely to
avoid correcting the first one.

Create or revise the plan from `plans/PLAN_TEMPLATE.md` and retain the
established active-plan depth.

Adapt headings to the work, but include these concerns whenever production code
changes:

- summary of the problem, outcome, and smallest useful scope;
- product behavior and explicit non-goals;
- current evidence and overlapping-contract inventory;
- accepted product, architecture, UI, and decision constraints;
- the complete Architecture Shape Gate;
- deliberately named public contracts, files, commands, routes, diagnostics,
  and package ownership;
- reviewable implementation slices that include required refactoring and
  deletion alongside new behavior;
- behavior tests and stable architecture guardrails;
- documentation and ADR effects;
- exact final verification, including desktop verification when UI changes;
- a comprehensive grouped completion checklist.

`plans/PLAN_TEMPLATE.md` defines required concerns, not a license to repeat the
same content in every section. Keep the plan proportional to the product change.
The completion checklist must be comprehensive and specific. Give every accepted
product behavior, contract change, deletion, implementation slice, owning-layer
test group, documentation/ADR action, and final verification a checkable item.
Avoid vague checklist items such as “update the UI” or “add relevant tests.” It
may restate an acceptance criterion in checkable form; it must not duplicate
explanatory prose or enumerate the same invalid matrix at every layer.

The Architecture Shape Gate must name the intended module layout, public
entrypoints, internal ownership, existing files that shrink or disappear,
bounded dispatch shape when needed, forbidden code shapes, and stop conditions.
Do not defer public names or file ownership to implementation.

Architecture tests must protect stable capabilities, imports, contracts, or
runtime boundaries. Do not plan source-text tests that freeze helper names,
private functions, or complete implementation inventories.

For tests, distinguish coverage from duplication:

- owning-layer tests cover the complete behavior and meaningful edge cases;
- server/CLI tests cover parsing, delegation, serialization, and error mapping;
- UI tests cover visible behavior and interaction;
- integration/E2E tests cover representative journeys, not the full invalid
  matrix again.

For ADRs, preserve decision history. When direction changes, add a new ADR and
add only a concise notice near the top of the affected older ADR linking to the
new decision and stating whether it supersedes or narrows it. Do not rewrite the
older ADR's original reasoning as if the new decision had always applied.

### 5. Run The Independent Review Loop

After the complete draft exists on disk, create a dedicated subagent. Give it
only the repository root, plan path, and this task:

```text
Use $renku-plan-review at
<repo>/.agents/skills/renku-plan-review/SKILL.md to review <plan-path>.
Work read-only. Inspect the repository evidence and canonical documentation.
Return actionable findings or the skill's exact approval verdict.
```

Do not prime the reviewer with the author's conclusions or suspected weak
spots. Do not substitute self-review for this step.

For every review response:

1. verify each finding against the source files;
2. revise the plan for valid findings;
3. when a finding is unsupported, answer the reviewer with concrete source
   evidence and ask it to reconsider;
4. ask the same reviewer to reopen the revised plan from disk and review it
   again from the full source context;
5. continue until it returns `APPROVED — no actionable findings`.

Do not weaken a requirement merely to obtain approval. If the loop exposes a
genuine product decision or an irreconcilable conflict in accepted documents,
pause, ask the user, then resume the review after the decision.

If subagents are unavailable, report that the required independent review is
blocked. Leave the plan proposed and do not claim that this skill's workflow is
complete.

### 6. Complete The Planning Task

Before reporting completion:

- reread the full plan rather than only the latest diff;
- confirm every proposed concept has current evidence;
- confirm existing owners are reused or deliberately refactored;
- confirm every major concept still maps to the requirement ledger;
- confirm every accepted requirement remains explicit and has an implementation
  owner, verification, and checklist item;
- confirm edge-case coverage is strong at the owning layer and not copied
  mechanically through every adapter and UI layer;
- confirm new decisions use new ADRs with discoverable notices on superseded
  ADRs rather than retroactive rewrites;
- confirm explanatory prose is not repeated unnecessarily while product
  acceptance criteria remain explicit where an implementer and reviewer need
  them;
- confirm no adapter-local business rule or generic mutation escape hatch is
  proposed;
- confirm the plan follows `plans/PLAN_TEMPLATE.md` and contains the complete
  checklist;
- inspect `git diff --stat` and the plan diff without touching unrelated files;
- include the reviewer's final approval verdict in the handoff.
