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
  detail.
- **Apply when:** A small user-visible change produces many new response types,
  modes, services, dispatchers, diagnostics, routes, documentation edits, or
  repeated plan sections, or when simplification replaces exact requirements
  with phrases such as “update callers,” “update the skill,” or “test normally.”
- **Evidence to inspect:** Compare the product request with every in-scope item,
  new concept, proposed file, validation, documentation target, verification
  step, and checklist group; identify existing owners that can be changed
  directly, then confirm no accepted requirement disappeared during compression.

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
