# 0218 Selection Liveness And Model Discovery

Status: complete
Date: 2026-09-30

## Summary And Review Attention

Fix preparation delays observed in 01a0ef10: hidden Studio tabs expire while the
user works in Codex, passive library-tab activity can replace engagement order,
and agent-written model-list parsing causes repeated discovery. Keep current
selection validation, stale-session expiry, provider schema ownership and all
review/confirmation behavior. No stored-data cleanup, migration, Settings change,
provider schema copies, or new CLI command is needed. The existing model list
adds `--query`; visualization Prepare accepts route-index paths and returns a
Core-resolved descriptor plus selector routes when a rebuild is needed. Remove
the per-thread catalog write/reuse workflow. CLI code must not interpret model
entries, capabilities, or skill guide structure.

## Evidence And Accepted Rules

The shot-plan tab last reported at 21:20:21; its visible-only heartbeat stopped
when hidden. At 21:27 the project-library tab was the only live session. Core
also ranks latest activity kind ahead of engagement, contrary to the existing
rule in docs/architecture/reference/studio-coordination-events.md: passive
activity proves liveness and must not reorder user engagement.
Model discovery repeatedly parsed `.models` instead of Core's `.routes`, then
read indexes/catalogs separately. The full effective list is needed for inline selectors and their cache digest;
Core can read its authoritative bundled and personal sources directly.

## Architecture Shape Gate And Contracts

- Studio `app/use-studio-coordination.ts` continues reporting current view intent;
  hidden-tab heartbeats report liveness, and loading routes do not report a
  fictitious library selection. Focus changes renew liveness in Core.
- Core `studio-coordination/current-projection.ts` owns last-engaged selection
  across live sessions; activity events cannot replace that ordering. Keep
  existing stale-session expiry and project/selection validation.
- Core `media-model-library/service.ts` adds generic query matching to
  `listMediaModels`; `generation models list --query` delegates through
  `models/queries.ts`. Names and ids remain opaque data without model-specific
  branches. Existing merge precedence and full-list digest remain unchanged.
- Core `generation-configuration-visualizations/preparation.ts` resolves the
  current list from supplied bundled route-index paths and personal storage,
  calculates the digest, and performs existing cache preparation. It returns
  a resolved `descriptor`; non-fresh outcomes also return `routes` for selectors.
  The CLI reads opaque documents, forwards paths, and serializes the result.
- Skill discovery prints Core query results enriched with optional skill-owned
  guide paths. The preparation script supplies installed index paths and saves
  the returned cache descriptor. Neither script writes a model catalog.
  Existing cache Store/Refresh consume the resolved descriptor; no new registry,
  model cache, aliases, provider switchboard, or entrypoint facade is introduced.
- Model/schema-specific expansion choices stay agent-owned. Generic guidance
  uses the schema's enabled default rather than selecting its slowest mode merely
  because expansion is enabled. Explicit user direction remains authoritative.
- No new index barrels, generic manager, provider dispatch, or creative parsing.
  Stop if this grows into event-store redesign or provider logic in adapters.

## Implementation And Verification

Add runtime tests for hidden heartbeat, route-loading suppression, passive
library activity, explicit navigation, and expiry. Test discovery against dynamic
route indexes, personal routes without hints, unchanged full digests, and discovery without catalog writes. Extend behavior evals for preparation discovery and expansion.
Run focused Core, Studio and skill tests, build and root checks, then verify
desktop tab-to-Codex handoff where available. Update coordination and performance
docs and the shared skill workflow.

## Completion Checklist

### Architecture and behavior

- [x] Hidden tabs report liveness without changing engagement order.
- [x] Loading a project route does not report a fictitious library selection.
- [x] Core selects the most recently engaged live view; explicit navigation wins.
- [x] Activity expiry and project/selection validation remain intact.
- [x] No provider/model behavior added to Core, CLI, or Studio runtime.

### Agent workflow and evals

- [x] Discovery prints Core query matches and skill-owned guide paths without files.
- [x] Preparation resolves current sources internally, returning selectors on rebuild.
- [x] Personal routes and absent guidance work without invented requirements.
- [x] Full catalog and digest remain available for selectors and existing cache.
- [x] Skills preserve enabled schema defaults and explicit expansion choices.
- [x] Script tests, behavior scorers, and a realistic forward-test scenario added.

### Verification and handoff

- [x] Core coordination tests: 17 passed; Studio hook tests: two passed.
- [x] Updated tests pass: 18 Core, two CLI, and 64 skill tests.
- [x] Core/CLI builds and root `pnpm check` pass for the discovery correction.
- [x] Desktop selection remains available beyond the expiry window in a hidden tab.
  Native Chrome check retained the exact Shot Plan/Shot at 21:52:46 UTC;
  hidden heartbeats at 21:51:29 and 21:52:08 coexisted with visible library activity.
- [x] Coordination and performance documentation updated.
- [x] Inspected changed functions, new scripts, diffs and diff statistics;
  no new public barrels or oversized dispatchers; unrelated work preserved.
- [x] Record local command timings without claiming an autonomous generation gain.

The standalone skill-creator Python validator could not run because PyYAML is
unavailable. Repository-owned skill validation passed. Installed plugin copies
must be refreshed before a new agent-session comparison.
