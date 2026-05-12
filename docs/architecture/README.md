# Renku Studio Architecture

Date: 2026-05-12

Status: current

Role: topic overview

This directory contains current architecture topic overviews. Precise contracts
and implementation references live in `docs/architecture/reference/`. Durable
decision history lives in `docs/decisions/`.

Use this page as the map:

## System Layers And Ownership

- `layers-of-responsibility.md` explains what belongs in core, server,
  frontend, CLI, agents, and future workers.
- `core-design-principles.md` summarizes source-of-truth, fail-fast, package
  boundary, and no-compatibility rules.
- `naming-guidelines.md` is the top-level naming policy. Naming is architecture
  in Renku Studio and should be checked during every design or implementation
  change.
- Related ADRs:
  - `../decisions/0001-create-renku-studio-monorepo.md`
  - `../decisions/0002-use-engines-for-ai-integrations.md`
  - `../decisions/0003-use-better-sqlite3-with-async-storage-boundary.md`
  - `../decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`

## Project Data, Storage, Files, And Assets

- `data-model-and-storage.md` is the short entry point for project data and
  storage architecture.
- `reference/domain-vocabulary.md` defines canonical project vocabulary.
- `reference/project-storage-boundaries.md` explains SQLite versus filesystem ownership.
- `reference/project-files-and-assets.md` explains assets, files, takes, selects, and
  production exports.
- `reference/project-relative-paths.md` defines the stored path contract.
- `reference/drizzle-migrations.md` defines the Drizzle Kit migration workflow.
- `reference/project-create-from-yaml.md` documents the current internal setup YAML
  creation path.
- Related ADRs:
  - `../decisions/0003-use-better-sqlite3-with-async-storage-boundary.md`
  - `../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
  - `../decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md`
  - `../decisions/0012-store-project-file-references-as-project-relative-paths.md`
  - `../decisions/0013-use-core-owned-project-assets-and-production-exports.md`
  - `../decisions/0016-use-active-project-sessions-and-eager-surface-data-for-studio-performance.md`

## Studio App, Server, Routes, And Coordination

- `reference/studio-server-hono.md` explains the local Hono server structure.
- `reference/front-end-guidelines.md` explains frontend folder and component boundaries.
- `studio-coordination-events.md` explains local browser/CLI/agent coordination
  events.
- Related ADRs:
  - `../decisions/0005-use-latest-only-save-queues-for-autosave.md`
  - `../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
  - `../decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
  - `../decisions/0008-use-url-owned-studio-routes.md`
  - `../decisions/0014-use-hono-route-modules-for-the-local-studio-server.md`
  - `../decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
  - `../decisions/0016-use-active-project-sessions-and-eager-surface-data-for-studio-performance.md`

## Diagnostics, Naming, CLI, And Contracts

- `reference/structured-diagnostics.md` explains the shared diagnostics contract.
- `naming-guidelines.md` explains domain naming rules and current contract
  names.
- Related ADRs:
  - `../decisions/0004-use-human-first-cli-guidelines.md`
  - `../decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
  - `../decisions/0008-use-url-owned-studio-routes.md`
  - `../decisions/0009-use-structured-diagnostics-at-package-boundaries.md`
  - `../decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`

## Generation And Engines

- `plans/exploration/project-generation-definitions.md` explores a possible
  code-owned generation boundary.
- `plans/exploration/generation-recipes-and-task-execution.md` is a draft for
  shared generation request/task execution architecture.
- `plans/exploration/core-workflows-and-queue.md` is a proposal for future
  micro-workflows and queue behavior.
- Related ADRs:
  - `../decisions/0002-use-engines-for-ai-integrations.md`

Do not promote generation explorations to architecture or ADRs until
implementation proves the exact generation-definition, request, task, queue, and
catalog contracts.
