# CLI Performance

Status: implemented; remaining acceptance gates listed below.
Date: 2026-09-28

## Live character-sheet workflow follow-up (2026-09-29)

An explicitly authorized operator-led Codex run exercised the built CLI and
current source skills against Mara in Urban Basilica. It used one complete
76,560-byte text briefing, read from a first-call capture in five bounded parts;
three informational Previews; three deliberate generation attempts; and one
successful final attachment. No Cast Design/Settings refetch, JSON context
recovery, historical recipe retrieval or Python briefing extraction was needed.
The earlier audited Mara session made five context reads and fourteen Renku
calls; this run made one and five respectively. These are observations from
different sessions, not a controlled latency benchmark.

Image calls took 44.096, 41.004 and 39.568 seconds. Two generated rulers had
unequal numeric spacing; an endpoint-only height bar resolved that defect in
the third candidate. Fine costume geometry remains interpretive. The final
candidate was attached as `asset_6drsbdvw`; no Cast facts or Settings changed.
Full evidence, source hashes, exact files and limitations are in sister
`studio-skills/skills/media-producer/evals/generation-context/runs/2026-09-29-mara.md`.

Shared skill guidance now covers aggregate tool limits, direct text output,
capture recovery and inventory use. Cast department context is conditional on
design authoring. The CLI process boundary reports `CLI_OUTPUT_CLOSED` with
exit 1 when stdout's consumer closes early; other stream errors remain errors.
Unit/integration, type/lint and skill checks passed. Independent blind trials
across the remaining generation types and packaged-plugin verification remain
open. The earlier verification sections below describe their original scopes.

## Consolidated readable briefings (0215)

Implemented in the 2026-09-29 working tree based on Studio
`ef2f31f9bb4b1e64c44cdb152aa3b8ad68712029` and Studio Skills
`bc3ef3ba33e7c458c44634a795c79936c6ffa05c`. Core now emits one complete
Asset inventory; the CLI renders that report as text by default or JSON with
`--json`. Creative context breadth is unchanged.

The following same-state Urban Basilica measurements are UTF-8 bytes, excluding
the final CLI newline. Before/after JSON both use two-space indentation. A
one-off comparison resolved inventory identities back to their source facts
and confirmed equal documents, Asset/File metadata, ordered candidate roles,
selection/ranges, voice identities, policy, warnings and resource keys. Derived
design summaries were checked through retained design identities/documents.

| Purpose | Previous JSON | Consolidated JSON | Readable text | Text reduction from previous JSON |
| --- | ---: | ---: | ---: | ---: |
| Cast character sheet | 92,644 | 78,549 | 64,474 | 30.4% |
| Cast voice sample | 41,263 | 35,385 | 28,652 | 30.6% |
| Location sheet | 61,284 | 52,859 | 43,439 | 29.1% |
| Scene storyboard sheet | 106,936 | 90,435 | 73,378 | 31.4% |
| Shot Plan dialogue audio | 104,470 | 79,343 | 64,564 | 38.2% |
| Shot Plan video generation | 153,421 | 131,447 | 105,950 | 30.9% |

A fresh-process character briefing smoke measurement on Node 24.16.0/macOS
arm64 used one warmup plus five runs per format, with piped stdout and no
concurrent test suite. Text median was 693 ms (range 640–732 ms), JSON median
758 ms (range 722–913 ms). Formats ran in separate batches; this is a small
sanity check, not evidence of a latency advantage. There is no comparable
pre-change timing or tokenizer measurement for this slice. Raw local captures
are under `/tmp/renku-briefing-investigation`; process measurements are in
`/tmp/renku-0215-latency.json`.

Verification: full build and `pnpm check`; 492 Core and 107 CLI unit tests;
36 Core and 33 CLI integration tests, including real text/JSON delegation;
19 focused Core projection/Scene Beat tests after final assertions; sister
`test:media-generation` passes, including 12 new fixture integrity cases.
Fixtures use a synthetic populated Core Project, not private movie contents.
They cover full designs, alternative/default voices, overlapping selected and
unselected dialogue Takes, exact multi-file edits, unavailable references and
changed selection. Current CLI rendering preserves every fixture string.

The shared Scene Beat visual-reference projection now exposes an inventory
alongside its references. Domain resources and generation execution are unchanged.
Normal and captured text were inspected; renderer tests cover opaque identity,
multiline/Unicode, whitespace, empty values, false and zero. Studio/Skills source
changes require coordinated delivery; no release or plugin installation was run.

Independent agent preparation trials remain open. The eleven behavioral cases
and controlled fixtures are checked in under Studio Skills
`skills/media-producer/evals/generation-context/`. Automated fixture validation
does not measure an agent's first format choice, roundtrip count, preparation
time or end-to-end generation speed. Do not infer those gains from byte savings.

## Generation briefing follow-up (0214)

On 2026-09-28, a same-state Urban Basilica Workroom `location.sheet` capture
decreased from 136,343 to 43,506 serialized UTF-8 bytes (68.1%). The baseline
Studio revision was `927466413bc63889714ebdfd666870c6acb8bbad`; the sister Skills
baseline was `2079d6fcf19f6f24784a407ab8147e6ec7295551`. Both working trees were
clean apart from the proposed plan. Comparison of parsed reports confirmed
equality of every retained field. The built CLI output matched Core's report.
The measurement excludes previous Asset recipes throughout generation context;
it does not truncate current creative documents or change stored provenance.

This is payload evidence, not a live agent-latency benchmark. Source Skill
guidance and forward cases were updated; installed plugin caches were not
modified. A new session with verified loaded Skill contents is still required
to measure context-call counts, agent-turn time, and provider intervals. Existing
0213 acceptance gates below remain separate.

## Loading and ownership

The installed CLI remains a one-shot Node process. `cli.ts` owns runtime checks,
error output and execution; `arguments.ts` owns the existing meow parser and
flags. `commands/registry.ts` maps a command family to a literal dynamic import
and its existing options. Imports alone are caught as `CLI_COMMAND_LOAD_FAILED`;
handler failures retain their own diagnostic behavior. The registry contains
no domain or provider-purpose rules. Studio handlers load on demand, and the
server implementation loads only after start has checked for an existing server.

Current authoring selection belongs to the intentional Core entrypoint
`@gorenku/studio-core/server/project-selection`. It exports read/open/close and
the CurrentProject/CurrentProjectReport types. Implementation stays in the
existing lifecycle owner; descriptor reads do not load database capabilities.
The replaced ProjectDataService members and broad report/input exports are gone.
Selection persistence, schema validation and migration behavior are unchanged.

The eight validator owners in plan 0213 initialize Ajv on first use. Ajv retains
compiled validators; Shot Plan validation also reuses schemas registered through
nested documents, so first-use order cannot create duplicate schema ids. No
schema or creative-content rule changed.

ElevenLabs, Fal and Replicate have thin indices and provider implementations in
`provider.ts`. SDK imports occur only when SDK work is needed. Voice sample
retrieval remains independent of ElevenLabs SDK loading. Fal obtains one schema
per execution and uses it for both validation stages, without relaxing freshness
between operations.

## Reproduction and measurements

Build first, then run:

```bash
node --test scripts/performance/*.test.mjs
node scripts/performance/cli.mjs --project urban-basilica --iterations 10 --output /tmp/renku-cli-performance.json
```

An existing assembled product can be selected with `--product-root <directory>`.
The harness uses its bundled Node and CLI layout. It does not assemble, download,
install, start Studio, run paid generation, select a project, or migrate data.
It checks database schema currency read-only before launching project commands.
A missing artifact or non-current schema is a prerequisite failure.

Each scenario has a first observed warmup followed by ten measured fresh
processes. stdout/stderr use the same pipe destination and their byte counts and
exit status are retained. Instrumented children run separately after timings.
`observe.mjs` is a developer-only import probe and diagnostic subscriber, never
part of normal CLI startup. It requires Node's `registerHooks` support (the
verified runtime here is Node 24.16.0).

Package owners publish to `renku.performance` only with a subscriber. Records
contain exactly package, bounded phase, monotonic durationMs, and success/failure.
They contain no request body, prompt, credentials, project identity, or media URL.
CLI records command loading/execution and notification delivery; Core records
store opening and existing operation/current-session boundaries; Engines records
metadata, JSON validation, uploads, polling and downloads. Polling includes its
retries and sleeps; it is not a measurement of provider inference alone.
Nested/concurrent phases overlap and must not be summed. A phase without a
measurement is absent rather than zero. Explicit information and Inspiration
reads currently expose database-open but do not expose a separate total Core
operation duration; no domain reorganization was done just to add that metric.

## Local results

Mac arm64, Node 24.16.0, Renku 0.1.24, base revision
`f2299c58d3cb1a3cf2bf851406d15b9dec133087`. Before used the existing compiled
checkout before implementation; after used the rebuilt working tree. Both used
Urban Basilica after read-only schema verification. No concurrent benchmark job
or test suite ran during the timed comparisons. These are warm-filesystem fresh
processes, not reboot/cold-disk measurements. Values below are milliseconds.

| Scenario | Before first | Before median | Before p95 | After first | After median | After p95 | Median improvement |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty-node | 46.1 | 32.7 | 62.5 | 27.1 | 31.2 | 34.2 | 4.5% |
| help | 2021.6 | 1140.5 | 1250.1 | 74.4 | 66.7 | 75.4 | 94.2% |
| version | 1177.9 | 1122.3 | 1343.2 | 54.1 | 54.5 | 64.0 | 95.1% |
| current | 1064.4 | 1205.3 | 1268.9 | 146.2 | 75.7 | 79.1 | 93.7% |
| information | 1129.0 | 1098.1 | 1278.6 | 606.8 | 594.8 | 674.8 | 45.8% |
| inspiration | 1178.0 | 1191.6 | 1909.7 | 621.4 | 516.6 | 587.9 | 56.6% |

All local targets passed: help/version below 200 ms, current-project below
250 ms, and both substantive reads improved by more than 40%. Every measured
process exited zero. Raw local reports are `/tmp/renku-cli-performance-before.json`
and `/tmp/renku-cli-performance-after.json`; the latter also includes separate
instrumented module/phase reports.

After instrumentation counted 16 modules for help/version, 101 for current,
744 for information, and 746 for Inspiration list. Counts explain this build;
tests enforce capability boundaries, not exact totals. Help/version load no
Core/Studio/Engines domain modules. Descriptor reads load no SQLite/Drizzle.
Engines import, Studio status/current/stop, and already-running start load no
vendor SDK or Studio server implementation as applicable.

An instrumented information read spent about 501 ms loading its command family
and 2.4 ms opening the database; Inspiration list spent about 416 ms loading and
3.2 ms opening. These instrumented observations are not added to the timing
medians. Broad Core import remains the largest observed remaining read cost;
this implementation does not introduce a wider package split to reduce it.

## Workstream evidence

| Workstream | Change and evidence | Limit |
| --- | --- | --- |
| W1 | Lazy CLI/Studio loading; fresh-process import probes; help/version timings above | Full foreground lifecycle/browser smoke gate remains open below |
| W2 | Deferred three vendor SDKs; Engines import probe and provider tests | No live/paid provider run |
| W3 | Focused selection API; eight deferred validator owners; 484 passing Core tests and substantive-read targets | Existing broad Core graph still costs time |
| W4 | Conditional validation/read-back; two-call explicit-target Inspiration authoring and validation-only integration cases | Call reduction assumes adequate context and authorization |
| W5 | Handler-verified targeting table and skill permission guidance; explicit-target fixture leaves selection empty | Does not alter host permission policy |
| W6 | Expired/no-store fake transport tests prove one retrieval during execution and a new retrieval for a separate operation; invalid before/after upload, upload failure and cancellation prevent submission | No global freshness or cache-persistence change |
| W7 | Corrected examples and task-local syntax discovery guidance; manual eval scenarios in existing Shot Planner and Media Producer eval directories | Autonomous end-to-end agent eval runs remain unverified |
| W8 | Benchmark/observer, scalar package timings, existing healthy/missing/unconfigured/refused/timeout notification tests | Assembled product, desktop smoke and broader agent latency evaluation remain open |

## Verification and remaining gates

Passed: full build; `pnpm check` including type checks, lint, architecture and
57 release-tool tests; Core (484), Engines (85), CLI (103) unit tests;
Core (36), CLI (32) and Studio (36) integration tests; 12 performance-script
and fresh-process import tests; sister Studio Skills test command.
The Studio integration suite had a stale literal header assertion; it now
checks the existing accessible home button. No UI behavior was changed.
The removed-command-specific CLI rejection sentinel/test was removed during
dispatch extraction in accordance with the repository's no-compatibility rule;
unknown commands use the ordinary unknown-command response.

Test suites must run sequentially here: the existing shared temporary-directory
cleanup can delete another suite's fixtures at teardown. Early parallel runs
failed for that reason; the final isolated/sequential reruns passed. That cleanup
mechanism was not redesigned in this performance slice.

Open acceptance gates:

- No already assembled product was found in the checkout's artifacts directory
  or the default local installation. Product verification and bundled-runtime
  timings therefore remain unverified. No release or dependency installation was
  performed to manufacture an artifact.
- `pnpm test:e2e:studio:smoke` reached Playwright but could not start its isolated
  server because localhost:5174 was already occupied (Node PID 2261). The
  existing service was not stopped or reused. Desktop live refresh/Preview and
  full foreground start/stop acceptance remain open; protocol/notification and
  already-running/not-running import tests passed.
- Native Windows timing was not performed.
- Added task-level scenarios are manual eval specifications, not claims of
  autonomous agent execution. The two-call authoring and validation-only cases
  were executed as CLI integration fixtures. Other changed-context, permission,
  notification and generation-review scenarios have guidance/manual review and
  owning-layer tests, but still need independent end-to-end agent eval execution.
- No paid generation was run. Provider inference/queue time and agent thinking,
  creative authoring, user review and tool delivery are not measured speedups.
  The historical 107/227-second generations cannot be attributed to CLI startup.

Only read commands were benchmarked against Urban Basilica. All mutations and
notification fixtures used isolated directories. No database migration, Settings,
cache policy, permission model, notification timeout, approval requirement,
installed plugin cache, or release was changed.
