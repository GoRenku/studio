# Reuse And Architecture Guidelines

Use these guidelines to verify that a plan fits the existing system and remains
inside Renku Studio's accepted ownership boundaries.

## Build An Existing-System Inventory

Before accepting new structure, locate:

- the package and module that currently own the domain rule;
- the public entrypoints used by browser, server, CLI, and skills;
- existing commands, validators, projections, repositories, routes, services,
  hooks, components, and tests with adjacent responsibility;
- current data fields and sources of truth;
- active plans or ADRs already changing the same boundary;
- obsolete code the new behavior should replace rather than sit beside.

Use targeted `rg` searches for domain terms, public types, route paths,
diagnostic codes, database fields, UI labels, and callers. Inspect
implementations and tests; matching names alone do not prove shared semantics.

Require the plan to record the important results of this inventory. An
implementation plan should not make the implementer rediscover whether an
existing owner can be reused.

## Detect Duplicate Solutions

Look for proposals that would create two answers to one domain question:

- two validators with slightly different accepted states;
- two projections of the same durable fact;
- a UI state mirror of server or Core state;
- a route-local relationship resolver beside a Core resolver;
- a new command that overlaps an existing command but changes one field;
- a purpose-specific lifecycle beside the accepted shared lifecycle;
- a wrapper DTO with convenience mirrors of existing contract fields;
- a parallel event, refresh, selection, attachment, or import mechanism;
- a new generic component that mostly duplicates an existing shared primitive;
- a new module that renames or forwards another public API.

If the existing solution is close but inadequate, require a focused refactor:

1. name the current owner and limitation;
2. change the owner to represent the new current requirement;
3. update all callers directly;
4. delete the obsolete path in the same implementation program;
5. add tests for the resulting single contract.

Do not preserve old and new paths through aliases, adapters, compatibility
readers, or transitional fallbacks.

## Protect Package Ownership

Apply the repository's canonical layer rules:

- Core owns durable domain types, validation, relationships, mutations,
  projections, paths, storage rules, and focused commands.
- Engines owns provider catalogs, schemas, payload assembly, provider
  validation, pricing facts, and external generation adapters.
- Studio server extracts HTTP input, calls owning services, serializes results,
  and translates structured diagnostics.
- CLI parses arguments, calls Core, and formats output.
- React consumes projections, owns ephemeral presentation state, and sends user
  intent through browser services.
- Skills coordinate supported CLI workflows and do not write project metadata
  directly.

Flag any plan that repairs a missing Core capability by adding business logic to
an adapter. Also flag a nominally Core-owned plan that puts every domain case,
side effect, and dispatch path into one monolithic service.

## Preserve Focused Contracts

Prefer focused public operations that express user or domain intent. Reject:

- arbitrary durable-state patch functions;
- generic “update anything” routes;
- untyped event payloads used to bypass a projection contract;
- catch-all helpers that mix persistence, validation, routing, and formatting;
- re-export facades or convenience barrels that avoid fixing imports;
- public contract mirrors created only for a local caller's convenience.

When a bounded registry or dispatcher is justified, require the plan to name:

- the stable key and owned responsibility;
- the concrete current cases;
- the focused handler contract;
- the file where registration occurs;
- the unrelated responsibilities excluded from it;
- the shape guardrail that prevents a god switchboard.

## Apply Cross-Cutting Hard Gates

Check the relevant project rules explicitly:

- fail fast with structured diagnostics at package boundaries;
- update callers directly with no shims, old aliases, or compatibility paths;
- keep AI prompts and media artifacts opaque to Studio runtime logic;
- use local shadcn-style controls in Studio feature code;
- keep visible UI copy intentional and domain-meaningful;
- use Drizzle Kit for schema migrations;
- preserve desktop-first verification unless mobile is requested;
- use deliberate domain names rather than generic placeholders;
- keep `index.ts` files as thin intentional entrypoints;
- avoid architecture tests that encode private implementation names or command
  inventories.

Do not reproduce all of these policies in the plan. Require the plan to cite and
apply the canonical source documents relevant to its scope.

## Review The Architecture Shape Gate

Require enough detail to make implementation shape reviewable before code is
written:

- exact owning packages, folders, and public entrypoints;
- focused internal files and their single responsibilities;
- existing modules that shrink, move, or disappear;
- domain branches and bounded dispatch shape;
- forbidden imports, APIs, state mirrors, and code shapes;
- stop conditions for files or functions accumulating responsibilities;
- direct caller updates and deletion order;
- stable tests or lint rules protecting the boundary.

Centralized ownership must not become centralized implementation. Splitting one
large file into vague helpers is not an architecture improvement. The named
file layout must follow domain responsibilities that a reviewer can predict.

## Review Implementation Slices

Each slice should deliver a reviewable vertical result and preserve the final
shape. Require slices to include:

- owning-layer contract changes;
- necessary refactoring of the existing solution;
- direct adapter and caller updates;
- deletion of the displaced path;
- behavior tests and stable boundary checks;
- documentation changes for accepted contracts.

Flag plans that add the new path first and leave cleanup as an optional final
phase. That pattern commonly turns temporary duplication into permanent bloat.

## Review Verification And Checklist Quality

Require exact focused commands and risk-proportionate root checks. The final
review must inspect:

- `git diff --stat` and the complete diff;
- newly large or heavily modified files;
- public `index.ts` entrypoints;
- duplicate state, service, route, and component paths;
- architecture tests for stable boundaries rather than helper names;
- the real desktop workflow and `urban-basilica` when relevant;
- skill contracts in the sister repository when agent workflows change.

The completion checklist must be comprehensive enough to track the plan without
rereading every section. It must not claim success by accepting a monolithic
owning-layer implementation or by postponing required cleanup.
