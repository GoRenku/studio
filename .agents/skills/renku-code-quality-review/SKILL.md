---
name: renku-code-quality-review
description: Focused Renku Studio architecture and code-quality review. Use when Codex is asked to review Renku Studio changes for architectural correctness, layering, fail-fast structured errors, no fallback or compatibility shortcuts, function and file complexity, naming quality, frontend shadcn usage, CLI/server/core boundaries, media-generation dependency architecture, or repeated quality issues that ordinary correctness review may miss.
---

# Renku Code Quality Review

## Overview

Use this skill for a focused Renku Studio architecture and code-quality review.
Prioritize shortcuts that will make the codebase harder to extend, even when the
feature appears to work.

This is not a general correctness review. Look specifically for architectural
drift, weak boundaries, guessing behavior, avoidable complexity, vague names,
and repeated project-specific failure modes.

## Review Workflow

1. Establish the review scope from the user request, `git status`, `git diff`,
   the current branch, or the named files/PR.
2. Read `AGENTS.md` before reviewing code.
3. Read the relevant accepted architecture docs for the touched area.
4. Read `references/review-rubric.md` before writing findings.
5. Inspect the changed code with the rubric in mind.
6. Report only actionable architecture/code-shape findings. Do not pad the
   review with generic style notes.

## Required Context

Always read these when reviewing non-trivial changes:

- `AGENTS.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/reference/structured-diagnostics.md`

Load area-specific docs when the diff touches that area:

- Frontend: `docs/architecture/reference/front-end-guidelines.md`,
  `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`,
  and `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`.
- Studio server: `docs/architecture/reference/studio-server-hono.md` and
  `docs/decisions/0031-use-studio-server-owned-coordination-delivery.md`.
- CLI: `docs/decisions/0026-use-thin-structured-cli-command-handlers.md` and
  `docs/cli/commands.md`.
- Core data or migrations: `docs/architecture/data-model-and-storage.md`,
  `docs/architecture/reference/project-storage-boundaries.md`,
  `docs/architecture/drizzle-first-project-data.md`, and
  `docs/architecture/reference/drizzle-migrations.md`.
- Media generation: `docs/architecture/reference/media-generation.md`,
  `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`,
  and the currently active dependency-inventory plans when relevant.
- Resource refresh or coordination: `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`
  and `docs/decisions/0031-use-studio-server-owned-coordination-delivery.md`.

If an active plan is named by the branch, commit message, PR, or changed files,
read that plan too. Treat accepted docs and implemented plans as stronger
evidence than historical or superseded documents.

## Search Prompts

Use targeted searches to find likely review issues. Adapt the path list to the
actual diff.

```bash
rg -n "fallback|compat|compatibility|alias|shim|facade|wrapper|re-export|barrel|legacy|obsolete" <changed-paths>
rg -n "throw new Error|catch \\(|\\.prepare\\(|session\\.sqlite|window\\.addEventListener|renku:studio-resource-changed" <changed-paths>
rg -n "data|item|helper|manager|util|detail|snapshot|view|open\\(|load\\(|fetchData" <changed-paths>
rg -n "<button|<input|<select|<textarea|<dialog" packages/studio/src
```

Do not treat search hits as automatic findings. Use them as prompts to inspect
whether the code violates the current architecture.

## Finding Standard

Each finding must include:

- a file and line reference;
- the violated Renku Studio rule or architecture boundary;
- a concrete example of when the problem happens;
- the expected impact;
- a proposed fix.

Severity guidance:

- `P1`: will corrupt durable state, bypass a package boundary, hide invalid
  project data, or break agent/CLI automation contracts.
- `P2`: adds architectural drift, guessing behavior, unsupported fallback
  behavior, complex command/control flow, or a confusing public contract.
- `P3`: localized maintainability issue that is still worth fixing before more
  code builds on it.

If there are no findings, say so directly and mention any residual risk or test
gap discovered during the review.

## Output Shape

Lead with findings, ordered by severity. Keep summaries secondary.

For every issue, explain the bug in plain language with a concrete scenario and
propose a solution. Example:

```text
[P2] Do not turn malformed dependency selectors into missing dependencies -
packages/core/src/server/media-generation/dependency-selectors.ts:75

When the selector kind is misspelled, this branch returns a normal missing
dependency. A typo in a purpose declaration would then show a quiet missing
reference card instead of a structured diagnostic. That hides a broken core
contract and can make Studio pricing look merely incomplete.

Prefer an exhaustive selector switch that returns a structured dependency
diagnostic for unknown selector kinds, with a focused test proving malformed
selector requests fail fast.
```

Use the user's requested format when they provide one, but keep the same finding
standard.
