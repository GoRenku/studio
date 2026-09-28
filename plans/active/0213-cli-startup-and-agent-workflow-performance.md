# 0213 CLI Startup And Agent Workflow Performance

Status: implemented; acceptance pending
Date: 2026-09-28

## Implementation Handoff — 2026-09-28

The source implementation covers W1–W8 in Studio and the sister Studio Skills
repository. See [CLI Performance](../../docs/architecture/cli-performance.md) for
the workstream evidence, exact benchmark conditions, results, and limitations.

**Review Attention:** The planned Core selection API cutover and conditional
skill call sequences are implemented. No Settings, flags, routes, schemas,
cache/permission/migration policies, notification timeout, or generation approval
rules changed. The dispatcher no longer contains the obsolete-command-specific
rejection sentinel, following the repository's no-compatibility rule. One stale
Studio integration header assertion now checks the existing accessible home
button; no UI behavior changed. Source changes are not published or installed.

Local medians improved from 1,140 to 67 ms for help, 1,122 to 54 ms for version,
1,205 to 76 ms for current project, 1,098 to 595 ms for information, and 1,192 to
517 ms for Inspiration list. Both substantive reads exceed the 40% target.
Core, Engines, CLI, integration, architecture, release-tool, performance/import,
and sister Skills checks passed as recorded in the performance document.

Acceptance remains open for an already assembled product (none found), desktop
foreground lifecycle/live refresh/Preview smoke (the existing service on fixed
test port 5174 prevented isolated startup), and independent end-to-end agent eval
execution. Added agent scenarios are explicitly manual specifications; the
two-call Inspiration authoring and validation-only paths were actually executed
as isolated CLI integration fixtures. Native Windows measurements are unverified.
Do not mark this plan complete until the remaining applicable gates pass.

## Summary

This plan addresses the complete September 27 performance investigation across
the CLI, Core, provider engines, and agent skills. The outcome is faster commands,
fewer unnecessary commands per task, fewer repeated provider requests, and clear
measurements of the time that remains. Project-selection changes are one part of
that work, not the overall deliverable.

Small commands currently take about 1.2 seconds while their underlying Core work
can take milliseconds. The same startup cost is paid repeatedly during a skill
workflow. Provider metadata requests, failed command attempts, permission retries,
and notification delivery add separate costs. Actual generation and agent
authoring also take time, which must be reported separately.

Keep the installed one-shot CLI. A persistent CLI service, daemon, MCP bridge,
background worker, and dependency on a running Studio for ordinary commands are
excluded. All eight workstreams below must be addressed before this plan is
complete; finishing the project-selection extraction alone does not satisfy it.

## Full Scope At A Glance

| Workstream | Finding from the investigation | Planned action and expected benefit | How completion is proved |
| --- | --- | --- | --- |
| W1 — CLI and Studio loading | Even help loads every command family and the Studio server implementation | Load only the selected command family; load server code only when Studio actually needs to start. Reduce the fixed cost of every invocation. | Fresh-process help/version benchmarks and import probes; ordinary commands still work with Studio stopped. Slice 2. |
| W2 — Provider SDK loading | Thousands of ElevenLabs SDK modules load even for unrelated commands | Load ElevenLabs, Fal, and Replicate SDKs only when their operation needs them. Avoid provider startup costs during project reads, context, and preview. | No vendor SDK modules during non-provider commands; selected-provider execution and errors still work. Slice 2. |
| W3 — Core initialization | The broad Core entrypoint initializes unrelated domain code and validators | Delay validator setup until use; give current-project reads a lightweight Core entrypoint. Improve real project reads as well as help. | First-use and repeat-use validation tests, import probes, and at least 40% improvement in the representative substantive-read benchmark set. Slice 3. |
| W4 — Skill command round trips | Open/show/validate/write/show sequences repeatedly pay startup and agent/tool overhead | Remove redundant preflight, validation, and read-back where the existing write already validates and returns enough confirmation; use existing operation batches and multi-file previews. | Task-level evals, including reducing known-folder inspiration authoring from five CLI calls to two while retaining necessary context and review. Slice 5. |
| W5 — Project targeting and permission retries | Repeated project-open calls write global selection; a blocked write caused an avoidable retry | Prefer supported explicit project targeting. Establish authoring selection only when needed. Teach the actual cache/output/network access requirements without changing permission policy. | Explicit-target workflows leave global selection untouched; current-project-only workflows still work; a known permission denial does not trigger repeated identical attempts. Slices 3 and 5. |
| W6 — Provider metadata retrieval | Disk-cached metadata is generally immediately stale; Fal reads a schema twice during one execution | Reuse the schema within one Fal execution for both validation stages. Keep freshness checks between separate operations. Remove one avoidable retrieval per normal execution. | Fake-transport request counts prove one retrieval and both validations; expired/no-store responses, cancellation, and invalid input retain correct behavior. Slice 4. |
| W7 — Agent command discovery | Unsupported commands and mistaken arguments cause extra attempts and reasoning/tool exchanges | Correct operational examples and document actual command targeting. Teach agents to reuse verified syntax and consult the reference when needed, instead of discovering syntax by attempting mutations. | Skill evals exercise valid command sequences and recovery; command examples agree with actual handlers. Slice 5. |
| W8 — Remaining latency and regressions | Startup, Core work, uploads/provider wait/downloads, notification waits, and agent time are easy to conflate | Add repeatable before/after benchmarks and package-owned phase measurements. Test notification failure/timeout behavior without changing its policy. Report provider and agent time separately. | Local and assembled-product reports, isolated provider/notification tests, and end-to-end task call-count comparisons. Slices 1 and 6. |

W1–W7 contain the concrete optimizations. W8 makes their benefit measurable and
prevents an unproven explanation from becoming another architectural change.
For example, the two-second notification timeout is a possible source of pauses,
but it was not established as a recurring bottleneck. Measure and verify it;
do not silently change delivery guarantees. Likewise, 107- and 227-second
generation calls are not expected to become instantaneous after startup work.

Implementation starts by capturing the baseline, then addresses loading, Core
initialization, provider metadata, and skill workflows, and finishes with the
complete comparison. The detailed sections below name the files, contracts,
preserved behavior, and tests for these same workstreams.

## Review Attention

- **Behavior changes:** Skills will prefer explicit project targeting where the
  command supports it, stop reopening an already resolved project unnecessarily,
  and use sufficient mutation results instead of mandatory duplicate validation
  and read-back calls. Actual write validation, meaningful dry runs, current
  context requirements, creative review, and generation approval remain intact.
- **Public code contract:** Introduce one bounded Core package entrypoint,
  `@gorenku/studio-core/server/project-selection`, for the existing current-project
  read/open/close operations. Remove those methods from `ProjectDataService` and
  update callers directly. This is needed to make project preflight independent
  of the broad domain-service import graph; it is not a second implementation.
  Other domain operations retain their existing Core services. This is the
  lightweight-read portion of W3; it does not replace W1, W2, or W4–W8.
- **Developer observability:** Add a repository-only benchmark/profiling harness
  and a subscriber-only Node diagnostic channel. No new `renku` command, CLI flag,
  environment variable, Settings field, HTTP route, persistent log, or response
  property is planned. Normal stdout, stderr, and exit behavior stay unchanged.
- **Diagnostic change:** Deferred command imports get the structured
  `CLI_COMMAND_LOAD_FAILED` error. Existing handler/provider errors retain their
  own codes; this does not introduce new validation or warning policies.
- **Provider behavior:** Fal execution will obtain one schema for that execution
  and reuse it before and after upload. Separate operations still follow existing
  freshness rules. No longer-lived cache, ignored cache directive, stale-schema
  fallback, skipped validation, or provider policy change is authorized.
- **Data and deletion effects:** No database migration, project cleanup, asset
  rewrite, configuration-path change, dependency installation, or release is part
  of this plan. Source extraction and removal of replaced exports/service members
  are required; no old API aliases or compatibility files remain. Preserve
  unrelated working-tree changes and existing development projects.
- **Existing behavior:** Keep Studio's foreground lifecycle, project schema
  checks, current migration behavior, notification timeout and warning policy,
  provider timeouts/retries, Preview, provenance, and attachment ownership.
- **Assumptions and limits:** Baseline numbers describe the linked development
  checkout on this Mac, not all installed products or platforms. Re-baseline the
  actual implementation revision and verify an assembled product separately.
  Network and notification costs need instrumentation; historical generation
  durations are not isolated measurements of provider inference time.
- **Review boundary:** This is a proposed implementation plan. The package API
  cutover and skill call-sequence changes are explicit review points. A persistent
  service, global cache policy, permission-model change, or new aggregate command
  would require separate scope approval and is excluded here.

## Requirement Ledger And Product Behavior

| ID | Accepted requirement or hard boundary | Implementation owner | Acceptance evidence |
| --- | --- | --- | --- |
| R1 | Remove substantial repeated startup work found in the accepted investigation | CLI dispatch, Engines SDK loading, Core validation modules | Fresh-process timings and runtime import-boundary probes |
| R2 | Reduce redundant skill calls and command-discovery retries | Sister `studio-skills` operational guidance and evals; current CLI reference | Representative task transcripts with required outcomes and fewer calls |
| R3 | Avoid unnecessary global project-selection writes and permission retries | Skills use supported explicit targeting; Core retains selection semantics | Explicit-project workflow succeeds without changing the global selection |
| R4 | Avoid repeated metadata retrieval within Fal execution | Engines Fal adapter | One metadata retrieval with both validation stages retained |
| R5 | Distinguish startup, Core work, provider preparation/wait, and notification delays | Repository performance harness and package-owned measurement points | Phase report with no request contents or secrets and no normal-output changes |
| R6 | Preserve correctness, structured errors, domain ownership, approval and creative review | Existing owning packages and Skills | Owning-layer behavior tests and representative integration journeys |
| R7 | Remain a one-shot installed CLI, with no persistent service | CLI and distribution | Commands work with Studio stopped; no extra listener/process lifecycle |

An ordinary known-project read should load the command it needs and return its
existing report. An authoring skill should resolve its target once for the
current task, obtain the context necessary for the decision, perform the accepted
mutation, and use that mutation's report when it contains the requested result.
Refresh context when the user changes project/selection, another mutation changes
the relevant resource, a revision check fails, or execution resumes after an
intervening user review. Do not treat a prior turn's context as indefinitely fresh.

Generation remains a sequence of meaningful boundaries: current purpose/target
context, provider/model configuration, native validation, Preview and applicable
confirmation, execution, media inspection, and focused attachment. Reducing
command count must not collapse these boundaries or authorize parallel paid runs.

### Non-goals

- No persistent Node process, CLI-to-Studio execution proxy, alternate agent API,
  generic batch executor, new whole-project context DTO, or cross-turn state cache.
- No provider/model selection, credential precedence, permission policy, image
  quality, FDX import, screenplay enrichment, or creative-content rule changes.
- No bundler/toolchain replacement, dependency upgrade, Node compile-cache
  deployment, package installation, or speculative full Core package split.
- No fire-and-forget notifications, shorter notification timeout, or retry of a
  successful mutation solely to refresh Studio.
- No claim that tool polling starts a new CLI process: polling an existing tool
  session continues that process. Conversely, several `renku` invocations in one
  shell command still start several processes.

## Context And Evidence

### Baseline investigation

The September 27 measurements used the `renku` launcher at
`/Users/keremk/Library/pnpm/renku`, which executes this checkout's compiled
`packages/cli/dist/cli.js`. It does not run a build on each invocation.
Planning inspection on September 28 used checkout HEAD `1a44a164`; the earlier
measurements are evidence, not a benchmark result for every subsequent revision.

| Measurement | Observed result | Interpretation |
| --- | --- | --- |
| Empty Node process, four runs | 31 ms median | Process creation alone is small |
| Empty login shell, four runs | 29 ms median | Shell startup is not the main cause here |
| CLI help, direct Node invocation | 1,212 ms median | Work unrelated to command execution dominates |
| `project current --json` | 1,199 ms median | Small preflight pays the same cost |
| `inspiration show --project test ... --json` | 1,193 ms median | Representative persisted read pays the same cost |
| Already-imported Core current-project read | 5.7 ms first, under 0.2 ms later | Not an end-to-end CLI measurement |
| Already-imported Core inspiration read | 18.5 ms first, about 1 ms later | Not an end-to-end CLI measurement |
| Instrumented CLI import | 4,726 modules, including 3,719 ElevenLabs SDK modules | Module counts, not a timing allocation |
| ElevenLabs SDK import in isolation | About 400–445 ms | An unrelated dependency is expensive |
| Core server import in isolation | About 590–710 ms | Top-level Core initialization also matters |

Import timings overlap and must not be summed. Instrumented runs add overhead.
Fresh processes here normally benefit from the operating system's warm file
cache; these are not reboot or cold-disk benchmarks.

Inspected Codex chats in `renku-movies`:

- **Add script to Renku project** (`01a0dccb-c5ca-7370-981b-c45c3b551a02`):
  five CLI calls consumed 7.26 seconds of a 147-second analysis turn. A redundant
  `project open test` failed writing the global descriptor; explicit
  `--project test` then worked. Another turn tried unsupported `project list`.
- **Create harbor walk previs** (`01a07aed-c926-7b43-ad17-d655af06a54b`):
  small commands commonly took 1–2 seconds; metadata cache write permissions
  caused a failed validation and retry; one generation execution took 107 seconds.
- **Create Scene 2 previs shot plan** (`01a08b3d-4052-7771-9ff5-6df43264faf7`):
  command/argument discovery caused additional calls; one generation execution
  took 227 seconds. Neither generation duration isolates queueing from upload,
  inference, polling, or download.

Nineteen of twenty inspected local provider metadata entries had
`max-age=0, must-revalidate`; the other had no expiry. None had ETag or
Last-Modified validators. Disk persistence therefore did not imply an avoided
network request. Fal currently reads the schema during `validate`, then again
after upload in `execute`; sequential retrievals are not coalesced by the
in-flight map. Mutation notifications are awaited with a two-second timeout,
but the investigation did not establish recurring notification stalls.

### Current owners and reusable contracts

- `packages/cli/src/cli.ts`: eager family imports, argument parsing, help,
  dispatch, error serialization, and the existing exported `runRenkuCli` API.
- `packages/cli/src/commands/studio/index.ts` and `start-command.ts`: eager
  server import; actual server startup occurs only for the start operation.
- `packages/core/src/server/index.ts` and `project-data-service.ts`: broad public
  entrypoint and service composition. Do not replace them with an async proxy or
  generate a lazy wrapper for every service method.
- `packages/core/src/server/database/lifecycle/current-project.ts`: existing
  selection persistence, validation, and session handling. `openCurrentProject`
  writes the descriptor even for an unchanged project; this plan removes needless
  calls rather than changing that command's persistence behavior.
- Core validator modules listed in the Architecture Shape Gate create Ajv
  instances and register/compile schemas on import. Preserve their actual rules.
- `packages/engines/src/providers/elevenlabs/index.ts`: eager SDK import; provider
  validation and voice-sample retrieval do not themselves require that SDK.
- `packages/engines/src/providers/fal-ai/index.ts`, `metadata.ts`, and shared
  metadata retrieval/cache modules: existing schema, upload, freshness, retries,
  and cancellation owners. Preserve their division of responsibility.
- `packages/cli/src/commands/studio-notification-client.ts`: notification owner;
  `studio-resource-event-command.ts` preserves mutation-success warning behavior.
- `../studio-skills/skills`: source of agent guidance. Installed plugin cache
  files are investigation evidence, not source files to patch.

### Accepted constraints and overlapping work

Read `docs/architecture/layers-of-responsibility.md`, `coding-practices.md`,
`naming-guidelines.md`, `media-generation.md`,
`reference/structured-diagnostics.md`, `reference/studio-skills.md`, and
`docs/cli/commands.md`. Decisions 0022 and 0026 constrain CLI-backed Skills and
thin command handlers; 0086 and 0088 define current standalone provider ownership
and schema access; 0041 preserves opaque creative content.

Plans 0044, 0137, 0156, and 0165 are implemented/completed baselines for command
structure, Skills alignment, shot authoring, and preview batching. Plans 0208
(implemented, acceptance pending), 0209, 0210, and 0211 constrain current model
discovery, credentials, screenplay enrichment, and Codex/provider behavior.
Plan 0212's implemented update handoff must still stop/update/restart Studio
correctly after lazy loading. Do not rewrite those plans.

There are older statements in ADRs 0016 and 0026 about migration and generation
lifecycle ownership that do not fully describe the current code. Current
generation ownership is resolved by ADR 0086. `store.ts` presently permits
automatic migration of older initialized databases, despite ADR 0016's older
no-runtime-migration wording. This plan does not resolve migration policy by
silently changing it. Benchmark only verified current-schema databases; preserve
the existing migration path and report any policy conflict separately.

## Chosen Approach

1. **Reuse unchanged contracts:** retain existing CLI commands, flags, domain
   reports, provider contracts, existing aggregate mutations, preview batching,
   database lifecycle, and notification semantics. Skills can already remove
   some redundant calls using these contracts.
2. **Refactor existing owners:** lazily dispatch CLI families, defer SDK and
   validator initialization to actual use, retain one Fal schema per execution,
   and expose the existing selection operations through one focused Core boundary.
   This is the selected approach to the measured initialization costs.
3. **New bounded mechanism only for verification:** a developer harness plus
   subscriber-only phase measurements makes regressions distinguishable. A new
   persistent service or general execution framework is not required.

The broad Core API remains for substantive authoring workflows. This plan does
not promise to make a large domain command as cheap as `--help`, or split every
domain into a new public package path. If the specified changes miss the targets,
report the remaining profile and revise the plan before widening that boundary.

## Architecture Shape Gate

### CLI

- Keep `src/cli.ts` as the executable and public `runRenkuCli` entrypoint. It
  performs the supported-runtime check, parses arguments, handles help/version,
  invokes the selected family, serializes errors, and sets exit behavior.
- Extract declarative help/flags and their parser into `src/arguments.ts`.
  Move existing argument semantics, including repeated `--file` behavior,
  without introducing a second parser or changing meow's package-version lookup.
- Put the bounded top-level family registry in `src/commands/registry.ts`.
  Entries use literal dynamic imports of existing command-family modules and
  focused CLI option mapping. No user-derived module paths, provider/purpose
  business rules, nested dispatch tree, or plugin discovery belongs here.
- Within `commands/studio/index.ts`, dispatch lazily to the existing focused
  handlers. Load `@gorenku/studio/server` inside the start path after checking
  whether Studio is already running. Status/current/stop must not load it.
- Keep SDK registration in `commands/generation/provider-registry.ts` and protocol
  execution in Engines. Ordinary generation context, preview, or model discovery
  must not initialize provider SDKs merely through imports.
- `cli.ts` shrinks substantially. The registry must not become the old large
  switch pasted into one exported function. Existing family handlers retain
  parsing/delegation/formatting ownership; no facade per command is introduced.

### Core

- Add `src/server/project-selection/index.ts` as an intentional public entrypoint
  exporting only `readCurrentProject`, `openCurrentProject`, `closeCurrentProject`,
  `CurrentProject`, and `CurrentProjectReport` from their existing owner.
  It must not expose a database session, raw store, or general state patcher.
- Keep implementation in `database/lifecycle/current-project.ts`. Defer its
  database/session-only imports to operations that actually open a database.
  Reading the selection descriptor must not load the whole domain service,
  SQLite/Drizzle, provider SDKs, or Studio server.
- Remove current-project read/open/close members from service contracts and
  `project-data-service-wiring/project-administration.ts`; remove the broad
  entrypoint's `CurrentProjectReport` export and the now-unused service-only
  `OpenCurrentProjectInput` declaration/export. The focused operations retain
  their existing parameter fields. Update direct consumers in CLI,
  Core tests, integration fixtures, and Studio E2E fixtures to the focused owner.
  Internal Core session callers continue using their internal lifecycle module.
  Do not duplicate operations or retain forwarding service methods.
- Keep `project select` and `project migrate` on their existing Core owners.
  The CLI project-family module loads those heavier dependencies only for those
  actions. Current/open/close do not import them eagerly.
- Make initialization lazy within these existing validator owners:
  `project-settings/document.ts`, `shot-plans/validation.ts`,
  `screenplay/validation/blocks.ts`, `screenplay/fdx/validation.ts`,
  `screenplay-analysis/validation.ts`, `scene-beats/validator.ts`,
  `department-design-json/validator.ts`, and `visual-language-json/validator.ts`.
  Construct each owner's Ajv state on first validation, compile the requested
  validator once, and retain it for that process. Keep synchronous validation
  contracts synchronous. Do not introduce a universal validator registry or
  change schema contents, diagnostics, or creative interpretation.

### Engines

- Defer SDK imports in existing provider modules to actual SDK-dependent work.
  Prioritize ElevenLabs; apply the same boundary to the existing Fal/Replicate
  SDK imports so importing the package alone performs no provider SDK loading.
  Keep standard module caching; do not create an additional SDK instance cache.
- Move the existing provider implementations from
  `providers/elevenlabs/index.ts`, `providers/fal-ai/index.ts`, and
  `providers/replicate/index.ts` into `provider.ts` within each same folder.
  Keep those indices as thin intentional public entrypoints, including the
  existing ElevenLabs voice-sample exports. Provider modules own deferred SDK
  construction and retain their focused existing protocol helpers. Move code
  without format-only rewrites; do not duplicate protocol/client implementations.
- Keep Fal schema loading in `providers/fal-ai/metadata.ts`. The Fal provider
  reuses that result during one execution; a small private validation function
  may accept the schema. No schema token, execution receipt field, global map,
  new provider API, or CLI-owned provider validation is added.
- `shared/metadata-retrieval.ts`, `retry.ts`, `polling.ts`, and `downloads.ts`
  remain focused protocol mechanisms. Engines retains zero workspace dependency.

### Performance tooling and Skills

- `scripts/performance/cli.mjs`: benchmark orchestrator over compiled artifacts,
  runtime identity, repeated child processes, percentiles, and report output.
- `scripts/performance/observe.mjs`: opt-in child-process subscriber/import probe;
  never part of the installed CLI's default bootstrap.
- Package-owned boundaries may publish scalar timings to the native Node channel
  `renku.performance` only when it has a subscriber. Use existing boundaries,
  not a new shared workspace timing service or generic tracing framework.
  Place CLI measurements in `cli.ts`, the command-load registry, and
  `studio-notification-client.ts`; Core measurements in `database/lifecycle/store.ts`,
  `project-operation.ts`, and current-session callbacks used by measured paths;
  Engines measurements in the affected provider modules and existing shared
  metadata/polling/download mechanisms. Avoid double-instrumenting the same
  operation at several wrappers. Use isolated probes for paths without a shared
  operation boundary rather than reorganizing the domain to collect timings.
- Skill changes live in the sister repository's existing `SKILL.md`, reference,
  and eval files. Do not add executable skill wrappers, alternate clients, or
  runtime dependencies to the plugin.

Stop and revise before implementation continues if a registry accumulates domain
rules; laziness requires a service-wide proxy; measurements require request-body
logging; database checks are bypassed for speed; providers move into Core; or
meeting the target would require a daemon, public batch API, broad package split,
cache policy change, or new dependency. Do not satisfy a checklist by accepting
an unreviewable owning-layer implementation.

## Contracts

### Runtime and package surfaces

- Existing `renku` commands, flags, JSON reports, and success/error exit codes
  remain. Help and version are answered before loading a command family.
- Add Core package export `./server/project-selection` with `types` pointing to
  `./dist/server/project-selection/index.d.ts` and `import` to the matching `.js`.
  The API cutover above is direct, with no compatibility service members.
- `project open` retains its existing write and schema-check behavior. This plan
  does not reinterpret `status: unchanged` as a new no-write guarantee.
- Deferred command-module load failure uses new structured code
  `CLI_COMMAND_LOAD_FAILED`, with command-family location and an installation
  repair suggestion. It must not swallow a handler's existing domain error or
  raw exception behind a misleading load error. Catch only the import stage.
  Deferred SDK failures stay inside existing provider error translation; they
  must fail before submission and never select a different provider.
- No changes to provider request/result shapes, provenance, cache-file format,
  database schemas, current-project descriptor schema, or Studio routes.

### Developer measurements

The native channel payload is `{ package, phase, durationMs, outcome }`, where
`package` is `cli`, `core`, or `engines`; `durationMs` uses a monotonic clock;
and `outcome` is `success` or `failure`. Phase names are deliberately bounded:

- CLI: `command-load`, `command`, `studio-notification`.
- Core: `database-open`, `project-operation` at the existing session/operation
  boundaries used by the benchmarked paths.
- Engines: `metadata`, `validation`, `upload`, `provider-wait`, `download` at
  existing adapter/shared protocol boundaries. `provider-wait` includes polling
  and retries, not an invented inference-time measurement.

Emit no prompts, arguments, paths, target IDs, credentials, headers, local media
names, upload URLs, or response bodies. Do not replace structured diagnostics
with timing records. No subscriber means no records, persistent state, timers,
or background work. The developer observer writes its own separate report;
command stdout/stderr must remain available verbatim for correctness checks.
Nested or concurrent timings are labeled as overlapping, not summed into a
fictional total. Unsupported/uninstrumented phases are absent, never zero.

The benchmark command is:

```bash
node scripts/performance/cli.mjs --project urban-basilica --iterations 10 --output /tmp/renku-cli-performance.json
```

It uses the current Node executable and compiled workspace CLI. Optional
`--product-root <absolute-directory>` selects an already assembled Renku product
and its bundled Node/CLI layout instead. Do not build, download, install, start
Studio, call paid providers, or update a project automatically. Missing compiled
files or a non-current project schema stop the benchmark with a clear prerequisite
failure before running project commands. Developer harness errors use ordinary
script failures; they do not add product diagnostic codes.

Record revision/version, Node/platform/architecture, executable/entrypoint,
iteration count, first-run timing, median, p95, output byte counts, exit status,
and instrumented module counts separately. The default scenarios are empty Node,
help, version, project current, `info show --project`, and
`inspiration list --project`, using the supplied project. Supplement with the
known-folder inspiration read only when a folder is explicitly resolved from
that project's list. Uninstrumented runs establish timings; instrumented runs
explain them. Never modify the global authoring selection just for measurement.

### Fal execution

One execution loads the live/fresh schema once, validates the provider-native
input with validation URL placeholders, uploads references, then validates the
substituted native input against that same schema before submission. Reuse is
local to that operation, not a claim that the response is fresh for another call.
Standalone schema and validate commands keep their existing semantics. Preserve
cache directives, retries, cancellation, timeout, upload failure behavior, and
structured errors. Invalid pre-upload input must not upload or submit; invalid
post-upload input must not submit.

### Skill call sequences

| Skill/source family | Planned operational change | Boundary retained |
| --- | --- | --- |
| `movie-director/SKILL.md`, `references/workflow-playbooks.md` | Resolve task project/selection once; do not run a full discovery sequence again merely because a specialist is invoked | Read current Studio selection when the user refers to it; do not confuse it with authoring selection |
| `inspiration-analyzer/SKILL.md`, `references/inspiration-analysis-cli-workflow.md` | Explicit `--project`; list only without a known folder; show context once; write directly when authorized; consume returned persisted analysis | Separate validate remains available for validation-only requests or a real review pause; inspect the actual images |
| `lookbook-designer` and `screenplay-analyst`, main skills and existing CLI-workflow references | Remove unconditional validate/write/show chains where the write validates and returns the needed result | Preserve required screenplay/inspiration context and active-revision selection as separate intent |
| `casting-director`, `production-designer`, main skills and their existing authoring references | Reuse context and existing operation documents; remove duplicate validation/read-back only for commands whose write enforces the same checks and returns sufficient confirmation | Preserve meaningful dry-run/change review and focused voice/asset attachment rules |
| `scene-beat-designer`, `shot-planner`, their CLI-workflow references and routing/iteration evals | Use returned exact identities/revisions; request only missing context; use supported operation batches rather than one mutation per field | Re-read after relevant edits; distinguish plan, shot, beat, clip, and take identities |
| `screenplay-drafter` and `screenplay-supporting-material-importer` | Avoid reopening after create or verified selection; use existing apply documents and import reports; document which commands require authoring selection | Preserve supporting-material reads, FDX source ownership, and plan 0210's immediate pre-enrichment read and result verification |
| `media-producer`, `references/workflow.md`, provider skills | Reuse discovery for an unchanged selected route within the current preparation; use existing repeated-`--file` preview batching; avoid guessed commands and automatic execution retries | Fresh generation context for each request, current schema semantics, credentials, Preview/configuration, approval, concurrency policy, inspection and attachment |
| `blender-shot-planner`, `location-world-producer` | Apply the same project-resolution convention in existing workflow references; avoid repeating setup during a simple directed iteration | Keep revision registration, render/QA, world-generation inputs and approval boundaries |

Make the command capability table in `docs/cli/commands.md` authoritative for
explicit `--project` versus current-authoring-project commands. Build that table
from actual handlers and Core inputs, not from the existence of the global parser
flag. A command must not be documented as targeted if its handler ignores the
flag. This plan adds no new targeting support to unsupported commands.

For a known inspiration folder with authorized authoring and adequate context,
the expected CLI sequence becomes `inspiration show --project ...` followed by
`inspiration analysis write --project ...`: two commands rather than five.
Use the write report's returned analysis to confirm the result. Read back if the
result is incomplete, a mutation outcome is uncertain, or intervening changes
make fresh state necessary. A request to validate only never writes.

Skills must not silently bypass a denied permission, read credential secrets,
disable metadata-cache persistence, or change host permissions to save time.
Use supported explicit targeting to avoid unnecessary global writes; actual
provider execution still requires the existing config/cache/output/local-network
access. If blocked, explain the specific requirement and use the host's authorized
permission flow. Do not repeatedly probe a known denial or replay an already
successful mutation after `CLI026`.

## Implementation Slices

### 1. Establish repeatable measurement (R1, R5, R7)

Add the two performance scripts and focused script tests. Capture a before report
against current compiled artifacts and a verified current-schema Urban Basilica.
Separate process time, output volume, import graph, Core work, and agent call
count. Add subscriber-only timing points at the existing owning boundaries;
use fake providers/local notification fixtures for repeatable phase tests.
Never obtain a before result by running a paid generation or modifying the real
project. Keep instrumented and uninstrumented samples separate.

### 2. Make CLI and provider loading demand-driven (R1, R6, R7)

Extract arguments, replace eager family dispatch with the bounded lazy registry,
and lazily dispatch Studio subcommands. Defer SDK imports inside Engines,
including ElevenLabs's SDK-independent voice-sample path. Preserve family flags,
version lookup, structured handler errors, update handoff, and release layouts.
Move the three affected provider implementations behind their thin indices as
specified in the Shape Gate, preserving existing provider-level decomposition.
Remove replaced eager imports directly. Test representative commands in fresh
child processes, not only a test runner whose module cache is already populated.

### 3. Bound Core initialization (R1, R3, R6)

Perform the project-selection API cutover and update every current caller in the
same slice. Keep selection persistence and database validation in their current
Core implementation. Defer validator construction/compilation in each listed
owner. Do not remove validation or fix unrelated schema/creative rules. Verify
that deferred initialization does not leak mutable Ajv errors between calls and
that invalid state still fails before a write. Re-measure substantive reads as
well as help to avoid improving only the trivial benchmark.

### 4. Reuse Fal metadata within execution (R4, R6)

Refactor the two validation stages to consume one schema obtained by the
execution. Keep standalone validation and schema commands independent. Add
request-count tests using immediately expired and no-store metadata responses,
as well as invalid input, upload failure, post-upload failure, and cancellation.
Measure request preparation using the fake provider transport; do not change
cache persistence failure policy or add stale data fallback.

### 5. Update agent workflows and discovery guidance (R2, R3, R6)

Update the named sister-repository skill/reference families, the CLI project
targeting table, and relevant examples/evals. Inspect each mutation result before
removing its read-back instruction: command count is not proof of sufficiency.
Use existing screenplay/department operation documents and preview batching;
keep each actual approval boundary explicit. Retain source-reading and enrichment
steps whose purpose is to prevent stale or incomplete authoring. No bulk edit
that removes every occurrence of `validate` or `show` is acceptable.

Add task-level eval cases for a known-folder inspiration update, repeated shot
iteration, current-selection ambiguity, current-authoring-only commands,
validation-only requests, intervening edits, generation review, and permission
or notification failures. Expected behavior includes both avoided loops and
retained safety/creative steps. Update any validator that enforces an obsolete
mandatory call sequence; do not freeze internal helper names or exact prose.

Address command-discovery retries explicitly, not only redundant successful
calls. Check the operational examples against actual handlers, including required
positional arguments and which commands honor `--project`. Remove guessed
discovery instructions such as `project list`; use the current documented command
or the already available task context. When syntax is unknown, read the relevant
reference/help once and retain that knowledge for the current task. Do not send
speculative mutations to find out how their arguments work. Keep new task-level
eval cases in the affected skill's existing eval directory; no new runtime
discovery API or separate documentation execution framework is needed.

### 6. Verify notification attribution and complete comparison (R5, R6, R7)

Use the existing notification client tests to cover healthy, not-running,
non-configured, refused, and timed-out delivery without live project writes.
Confirm the mutation remains successful with its existing warning when delivery
fails, and Preview retains its existing required-delivery error. Keep the
two-second timeout. Publish the final local and assembled-product benchmark
report, representative skill call-count comparison, and remaining bottlenecks.
Do not disguise provider wait time or agent thinking time as a CLI regression.

## Tests And Guardrails

### Owning-layer coverage

- Core selection: direct public consumer can read the descriptor without loading
  database or other domain capabilities; open/close still enforce their existing
  rules; explicit-target commands do not overwrite global selection. API callers
  compile after removed service methods. No schema/migration behavior changes.
- Core validators: existing valid/invalid/diagnostic tests pass on first use and
  repeat use; correct schema and collected issues are preserved; compilation is
  deferred until validation. Retain invalid-before-write coverage at Core.
- Engines: importing the public package and validating SDK-independent requests
  does not load vendor SDKs; the selected SDK loads when execution needs it;
  provider errors/cancellation survive deferred import. One Fal schema retrieval
  serves both validation stages. Separate operations still honor cache headers.
- Measurements: monotonic nonnegative durations, failure records, absent phases
  distinguished from zero, no sensitive payload fields, and no lasting resources
  or output changes without a subscriber. Reuse existing fake transports.

### Adapter and integration coverage

- CLI: help, no-argument help, version, unknown command/flag, unsupported Node,
  repeated file flags, representative read/mutation/provider commands, structured
  load error versus handler error, and existing JSON/human serialization.
- Runtime import probes: help/version load no Core domain/Studio/Engines modules;
  current-project read loads no SQLite/Drizzle or provider/server capability;
  non-generation reads load no provider SDK; Studio status/current/stop load no
  Studio server implementation. Assert package/import capabilities, not a list of
  helper names, all command names, or exact module-count totals.
- CLI architecture checks retain the ban on database internals and validate
  literal dynamic imports as well as static imports. Keep scoped complexity and
  nesting checks on the new dispatcher rather than source-text name inventories.
- Notification tests preserve `CLI026` and Preview delivery behavior. Timing
  instrumentation does not convert failure into success or add retries.
- Representative integration journeys: read/write an Inspiration Analysis in an
  isolated fixture, author through a current-project-only command, validate and
  execute through an injected provider, and show a batched preview against a
  local test server. Do not repeat every Core invalid matrix in CLI/E2E tests.
- Skills evals verify two-call known-folder authoring, conditional validation and
  read-back, targeting accuracy, refresh after intervening edits, no guessed
  `project list`, no bypass of review/approval, no duplicate paid execution, and
  no mutation replay after notification failure. Manual evals must be labeled
  manual; file validators do not prove an agent executed the intended workflow.

## Performance Acceptance

After one unmeasured warmup, run at least ten fresh processes per local scenario;
report the first observed run separately. Compare before/after on the same Mac,
Node, project, build mode, and output destination without concurrent benchmark
jobs. Record median and p95 rather than choosing the fastest sample.

On the investigation machine, target help/version below 200 ms median,
current-project read below 250 ms, and the representative substantive project
read set at least 40% faster than its new before baseline. These are acceptance
targets, not claimed results or brittle CI wall-clock assertions. Functional and
import-boundary tests are deterministic CI guards. If a target is missed, retain
the evidence and leave the performance acceptance item open; do not silently
weaken correctness or add an unplanned subsystem to reach it.

For Fal, the deterministic target is one schema retrieval per execution with two
validation stages. For the known-folder inspiration workflow, the target is two
CLI calls under the stated preconditions. Report exceptions with their necessary
context or review reason instead of making a global maximum-command-count rule.

An assembled-product run is a separate acceptance item because dependency layout
and bundled Node affect startup. Native Windows timing is valuable but unavailable
on this Mac; report it explicitly as unverified unless a Windows run is actually
performed. Do not extrapolate the Mac numbers to all release targets.

## Documentation And Decision Effects

- Update `docs/cli/commands.md`: project-targeting capability table, selection
  semantics, command discovery, and notification-success distinction.
- Add `docs/architecture/cli-performance.md`: accepted loading boundaries,
  selection entrypoint, measurement instructions, and final results/limitations.
- Update `docs/architecture/reference/studio-skills.md` and the sister skill
  files named above for conditional validation/read-back and retained review.
- Update `docs/architecture/media-generation.md` for execution-local schema reuse
  without changing provider-native ownership or cache freshness policy.
- No new ADR is needed for lazy evaluation within existing ownership. The bounded
  Core entrypoint is documented directly. A proposed change to an accepted
  migration, provider, cache, notification, or approval policy is outside this
  plan and must be surfaced separately, with a new ADR if accepted.
- Studio and Studio Skills release independently through existing tooling. This
  plan does not publish either repository, patch installed plugin caches, or
  assume a source edit has reached the user's installed skill version.

## Final Verification

Implementation verification, not work to run during plan authoring:

```bash
pnpm build
pnpm test:core
pnpm test:engines
pnpm test:cli
pnpm test:integration
pnpm check
node --test scripts/performance/*.test.mjs
node scripts/performance/cli.mjs --project urban-basilica --iterations 10 --output /tmp/renku-cli-performance-after.json
pnpm --dir /Users/keremk/Projects/aitinkerbox/studio-skills test
```

Run `node scripts/release/verify-product.mjs <assembled-product-directory>` and
the performance command with `--product-root <assembled-product-directory>`
against an already assembled local product. Record the actual directory and
results; absence of an artifact leaves this gate open, not implicitly passed.
Do not install dependencies or publish to obtain a verification result.

Confirm real-project schema currency read-only before benchmark commands because
existing database opening can migrate older data. Real Urban Basilica verification
is read-only. All authoring, permission-denial, timeout, and fake-provider tests
use isolated fixtures with their own home/config/project directories. Do not run
project-selection changes, paid generation, or destructive tests against the
user's projects or global configuration.

Desktop smoke verification in an isolated environment: Studio start/status/current
and stop still work, an ordinary successful mutation refreshes the open surface,
and a notification failure does not invite replay. Check preview delivery with
the existing dialog; no UI redesign or mobile testing is included.

Inspect both repositories' diff statistics and complete diffs. Inspect heavily
modified entrypoints, registry, validators, and provider modules. Confirm thin
`index.ts` files, no broad switchboard, no deferred-service proxy, no new raw UI
controls, no arbitrary database API, no compatibility exports, and no unrelated
formatting. Preserve pre-existing release-script/documentation changes.

## Completion Checklist

### Review Area

- [x] Account for every W1–W8 workstream in the final implementation report with
      its change, verification, measured result, and any remaining limitation.
- [x] Confirm project-selection work has not displaced CLI/SDK loading, validator
      initialization, metadata reuse, skill efficiency, or latency attribution.
- [x] Confirm R1–R7 remain covered without a persistent CLI service.
- [x] Review the Core selection API cutover and conditional skill call sequences.
- [x] Confirm no cache, permission, migration, notification, or approval policy
      changed under the label of performance optimization.
- [x] Confirm the module layout matches the Architecture Shape Gate and no
      central owner has become a monolithic implementation.

### Architecture And Contracts

- [x] Keep CLI command/flag/report/exit contracts and `runRenkuCli` intact.
- [x] Add the bounded `server/project-selection` package export and remove the
      replaced service members and broad type export, updating every caller.
- [x] Keep selection persistence and session validation Core-owned; do not expose
      raw database/session capabilities through the new entrypoint.
- [x] Preserve Engines independence and provider-native execution ownership.
- [x] Add `CLI_COMMAND_LOAD_FAILED` only around command import failures; retain
      existing domain/provider diagnostics at their owning boundaries.
- [x] Define subscriber-only scalar measurements without normal-output changes,
      request contents, or persistent runtime state.

### Implementation Slices

- [x] Add the reproducible benchmark/observer and capture a labeled before report.
- [x] Extract argument parsing and implement lazy bounded CLI family dispatch.
- [x] Defer Studio server loading, including the already-running start case.
- [x] Defer vendor SDK loading and keep ElevenLabs voice samples SDK-independent.
- [x] Leave ElevenLabs, Fal, and Replicate indices thin after moving their existing
      implementations without formatting churn or duplicate protocol code.
- [x] Make current-project descriptor reads independent of database/domain loads.
- [x] Defer initialization in each of the eight named Core validator owners.
- [x] Reuse one Fal schema within execution while retaining both validations.
- [x] Instrument package-owned startup/operation/provider/notification boundaries
      without building a general tracing or scheduling service.
- [x] Preserve the two-second notification timeout and existing success/error
      distinctions; do not add mutation replay.

### CLI And Agent Surfaces

- [x] Publish the handler-verified project-targeting capability table.
- [x] Update director and specialist project resolution without confusing Studio
      selection with current authoring project.
- [x] Implement the two-call known-folder inspiration workflow and retain the
      validation-only, incomplete-report, and uncertain-outcome alternatives.
- [x] Update Lookbook, analysis, Cast/Location/Prop, Beats/Shot Plan, screenplay,
      supporting-material, Blender, and Location World guidance as specified.
- [x] Keep plan 0210's fresh enrichment reads and result verification.
- [x] Update Media Producer/provider guidance while retaining configuration,
      Preview, approval, concurrency, artifact review, and attachment boundaries.
- [x] Use existing operation batches and repeated-file previews where appropriate;
      add no new generic batch command or skill executable.
- [x] Add evals for redundant loops, targeting, changed context, permissions,
      notification failure, and skipped review/approval boundaries.
- [x] Correct command-discovery examples and verify required arguments/targeting
      against handlers; evals must not use speculative mutations to discover syntax.

### Tests And Guardrails

- [x] Test Core selection through its new public consumer contract.
- [x] Verify first/repeated validator use and invalid-before-write behavior.
- [x] Verify runtime import boundaries in fresh processes using stable package
      capabilities rather than implementation-name inventories.
- [x] Cover CLI argument and serialization behavior after dispatch extraction.
- [x] Cover deferred provider loading and existing structured failure behavior.
- [x] Prove Fal retrieval count, both validation stages, upload/submission ordering,
      independent-operation freshness, and cancellation.
- [x] Prove timing redaction, failure recording, overlapping-phase labeling, and
      no-subscriber silence without altering product outcomes.
- [x] Run representative isolated authoring/provider/preview integrations and
      notification timeout tests at their appropriate owning layers.
- [ ] Execute and record representative agent evals; distinguish manual checks
      from automated document/fixture validation.

### Documentation And Final Verification

- [x] Update the named current CLI/architecture/Skills documents; leave historical
      plans and ADR reasoning intact.
- [x] Run build, focused tests, integration tests, checks, performance-script tests,
      and the sister repository's checks without installing dependencies.
- [x] Compare matched local before/after median/p95 and report target attainment.
- [ ] Run assembled-product verification and timings; record platform limitations.
- [ ] Verify desktop Studio lifecycle/refresh/preview behavior in an isolated setup.
- [x] Confirm Urban Basilica, other real projects, and global configuration were
      not mutated for measurement.
- [x] Inspect full diffs and all large changed files; confirm thin indices, bounded
      dispatch, preserved formatting, and no compatibility or catch-all modules.
- [x] Record remaining provider/agent latency separately; no checklist item may be
      completed by accepting unreviewable structure or an unmeasured speed claim.
- [ ] Mark the plan complete only after its functional and performance gates pass.
