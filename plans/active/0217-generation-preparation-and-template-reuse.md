# 0217 Generation Preparation And Template Reuse

Status: implemented and verified
Date: 2026-09-29

## Summary And Review Attention

Implement the three accepted preparation improvements: fingerprint the actual
template contract, validate and deliver Preview in one command, and assemble a
cached visualization without agent round trips between mechanical steps.
New CLI contracts are `generation prepare --file` and
`generation configuration-visualization prepare --file --payload --output`.
The shared cache, schema freshness, creative context, editable Preview, and
generation confirmation remain intact. No database or Settings changes.
The fingerprint change makes existing entries incompatible once; subsequent
workflow-only instruction edits do not invalidate templates.

## Context And Evidence

Session 01a0eee3 used an existing reference-to-video cache entry but rejected it
because the entire workflow guide hash changed. Replacement schema and HTML
hashes were identical. Settings-to-Preview took 35.7 seconds with only 2.8 seconds
in Validate and Preview. This extends 0216's execution handoff.
Architecture follows docs/architecture/coding-practices.md and the existing
Core media-generation-review and generation-configuration-visualizations owners.

## Architecture Shape Gate And Contracts

- Core `media-generation-review/preview.ts` exposes
  `projectMediaGenerationPreview` for an already loaded document; both file
  reading and preparation use the same projection. CLI never projects references.
- CLI `generation/prepare.ts` loads once, delegates existing Engines validation,
  projects that exact document through Core, and delivers Preview. It returns
  `requestSha256`, provider/model/media kind, diagnostics and delivery status.
  Shared validation and delivery stay in their existing focused modules.
- Core `generation-configuration-visualizations/preparation.ts` owns inspecting
  the shared cache and materializing a fresh opaque payload only on a fresh hit.
  Non-fresh states return existing cache statuses without writing an instance.
  `materialization.ts` owns payload escaping and fragment-size enforcement.
- CLI configuration handler only reads flags/files and delegates to Core with
  the requested output path. Output must not overwrite shared
  cache artifacts. Core owns that boundary and atomic instance persistence.
- Skill script `prepare-generation-configuration-visualization.mjs` replaces the
  separate descriptor/materializer commands: hashes installed dependencies,
  saves the descriptor for existing store/refresh operations, and invokes CLI
  preparation once. It owns no cache decisions or HTML transformations.
- `references/generation-configuration-template.md` contains only actual HTML,
  payload, controls, and handoff requirements. The workflow guide points to it.
- Public indexes remain exports only. No provider/purpose dispatch, creative
  parsing, route-specific fields, or model constants are added to CLI/Core.
  Stop if these orchestration changes require a catch-all command or owner.

## Implementation And Verification

1. Refactor shared Preview projection and validation; add Prepare with tests
   proving invalid input never opens Preview, delivery failure is explicit,
   and file edits cannot change the validated projection or returned hash.
2. Add Core cache preparation and CLI delegation; test fresh/miss/expired/
   incompatible paths, distinct task payloads, escaping, and cache protection.
3. Split template requirements from workflow instructions; update all affected
   skill examples and evals across image/audio/video. Keep standalone Validate
   and Preview for their existing independent uses and multi-request Preview.
4. Update CLI and architecture documentation. Run Core/CLI focused tests and
   type/lint checks, sister-project skill tests, and a real cache-hit smoke test
   in separate CLI processes without submitting paid generation.

## Completion Checklist

- [x] Combined Prepare validates and previews the exact same loaded request.
- [x] Invalid validation and failed Preview delivery cannot report readiness.
- [x] Fresh shared HTML is reused with isolated task-local payloads.
- [x] Non-fresh cache states preserve schema refresh/rebuild behavior.
- [x] Only actual template requirements affect the template-contract digest.
- [x] Skills and evals use the new flow for all provider media kinds.
- [x] Docs describe commands, ownership, and structured failures.
- [x] Focused tests, checks, and real cross-process cache reuse pass.
- [x] Inspect complete diffs, large files, and thin indexes; preserve unrelated work.

## Verification Results

- Core: 500 tests passed with `vitest run --pool=forks --maxWorkers=1`.
  The initially parallel run had nine database-fixture failures; the serialized
  run passed all 99 files without production database changes.
- CLI: 129 tests passed; Core and CLI check:all passed. Root `pnpm check` passed.
- Studio Skills: 62 automated tests, 184 routes, 22 purposes, and 27 cross-cutting
  eval requirements passed. Generic skill quick_validate could not run because
  the system Python lacks PyYAML; the repository's own skill validation passed.
- Real existing H3 request: `generation prepare` returned valid, no diagnostics,
  the expected request digest, and Studio delivery=delivered. No paid execution.
  Normal host permission was needed for the existing provider metadata cache write.
- Actual existing shared H3 template: two separate CLI processes returned fresh
  in 858 ms and 600 ms, wrote distinct task instances, and left all shared cache
  bytes unchanged. Evidence: `/tmp/renku-0217-cache-smoke/results.json`.
- Combined Skill script using the current narrower contract and a temporary
  cache: initial miss, then fresh hits from separate CLI processes in 585 ms and
  550 ms. Evidence: `/tmp/renku-0217-cache-smoke/script-results.json`.
- Diff and module-shape review completed; indexes contain exports only and no
  provider/model or creative-content decisions moved into CLI/Core.

Timing evidence measures deterministic preparation, not a new autonomous agent
session. The installed Codex plugin is a copy; load an updated plugin before
measuring agent behavior against these source instructions. Existing cache
entries undergo one contract-fingerprint invalidation with that update.
