---
name: renku-plan-retrospective
description: Turn explicit user feedback from a Renku Studio plan review into concise, durable lessons for future plan creation and review. Use after the user manually reviews a plan and objects to overengineering, duplication, missing reuse or refactoring, architectural shortcuts, weak layering, plan-format violations, or another repeatable planning mistake; or when the user asks to remember, record, or learn from plan feedback in the current session. Do not infer lessons from silence or use this skill for implementation retrospectives.
---

# Renku Plan Retrospective

Record the user's explicit planning corrections so future plans and reviewers
notice the same failure pattern earlier. Write only reusable lessons, not a
transcript or a second source of product truth.

## Memory Location

Maintain:

```text
../renku-plan-review/references/review-memory.md
```

Resolve this path relative to this skill directory. Do not create another
memory file elsewhere.

## Retrospective Workflow

### 1. Collect Explicit Feedback

Read the current session and identify statements where the user directly:

- rejects part of a plan;
- explains why a proposed structure is too elaborate or speculative;
- points to an existing solution that should be reused or refactored;
- identifies duplicated contracts, state, services, or workflows;
- rejects a local hack or incorrect package boundary;
- corrects plan scope, naming, evidence, format, tests, or verification;
- distinguishes strong owning-layer test coverage from repeated cross-layer
  coverage;
- distinguishes complete product and UX specification from speculative
  implementation machinery;
- explains how changed decisions should be recorded and discovered without
  rewriting ADR history;
- states a reusable preference for how future plans should be reasoned about.

Inspect the referenced plan and relevant repository evidence so the recorded
lesson keeps the user's actual meaning. Do not reconstruct objections from
memory when the session or plan is available.

### 2. Classify Each Candidate

Record a lesson only when all are true:

- the user expressed the objection explicitly;
- it can recur in another Studio plan;
- it changes how an agent should investigate, design, or review plans;
- it is specific enough to trigger a concrete check;
- it does not conflict with current accepted documentation.

Do not record:

- plan-specific implementation instructions that have no broader application;
- inferred preferences the user did not state;
- generic advice such as “keep it simple” without the observed failure mode;
- temporary facts likely to become stale;
- obsolete names or compatibility guidance;
- a proposed product or architecture rule that has not been accepted in docs.

If explicit feedback conflicts with accepted documentation, report the conflict
and ask whether the source document should change. Do not silently make memory
override the docs.

### 3. Deduplicate And Generalize Conservatively

Read the whole memory file before editing it.

- If an existing entry expresses the same constraint, strengthen that entry
  with the newly observed trigger or evidence instead of appending a near
  duplicate.
- Keep separate lessons separate when they require different review actions.
- Generalize only far enough to cover the repeated pattern.
- Preserve the concrete distinction that mattered to the user, such as
  “refactor the current owner before adding a parallel projection,” rather than
  reducing it to “avoid complexity.”
- Preserve qualifications in the feedback. For example, record “keep edge-case
  tests at the owning layer but do not repeat them through every adapter,” not
  the inaccurate shorter lesson “remove edge-case tests.”
- When the user objects to both overengineering and vagueness, record the stable
  middle: preserve every accepted requirement and make it implementable, while
  removing only unsupported mechanisms, behaviors, and duplication. Do not
  reduce the lesson to “make plans shorter.”

### 4. Write A Small Memory Entry

Under `## Learned Constraints`, replace the empty-state sentence when adding
the first lesson. Use this shape:

```markdown
### YYYY-MM-DD — Imperative lesson title

- **User objection:** Concise paraphrase of the explicit feedback.
- **Planning rule:** The reusable rule future authors and reviewers must apply.
- **Apply when:** Concrete signals that should trigger the rule.
- **Evidence to inspect:** Existing owners, callers, docs, or plan sections that
  reveal whether the mistake is recurring.
```

Do not include long quotations, hidden reasoning, session identifiers, or
personal information. One clear entry is better than several overlapping
entries.

### 5. Verify And Report

After editing:

- reread the full memory file;
- inspect its diff;
- confirm accepted docs still outrank the new lesson;
- report what was recorded, what was merged, and what plan-specific feedback
  was intentionally not stored.

Do not revise the plan, implementation, or canonical docs unless the user asks
for those changes separately.
