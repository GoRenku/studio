# 0165 Restore Repeatable Generation Preview CLI Inputs

Status: complete

Date: 2026-07-30

## Summary

Restore the already accepted multi-request Generation Preview workflow at the
CLI entry boundary.

The Core Preview builders, ordered Studio coordination event, Studio server
projection, and desktop dialog navigation already support one or more ordinary
GenerationSpecs. The current failure occurs earlier: `meow` still declares
`--file` and `--spec` as single-value flags, so it rejects a second occurrence
before the later raw-argument recovery code or generation command handler can
run.

The smallest useful fix is:

- let the CLI parser itself accept repeated `--file` and `--spec` values;
- pass the parser-owned ordered arrays to the existing
  `generation preview show` handler;
- remove the unreachable raw `argv` re-parser;
- preserve scalar behavior for every command that accepts only one file or
  GenerationSpec id;
- add a test at the exported `runRenkuCli` boundary so parser configuration and
  handler tests cannot disagree again; and
- instruct the Media Producer to report a combined-Preview delivery failure
  instead of opening each request separately.

No Core, Studio server, Studio React, database, GenerationSpec, estimate,
approval, or run contract changes are required.

## Requirement Ledger

| Id | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | One `generation preview show` invocation accepts two or more repeated `--spec` values or two or more repeated `--file` values in command-line order. | User request and current CLI documentation. | `packages/cli/src/cli.ts` parser boundary. | Entry-point tests cover both input kinds and exact order. |
| R2 | All requested previews appear in one dialog with `1 / N` and Previous/Next controls. | User request and completed Plan `0138`. | Existing generation handler, coordination event, and Preview dialog. | Existing handler/server/Studio tests plus real desktop verification. |
| R3 | Each GenerationSpec keeps its independent prompt, references, estimate, approval, update, run, output, and attachment lifecycle. | Current generation architecture and Plan `0138`. | Existing Core and Studio contracts. | No contract changes; existing Preview state-preservation test remains green. |
| R4 | One input preserves the current single-request dialog without navigation. | Current product behavior. | Existing handler and Preview dialog. | Existing single-preview UI test and one-input CLI test remain green. |
| R5 | Invalid or mixed inputs fail before any partial Preview notification. | Structured-diagnostics boundary and current Preview contract. | Existing generation handler, plus CLI scalar normalization for non-Preview commands. | Tests cover mixed Preview inputs, one invalid member, and repeated values on scalar commands. |
| R6 | A combined Preview failure is reported; the agent must not substitute separate Preview invocations whose later event replaces the earlier dialog session. | Referenced task evidence, user expectation, and fail-fast project rule. | Source Media Producer guidance and eval. | Skill diff/eval asserts one combined command and no split fallback. |

Every planned change traces to one of these requirements. This plan does not
promote other possible Preview grouping behavior into scope.

## Product Behavior

The accepted saved-request command remains:

```bash
renku generation preview show \
  --spec media_generation_spec_first \
  --spec media_generation_spec_second \
  --json
```

The transient-file form remains:

```bash
renku generation preview show \
  --file tmp/first-spec.json \
  --file tmp/second-spec.json \
  --json
```

For either form:

1. the outer CLI parser preserves every value in command-line order;
2. the existing generation handler builds all ordinary Previews;
3. if any build fails, no Studio notification is sent;
4. otherwise the CLI sends one ordered `previews` array;
5. Studio appends one `studio.generationPreviewsRequested` event;
6. the existing dialog opens at `1 / N`; and
7. Previous and Next cycle through the requests without combining their
   independent lifecycle state.

Repeated `--file` and `--spec` are supported together only as alternatives, not
as mixed input kinds. Commands other than `generation preview show` continue to
accept at most one value for these flags.

If the combined command cannot be parsed, validated, projected, or delivered,
the agent reports that failure and stops the Preview handoff. It does not issue
one Preview command per spec.

## Explicit Non-Goals

This plan does not:

- add a Preview collection, batch, review-session, or thread-level domain type;
- accumulate separate Preview events by time window or Codex task;
- make Studio guess which sequential notifications belong together;
- add a combined estimate, approval, run, receipt, output, or attachment;
- change GenerationSpec persistence or add a database migration;
- change Core Preview construction or Studio server projection;
- redesign the existing Preview dialog or move its navigation controls;
- change the single-request Preview experience;
- add mobile behavior or mobile verification;
- add compatibility aliases or preserve the ineffective raw argument parser;
- edit the installed plugin cache; or
- modify completed Plan `0138` to rewrite its history.

## Context And Evidence

### Referenced task

Task `019fb3be-5254-7db3-aba9-cf98cfef4a6a` created:

- `media_generation_spec_j2myn4ga` for the first frame; and
- `media_generation_spec_ebk723dj` for the last frame.

It then issued the intended combined command:

```bash
renku generation preview show \
  --spec media_generation_spec_j2myn4ga \
  --spec media_generation_spec_ebk723dj \
  --json
```

The command exited before generation dispatch with:

```text
The flag --spec can only be set once.
```

The task then sent one command per spec. Each successful command appended its
own Studio event. `GenerationPreviewDialogHost` intentionally replaces the
current dialog session when a later complete event arrives, so the second
single-entry event replaced the first. The final visible dialog therefore had
one request and no navigation.

### CLI parser and handler

`packages/cli/src/cli.ts` currently declares both `file` and `spec` with only:

```ts
{ type: 'string' }
```

`meow@14.1.0` rejects repeated flags unless the flag definition has
`isMultiple: true`. That validation runs inside `meow(...)`, before
`runRenkuCli` reaches:

```ts
repeatedGenerationPreviewFlags(argv)
```

The raw recovery path is therefore unreachable for the exact repeated command
it exists to support.

The downstream implementation is already correct:

- `GenerationCommandFlags.file` and `.spec` can represent arrays;
- `runPreviewShow` uses every value in order;
- all Previews are built before notification;
- `notifyStudioGenerationPreviews` sends one array; and
- handler tests prove one notification is used for two ordinary Previews.

### Studio path

The existing Studio path is also already correct:

- `studio.generationPreviewsRequested` carries
  `GenerationPreviewResource[]`;
- the Studio server projects every member before appending one event;
- browser coordination republishes the complete array;
- `GenerationPreviewDialogHost` opens one session for one complete event; and
- `GenerationPreviewDialog` shows `1 / N` with accessible Previous/Next shadcn
  Buttons.

`generation-preview-dialog-host.e2e.test.tsx` already proves navigation order,
disabled boundary buttons, shared-tab preservation, independent unsaved drafts,
and the absence of navigation for one request.

No Studio production change is justified by the observed failure.

### Documentation and prior plan

The current contract is already documented correctly in:

- `docs/architecture/studio-coordination-events.md`;
- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`; and
- completed Plan
  `0138-multi-request-generation-preview-and-storyboard-continuity.md`.

Plan `0138` deliberately rejected time-window aggregation and introduced the
ordered array contract. Its handler and UI tests passed, but no test exercised
the repeated flags through the outer `meow` parser. The completed plan remains
historical evidence; this plan repairs that missed entry boundary.

### Working-tree overlap

The current Studio working tree contains the completed-but-uncommitted Plan
`0162` implementation. It already modifies `packages/cli/src/cli.ts` for
Shot Plan generation context. The implementation of this plan must make a
narrow merge into that file and preserve the existing
`--authored-from-shot-plan` work.

The source Studio Skills repository also contains Plan `0162` changes. Any
Media Producer wording or eval edit must preserve that work and must not revive
retired Shot Video Take paths.

## Architecture Decision

Three implementation choices were compared:

1. **Reuse the existing implementation unchanged.** Rejected because the outer
   parser demonstrably rejects the documented public command before the
   implementation runs.
2. **Repair the existing CLI owner.** Accepted. Configure `meow` to own repeated
   values, normalize scalar-only commands explicitly, and reuse every existing
   downstream contract unchanged.
3. **Introduce a Preview collection or Studio event aggregator.** Rejected
   because the existing ordered event already represents the complete user
   intent. Aggregating separate events would guess across unrelated commands
   and recreate a domain concept Plan `0138` deliberately excluded.

This is a parser-boundary correction, not a new Preview feature.

## Architecture Shape Gate

### Ownership and public entrypoints

- `packages/cli` owns accepted command-line multiplicity and conversion from
  parsed flags to command-handler inputs.
- `renku generation preview show` remains the only public Preview command.
- `runRenkuCli` remains the exported CLI entrypoint.
- `generationCommandHandlers` remains the bounded generation dispatch map.
- `ProjectDataService.buildGenerationPreview` remains the one-request Core
  builder.
- The existing notification endpoint and
  `studio.generationPreviewsRequested` event remain unchanged.
- Studio Skills owns the agent rule to use one combined invocation and stop on
  failure.

### Intended module and file shape

Production changes are limited to:

```text
packages/cli/src/cli.ts
  declare parser-owned repeated file/spec values
  normalize scalar-only command inputs
  remove raw argv recovery

packages/cli/src/cli.test.ts
  exercise repeated flags through runRenkuCli
```

Source skill changes are limited to:

```text
$HOME/Projects/aitinkerbox/studio-skills/
  skills/media-producer/SKILL.md
  skills/media-producer/references/workflow.md
  skills/media-producer/evals/forward-test-cases.md
```

No new production module, wrapper, registry, dispatcher, or `index.ts` export is
needed.

### Parser shape

`createCliFlags` marks `file` and `spec` as `isMultiple: true`, allowing
`meow` to produce ordered arrays for one or more occurrences.

One focused private function in `cli.ts`, named
`singleCommandFlagValue`, converts zero-or-one parsed values to the scalar
shape expected by commands other than `generation preview show`. It rejects
more than one value with structured diagnostic `CLI154`, explaining that
repeated `--file` and `--spec` values are supported only by
`generation preview show`.

The generation Preview branch passes the parser-owned arrays directly. Delete:

- `repeatedGenerationPreviewFlags`; and
- `repeatedFlagValues`.

Do not scan raw `argv` a second time.

### Files that remain unchanged

The following existing owners must remain unchanged unless new evidence
invalidates this gate:

- `packages/cli/src/commands/generation-command-handlers.ts`;
- `packages/cli/src/commands/studio-notification-client.ts`;
- all Core generation and coordination contracts;
- all Studio server event routes and projections; and
- all Studio generation-preview React production files.

Their focused tests are verification targets, not an invitation to refactor
them.

### Forbidden implementation shapes

Do not:

- special-case a second raw-argument parser before or after `meow`;
- silently keep the last `--file` or `--spec` value on scalar-only commands;
- broaden `GenerationCommandFlags` into an untyped flag bag;
- move flag parsing into Core, Studio server, or React;
- add a Preview collection service, wrapper DTO, event id, or persistence;
- make `GenerationPreviewDialogHost` merge separate events;
- add purpose-specific branching to the CLI parser;
- change Preview navigation to compensate for a one-entry event;
- add aliases or compatibility behavior for the broken parser path; or
- turn `cli.ts` into a second command dispatcher beyond its current top-level
  routing responsibility.

### Stop conditions

Stop and revise the plan if implementation requires:

- a Core, server, database, or Studio production change;
- a new public Preview contract;
- a new command or alternate combined-spec document;
- time-based or task-based event aggregation;
- sharing lifecycle state across Preview entries;
- a broad rewrite of `cli.ts`;
- a new package or dependency; or
- editing or discarding unrelated Plan `0162` working-tree changes.

## Contracts

### Restored CLI contract

`generation preview show` accepts:

```ts
file?: string[];
spec?: string[];
```

through the parser and preserves order. The existing handler remains responsible
for:

- requiring at least one input;
- rejecting mixed file/spec input kinds with `CLI145`;
- building every Preview before notification;
- returning `requestCount`; and
- preserving one Preview per independent request.

This restores the documented contract; it does not add a new public response.

### Scalar command contract

All other commands continue to observe:

```ts
file?: string;
spec?: string;
```

after CLI-entry normalization.

Repeated scalar values fail with:

```text
CLI154
```

The diagnostic names the repeated flag and suggests using one value, or using
`generation preview show` when the intent is multi-request review.

### Agent workflow contract

The Media Producer continues to issue one command with repeated flags. Guidance
must state that failure of that command is a failed review handoff: do not emit
separate Preview commands, do not claim all requests are open, and do not move
to cost approval until the combined Preview succeeds.

## Implementation Slices

### Slice 1 — Make parser multiplicity match the public command

Files:

- `packages/cli/src/cli.ts`.

Work:

- declare `--file` and `--spec` as parser-owned multiple flags;
- derive ordered arrays only from `cli.flags`;
- pass arrays only to `generation preview show`;
- normalize zero-or-one values for every scalar command before dispatch;
- report `CLI154` inside the existing structured CLI error boundary when a
  scalar command receives repeated values; and
- delete the ineffective raw `argv` repeated-flag functions and their call
  site.

Exit:

- the exact two-`--spec` command from the referenced task reaches the existing
  generation Preview handler with both ids in order.

### Slice 2 — Cover the real entry boundary

Files:

- `packages/cli/src/cli.test.ts`;
- existing `packages/cli/src/commands/generation-command-handlers.test.ts`
  remains the handler-level companion.

Work:

- mock the generation command runner at the `runRenkuCli` boundary;
- prove repeated saved-spec ids reach it as one ordered array;
- prove repeated files reach it as one ordered array;
- prove one Preview value still uses the same handler path;
- prove scalar generation commands receive a scalar value;
- prove repeated values on scalar commands return structured `CLI154`; and
- retain the existing handler tests proving one notification, all-or-nothing
  building, input-kind rejection, and order.

Exit:

- a parser configuration that rejects repeated Preview flags fails the new
  entry-point test before it can be merged.

### Slice 3 — Remove the agent fallback that hid the failure

Files in the source Studio Skills repository:

- `skills/media-producer/SKILL.md`;
- `skills/media-producer/references/workflow.md`;
- `skills/media-producer/evals/forward-test-cases.md`.

Work:

- keep the current repeated-flag examples;
- state explicitly that separate Preview invocations are not a fallback for a
  failed combined review;
- require the agent to report the combined delivery failure and stop;
- require success before estimating or asking for paid execution approval; and
- strengthen the existing combined-preview eval with the negative assertion
  that no per-spec Preview commands are sent.

Exit:

- a future agent either opens one complete ordered dialog or reports that the
  requested review could not be opened.

### Slice 4 — Verify the existing end-to-end path

No production files change in this slice.

Work:

- rebuild the CLI distribution used by the installed `renku` shim;
- run the focused CLI and existing Studio Preview tests;
- use the two saved specs from the referenced `urban-basilica` task;
- confirm the CLI reports `requestCount: 2`;
- confirm Studio opens one dialog at `1 / 2`;
- navigate to `2 / 2` and back;
- confirm the first-frame and last-frame requests remain distinct; and
- confirm no estimate, run, provider call, output, or attachment is created by
  Preview.

Exit:

- the originally failing command completes the already implemented UI journey.

## Tests And Guardrails

### CLI parser boundary

- repeated `--spec value` syntax preserves both values;
- repeated `--spec=value` syntax is handled by `meow` consistently;
- repeated `--file value` syntax preserves both values;
- input order is unchanged;
- a single value reaches the same Preview handler path;
- absent multiple flags normalize correctly for scalar commands;
- scalar commands receive strings, not arrays;
- repeated scalar inputs return `CLI154` through JSON and human-readable error
  formatting;
- mixed Preview input kinds still return `CLI145`; and
- malformed or invalid Preview members still produce no notification.

### Existing downstream coverage

- generation handler test: two ids build two ordinary Previews and send one
  notification;
- notification/server test: one ordered array becomes one event only after all
  projections succeed;
- Studio test: `1 / 2`, Next, Previous, disabled boundaries, shared tab, and
  independent request drafts;
- Studio test: one Preview has no navigation; and
- no test introduces a collection or combined execution concept.

### Stable architecture guardrails

- tests assert public parser behavior and notification count, not private helper
  names;
- no architecture test searches source text for
  `singleCommandFlagValue`;
- CLI does not inspect GenerationSpec creative contents;
- Studio React does not import CLI or Core server code;
- no source-text inventory freezes command or helper names; and
- no new dependency or formatter run is required.

## Documentation And ADR Effects

No accepted Studio documentation or ADR change is required. Current
coordination, CLI, and skill architecture documents already describe repeated
Preview flags and one `1 / N` dialog accurately.

Implementation completion evidence belongs in this plan. Do not:

- rewrite completed Plan `0138`;
- add a new ADR for a parser bug;
- add a Preview collection document; or
- edit historical plans for naming or chronology.

The source Media Producer instructions and eval change because they are
executable workflow guidance, not accepted architecture documentation.

## Final Verification

### Focused automated verification

```bash
pnpm test:cli
pnpm build:cli
pnpm --dir packages/cli type-check
pnpm --dir packages/cli lint
pnpm --dir packages/studio test -- generation-preview-dialog-host.e2e.test.tsx
```

Run the existing Studio server event test if the focused Studio command does not
already include it:

```bash
pnpm --dir packages/studio test -- studio-events.test.ts
```

After integrating with the current working tree, run the repository gates:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Do not install or update dependencies.

### Real desktop verification

With Studio running on `urban-basilica`, run:

```bash
renku generation preview show \
  --spec media_generation_spec_j2myn4ga \
  --spec media_generation_spec_ebk723dj \
  --json
```

Verify:

1. the CLI exits successfully with `requestCount: 2`;
2. one dialog opens at `1 / 2`;
3. the first entry is “Urban Before the Empire — First Frame”;
4. Next shows `2 / 2` and the last-frame request;
5. Previous returns to the first request;
6. each entry retains its own prompt, references, estimate, and Update state;
7. Close dismisses the complete session;
8. one-spec Preview still opens without navigation; and
9. Preview causes no paid provider call or durable generation mutation.

Test desktop behavior only.

### Skill verification

- inspect the full Studio Skills diff around the existing Plan `0162` changes;
- confirm the combined-preview eval requires exactly one Preview command;
- confirm the eval forbids split fallback commands;
- confirm current Shot Plan video guidance and provider research remain intact;
- run the repository's applicable skill validation/eval workflow; and
- confirm the installed plugin cache was not edited.

### Architecture-shape review

Before completion:

- inspect `git diff --stat` in Studio and Studio Skills;
- inspect the complete diffs and preserve unrelated user changes;
- confirm `cli.ts` only gained parser multiplicity, scalar normalization, and
  deletion of the raw parser;
- confirm this plan added no Core, server, database, or Studio production
  change beyond the unrelated changes already present in the working tree;
- confirm no new module, wrapper, dispatcher, collection type, compatibility
  path, or broad helper was added;
- confirm no `index.ts` file changed;
- confirm no formatting churn was introduced; and
- confirm no checklist item was satisfied by accepting unreviewable code
  structure.

## Completion Evidence

Completed on 2026-07-30.

Implementation:

- `meow` now owns repeated `--file` and `--spec` parsing through
  `isMultiple: true`.
- `runRenkuCli` passes the parser-owned ordered arrays only to
  `generation preview show`.
- Other commands receive zero-or-one scalar values and fail with structured
  `CLI154` diagnostics when either flag is repeated.
- The unreachable raw `argv` parser was removed.
- Source Media Producer guidance and its combined-preview forward-test case now
  require one complete Preview handoff and forbid per-request fallback
  commands.

Verification:

- Before implementation, the exact referenced two-spec command exited with
  `The flag --spec can only be set once.`
- The rebuilt installed `renku` shim returned `requestCount: 2` and
  `studio.delivery: "delivered"` for the two saved `urban-basilica` specs.
- Desktop verification opened one “First Frame” dialog at `1 / 2`, navigated
  to the distinct “Last Frame” request at `2 / 2`, and returned to the first
  request with the expected disabled boundary controls.
- A one-spec command returned `requestCount: 1`; the existing Studio test
  verifies that this path has no navigation.
- Preview invoked no estimate, approval, run, provider, output, or attachment
  command.
- The CLI suite passed 13 files and 52 tests. The Studio suite passed 71 files
  and 303 tests, including the Preview navigation/state and server event
  coverage.
- `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` passed at the
  workspace root. Lint retained only the pre-existing `no-console` warning in
  `packages/studio/server/bin.ts`.
- The Media Producer skill passed `quick_validate.py`.
- `git diff --check` passed in both repositories. Complete diffs and diff
  statistics were inspected; no `index.ts`, Core, server, database, or Studio
  production file changed, and the installed plugin cache was not edited.

## Completion Checklist

### Review Area

- [x] Reproduce and record the outer-parser failure from the referenced task.
- [x] Confirm the existing handler, notification, event, and dialog array path
      remains correct.
- [x] Confirm the final scope is a CLI parser repair plus source-skill
      fail-fast guidance.
- [x] Confirm every implementation change maps to R1-R6.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm centralized parsing did not become a new broad command
      dispatcher.

### Architecture And Contracts

- [x] Keep `renku generation preview show` as the only public Preview command.
- [x] Keep `GenerationSpec`, `GenerationPreview`, notification, coordination
      event, server projection, and dialog contracts unchanged.
- [x] Let `meow` own repeated flag parsing.
- [x] Preserve ordered arrays for Preview and scalar values for all other
      commands.
- [x] Add structured `CLI154` for repeated values on scalar commands.
- [x] Keep `CLI145` for mixed Preview input kinds.
- [x] Remove the raw argument re-parser instead of retaining a shim.
- [x] Add no collection, batch, persistence, or combined execution concept.

### CLI Implementation

- [x] Mark `file` and `spec` as `isMultiple: true` in the existing flag
      definitions.
- [x] Pass parser-owned arrays directly to `generation preview show`.
- [x] Normalize zero-or-one file/spec values before scalar command dispatch.
- [x] Reject repeated scalar values without silently choosing first or last.
- [x] Delete `repeatedGenerationPreviewFlags`.
- [x] Delete `repeatedFlagValues`.
- [x] Preserve all overlapping Plan `0162` changes in `cli.ts`.
- [x] Keep `generation-command-handlers.ts` and notification code focused and
      unchanged unless contrary evidence is found.

### Studio And Agent Surfaces

- [x] Make no Studio server or React production change for this parser failure.
- [x] Preserve the existing `1 / N` header navigation and single-preview
      surface.
- [x] Keep every Preview entry's estimate, Update, approval, and run
      independent.
- [x] Update source Media Producer guidance to stop on combined Preview
      failure.
- [x] Forbid per-spec Preview commands as a fallback.
- [x] Strengthen the existing combined-preview eval without reviving retired
      workflow contracts.
- [x] Do not edit the installed plugin cache.

### Tests And Guardrails

- [x] Add `runRenkuCli` coverage for repeated `--spec` values.
- [x] Add `runRenkuCli` coverage for repeated `--file` values.
- [x] Assert exact input order.
- [x] Assert single Preview input remains supported.
- [x] Assert scalar commands receive scalar values.
- [x] Assert repeated scalar values return structured `CLI154`.
- [x] Keep handler tests for one notification and all-or-nothing building.
- [x] Run existing server array-event tests.
- [x] Run existing desktop Preview navigation/state tests.
- [x] Add no source-text architecture test for private names or inventories.

### Documentation

- [x] Confirm current accepted docs already describe the restored behavior.
- [x] Add no ADR for this parser correction.
- [x] Do not rewrite completed Plan `0138`.
- [x] Record final implementation and verification evidence in this plan.
- [x] Do not edit historical plans for naming sweeps.

### Final Verification

- [x] Run focused CLI tests, type-check, lint, and build.
- [x] Rebuild the distribution used by the installed `renku` shim.
- [x] Run focused Studio Preview and event tests.
- [x] Run applicable Studio Skills validation/eval checks.
- [x] Run root build, test, lint, and check gates after integration.
- [x] Exercise the two saved `urban-basilica` specs in one desktop Preview.
- [x] Confirm `requestCount: 2` and `1 / 2` navigation in both directions.
- [x] Confirm no estimate, generation, provider call, output, or attachment was
      created by Preview.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect `cli.ts` and any heavily modified file for accidental complexity.
- [x] Confirm this plan added no `index.ts`, Core, server, database, or Studio
      production change beyond the unrelated changes already present in the
      working tree.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
