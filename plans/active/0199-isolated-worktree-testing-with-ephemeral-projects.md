# 0199 Isolated Worktree Testing With Ephemeral Projects

Status: proposed
Date: 2026-09-06
Updated: 2026-09-11

## Summary

Keep the maintainer's primary development checkout, normal Studio instance, and
persistent movie projects as the personal manual-testing environment. Make
implementation and verification in every other checkout independent of that
environment. Computer Use, Playwright, CLI integration, and migration tests
must create their own disposable projects from repository-owned inputs.

Reuse the existing Core project commands and Studio browser fixtures. Add one
shared test-run lifecycle for interactive Computer Use and Playwright, make
Renku configuration and runtime discovery process-scoped through an explicit
Renku home override, and correct test cleanup that currently crosses process
boundaries. No copy of Urban Basilica is required.

Preserve the installed product's singleton independently of test isolation.
Ordinary installed and manual-development launches use `localhost:5173` with
strict binding. Only repository test launchers explicitly request an isolated
runtime. Changing the Renku configuration home does not enable multiple app
instances or select another port.

## Review Attention

- **Accepted behavior change:** agents default to ephemeral test projects and
  their own browser instance. They no longer attach to the maintainer's Studio
  instance or inspect the personal sample project unless explicitly requested.
- **Necessary runtime changes:** add `RENKU_HOME_DIR` for configuration paths
  and an explicit programmatic `StudioServerLaunch` contract for singleton or
  isolated startup. Only test launchers request isolated startup; installed
  `renku studio start` always requests singleton startup. No environment-based
  port selector or installed isolation flag is added. CLI status reports the
  discovered URL without changing the ordinary product's fixed-port policy.
- **Runtime ownership correction:** serialize descriptor claim, heartbeat, and
  release through a Core-owned per-home file lock. Automatic ports otherwise
  expose the existing read-then-write race. This adds `studio-runtime.lock`
  operational state and structured launch/ownership failures, not domain state.
- **Installed-product verification:** add explicit fixed-port, repeated-launch,
  cross-installation, occupied-port, and restart checks alongside isolated
  packaged-server verification. Isolated smoke success cannot stand in for
  proof of the installed singleton.
- **New repository commands:** `pnpm studio:test --scenario <name>` starts an
  interactive disposable environment; `pnpm renku:test --run <absolute-path>
  -- <renku-arguments>` executes the checkout's CLI against that environment.
  Neither command is added to the installed `renku` product CLI.
- **Cleanup correction:** remove timestamp-based deletion of machine-wide
  `renku-*` temporary folders. Cleanup may delete only directories owned by its
  test run. Interactive runs retain artifacts after stopping for inspection;
  no automatic stale-run sweeper is introduced.
- **Unchanged:** the installed app and ordinary development server remain
  `localhost:5173` with a strict port; repeated installed launches reuse the
  existing ordinary instance. The normal configured Project Library stays where
  it is. Project-local SQLite, Core domain ownership, runtime tokens, and
  explicit project migrations retain their roles.
- **Data effects:** no application schema migration, sample migration, project
  move, sample backup/copy, or personal-data cleanup. Source fixture modules
  move to shared test support; obsolete test-runtime entrypoints are removed
  and callers updated directly.
- **Migration testing:** retain historical one-way conversion fixtures, even
  when their checked-in records came from earlier development data. Add a
  representative real Drizzle upgrade test; do not redesign accepted historical
  migrations or create a customer-fleet migration system.
- **Assumptions:** each code worktree has its own dependency links and build
  output; dependencies/browser binaries are provisioned separately under the
  existing installation authorization rule. Concurrent Computer Use uses
  independently addressed browser tabs/sessions. A shared foreground desktop
  input device is not made concurrent by this plan.
- **Accepted review adjustments:** preserve the installed singleton, separate
  configuration paths from isolated launch intent, prevent concurrent claims
  within one home, and prove ordinary installed launches independently of test
  startup. These reflect the user's requested review corrections. No additional
  product choice is left unresolved.

## Requirement Ledger

| ID | Authority | Required outcome | Owner and acceptance evidence |
| --- | --- | --- | --- |
| R1 | User: one personal development environment | Preserve normal manual development and persistent movie data | Core default path/port tests; third-environment isolation test |
| R2 | User: work does not require the sample project | Create deterministic disposable projects and assets from repository inputs | Studio shared fixtures; clean-home CLI/browser verification |
| R3 | User: concurrent worktrees and Computer Use | Independent browser targets, CLI code, config, events, server lifecycle, and artifacts | Core runtime/path resolution; Studio test lifecycle; two-instance Computer Use |
| R4 | User: migrations without distributing sample databases | Verify creation and upgrades using ephemeral SQLite fixtures | Core lifecycle and integration tests |
| R5 | Hard operational boundary | A run cannot remove another run's files or silently attach to its server | Owned Vitest cleanup and child-process lifecycle tests |
| R6 | Accepted architecture | Domain writes stay in Core; test scaffolding stays outside product APIs | Import boundaries; fixture setup through Core/CLI |
| R7 | User direction supersedes current agent guidance | Remove the default dependence on personal projects and attach-only testing | AGENTS, development documentation, planning skills, sister-skill guidance |
| R8 | User: retain singleton deployment on end-user machines | Installed launches use 5173, reuse the existing ordinary instance across installation directories, and never search for another port | Core launch policy; CLI and installed-launch acceptance checks |
| R9 | Accepted review: simultaneous launches into one home | Exactly one runtime claims a home; losing startup closes its listener and cannot overwrite or remove the winner | Core exclusive descriptor lifecycle; same-home subprocess race and recovery tests |
| R10 | Accepted review: prove the installed path separately | Isolated packaged smoke and ordinary installed singleton checks produce distinct evidence | Release verifier and installed-launch acceptance group |

## Context And Investigation Evidence

### Current implementation

| Area | Evidence | Consequence for this plan |
| --- | --- | --- |
| Core config | `packages/core/src/server/config/paths.ts` exposes `homeDir` and `storageRoot`. Defaults use native platform paths; macOS does not use `XDG_CONFIG_HOME`. `document.ts` owns config reads and initialization. | Extend the existing home-resolution seam; setting XDG alone is insufficient on this machine. |
| Runtime discovery | `core/src/server/studio-coordination/runtime-descriptor.ts` stores one descriptor under the resolved config directory, uses heartbeat/PID checks, and permits canonical-server replacement of another address. Claim currently reads then writes; atomic rename does not exclude another claimant. | Keep discovery per home, remove address-based replacement, and serialize lifecycle writes. Retain the ordinary fixed-port policy separately. |
| Other global state | `studio-coordination/event-store.ts`, `database/lifecycle/current-project.ts`, and provider credential storage resolve through Core config. Project references include storage root. | Scope all these through the same home resolution; do not add a parallel test registry. |
| Vite | `packages/studio/vite.config.ts` selects fixed dev/E2E addresses, partially passes an E2E home, claims the descriptor after listening, and writes a checkout-wide log. `server/studio-dev-server.ts` enforces 5173 and defines 5174. | Replace E2E mode branches with normal isolated-process configuration and actual-address discovery. |
| Hono composition | `server/app.ts` forwards `homeDir` only to setup and credentials. Project routes construct an unscoped service. Event routes and some Visual Language/FDX paths resolve config implicitly. | A partial `app.homeDir` parameter is not application isolation. Use one home for the entire server process, resolved by Core. |
| Packaged server | `server/runtime.ts` already accepts a port and can bind zero, but app creation and descriptor lifecycle use default config. | Replace raw binding options with the Core launch contract; installed CLI selects singleton, repository release smoke selects isolated. Both use the same server implementation and routes. |
| CLI | `packages/cli/src/cli.ts` accepts an internal `homeDir`; executable entry calls `runRenkuCli()` without it. `studio/start-command.ts` can reuse any fresh descriptor in the selected home. `server-status-command.ts` exposes `canonicalUrl`, `matchesCanonical`, and a fixed `agent.browserUrl`. | Local executable selection and environment targeting are both necessary. Cut status over directly. |
| CLI refresh | `studio-notification-client.ts` already reads the selected home's descriptor and posts to its URL with the notification token. | Preserve delivery/no-op/warning behavior; isolation should follow Core config automatically. |
| Browser state | `src/app/use-studio-coordination.ts` uses a tab session identity; theme and FDX dismissal use browser storage. API origin checks compare the request's actual host, including port. | Independent URLs and tab identities fit current behavior; do not add login or weaken token checks. |
| Browser fixtures | `e2e/fixtures/studio-e2e-project.ts` creates minimal and Scene Beats projects through Core and seeds media. It is already over 700 lines. Preview/FDX fixtures extend these scenarios. | Extract bounded reusable fixture modules, not a second set of Computer Use fixtures. |
| E2E lifecycle | `studio-e2e-runtime.ts` creates a unique run root, isolated home, and project root. Both Playwright configs still use fixed 5174 and change `HOME`. CLI subprocess fixtures also change `HOME`. | Share lifecycle and discover the actual test URL; remove OS-home overrides. |
| Onboarding | `first-run.onboarding.spec.ts` removes the entire config directory between cases, including the live runtime descriptor, and assumes `Movies/Renku`. | Reset only setup-owned files; derive the recommendation through Core for the actual platform. |
| Vitest cleanup | `scripts/vitest-renku-tmpdir-cleanup.mjs` scans `os.tmpdir()`: startup removes old `renku-*`; teardown removes recently modified `renku-*`. Seven fast/integration configs reference it. | Run A can delete Run B's still-active fixtures; age does not prove ownership. Fix this in scope. |
| Core fixtures | `testing/project-data-fixtures.ts` and `movie-project-template-fixtures.ts` build disposable synthetic projects and process-local templates. They do not load Urban Basilica. | Preserve template speedups; place their temporary files within the owning run. |
| Migrations | `database/lifecycle/migrator.ts` resolves Drizzle Kit from its Core package and invokes package-owned migrations. `migration-0082.test.ts` and `migration-0083.test.ts` construct in-memory prior-schema slices. | Existing branch-local migration ownership is suitable. Distinguish SQL transformation coverage from full migrator coverage. |
| Release smoke | `scripts/release/verify-product.mjs` creates a temporary project but launches and probes fixed 5173 and changes OS-home variables. It can probe a different running server. | Apply the same environment override and exact-runtime discovery to runtime verification only. |
| Build isolation | CLI/Core exports resolve to their checkout's `dist`; Studio server exports resolve to `server-dist`. E2E dependency builds already include the CLI dependency graph. | Reuse those builds. Never globally link the CLI or share another checkout's generated output. |

The source scan found no ordinary test that needs to read the personal
Urban Basilica database. A few tests use its name as a literal, and migration
0083 deliberately reproduces exact historical conversion inputs in memory.
Those are different from accessing a developer's filesystem. Do not perform a
cosmetic name purge or rewrite historical migration semantics.

`scripts/maintenance/rebuild-urban-basilica-project.mjs` is an explicit personal
maintenance operation, not a test dependency. Leave it outside default testing.
The website README's historical screenshot provenance is also not a fixture
dependency. Neither warrants unrelated deletion.

No personal config, sample database, media, or running browser was accessed in
this planning investigation. Existing staged implementation changes, including
plan 0198, are outside this plan's edit scope.

### Accepted constraints and overlapping plans

- `AGENTS.md`, `docs/architecture/coding-practices.md`, naming guidelines,
  data-model-and-storage, and layers-of-responsibility remain hard boundaries.
- ADRs 0006 and 0031 retain SQLite/domain versus live coordination ownership.
  `docs/architecture/reference/studio-coordination-events.md` currently says
  one local server; preserve that rule for ordinary product launches and document
  an explicit test-only exception with one server per isolated home.
- ADR 0037 owns deterministic Playwright gates and Core-built fixtures.
  Computer Use remains a supported interactive verification workflow without
  making an LLM the committed CI pass/fail oracle.
- ADR 0085 owns native default config paths and onboarding. Preserve default
  behavior; introduce only an explicit process override for isolated execution.
- ADR 0011, the Drizzle reference, and project-database-distribution retain
  package-owned Drizzle generation/application and explicit upgrade operations.
- Plans 0117 (implemented with historical browser blocker), 0118 (completed),
  and 0119 (verified) establish test partitions and template performance.
  Preserve them rather than merging every test into a browser gate.
- Plans 0186 and 0187 are implemented credential/onboarding foundations;
  0187 still records native installed-runtime verification pending. This plan
  does not claim to finish that separate platform-verification obligation.
- Plans 0189–0194 establish the currently implemented generation, preview,
  provider, and dialogue workflows used by fixtures. Plan 0198 is implemented
  in the current working tree and adds FDX update routes/tests. Adapt their
  environment wiring without changing domain behavior.

### External implementation references

Checked 2026-09-06: [Vite JavaScript server lifecycle](https://vite.dev/guide/api-javascript.html),
[Playwright global setup and teardown](https://playwright.dev/docs/test-global-setup-teardown),
[Vitest global setup](https://vitest.dev/config/globalsetup),
[Vitest test environment variables](https://vitest.dev/config/env), and
[Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate).
Use the repository-installed versions when implementing. In particular, the
installed Vite 7 `startServer` treats a zero configuration port as falsy; do not
assume `vite --port 0` behaves like Node's direct `listen(0)`.

## Options Considered

1. **Reuse unchanged:** existing fixtures solve project creation, but fixed
   ports, shared config defaults, and global temp cleanup prevent concurrency.
2. **Extend existing owners — selected:** Core owns process configuration and
   runtime discovery; Studio test support owns disposable projects and server
   processes; Vitest owns its run directory. Share these between test drivers.
3. **New environment platform:** reject sample cloning, baseline distribution,
   containers, a daemon, machine-wide registry, port reservation service, and
   database promotion. None is needed for independent ephemeral projects.

## Intended Workflow And Files

| Launch purpose | Binding and repeat-launch behavior |
| --- | --- |
| Installed `renku studio start` | Strict `localhost:5173`; reuse the existing ordinary instance without starting another server, including from another installation directory. An unrelated port occupant fails clearly. |
| Manual `pnpm dev:studio` | Strict `localhost:5173`; retain the existing development command's refusal to run a second listener. |
| Repository interactive/Playwright launcher | Explicit isolated launch, disposable home, automatically allocated port, and child-owned shutdown. |
| Repository packaged-server smoke | Explicit isolated launch through a repository-owned entrypoint importing the assembled server; installed CLI behavior is checked separately. |

`RENKU_HOME_DIR` changes configuration paths only. Setting it alone cannot
enable isolated startup. Ordinary launch from a differently configured home
still attempts only 5173 and fails if it cannot safely reuse the selected
home's ordinary runtime. It must not attach to another home's server merely
because that server answers on 5173.

The maintainer continues using `pnpm dev:studio`, ordinary `renku`, and the
existing configured library. No checkout detection or Git metadata changes
those defaults. Repository agents are instructed to use the explicit test
commands, including when working in the primary checkout on implementation.

An agent runs, from its own checkout:

```bash
pnpm studio:test --scenario scene-beats
```

The command builds the existing dependency graph and test tooling, allocates a
new run, creates the scenario through Core, starts Vite in a child process, and
prints readiness only after the matching runtime is healthy. It stays attached
until interrupted. It never opens a system browser automatically.

```text
<worktree>/tmp/studio-tests/<unique-run>/
  home/
    .config/renku/
      config.yaml
      current-project.json       # existing Core-owned name/path
      studio-runtime.json
      studio-runtime.lock         # transient exclusive descriptor-write lock
      studio-events.jsonl
    projects/
      test-movie/
        .renku/project.sqlite
        ...Core-owned project and media files...
  scratch/
  artifacts/
  studio-server.log
```

`current-project.json` is the existing Core-owned filename; no change to its
name or format is authorized here. All listed test-owned paths are normative.
Onboarding uses the platform recommendation under the isolated home instead of
precreating `home/projects` configuration. Both locations remain inside the run.

The agent retains the exact browser tab/session handle associated with the
reported URL. It invokes the task CLI with:

```bash
pnpm renku:test --run /absolute/worktree/tmp/studio-tests/<unique-run> -- studio server status --json
pnpm renku:test --run /absolute/worktree/tmp/studio-tests/<unique-run> -- project current --json
```

The CLI process adapter sets the run's environment, executes
`<worktree>/packages/cli/dist/cli.js` with `process.execPath`, uses that checkout
as `cwd`, forwards arguments without shell interpolation, and propagates the
exit code. It rejects another checkout's run directory. It adds no domain
commands, chooses no project implicitly beyond existing current-project rules,
and does not fall back to an installed executable.

After code changes, rebuild the relevant compiled dependencies using current
root/package commands and restart the interactive run when server/Core code or
schema changes require it. Restart creates a new fixture. Do not automatically
migrate an old retained run or introduce persistent test-project maintenance.
Frontend HMR within a running test remains available.

Interactive shutdown stops its own child and releases its descriptor, retaining
the disposable run for screenshots/debugging. Playwright retains current
failure/keep-artifact behavior and deletes only successful test-owned projects.
No task scans or cleans other runs. Deleting retained runs is an explicit,
path-scoped housekeeping action under the existing authorization rule.

## Architecture Shape Gate

### Core: extend process resolution, retain domain ownership

```text
packages/core/src/server/
  config/
    paths.ts                     # home resolution and native default paths
    paths.test.ts                # override and platform behavior
  studio-coordination/
    server-binding.ts            # explicit launch policy and loopback binding
    runtime-ownership.ts         # internal per-home critical section and recovery
    runtime-descriptor.ts        # existing scoped descriptor lifecycle
    server-status.ts             # scoped status projection, no CLI formatting
    index.ts                     # thin public exports
  testing/
    movie-project-template-fixtures.ts  # retained process-local templates
  database/lifecycle/             # retained migration and backup owners
```

Core public additions are `StudioServerLaunch`, `resolveRenkuHomeDirectory`,
`resolveStudioServerBinding`, and `readStudioServerStatus`. Existing config,
event, credential, current-project, and storage resolvers consume the same home
choice. No generic service proxy, command inventory, new Project field, or
adapter-side domain validation is introduced.

`server-status-command.ts` shrinks to argument validation, the Core status call,
and formatting. Core `index.ts` and coordination `index.ts` remain exports.
`runtime-ownership.ts` stays private to coordination; retain the existing
claim/heartbeat/release entrypoints and make each use the same critical section.
Do not export a generic lock service or introduce a runtime database.

### Studio: process adapters and shared test support

```text
packages/studio/
  vite.config.ts                 # config and plugin composition only
  server/
    studio-dev-server.ts         # Vite binding, log, descriptor lifecycle
    runtime.ts                   # packaged HTTP server lifecycle
    app.ts                       # thin route composition
  testing/
    run.ts                       # allocate/read run paths, containment, retention
    server.ts                    # child spawn, readiness, shutdown
    server-entry.ts              # explicitly isolated Vite child entrypoint
    interactive.ts               # parse scenario, compose run and server
    cli.ts                       # checkout-local CLI process adapter
    scenarios.ts                 # bounded map: onboarding/minimal/scene-beats/preview
    projects/
      movie.ts                   # minimal creation, names, routes, cleanup
      scene-beats.ts             # scenario orchestration and returned identifiers
      screenplay.ts              # synthetic screenplay and Beat input documents
      media.ts                   # fixture media writes and Core attachment calls
      lookbook.ts                # existing fixture Lookbook document
      generation-preview.ts      # existing Preview scenario extension
  tsconfig.testing.json
  e2e/
    global-setup.ts              # shared run/server lifecycle adapter
    fixtures/studio-e2e-test.ts   # Playwright fixture bindings and baseURL
```

`vite.config.ts` exports `createStudioViteConfig({ mode, launch, workspaceRoot })`;
its default export supplies `{ kind: 'singleton' }` and the source checkout root.
The test child calls that factory with its explicit checkout root and
the isolated launch and starts Vite with `configFile: false`, so Vite cannot
reload the default singleton configuration over the explicit test configuration.
The factory remains shallow composition; binding and descriptor lifecycle stay
in `server/studio-dev-server.ts`. Include this factory and its imports in the
test-tool compilation rather than adding an environment-driven mode switch.
Resolve Vite root, aliases, and served directories from `workspaceRoot`, not
from the emitted config module's directory.

`MovieStudioServerOptions` in `server/runtime.ts` replaces its raw `host`/`port`
options with `launch?: StudioServerLaunch`, defaulting to singleton. Update all
callers directly. The installed CLI passes singleton intent; it has no isolated
flag or environment switch. `scripts/release/studio-server-entry.mjs` is a
repository-only child entrypoint that imports the assembled package's server
and explicitly passes isolated intent for release smoke. It is not shipped.
`scripts/release/runtime/installed-studio.test.mjs` owns the installed-launch acceptance
group, using assembled runtime paths supplied by the release verification flow.
Keep it outside the existing `scripts/release/*.test.mjs` unit-test glob so
`pnpm check` does not acquire an assembled-product or free-5173 prerequisite.

Move `studio-e2e-runtime.ts`, `studio-e2e-project.ts`, and
`studio-e2e-generation-preview.ts` implementations into the named shared test
owners; delete their old entrypoints and update imports directly. Keep
FDX-specific fixture modules and CLI import helpers in E2E unless they are
actually reused. Point their runtime types and child environments at the
shared implementation. Do not move all domain test support into Core or export
browser fixture scenarios from the product.

Compile `testing/**/*.ts` with the installed TypeScript compiler, NodeNext and
explicit `.js` imports, into `packages/studio/tmp/testing-build/`. Production
builds/releases exclude this tree. Runtime support accepts an explicit
`workspaceRoot`; asset reads resolve from that root, not relative to the emitted
module location. This avoids a new TS runner dependency and source/output path
drift. Playwright can import the shared source modules directly.

The scenario registry has four explicitly supported cases, not an extensible
plugin system. Scenario modules call current Core commands; CLI/server runners
must not author SQL or bypass media attachment. Further scenarios are added
only for an actual test need.

### Shared Vitest support

```text
scripts/testing/
  vitest-run.mjs                 # global setup/teardown; owns one mkdtemp root
  vitest-environment.mjs         # worker setup; applies provided run paths
  vitest-run.test.mjs            # overlapping-process cleanup regression
```

Replace `scripts/vitest-renku-tmpdir-cleanup.mjs` and its seven config references.
Global setup creates one unique directory and provides its paths to workers;
worker setup establishes `TMPDIR`, `TMP`, `TEMP`, and `RENKU_HOME_DIR` before
test modules load. Do not repurpose `HOME`, `USERPROFILE`, or `CODEX_HOME`.
Use Vitest `provide`/`inject`, since setup and worker globals are separate.
Attach setup to the actual Core Vitest projects so both worker configurations
receive it. Teardown closes over the directory that setup created and deletes
only that directory after its workers finish; no age or prefix search.

Retain current fixture caches per worker/process and test execution partitions.
Do not enumerate private fixture helper names in an architecture test.

### Stop conditions

Stop and revise this plan if implementation requires a sample-data distribution
mechanism, a cross-worktree database synchronizer, a universal fixture DSL, a
multi-user login model, a new provider configuration surface, or production
imports of test support. Split the existing large fixture before extending it.
Do not add an environment branch to every domain command, a dynamic proxy around
ProjectDataService, or a broad dispatcher combining startup, fixture authoring,
migration, browser actions, and cleanup in one function.

## Contracts

### Core process configuration

`resolveRenkuHomeDirectory(options?: { homeDir?: string }): string` resolves:
explicit nonempty `homeDir`, then explicitly supplied `RENKU_HOME_DIR`, then
`os.homedir()`. Explicit inputs must be absolute native paths; a present blank
or relative value fails with `CONFIG016`. No `~` expansion or guessing.
The override uses the existing explicit-home path convention
`<homeDir>/.config/renku` on every platform. With no override, preserve ADR 0085
native config paths. Recommended library paths use the same resolved home and
existing platform rule, keeping first-run setup inside the test home.

`RENKU_HOME_DIR` is read through Core at process startup/use, not stored in
`config.yaml`, passed from HTTP, or changed per request. Explicit `homeDir`
remains a useful unit-test seam. Processes must select their environment before
loading product services. Vite's loaded `.env` values must not override a
test-child process's explicit isolation variables.

Remove `homeDir` from `CreateStudioServerAppOptions`: it currently scopes only
two routes and falsely suggests whole-app isolation. Remove its Vite caller;
test the full app in a process with `RENKU_HOME_DIR`. Focused setup/credential
route injection seams may remain. All default route calls, including Visual
Language and new FDX coordination calls, resolve through Core's process scope.

### Explicit launch policy

```ts
type StudioServerLaunch =
  | { kind: 'singleton' }
  | { kind: 'isolated'; homeDir: string };

resolveStudioServerBinding(
  launch?: StudioServerLaunch
): { host: 'localhost'; port: number | null };
```

- Omitted launch or `kind: 'singleton'` always returns `port: 5173`, even when
  `RENKU_HOME_DIR` is set. Environment variables never select the port or launch
  kind. Installed startup and the default Vite configuration use this branch.
- `kind: 'isolated'` returns `port: null` for automatic loopback allocation.
  Its explicit absolute `homeDir` must match the process's explicitly selected
  `RENKU_HOME_DIR` after path resolution. Missing or mismatched process scope
  fails with `STUDIO_COORDINATION041` before any listener starts. This prevents
  an isolated listener from using ordinary configuration accidentally.
- Home validation remains owned by the existing Core home resolver. The test
  launcher selects the home before importing product services; the binding
  resolver validates intent and never mutates process environment.

Adapters implement automatic allocation with their actual server facility:
Node uses `listen(0)`; Vite starts at 5174 with `strictPort: false` and reports
the port it actually bound. Singleton binding remains strict. No
probe-close-reserve race, private Vite fields, or dependency upgrade is needed.
`localhost:5174` is never treated as an identity or assumed readiness URL.

Installed startup may reuse only a usable descriptor for the selected home's
ordinary `http://localhost:5173` instance. A descriptor for an isolated address
must not redirect an ordinary launch; report `STUDIO_COORDINATION030` with the
existing URL instead. If binding 5173 fails, reread the selected descriptor once
to recognize an ordinary instance that became ready during startup; otherwise
report `CLI162` without trying another port or killing any process. Repeated
launches preserve browser-opening and `--no-browser` behavior and return without
owning or stopping the existing server. Installation directory and version are
not singleton identity; no automatic version replacement is introduced.
Core owns reuse eligibility: extend `isStudioRuntimeDescriptorUsable` with an
optional third `launch?: StudioServerLaunch` argument after `now`. When launch
is supplied, apply the corresponding binding policy as well as freshness/PID
checks. Status and notification callers omit launch and retain their existing
discovery semantics; CLI startup passes singleton intent. Do not duplicate the
URL eligibility rule in CLI or Vite code.

### Exclusive runtime ownership

Keep one descriptor per resolved home. Remove
`replaceNonCanonicalDevServer` and its replacement branches/tests directly;
an occupied fresh runtime still reports `STUDIO_COORDINATION030`. Cross-home
processes never replace one another. Actual host/port/URL populate descriptors
only after listening. Claim failure closes the listener. Heartbeat and release
use the same scope, with ownership checks retained. A ready test requires the
descriptor PID to equal its launched child PID and health to pass at its URL.

The existing read-then-write claim is insufficient once two listeners can bind
different ports. Core `runtime-ownership.ts` serializes the complete descriptor
read/check/write operation using exclusive filesystem creation of
`studio-runtime.lock` in the resolved configuration directory. Heartbeat and
release use that same critical section; a separate ownership check followed by
an unprotected write or unlink is not sufficient. Keep descriptor JSON and its
atomic publication as the discovery contract; the lock is only short-lived
operational exclusion with owner PID and a unique acquisition token.

Contention waits for at most five seconds and then fails with
`STUDIO_COORDINATION042`. Recovery may reclaim only a proven-dead lock owner;
age alone must never justify stealing a lock. Serialize recovery contenders and
verify acquisition identity so a recovering process cannot remove a replacement
owner's lock. Incomplete or unprovable ownership fails clearly with the lock
path instead of guessing. Release must be token-owned and run in `finally`.
These are private implementation details within the existing coordination owner,
not a general-purpose locking framework.

Under exclusion, a descriptor whose PID is still alive blocks a new claim even
if its heartbeat has become stale; stale discovery does not authorize a second
live server. A dead runtime's descriptor may be replaced under the same lock.
Freshness still controls status and notification behavior. If a runtime loses
descriptor ownership, stop its listener and heartbeat with a structured
`STUDIO_COORDINATION043` failure instead of remaining an undiscoverable server.
Failure to claim or recover must close the newly bound listener. Prove the
same-home startup and recovery races before accepting this implementation;
stop the slice if lock recovery cannot be made exclusive on supported platforms.

### CLI server status

Move the existing status projection into Core and expose:

```ts
interface StudioServerStatus {
  server: {
    running: boolean;
    descriptor: {
      present: boolean;
      fresh: boolean;
      host: string | null;
      port: number | null;
      serverUrl: string | null;
      pid: number | null;
      heartbeatAgeMs: number | null;
      hasCliNotificationToken: boolean;
    };
  };
  eventStore: {
    path: string;
    lineCount: number;
    invalidEventCount: number;
    warningCount: number;
  };
}
```

`readStudioServerStatus(options?: { homeDir?: string; now?: Date })` returns
this projection; `eventStore.path` is absolute. No tokens are serialized.
Remove `canonicalUrl`, `matchesCanonical`, and the redundant `agent` URL/policy
block rather than maintaining aliases. Consumers use a fresh descriptor's
`serverUrl`. Missing/stale discovery remains visible and never attaches to the
maintainer's default server. Preserve CLI notification no-op/warning semantics
from ADR 0031. `renku studio start` uses the singleton launch policy and Core
home resolution; no additional public CLI flags are added. Status discovery
does not itself grant permission to launch or reuse an isolated runtime.

### Test run and commands

`StudioTestRun` contains only `workspaceRoot`, `runRoot`, `homeDir`,
`projectStorageRoot`, and `artifactsDirectory`, all absolute. Derive the last
three from the root rather than persisting mirrors. `createStudioTestRun({
workspaceRoot, initializeConfig })` uses `mkdtemp` beneath
`<worktree>/tmp/studio-tests/`; `readStudioTestRun({ workspaceRoot, runRoot })`
checks realpath containment and existence before returning the derived paths.
No machine registry, task ID, branch mapping, or run manifest is required.
Initialization calls existing `initRenkuConfig` with the explicit test home
and `home/projects`; onboarding skips that call. Shared fixture builders pass
the run's home explicitly to Core, so setup itself cannot use personal defaults.

For server and CLI children, replace any inherited `RENKU_HOME_DIR` with this
run's home and set `RENKU_MOVIE_STUDIO_ROOT` to this run's allowed project root
for Vite.
Set `TMPDIR`, `TMP`, and `TEMP` to `scratch`. These values are child-process
environment arguments, not edits to the user's shell configuration or `.env`.
Derive server logs and browser artifact paths from this run, keeping the normal
developer log path unchanged. Do not copy provider secrets or personal config.
The server entrypoint explicitly passes `{ kind: 'isolated', homeDir: run.homeDir }`
to the Core-backed Vite configuration factory. CLI children use the home to
target commands and discovery; they do not gain isolated launch permission.
Use `studio:test` to start the test server, not `renku:test ... studio start`.

`startStudioTestServer(run)` launches the named Node child with the run's
environment, captures logs, waits up to 120 seconds for matching descriptor and
health, and returns `{ serverUrl, stop }`. Exit/startup failures include the log
path. `stop` signals and waits for that child only, with a bounded forced-stop
path if it does not exit. It never kills a process discovered by port. Test
readiness failure must not be treated as success just because another server
answers HTTP.

`studio:test --scenario` accepts exactly `onboarding`, `minimal`, `scene-beats`,
or `preview`; the flag is required. Onboarding has no configured library;
minimal creates `test-movie`; scene-beats reuses the populated coverage fixture;
preview adds the existing review/inspection fixture. Output reports `runRoot`,
`serverUrl`, project name/path when present, and the exact local CLI invocation.
Logs never print runtime or provider tokens.

`renku:test --run <path> -- <args>` requires an existing run beneath the current
checkout, checks its initialized project storage remains inside the run, and
executes the existing CLI. It does not rebuild on each invocation; missing
compiled output fails with an actionable build instruction. General product
commands retain their current scope; the test command is an orchestration
adapter, not a filesystem security sandbox.
Before onboarding has written config, read-only status/setup and initialization
commands remain usable; absence of config must not itself reject the run.

Use existing structured diagnostics for Core/CLI failures. Test tooling uses
`STUDIO_TEST001` (invalid arguments/run boundary), `STUDIO_TEST002` (missing
build/fixture prerequisite), and `STUDIO_TEST003` (server startup/readiness).
No new diagnostics describe obsolete environment flags or old status fields.

## Implementation Slices

### 1. Establish process-scoped Core configuration and runtime discovery

Implement the Core contracts and status projection. Update configuration,
recommended storage paths, explicit launch policy, exclusive descriptor
lifecycle, and focused tests. Wire CLI start/status and existing notification
consumers; retain thin handlers. Preserve installed reuse and occupied-port
behavior under singleton intent. Do not
alter Project schemas or migrate any developer data.

### 2. Apply the same scope to Vite and the packaged server

Refactor the descriptor lifecycle from the large Vite config into
`server/studio-dev-server.ts`; keep app/plugin composition shallow. Use actual
bound addresses and scoped logs. Replace the fixed E2E mode, constants, and
environment controls with the shared process contract, updating callers in the
same slice. Ensure the packaged server gets the same environment for API
routes, claims, heartbeats, and release. Preserve HMR, same-origin checks, and
separate API/notification tokens. No new HTTP route or browser badge.
Use the explicit configuration factory for isolated Vite startup and singleton
intent for its default export. Replace packaged raw binding options with the
launch contract; do not make the installed CLI consult a test-mode environment
variable. Close listeners on claim failure or loss of ownership in both adapters.

### 3. Expose existing synthetic fixtures for interactive testing

Extract the named shared fixture files, retaining all returned scenario
identifiers and current scenario behavior. Name shared types `StudioTestProject`
and `StudioTestMovieProject`; update existing E2E callers directly. Keep
Playwright page objects/assertions outside shared builders.

Use checked-in app images or small deterministic media. Existing fixture audio
contains placeholder bytes, which cannot prove audio playback; tests claiming
playback must use a small valid repository-owned clip. Do not generate media
through paid providers to populate ordinary fixtures. Preserve opaque creative
text without semantic validation. Preview fixtures exercise review and
inspection without executing the provider request.

Add `tsconfig.testing.json`, `test:build-tools`, `test:interactive`, and
`test:cli` scripts to Studio and root `studio:test`/`renku:test` delegations.
Reuse `e2e:build-deps` for initial builds. Include shared support in typechecks
and lint, exclude its compiled output and imports from production bundles, and
require available native SQLite bindings instead of reporting a prepared
interactive environment after skipped setup.

### 4. Share lifecycle with Playwright and release verification

Both Playwright configs use `e2e/global-setup.ts` to create the appropriate run
and start/stop its child through shared support. Replace fixed `webServer.url`
startup with that lifecycle; never reserve a port by briefly opening a socket.
Workers receive the run root via `RENKU_STUDIO_TEST_RUN_ROOT`; the existing
Playwright fixture overrides `baseURL` from the ready runtime descriptor.
Update onboarding to use that fixture instead of importing the bare base test.
Remove URL reads at config evaluation that occur before the server exists.
Create the run-path object during config construction and pass it to global
setup through Playwright metadata, so `outputDir` and report paths are already
known; global setup starts that same run rather than allocating another one.
Only the server URL is discovered after startup. Initial E2E prebuild hooks also
run `test:build-tools` before the child entrypoint is used.

Update CLI fixture subprocesses to set `RENKU_HOME_DIR` and use the checkout's
entrypoint. Use `RENKU_STUDIO_TEST_KEEP_ARTIFACTS=1` for explicit retention;
remove the superseded E2E runtime variables and update every current caller.
Keep a single worker within each run; concurrency is between isolated runs.
Preserve smoke, regression, compatibility, and onboarding command partitions.
Retain checksum-pinned external FDX interoperability fixtures and their existing
download behavior. Their cache is checkout-local input data, not a persisted
movie project; this plan does not claim that the full interoperability suite
is offline. Default interactive scenarios need no external fixture download.

Onboarding cases remove only `config.yaml` and their test credential file when
resetting setup, not the running server's descriptor/event directory. Resolve
the recommended library with Core; its files remain test-owned.

Change runtime verification in `scripts/release/verify-product.mjs` to launch
`scripts/release/studio-server-entry.mjs` with the assembled runtime path and a
synthetic home. That child imports the assembled server and explicitly requests
isolated startup. Discover it using the assembled CLI's status command, verify
the PID, then probe that URL. Add a regression with an unrelated healthy server
so a failed launch cannot falsely pass verification. Wait for the owned child
to exit before removing its temporary configuration.

Add the separate `scripts/release/runtime/installed-studio.test.mjs` acceptance group
specified below. Run it with the assembled installed CLI, singleton launch
intent, and synthetic configuration. `verify-product.mjs` must report isolated
server smoke and installed singleton results separately; a missing artifact or
unavailable controlled port means the corresponding check is unverified, not
passed. Keep archive structure, publishing, versioning, and installation
untouched; no release entrypoint or test is included in the shipped product.

### 5. Make Vitest cleanup owned and concurrent

Replace the machine-wide cleanup hook using the Architecture Shape Gate.
Provide run paths to workers before fixtures load, including both Core project
configurations, CLI and Studio integration, and Engines fast tests. Extend
isolation to diagnostics tests if they create temporary files; paid provider
tests remain explicit and receive isolated scratch paths without changing their
credential contract. Reuse the existing fixture `mkdtemp(os.tmpdir())` pattern
inside the owned root rather than rewriting hundreds of fixture call sites.

Verify that config-path unit tests deliberately testing native defaults clear
the test override locally and use supplied/mock platform contexts; do not let
those tests access the developer's actual files. Keep template build promises
local to each process. Do not broadly repair unrelated fixture content.

### 6. Prove independent project creation and migration

Keep current migration SQL-slice tests and template tests. Add
`packages/core/tests/integration/project-migrations.test.ts` with a disposable
on-disk upgrade from the journal prefix through 0082 to the full current
migration history. Build the predecessor using checked-in SQL/journal inputs
and Drizzle Kit in a temporary migration directory/config; do not write a
second TypeScript migration registry or duplicate migration SQL.

Seed a minimal synthetic Project and supported prior-version Settings using
the exact prior-schema test fixture, leaving the historical dialogue tables
empty for this representative end-to-end path. Apply the production
`migrateProjectDatabase` operation from this checkout. Verify the backup,
retained Project values, current Settings version, schema generation, foreign
keys, and a Core read after migration. The existing 0083 SQL-slice test retains
its populated conversion coverage. Prior-schema SQL writes are confined to
migration tests; ordinary browser fixtures still use current Core commands.

Do not amend existing migration files or introduce a new migration in this
plan. Future schema changes must add their own meaningful upgrade fixture and
verify the combined migration sequence after branch integration. There is no
requirement to serialize all developers or migrate every active task's project.

### 7. Replace agent defaults and document the complete workflow

Update instructions and references listed below. Explain how a Computer Use
session starts with fixture data, obtains the exact URL, uses its task-local
CLI, retains evidence, and stops only its own process. Explain the user's
separate persistent manual environment and the explicit exception for a
user-requested sample-specific investigation. Do not edit historical plans
merely because they mention Urban Basilica.

## Tests And Guardrails

### Owning-layer coverage

- Core config: explicit option/environment/default precedence, invalid explicit
  paths, native defaults, and isolated recommended onboarding storage.
- Core binding/status: singleton fixed port with and without a home override,
  explicit isolated binding, missing/mismatched isolated home, ordinary reuse
  eligibility, missing/stale/fresh descriptors, exact discovered URL,
  independent config homes, and no token disclosure.
- Core ownership: simultaneous same-home claims with different bound ports;
  exactly one winner, loser listener closure, protected heartbeat/release,
  live-but-stale owner rejection, dead-owner recovery, concurrent recovery,
  lock timeout, incomplete lock ownership, and an old owner unable to overwrite
  or delete a new claim. Use synchronized subprocesses to force the race; do
  not rely on timing-sensitive repeated attempts. Check loss-of-ownership
  shutdown at the server adapter, without repeating the Core race matrix there.
- Test lifecycle: unique roots, realpath containment, missing prerequisites,
  fixture failure, early child exit, timeout, scoped stop, and run retention.
- Cleanup: overlapping subprocess runs A and B; completing A leaves B's files
  intact, including older files and process-local fixture templates. Watch-mode
  teardown removes only its own run. No traversal or symlink-target deletion.
- Migration: new-project creation through the real command, prior-schema
  transformation tests, and the representative Drizzle upgrade described above.

### Adapters and representative journeys

- CLI tests cover argument/JSON mapping, the local executable and child env,
  singleton launch delegation, occupied-port error mapping, browser/no-browser
  reuse behavior, and current notification delivery semantics; do not duplicate
  Core matrices.
- Server tests cover scope resolution for setup, project library, media,
  credentials, current selection, FDX events, and notification endpoints using
  representative requests. Do not repeat domain validation suites.
- Run two servers with the same project name but different titles and files.
  A CLI mutation in A refreshes A's browser only. B's project, events, and
  browser selection remain unchanged. Stop A; B still works.
- Include a third synthetic default environment representing the maintainer's
  instance. Assert isolated runs never read/write its config, project files,
  descriptor, or events; do not use the real personal project as the sentinel.
- Run two Playwright invocations concurrently in independent checkouts (or
  already-built runs), including onboarding alongside a configured scenario.
  Confirm distinct URLs, data roots, logs, and results.
- Computer Use at desktop size: open two independently addressed sessions;
  navigate, edit a project title, inspect Scene Beats/Shot media, and reload.
  Retain URL, screenshot, and CLI readback evidence for each. File-picker flows
  use only fixture files; record a host limitation if native desktop input
  cannot be addressed independently. Do not replace this with only Playwright.

### Installed-launch acceptance

These checks exercise `renku studio start` from the assembled product, not the
isolated server entrypoint. Use a synthetic `RENKU_HOME_DIR` while retaining
singleton launch intent; native default-path selection remains covered in Core.
Run fixed-port checks serially on a controlled host with 5173 available. Never
stop the maintainer's server to make this gate run; report the host limitation
and run the gate in the controlled release environment instead.

- First launch binds `http://localhost:5173`; status PID matches its child and
  health succeeds at that exact address.
- A repeated installed launch exits successfully using the same PID and URL
  without leaving a new server. A launch from a second installation directory
  sharing that configuration also reuses the same ordinary instance. Two copies
  of the assembled artifact suffice; no version-comparison system is needed.
- Simultaneous ordinary launches leave only one listener. The other invocation
  either reuses the newly ready instance or reports the structured occupied-port
  failure; it never searches for another port.
- A test-owned unrelated listener occupying 5173 produces `CLI162`, leaves
  that listener intact, and creates no Renku runtime descriptor or other server.
- Graceful stop followed by another installed launch succeeds on 5173 with a
  new PID; crash recovery is covered at the Core ownership boundary.
- An explicit isolated packaged server coexists with the ordinary instance.
  Its CLI mutation and shutdown leave the ordinary PID, descriptor, events,
  and synthetic project untouched. A home override alone still requests 5173.

Assert process identity and owned shutdown, not just HTTP success. Keep the
full race/recovery matrix at Core; this group proves the installed entrypoint
and package wiring preserve the product contract.

Protect package import boundaries: product code cannot import `testing/` or
`e2e/`, shared fixture modules cannot import browser page controllers, and
ordinary browser fixtures cannot import SQLite/Drizzle writers. Use import or
runtime-capability checks, never source needles for private function names or
inventories of all service methods. Keep historical migration test boundaries
distinct from current-schema fixture creation.

## Documentation

- Add `docs/development/isolated-worktree-testing.md` for commands, paths,
  Computer Use, fixture selection, rebuild/restart, retention, and migration
  verification. Link it from the current development/test references.
- Rewrite `docs/development/codex-debugging.md` around isolated agent testing;
  retain explicitly requested personal-instance attachment as a separate case.
  Remove the obsolete browser bootstrap instructions and describe exact
  session/URL targeting through the browser tools actually available.
- Update `AGENTS.md` sample-project directions and stale-example replacement
  rule: use synthetic fixtures, not another personal sample path. Preserve
  explicit personal maintenance authorization requirements.
- Update `.agents/skills/renku-plan/SKILL.md`,
  `.agents/skills/renku-plan-review/SKILL.md`, and review reference
  `reuse-and-architecture.md` so realistic verification uses disposable fixtures
  by default. Do not rewrite historical review-memory entries; current user
  direction and accepted docs govern their application.
- Update `docs/architecture/reference/studio-coordination-events.md`,
  `docs/architecture/test-execution-strategy.md`,
  `docs/architecture/reference/drizzle-migrations.md`,
  `docs/architecture/project-database-distribution.md`, and
  `docs/cli/commands.md` for exact scope, status, and upgrade-test contracts.
  State the installed fixed-port/reuse contract separately from explicit test
  isolation, including cross-installation behavior, scoped lock recovery, and
  the fact that configuration overrides do not enable isolated launches.
- Update `packages/studio/e2e/README.md`, test command references, and the
  structured diagnostics reference with the new contracts and removed flags.
- Add ADR `0094-use-isolated-test-runtimes-and-ephemeral-projects.md`. Narrow
  ADR 0037's OS-home/startup assumptions and ADR 0085's default-only resolution
  description through short notices linking to the new decision; preserve
  their original history. Coordination ownership from ADRs 0006/0031 is retained.
  The new ADR preserves the ordinary singleton and records only the explicit
  development/test exception; it must not redefine every installed home as an
  independently launchable product instance.
- In the sister `studio-skills` repository, update
  `skills/movie-director/SKILL.md` and `docs/codex-renku-permissions.md` to obtain
  the selected runtime URL rather than require 5173. Explain that development
  testing uses the repository CLI adapter, while ordinary movie-making uses
  the installed CLI. Do not globally replace every skill command or change
  permission policy, plugin releases, or user installation state.

## Final Verification

This is a planning-only change. The following commands are implementation gates,
not commands executed while authoring the plan. Do not install dependencies
without the separate authorization required by AGENTS.

```bash
pnpm build
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
pnpm test:e2e:studio:onboarding
pnpm test:e2e:studio
node --test scripts/testing/*.test.mjs
```

Run the explicit concurrency journeys after focused tests pass. Use two
available independent checkouts with local builds; creating/provisioning new
checkouts must not reuse another checkout's `node_modules` links or `dist`.
Run `pnpm studio:test --scenario scene-beats` and
`pnpm studio:test --scenario preview` concurrently and verify both through
Computer Use. Exercise `pnpm renku:test` against each reported run root.
Verify onboarding with its own interactive scenario and no personal config.

Run release verifier unit tests through the existing `pnpm check` gate and
perform packaged runtime verification only if a host-matching assembled archive
is available. Run `node --test scripts/release/runtime/installed-studio.test.mjs` with
`RENKU_TEST_PRODUCT_ROOT` set to that assembled product path on the controlled
fixed-port host. The test fails with a clear prerequisite diagnostic if the
artifact is missing; it does not silently skip. Report isolated packaged smoke
and installed singleton acceptance separately, including unavailable artifact
or occupied-host limitations. Neither limitation satisfies R10. Do not publish
or install a release as a side effect. Paid provider calls are not required.

Inspect the complete diff and `git diff --stat`; inspect large or heavily
modified files, especially the Vite plugin, test lifecycle, extracted fixture
modules, and CLI status. Confirm `index.ts` files remain thin and no source
move introduces a re-export stub. Verify new test scripts are included in checks
and excluded from release artifacts. Only relevant documentation/source changes
are authorized; no personal-project files should appear in the diff or tests.

## Completion Checklist

### Review Area

- [ ] Confirm R1–R10 have implementation, test evidence, and documentation.
- [ ] Confirm no sample copying, baseline distribution, database promotion,
      container, daemon, or environment registry entered the implementation.
- [ ] Confirm the primary manual workflow and personal files remain unchanged.
- [ ] Confirm installed singleton behavior is explicit and independent of the
      configuration-home override and repository test launchers.
- [ ] Confirm the final layout matches the Architecture Shape Gate and no
      monolithic fixture, dispatcher, or owning-layer implementation was accepted.

### Architecture And Contracts

- [ ] Implement and test the Core home resolver and explicit override validation.
- [ ] Preserve native default config and recommended storage behavior.
- [ ] Implement binding policy and actual-port runtime discovery.
- [ ] Add the explicit Core launch contract; installed/default Vite startup
      always selects singleton and no environment variable selects another port.
- [ ] Validate the isolated launch home against the selected process home.
- [ ] Serialize claim, heartbeat, release, and dead-owner recovery under the
      private per-home lock, with token ownership and structured failures.
- [ ] Reject takeover of a live stale runtime and stop a listener that loses
      descriptor ownership; retain status/notification freshness semantics.
- [ ] Remove canonical replacement behavior and old status fields directly.
- [ ] Move status projection to Core and keep CLI formatting thin.
- [ ] Scope events, current-project state, credential storage, and notifications
      through the same process configuration without new domain state.
- [ ] Remove the misleading app-level partial home option and its callers.
- [ ] Preserve runtime token separation, freshness, ownership, and warning rules.

### Implementation Slices

- [ ] Refactor Vite lifecycle into its focused server owner and keep config thin.
- [ ] Apply isolated binding/discovery to the packaged server and release smoke.
- [ ] Keep installed CLI reuse, browser/no-browser, occupied-port, and restart
      behavior; use the explicit Vite factory only from repository test startup.
- [ ] Add the repository-only packaged-server smoke entrypoint and installed
      acceptance group; exclude both from shipped artifacts.
- [ ] Extract minimal, screenplay, Beats, media, Lookbook, and Preview fixture
      modules; update imports and remove superseded entrypoints.
- [ ] Add the four named interactive scenarios through existing Core commands.
- [ ] Add test-tool compilation, root commands, local CLI adapter, and fail-fast
      build/native-binding checks without dependency installation automation.
- [ ] Resolve fixture assets from the checkout root after test-tool compilation.
- [ ] Use one lifecycle for Playwright and interactive test servers.
- [ ] Replace fixed E2E addresses and OS-home overrides in all current callers.
- [ ] Fix onboarding reset ownership and platform recommendation assertions.
- [ ] Replace global temp sweeping in all seven referenced Vitest configs and
      verify Core project-specific setup receives isolated run paths.
- [ ] Preserve process-local template reuse and test tier partitions.

### Tests And Computer Use

- [ ] Cover config, binding, status, readiness, containment, and shutdown at owners.
- [ ] Prove one same-home claim wins under synchronized concurrent startup and
      recovery, and losing/previous owners cannot remove or overwrite it.
- [ ] Prove installed first/repeat/cross-installation launches, simultaneous
      starts, occupied-port failure, restart, and coexistence with isolated tests
      through the assembled CLI and exact PID/URL evidence.
- [ ] Prove overlapping Vitest cleanup leaves another run and its templates intact.
- [ ] Prove two same-named Projects stay independent through CLI, HTTP,
      coordination refresh, media access, reload, and stopping one server.
- [ ] Prove a third synthetic default environment remains untouched.
- [ ] Run concurrent Playwright processes, including onboarding, on distinct URLs.
- [ ] Perform desktop Computer Use in two independently targeted browser sessions
      and retain screenshots plus CLI readback for each.
- [ ] Report any shared native-desktop limitation without claiming unproven
      concurrent control or accessing the personal sample.
- [ ] Keep deterministic E2E gates and opt-in provider tests; no live model or
      paid generation is required to create default fixtures.
- [ ] Add import/capability guardrails without implementation-name inventories.

### Migration Verification

- [ ] Preserve existing historical transformation tests and current fixture caches.
- [ ] Add the disposable on-disk Drizzle prefix-to-current upgrade test.
- [ ] Verify backup, retained data, Settings, schema generation, integrity, and
      current Core reads after that upgrade.
- [ ] Verify fresh project creation without a cached database shortcut.
- [ ] Leave all migration files and the personal database unchanged in this plan.
- [ ] Document new migration coverage and post-merge verification responsibilities.

### Documentation And Agent Surfaces

- [ ] Publish the isolated-worktree development guide and revise debugging steps.
- [ ] Update AGENTS and planning/review skill defaults to disposable fixtures.
- [ ] Update coordination, config, CLI status, migration, and test references.
- [ ] Document singleton versus test launch intent, private lock lifecycle and
      diagnostics, and separate installed/isolated release-verification results.
- [ ] Add ADR 0094 and concise supersession notices without rewriting history.
- [ ] Update sister movie-director/permissions guidance for runtime discovery and
      local development invocation without changing installation/permission policy.
- [ ] Document exact commands, artifact paths, rebuild behavior, and explicit
      cleanup; leave maintenance scripts and historical plans outside the sweep.

### Final Verification

- [ ] Run focused owner and adapter tests, then the named root checks once.
- [ ] Run full browser and concurrency verification with no sample-project access.
- [ ] Validate release-smoke targeting and the separate installed singleton
      acceptance group; report unavailable artifacts or controlled hosts without
      marking the corresponding acceptance requirement complete.
- [ ] Inspect `git diff --stat`, the full diff, large files, and thin entrypoints.
- [ ] Confirm no unrelated formatting, dependency, schema, or personal-data changes.
- [ ] Confirm every checklist item is satisfied by reviewable code structure.
- [ ] Mark implementation complete only after recording evidence and limitations.
