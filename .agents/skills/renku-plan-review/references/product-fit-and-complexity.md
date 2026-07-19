# Product Fit And Complexity Guidelines

Use these guidelines to detect both speculative design and short-sighted
patching. They guide plan review; accepted repository documentation remains the
authority.

## Start From The Product Need

- Require the plan to describe the user problem and observable outcome before
  naming mechanisms.
- Separate current requirements from possible future extensions.
- Require each major mechanism to support a current behavior, invariant,
  quality attribute, or operating constraint.
- Treat “more flexible,” “reusable,” “generic,” “extensible,” and “future-proof”
  as claims that need concrete evidence.
- Reject scope that exists only to make a hypothetical later feature easier.
- Also reject a narrowly framed symptom fix when the product need clearly
  crosses an existing owning contract.

## Demand A Concept Budget

Every new concept adds learning cost, state combinations, test surface, and
future coordination. Review the plan's proposed:

- public types and DTOs;
- durable states and database fields;
- services and commands;
- registries, dispatchers, strategies, and plugin points;
- projections and client mirrors;
- routes, hooks, contexts, and UI modes;
- configuration files and schema layers.

For each, ask:

1. Which current requirement cannot be expressed cleanly without it?
2. What existing concept is closest?
3. Does refactoring that concept remove more complexity than adding this one?
4. What old structure becomes smaller or disappears?
5. How many independent current cases prove that a shared abstraction is real?

There is no fixed duplication count that automatically justifies abstraction.
The plan must show repeated responsibility and a shared invariant, not merely
similar spelling.

## Recognize Overengineering

Flag plans that propose:

- a generic framework before concrete current variants exist;
- an interface, registry, provider, or strategy with one speculative
  implementation;
- configuration for behavior that product code owns and users cannot vary;
- a new draft, executable, projection, or convenience state that mirrors an
  existing source of truth;
- extension hooks whose consumers and constraints are unknown;
- a broad event or command system for one focused interaction;
- a schema intended to generate several APIs before those APIs have proven
  shared semantics;
- a layer whose main job is forwarding, renaming, or hiding another layer;
- a large taxonomy for cases the current product does not distinguish;
- “consistency” work that spreads a local design into unrelated areas;
- speculative migration, compatibility, or fallback machinery in the
  pre-customer codebase.

The correction is usually to keep the current domain case explicit, refactor a
proven shared owner, or defer the extension point until its second real
constraint is known.

## Recognize Underengineering

Flag plans that propose:

- enforcing a durable rule only in React, an HTTP route, CLI parsing, or an
  agent instruction;
- adding a caller-local conditional because the owning service lacks a focused
  command or validator;
- exposing an arbitrary state patch to avoid designing a domain command;
- duplicating validation in adapters instead of fixing Core;
- storing another derived value because a projection is inconvenient;
- swallowing invalid state with an empty result, default, guessed match, or
  compatibility fallback;
- adding another branch to an already broad dispatcher without repairing its
  shape;
- using a generic helper or wrapper to conceal mixed responsibilities;
- postponing required deletion or caller updates so old and new paths coexist;
- leaving public contract names, module layout, or ownership for the implementer
  to decide.

The correction is not automatically a framework. Prefer a focused owning-layer
command, validator, projection, or module refactor with direct caller updates.

## Evaluate Change Amplification

Review how one product change propagates through the proposed system:

- How many declarations must be updated?
- How many representations of the same fact exist?
- Does adding one domain case require editing unrelated central files?
- Does the plan create a second state machine or synchronization path?
- Are UI, server, CLI, and Core each interpreting the same rule?
- Can obsolete code be deleted in the same slice?

Low file count does not guarantee low amplification. One god file can be worse
than several focused modules. Conversely, many tiny files and registries can
make a simple product rule harder to trace. Review the end-to-end concept path.

## Use Reversibility Instead Of Speculative Flexibility

When the future is uncertain, prefer a clear current contract that can be
changed directly. Good reversible choices include:

- explicit domain unions for known cases;
- focused modules behind an already accepted package boundary;
- direct caller updates in a pre-customer codebase;
- schemas that store only current durable facts;
- tests of behavior and package boundaries rather than internal names.

Do not build unused extension points as insurance. A smaller coherent contract
is usually easier to replace once real future requirements arrive.

## Check Scope Discipline

A right-sized plan should explain:

- what it deliberately does not solve;
- why adjacent cleanup is necessary or deferred;
- which refactoring is required to avoid duplication or boundary violations;
- which attractive generalizations lack evidence;
- how the work can be reviewed in vertical slices;
- what proves the product need is satisfied.

Non-goals must not be used to exclude architecture work required for a correct
solution. Architecture work must not be used to absorb unrelated product ideas.
