# 0044 CLI Command Architecture Refactor

Date: 2026-06-03

Last reviewed against code: 2026-06-05

Status: implemented

Implemented: 2026-06-05

## Goal

Refactor the CLI command architecture for media import and media generation so
the CLI remains a crucial, stable, agent-facing contract without allowing giant
command functions to accumulate nested branching, purpose-specific dispatch, file
parsing, service calls, output formatting, and side-effect handling in one body.

The first implementation scope is:

- `packages/cli/src/commands/media-command.ts`;
- `packages/cli/src/commands/generation-command.ts`;
- adjacent command parser, command handler, dispatch-table, registry, JSON-file,
  target-parsing, and Studio coordination-event modules needed to make those two
  commands small and reviewable.

The already-implemented `generation plan` command is adjacent scope. It should
reuse shared parsing and structured command primitives where that reduces
duplication, but it must remain a focused shot-video planning adapter rather
than becoming another branch inside `runGenerationCommand`.

The CLI is how Studio Skills and external agents communicate with core-owned
project behavior. It is not optional plumbing. It is part of the architecture.

The CLI must stay thin:

- parse command tokens and flags;
- read explicitly provided files;
- call core service methods;
- write human or JSON output;
- report structured diagnostics;
- return stable exit codes.

The CLI must not own media-generation business logic, dependency graph behavior,
asset-selection rules, or provider behavior.

## References

- `packages/cli/src/commands/media-command.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/generation-plan-command.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/src/cli.test.ts`
- `packages/cli/src/commands/info.test.ts`
- `packages/cli/eslint.config.mjs`
- `packages/core/src/client/media-generation.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`
- `packages/core/src/server/project-data-service-contracts.ts`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/cli/commands.md`
- `docs/decisions/0004-use-human-first-cli-guidelines.md`
- `docs/decisions/0009-use-structured-diagnostics-at-package-boundaries.md`
- `docs/decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `plans/active/0042-shot-video-take-generation-plan-architecture.md`
- `plans/active/0043-existing-media-generation-purpose-architecture-refactor.md`

## Current Problem

`runMediaCommand` currently mixes command routing, media purpose dispatch,
required-flag validation, import document parsing, target parsing, core service
calls, Studio coordination event writing, JSON output, and unsupported-purpose
diagnostics in one exported function.

`runGenerationCommand` has the same structural problem, although plan `0043`
has already moved the main media-generation lifecycle dispatch into core. The
command still contains top-level action routing, nested action routing, purpose
parsing, target parsing, spec file reading, service calls, JSON output, and
several shot-video-only command branches in one exported function.

Those functions are difficult to extend safely because adding a new media purpose
or command action encourages one more nested branch in a function that already
does too many jobs.

This plan rejects that pattern. Future CLI work must not add more command
behavior through giant nested `if` blocks, nested ternary dispatch chains, or
single functions that route many unrelated command shapes.

Since the plan was first drafted, the command surface has grown. `lookbook.sheet`
is now a first-class media-generation purpose in core, CLI parsing, CLI tests,
and media import. The shot-video input purposes and final video purpose are also
present in the CLI generation and media import paths:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet`;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take`.

That growth confirms the reason for this refactor: every new purpose currently
adds pressure to extend the same large command functions.

## Current Status After 0043 And June 5 Code Review

The relevant generic lifecycle portion of plan `0043` is implemented in the
codebase, and this CLI plan must start from that newer state.

The `generation` command is already hooked into the shared media-generation
architecture for the core lifecycle commands:

- `generation context` calls `ProjectDataService.buildMediaGenerationContext`;
- `generation model list` calls `ProjectDataService.listMediaGenerationModels`;
- `generation spec validate` calls
  `ProjectDataService.validateMediaGenerationSpec`;
- `generation spec create` calls `ProjectDataService.createMediaGenerationSpec`;
- `generation spec update` calls `ProjectDataService.updateMediaGenerationSpec`;
- `generation spec show` calls `ProjectDataService.readMediaGenerationSpec`;
- `generation spec list` calls `ProjectDataService.listMediaGenerationSpecs`;
- `generation estimate` calls `ProjectDataService.estimateMediaGenerationSpec`;
- `generation run` calls `ProjectDataService.runMediaGenerationSpec`.

Those generic service methods dispatch through the core media-generation purpose
registry. The CLI must not reintroduce lifecycle dispatch by mapping every
purpose to purpose-specific create, read, update, estimate, or run service
methods.

The current registered media-generation purpose set is:

- `lookbook.image`;
- `lookbook.sheet`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.environment-sheet`;
- `scene.storyboard-sheet`;
- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet`;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take`.

The remaining `generation` command work is structural:

- move command-path routing into handlers;
- move purpose and target parsing into focused CLI parser modules;
- keep JSON-file reading and output writing shared;
- keep shot-video-only commands explicit and small.

The shot-video-only command branches are still intentionally concrete because
they operate on production groups, preflight planning, and dependency input
selection rather than the generic persisted-spec lifecycle:

- `generation production update`;
- `generation preflight`;
- `generation input list`;
- `generation input select`;
- `generation input clear`.

The `generation plan` command now exists in
`packages/cli/src/commands/generation-plan-command.ts` and is dispatched from
`packages/cli/src/cli.ts` before `runGenerationCommand`. It is intentionally a
shot-video-only planning surface. This refactor may move its duplicated
`scene:<id>`, `--shots`, and required-flag parsing into shared command modules,
but it should not be folded into the generic lifecycle dispatch unless the
implementation creates a root generation command-path dispatcher where `plan`
has its own obvious handler.

The `media import` command has not yet been structurally migrated. It still uses
CLI-side purpose branching, grouped import-document branches, and a large switch
for single-file imports.

Core now contains an internal `importMediaGenerationByPurpose` helper in
`packages/core/src/server/media-generation/purpose-registry.ts`, but that helper
is not part of the public `@gorenku/studio-core/server` entry point and is not a
`ProjectDataService` method. The CLI refactor must not deep-import that internal
module across the package boundary. If implementation chooses to delegate media
import purpose dispatch to core, first expose a deliberate core-owned service
contract. Otherwise keep a focused CLI media-import purpose registry that calls
the current `ProjectDataService` import methods directly.

Some current documentation references lag behind the implemented purpose set.
For example, `docs/architecture/reference/media-generation.md` and
`docs/cli/commands.md` should be checked during implementation so their command
examples include `lookbook.sheet` and the shot-video input purposes where
appropriate, plus the final `shot.video-take` purpose.

## Non-Goals

This plan does not:

- change the public command names or flag shapes except for intentional cleanup
  called out during implementation;
- redesign media generation business logic;
- redesign the shot-video dependency planner or change `generation plan`
  semantics;
- redo the existing media-generation purpose architecture refactor from plan
  `0043`;
- add CLI-side lifecycle dispatch that duplicates the core media-generation
  purpose registry;
- deep-import core internal modules to avoid adding a deliberate core service
  contract;
- change provider integrations;
- change Studio Skill behavior except where tests prove the CLI output contract
  is preserved;
- add compatibility aliases or old command paths.

No behavior changes are allowed unless they are explicitly listed in the
implementation notes and covered by tests.

## Architecture Decision

Write a new ADR under `docs/decisions/` before or during the refactor. As of
2026-06-05 the next available decision number is `0026`; still verify the next
available number at implementation time. Suggested title:

```text
Use Thin Structured CLI Command Handlers
```

The ADR must state:

- the CLI is a crucial human-facing and agent-facing contract;
- Studio Skills and agents use CLI commands to call core safely;
- the CLI owns command parsing, help text, output formatting, and exit codes;
- the CLI does not own domain behavior;
- command dispatch must use command handlers, dispatch tables, and purpose
  registries instead of giant nested command functions;
- command handlers must have low cyclomatic complexity and shallow control flow;
- structured diagnostics are required at CLI package boundaries;
- JSON output and error shapes are part of the automation contract.

Link the ADR from `docs/architecture/layers-of-responsibility.md` in the
decision-history list and update the `studio-cli` section to name the thin
handler/dispatch-table rule.

## Target Command Shape

Keep these exported entry points as the command adapter surface used by
`packages/cli/src/cli.ts`:

```ts
export async function runMediaCommand(options: MediaCommandOptions): Promise<number>;
export async function runGenerationCommand(options: GenerationCommandOptions): Promise<number>;
```

After the refactor, each exported function should do only three things:

- build a command runtime from `options`;
- dispatch to a registered command handler by command path;
- write the handler result or return the handler exit code.

The body of each exported function should be small enough that a reviewer can see
the whole routing shape without scrolling through purpose-specific behavior.

`runGenerationPlanCommand` may remain as its own exported adapter, because plan
generation is a separate shot-video planning command rather than a generic
persisted-spec lifecycle action. If implementation revisits generation routing
in `packages/cli/src/cli.ts`, route `generation plan` by command path to its own
handler instead of adding an inline branch to `runGenerationCommand`.

Preferred implementation modules:

- `packages/cli/src/commands/structured-command.ts`
  - owns shared command-handler types, command-path lookup, required flag
    helpers, JSON output helpers, and structured unknown-command diagnostics;
- `packages/cli/src/commands/studio-target-parsing.ts`
  - owns shared parsing for `lookbook:<id>`, `cast:<id>`, `location:<id>`,
    `scene:<id>`, comma-separated shot ids, and selection flags;
- `packages/cli/src/commands/media-import-documents.ts`
  - owns parsing and validation for media import JSON documents such as
    Location environment sheets and Scene storyboard sheets;
- `packages/cli/src/commands/studio-resource-event-command.ts`
  - owns the CLI-side Studio resource-changed event append behavior after media
    imports;
- `packages/cli/src/commands/media-import-command-handlers.ts`
  - owns `media import` handler registration and media-import purpose handlers;
- `packages/cli/src/commands/generation-command-handlers.ts`
  - owns generation action handlers such as `context`, `model list`,
    `production update`, `preflight`, `input list`, `input select`,
    `input clear`, `spec validate`, `spec create`, `spec update`,
    `spec show`, `spec list`, `estimate`, and `run`;
- `packages/cli/src/commands/generation-plan-command.ts`
  - may either remain a small focused command adapter or be reduced to a thin
    wrapper over a `generation plan` handler; either way, it should consume the
    shared required-flag, scene-target, and shot-id parsers when those exist;
- `packages/cli/src/commands/generation-purpose-command-registry.ts`
  - owns CLI-level generation purpose parsing and target-parser selection only.
    It must not map lifecycle commands to purpose-specific core service methods,
    because that dispatch now belongs to core after plan `0043`.

These modules are not compatibility wrappers. They must contain real command
adapter behavior: parsing, validation, dispatch, output, or event work. Do not
create pass-through files whose only purpose is to hide old names or avoid
updating imports.

## Command Handler Contract

Use this internal command-handler contract to make routing explicit:

Example shape:

```ts
export interface CliCommandRuntime {
  projectName?: string;
  homeDir?: string;
  json: boolean;
  io: RenkuCliIo;
  projectDataService: ProjectDataService;
}

export interface CliCommandHandler<Flags> {
  path: readonly string[];
  run(input: {
    flags: Flags;
    runtime: CliCommandRuntime;
  }): Promise<unknown | CliCommandResult>;
}
```

Implementation may add fields when a command genuinely needs more runtime
context, but these names and responsibilities are the planned shape:

- dispatch by command path, not by nested `if` chains;
- keep per-command handler logic focused on one command shape;
- keep purpose routing in typed purpose registries;
- keep shared parsing in named parser modules;
- return data to a shared output writer instead of writing JSON in every branch.

## Media Import Refactor

`media import` should route through a media import handler registry.

Media import purpose handlers should cover the current purpose set:

- `lookbook.image`;
- `lookbook.sheet`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.environment-sheet`;
- `scene.storyboard-sheet`;
- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet`;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take`.

Each purpose handler should own only the CLI adapter work for that purpose:

- required flag extraction;
- target parsing;
- optional receipt parsing;
- import-document parsing when that purpose needs a document;
- calling the matching core service method;
- returning the import report.

Current purpose-specific import shapes:

- `lookbook.image` and `lookbook.sheet` use `lookbook:<id>` targets and
  single-file `--source` imports;
- `cast.character-sheet` and `cast.profile` use `cast:<id>` targets and
  single-file `--source` imports;
- `location.environment-sheet` uses `location:<id>` targets and grouped
  `--file` import documents, and must continue to reject `--source` and
  `--receipt`;
- `scene.storyboard-sheet` uses `scene:<id>` targets plus `--shot-list` and a
  grouped `--file` import document, and must continue to reject `--source` and
  `--receipt`;
- shot input purposes use `scene:<id>`, `--shot-list`, `--shots`, single-file
  `--source`, optional `--receipt`, and optional `--selection`;
- `shot.video-take` uses `scene:<id>`, `--shot-list`, `--shots`, single-file
  `--source`, and optional `--receipt`.

The shared `media import` command handler should:

- select the purpose handler;
- call it;
- append the Studio resource-changed event when the report contains resource
  keys;
- return the report for shared JSON output.

Unsupported purpose diagnostics must remain structured and stable.

## Generation Command Refactor

Generation command routing should be split into command action handlers and
focused purpose/target parsers.

Action handlers should cover the current command surface:

- `generation context`;
- `generation model list`;
- `generation production update`;
- `generation preflight`;
- `generation input list`;
- `generation input select`;
- `generation input clear`;
- `generation spec validate`;
- `generation spec create`;
- `generation spec update`;
- `generation spec show`;
- `generation spec list`;
- `generation estimate`;
- `generation run`.

Generic lifecycle handlers must call the shared `ProjectDataService`
media-generation methods added by plan `0043`. These handlers should not branch
by purpose after parsing the purpose and target:

- `buildMediaGenerationContext`;
- `listMediaGenerationModels`;
- `validateMediaGenerationSpec`;
- `createMediaGenerationSpec`;
- `updateMediaGenerationSpec`;
- `readMediaGenerationSpec`;
- `listMediaGenerationSpecs`;
- `estimateMediaGenerationSpec`;
- `runMediaGenerationSpec`.

Purpose-aware CLI code should only parse and validate CLI input shapes, such as
converting `--purpose shot.video-take --target scene:<id> --shot-list <id>
--shots <ids>` into a `MediaGenerationRequestTarget`. Core remains responsible
for purpose-specific lifecycle behavior.

The current supported generation purposes are:

- `lookbook.image`;
- `lookbook.sheet`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.environment-sheet`;
- `scene.storyboard-sheet`;
- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet`;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take`.

Shot-video-only commands such as production update, preflight, and input
selection may remain explicit command handlers. They should not appear as inline
branches inside `runGenerationCommand`.

`generation plan` is also shot-video-only, but it is already implemented as a
separate command adapter. This plan does not require changing its user-facing
behavior. It does require any touched parsing or diagnostics to follow the same
shared command primitives as the rest of the generation command family.

## Complexity Rules

The implementation must enforce low cyclomatic complexity for CLI command code.

Rules:

- no nested ternary expressions in command files;
- no command function with many action branches;
- no purpose dispatch implemented as long `if` / `else if` chains;
- no function that mixes command routing, file parsing, purpose dispatch,
  service calls, output writing, and side effects;
- exported command entry points should have a cyclomatic complexity target of
  `3` or lower;
- individual command handlers should generally stay at complexity `8` or lower;
- handler nesting depth should generally stay at `2` or lower;
- when a handler exceeds those limits, split command parsing, purpose handling,
  document parsing, or side effects into named modules before adding more logic.

Add lint coverage in `packages/cli/eslint.config.mjs` using existing ESLint
rules where possible:

- `complexity`;
- `max-depth`;
- `no-nested-ternary`;
- optionally `max-lines-per-function` for `packages/cli/src/commands/**/*.ts`
  if the threshold can be set without creating noisy failures in parser modules.

If lint rules cannot express a useful scoped guard, add focused tests or a small
static check in the CLI package test suite. Do not install new dependencies
unless the user explicitly approves dependency installation.

## Structured Diagnostics

All CLI command-boundary failures must use `StructuredError` or a structured
diagnostic mechanism already accepted by the repo.

Required diagnostics:

- unknown command path;
- unsupported media import purpose;
- unsupported generation purpose;
- missing required flag;
- invalid target format;
- invalid import document;
- invalid shot list flag combination;
- invalid selection flag.

Do not replace structured errors with `throw new Error(...)` at CLI package
boundaries. Do not silently fall back to another purpose, command, target, or
spec reader.

## Behavior Preservation

This is a structural refactor first.

Preserve current behavior unless a cleanup is intentionally named and tested:

- command names;
- command paths;
- required flags;
- optional flags;
- JSON output shapes;
- structured error codes and messages where already relied upon;
- exit codes;
- Studio resource-changed event behavior after successful media imports;
- simulation and approval-token behavior for generation runs.

If implementation discovers a real bug, record the intended cleanup in the
implementation notes and add a test that describes the corrected behavior.

## Testing Plan

Add focused CLI tests before or during the refactor so behavior changes are
visible.

Required tests:

- `media import` routes each supported purpose through the correct core service
  method;
- `media import` rejects unsupported purposes with a structured diagnostic;
- `media import --purpose lookbook.sheet` preserves the current single-file
  import behavior and Studio resource-changed event behavior;
- Location environment sheet imports still reject `--source` and `--receipt`;
- Scene storyboard sheet imports still reject `--source` and `--receipt`;
- media imports append Studio resource-changed events when reports include
  resource keys;
- `generation context` routes each supported purpose to the correct core service
  method and sends the parsed purpose/target to core;
- `generation model list` routes each supported purpose to the correct core
  method and sends the parsed purpose/target to core;
- `generation context`, `generation model list`, and `generation spec list`
  include `lookbook.sheet` and shot-video input/final video purposes in parser
  coverage;
- `generation spec validate/create/update/show/list` call the shared generic
  media-generation service methods;
- `generation estimate` and `generation run` call the shared generic
  media-generation service methods and preserve approval-token/simulation flags;
- no CLI lifecycle handler maps a media-generation purpose to a purpose-specific
  create, read, update, estimate, or run core service method;
- shot-video-only commands reject non-`shot.video-take` purposes with structured
  diagnostics;
- `generation plan` remains routed to one focused shot-video planning adapter or
  handler and rejects non-`shot.video-take` purposes with structured diagnostics;
- unknown command paths return structured diagnostics with helpful suggestions;
- JSON output still writes primary machine-readable results to `stdout`.

Prefer handler-level tests with a fake command runtime and fake project data
service. Keep end-to-end CLI tests for the command surface and output behavior.

## Implementation Phases

### Phase 1: Baseline Current Command Contract

- Inventory the current `media` and `generation` command paths, flags, JSON
  outputs, and structured diagnostics.
- Inventory the adjacent `generation plan` path, flags, human output, JSON
  output, and structured diagnostics so shared parser extraction does not break
  it.
- Compare the implemented purpose set in `packages/core/src/client/media-generation.ts`
  and `packages/core/src/server/media-generation/purpose-registry.ts` with
  `docs/architecture/reference/media-generation.md` and `docs/cli/commands.md`;
  record documentation drift before implementation.
- Add or expand tests for the current intended behavior before changing routing.
- Note any intentional cleanup candidates discovered during inventory.

### Phase 2: ADR And Architecture Link

- Add `docs/decisions/NNNN-use-thin-structured-cli-command-handlers.md` using
  the next available ADR number.
- Link the ADR from `docs/architecture/layers-of-responsibility.md`.
- Update the `studio-cli` section in that architecture doc with the rule that
  CLI command entry points must dispatch through small handlers, dispatch
  tables, or registries.

### Phase 3: Shared CLI Command Primitives

- Add shared command handler/runtime types.
- Add command-path lookup that reports structured unknown-command diagnostics.
- Move shared required-flag, JSON output, JSON-file reading, target parsing,
  shot parsing, and selection parsing into deliberately named CLI modules.
- Reuse the shared required-flag, `scene:<id>`, and shot-id parsers from
  `generation-plan-command.ts` if that file is touched.
- Keep modules specific to CLI command behavior. Do not move domain validation
  out of core.

### Phase 4: Refactor Media Import

- Create the media import command handler.
- Create the media import purpose registry.
- Include `lookbook.sheet` in the media import purpose registry.
- Move Location environment sheet and Scene storyboard sheet import document
  parsing into `media-import-documents.ts`.
- Move Studio resource-changed event append behavior into
  `studio-resource-event-command.ts`.
- If delegating import dispatch to core, add a deliberate `ProjectDataService`
  or public server entry-point contract instead of importing
  `media-generation/purpose-registry.ts` directly from the CLI.
- Reduce `runMediaCommand` to runtime creation and dispatch.

### Phase 5: Refactor Generation

- Create generation command action handlers.
- Create focused generation purpose and target parser modules.
- Move repeated purpose and target parsing out of `runGenerationCommand`.
- Keep lifecycle handlers wired to the generic media-generation core service
  methods added by plan `0043`.
- Keep shot-video-only action handlers explicit and small.
- Keep `generation plan` as a separate focused adapter/handler and share parser
  modules where useful.
- Reduce `runGenerationCommand` to runtime creation and dispatch.

### Phase 6: Complexity Enforcement

- Add lint or test enforcement for command complexity, nesting depth, and nested
  ternary usage.
- Confirm the new command files satisfy the limits in this plan.
- Update tests if an intentional cleanup changed behavior.

### Phase 7: Documentation Sync

- Update `docs/architecture/reference/media-generation.md` if its current
  purpose list, command examples, or target examples lag behind the implemented
  core registry.
- Update `docs/cli/commands.md` if its `generation` or `media import` sections
  omit implemented purposes such as `lookbook.sheet`, shot-video input purposes,
  or the final `shot.video-take` purpose.
- Keep documentation focused on the current command contract. Do not document
  compatibility aliases, old command paths, or staged coexistence.

### Phase 8: Verification

Run focused and package-level checks:

```bash
pnpm test:cli
pnpm lint
pnpm check
```

If package-level checks are too broad for the implementation turn, run the
focused CLI tests first and document what remains unrun.

## Acceptance Criteria

- `runMediaCommand` is a small entry point that delegates to registered command
  handlers.
- `runGenerationCommand` is a small entry point that delegates to registered
  command handlers.
- Purpose dispatch lives in typed registries or handler maps, not nested
  ternaries or long `if` / `else if` chains.
- Generic generation lifecycle commands remain wired to shared
  `ProjectDataService` methods, not CLI-side purpose-to-service dispatch.
- Shared target parsing and JSON document parsing are not duplicated between the
  media and generation command files.
- Structured diagnostics are preserved or improved intentionally.
- Existing command behavior is preserved unless a cleanup is explicitly named
  and tested.
- CLI tests cover the media and generation command surfaces listed above.
- Complexity enforcement exists through lint rules or focused static tests.
- A new CLI command architecture ADR exists in `docs/decisions/`.
- `docs/architecture/layers-of-responsibility.md` links the new ADR and names
  the thin handler/dispatch-table rule.
- `docs/architecture/reference/media-generation.md` and `docs/cli/commands.md`
  match the implemented purpose set after the refactor.

## Review Checklist

- Does every new command path have one obvious handler?
- Can a reviewer find every supported media generation purpose in one registry?
- Can a reviewer find every supported media import purpose in one registry?
- Can a reviewer confirm generation lifecycle commands call generic core methods
  rather than purpose-specific service methods?
- Can a reviewer confirm `lookbook.sheet` is present everywhere the supported
  purpose set is enumerated?
- Can a reviewer confirm `generation plan` remains a focused shot-video planning
  adapter/handler?
- Are command entry points small enough to read without scrolling through
  purpose behavior?
- Are structured error codes stable and intentional?
- Are JSON outputs still suitable for agents?
- Did the implementation avoid pass-through re-export files and compatibility
  aliases?
- Did tests fail if someone reintroduces nested ternary dispatch or excessive
  command complexity?

## Completion Checklist

Use this checklist to track when the CLI command architecture refactor is
complete enough to support future media-generation and shot-video work without
returning to giant nested command functions.

Implementation note: this plan was implemented on 2026-06-05. Verification
completed with `pnpm --dir packages/cli check:all`, root `pnpm check`, and root
`pnpm test`.

### Design Review

- [ ] Confirm CLI remains the required human-facing and agent-facing contract for
  Studio Skills and external agents.
- [ ] Confirm CLI stays a thin wrapper over core and does not move domain logic,
  dependency graph behavior, asset-selection rules, or provider behavior into
  `packages/cli`.
- [ ] Confirm `runMediaCommand` and `runGenerationCommand` are only command
  entry points, not large implementation bodies.
- [ ] Confirm command routing uses handlers, dispatch tables, or typed
  registries.
- [ ] Confirm media import purpose routing is not implemented through long
  `if` / `else if` chains or nested ternaries.
- [ ] Confirm generation lifecycle purpose routing remains in core and is not
  duplicated in `packages/cli`.
- [ ] Confirm `generation plan` remains a focused shot-video planning adapter or
  handler and does not add branches inside `runGenerationCommand`.
- [ ] Confirm no public command names or flag shapes change unless explicitly
  named and tested.

### ADR And Architecture Docs

- [ ] Add `docs/decisions/NNNN-use-thin-structured-cli-command-handlers.md`
  using the next available ADR number.
- [ ] State in the ADR that CLI is a crucial human-facing and agent-facing
  contract.
- [ ] State in the ADR that command entry points must dispatch through small
  handlers, dispatch tables, or registries.
- [ ] State in the ADR that CLI package-boundary failures require structured
  diagnostics.
- [ ] Link the ADR from `docs/architecture/layers-of-responsibility.md`.
- [ ] Update the `studio-cli` section in
  `docs/architecture/layers-of-responsibility.md` with the thin
  handler/dispatch-table rule.
- [ ] Confirm `docs/architecture/coding-practices.md` still reflects the CLI
  complexity rules used by this plan.

### Baseline Command Contract

- [ ] Inventory every current `media` command path.
- [ ] Inventory every current `generation` command path.
- [ ] Inventory the adjacent `generation plan` command path and its output
  contracts.
- [ ] Inventory current required flags, optional flags, and target formats.
- [ ] Inventory current JSON output shapes used by agents.
- [ ] Inventory current structured error codes and suggestions.
- [ ] Inventory current Studio resource-changed event behavior after successful
  media imports.
- [ ] Add or expand tests that lock the intended current behavior before
  refactoring routing.

### Shared CLI Command Primitives

- [ ] Add shared command handler/runtime types.
- [ ] Add command-path lookup with structured unknown-command diagnostics.
- [ ] Add shared required-flag helpers.
- [ ] Add shared JSON output helpers.
- [ ] Add shared JSON file reading helpers.
- [ ] Move target parsing into a named CLI parser module.
- [ ] Move shot id parsing into a named CLI parser module.
- [ ] Move selection parsing into a named CLI parser module.
- [ ] Reuse shared scene-target and shot-id parsing from `generation plan` if
  that file is touched.
- [ ] Ensure new modules contain real command adapter behavior and are not
  pass-through re-export files.

### Media Import Refactor

- [ ] Create the `media import` command handler.
- [ ] Create the media import purpose handler registry.
- [ ] Add handlers for `lookbook.image`.
- [ ] Add handlers for `lookbook.sheet`.
- [ ] Add handlers for `cast.character-sheet`.
- [ ] Add handlers for `cast.profile`.
- [ ] Add handlers for `location.environment-sheet`.
- [ ] Add handlers for `scene.storyboard-sheet`.
- [ ] Add handlers for `shot.first-frame`.
- [ ] Add handlers for `shot.last-frame`.
- [ ] Add handlers for `shot.reference-sheet`.
- [ ] Add handlers for `shot.multi-shot-storyboard-sheet`.
- [ ] Add handlers for `shot.video-take`.
- [ ] Move Location environment sheet import document parsing into
  `media-import-documents.ts`.
- [ ] Move Scene storyboard sheet import document parsing into
  `media-import-documents.ts`.
- [ ] Move Studio resource-changed event append behavior into a focused command
  module.
- [ ] Reduce `runMediaCommand` to runtime creation, handler dispatch, and result
  output.

### Generation Command Refactor

- [ ] Create generation command action handlers.
- [ ] Create focused generation purpose and target parser modules.
- [ ] Add a handler for `generation context`.
- [ ] Add a handler for `generation model list`.
- [ ] Add a handler for `generation production update`.
- [ ] Add a handler for `generation preflight`.
- [ ] Add handlers for `generation input list`, `input select`, and
  `input clear`.
- [ ] Add handlers for `generation spec validate`, `spec create`,
  `spec update`, `spec show`, and `spec list`.
- [ ] Add a handler for `generation estimate`.
- [ ] Add a handler for `generation run`.
- [ ] Keep `generation plan` in one focused adapter or handler and share parser
  modules where useful.
- [ ] Ensure `generation context` and `generation model list` call the generic
  core media-generation methods with parsed purpose and target values.
- [ ] Ensure `generation spec validate`, `spec create`, `spec update`,
  `spec show`, and `spec list` call the generic core media-generation methods.
- [ ] Ensure `generation estimate` and `generation run` call the generic core
  media-generation methods.
- [ ] Ensure no generation lifecycle handler maps purposes to purpose-specific
  create, update, read, estimate, or run service methods.
- [ ] Keep shot-video-only command behavior in explicit small handlers.
- [ ] Reduce `runGenerationCommand` to runtime creation, handler dispatch, and
  result output.

### Structured Diagnostics

- [ ] Preserve structured diagnostics for unknown media command paths.
- [ ] Preserve structured diagnostics for unknown generation command paths.
- [ ] Preserve structured diagnostics for unsupported media import purposes.
- [ ] Preserve structured diagnostics for unsupported generation purposes.
- [ ] Preserve structured diagnostics for missing required flags.
- [ ] Preserve structured diagnostics for invalid target formats.
- [ ] Preserve structured diagnostics for invalid import documents.
- [ ] Preserve structured diagnostics for invalid shot list or shot id flags.
- [ ] Preserve structured diagnostics for invalid selection flags.
- [ ] Do not introduce loose `throw new Error(...)` at CLI package boundaries.

### Complexity Enforcement

- [ ] Add scoped ESLint `complexity` coverage for CLI command files where
  practical.
- [ ] Add scoped ESLint `max-depth` coverage for CLI command files where
  practical.
- [ ] Add scoped ESLint `no-nested-ternary` coverage for CLI command files.
- [ ] Add focused static tests if lint cannot express a useful scoped guard.
- [ ] Confirm exported command entry points meet the complexity target.
- [ ] Confirm command handlers stay within the planned complexity and nesting
  targets.
- [ ] Confirm tests or lint fail if nested ternary dispatch returns.

### Behavior Preservation Tests

- [ ] Test `media import` routing for every supported purpose.
- [ ] Test `media import --purpose lookbook.sheet` preserves current single-file
  import behavior.
- [ ] Test unsupported media import purpose diagnostics.
- [ ] Test Location environment sheet import flag rejection for `--source` and
  `--receipt`.
- [ ] Test Scene storyboard sheet import flag rejection for `--source` and
  `--receipt`.
- [ ] Test Studio resource-changed event append behavior for media imports with
  resource keys.
- [ ] Test `generation context` calls the generic core service with every
  supported purpose's expected parsed target shape.
- [ ] Test `generation context`, `generation model list`, and
  `generation spec list` parser coverage for `lookbook.sheet`.
- [ ] Test `generation model list` calls the generic core service with every
  supported purpose's expected parsed target shape.
- [ ] Test `generation spec validate/create/update/show/list` call the generic
  core service methods.
- [ ] Test `generation estimate` calls the generic core service method.
- [ ] Test `generation run` calls the generic core service method.
- [ ] Test approval-token and simulation flag preservation.
- [ ] Test shot-video-only commands reject non-`shot.video-take` purposes.
- [ ] Test `generation plan` keeps its current shot-video-only behavior.
- [ ] Test unknown command paths return structured diagnostics.
- [ ] Test JSON output writes machine-readable results to `stdout`.

### Documentation Sync

- [ ] Update `docs/architecture/reference/media-generation.md` so its current
  purposes and command examples include the implemented purpose set.
- [ ] Update `docs/cli/commands.md` so the `generation` and `media import`
  sections include the implemented purpose set.
- [ ] Confirm documentation avoids compatibility aliases, old command paths, and
  stale purpose lists.

### Integration With Other Plans

- [ ] Confirm the CLI refactor supports the `0042` `generation plan` command
  without adding nested command branches.
- [ ] Confirm CLI handlers use the `0043` shared core generation service for
  lifecycle commands.
- [ ] Confirm CLI handlers remain adapters now that `0043` moved lifecycle
  behavior into core.
- [ ] Confirm media import either uses a focused CLI purpose registry or delegates
  to a core import-purpose helper without duplicating nested command dispatch.
- [ ] Confirm the CLI does not deep-import core internal media-generation modules
  when delegating import dispatch.
- [ ] Confirm Studio Skill workflows continue to use CLI commands for metadata
  mutation.

### Final Verification

- [ ] Verify `runMediaCommand` is small enough to read without scrolling through
  purpose behavior.
- [ ] Verify `runGenerationCommand` is small enough to read without scrolling
  through purpose behavior.
- [ ] Verify every command path has one obvious handler.
- [ ] Verify every supported purpose appears in one relevant registry.
- [ ] Verify `lookbook.sheet` appears in supported-purpose lists, parser
  coverage, tests, and docs.
- [ ] Verify no pass-through re-export files or compatibility aliases were
  added.
- [ ] Run `pnpm test:cli`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm check`.
- [ ] Run broader `pnpm test` if the implementation touches shared behavior
  beyond CLI command routing.
- [ ] Document any checks not run and why.
