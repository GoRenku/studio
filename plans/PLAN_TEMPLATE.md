# Implementation Plan Template

Use this template for new active implementation plans in `plans/active/`.
Adapt headings when a plan genuinely does not need a section, but do not remove
the architecture-shape gate for code changes.

## Header

```text
# NNNN Short Plan Name

Status: proposed
Date: YYYY-MM-DD
```

## Summary

Explain the problem, the intended outcome, and the smallest useful scope.

## Context

List the accepted docs, ADRs, active plans, packages, workflows, and real sample
projects that constrain the work.

## Architecture Shape Gate

This section is required for any plan that changes production code.

The plan must describe the intended code shape before implementation begins.
Passing tests is not enough if the implementation creates a god file, a broad
dispatcher, or an unreviewable function.

Answer these questions concretely:

- What package, folder, or module owns the new behavior?
- What public entrypoints will callers use?
- What internal files or submodules will exist, and what does each one own?
- Which file is allowed to be the public `index.ts`, and what is it allowed to
  contain?
- Where will domain-specific branches live?
- If a switch, registry, or dispatch table is needed, why is that the right
  shape and how will it stay focused?
- What existing files are expected to shrink, disappear, or remain thin?
- What code shape is explicitly forbidden for this plan?

Required defaults:

- Centralized ownership must not mean centralized implementation.
- `index.ts` files should be thin public entrypoints, not dumping grounds for
  domain logic.
- A module may own a boundary while still delegating to focused internal files.
- Do not put unrelated domain destinations, providers, commands, routes,
  validators, persistence operations, and filesystem side effects into one file.
- Do not add large switch statements that grow with every purpose, provider,
  destination, command, or media kind unless the plan explicitly justifies a
  bounded registry shape.

Stop and revise the plan before continuing implementation if:

- one file starts accumulating several unrelated domain cases;
- a function handles routing, validation, persistence, side effects, and result
  formatting at once;
- a new public boundary is correct but its internal module shape is becoming
  harder to review;
- the easiest patch is to add another branch to an already broad dispatcher;
- the completion checklist can be satisfied only by accepting a monolithic
  implementation.

## Contracts

Name the public commands, schemas, DTOs, services, functions, folders, files,
diagnostic codes, and package boundaries that change.

Do not defer interface-level naming to implementation.

## Implementation Slices

Break the work into reviewable slices. Each slice should name the files it
expects to touch and the architecture boundary it preserves.

For every slice, include the shape-preservation work alongside behavior work.
For example: "add destination X in `destinations/x.ts` and register it in the
bounded destination registry," not only "support destination X."

## Tests And Guardrails

List behavior tests and architecture tests.

Include guardrails that protect the intended code shape when practical:

- import-boundary tests;
- focused static tests for forbidden capabilities;
- lint rules for complexity or nesting where useful;
- tests proving invalid state fails before writes;
- scans that verify production code does not use forbidden APIs.

Avoid brittle architecture tests that hard-code private helper names or complete
implementation inventories.

## Documentation

List architecture references, ADRs, CLI docs, user-facing docs, and skill docs
that must change.

## Final Verification

List exact commands and manual inspections required before completion.

Final verification must include an architecture-shape review:

- inspect `git diff --stat`;
- inspect any newly large or heavily modified files;
- confirm no new god file, catch-all module, or broad dispatcher was created;
- confirm `index.ts` files remain thin entrypoints unless the plan explicitly
  allowed otherwise;
- confirm behavior was not fixed by moving the mess into the owning layer.

## Completion Checklist

Every active implementation plan must include a comprehensive checklist near the
end of the document.

At minimum, include these groups when production code changes:

### Review Area

- [ ] Confirm the implementation preserves accepted architecture boundaries.
- [ ] Confirm centralized ownership did not become a monolithic implementation.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [ ] Update public contracts deliberately, with no compatibility shims unless
      explicitly accepted.
- [ ] Keep package-boundary diagnostics structured.
- [ ] Keep durable business rules in the owning package.

### Implementation Slices

- [ ] Complete each planned slice without merging unrelated responsibilities
      into one file or function.
- [ ] Split implementation modules before adding more branches when a file
      starts collecting unrelated domain cases.

### Tests And Guardrails

- [ ] Add or update behavior tests.
- [ ] Add or update architecture/static tests for the important boundary.
- [ ] Run the shape-review checks listed in Final Verification.

### Documentation

- [ ] Update current docs that describe the accepted contract.
- [ ] Do not edit historical plans merely for naming sweeps.

### Final Verification

- [ ] Run focused tests.
- [ ] Run root checks when the blast radius requires it.
- [ ] Review `git diff --stat` and inspect large changed files.
- [ ] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [ ] Only then mark the plan complete.
