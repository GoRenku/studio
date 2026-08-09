# 0074 Use Core-Owned Project Workflow Settings

Date: 2026-08-06

Status: accepted

## Context

Screenplay-import follow-up and generation workflow preferences belong to one
Project, not to global Renku configuration. Studio, CLI, and agent skills need
the same current values without duplicating defaults, validation, or effective
policy rules in their own layers.

The settings are always read and replaced together. No current requirement
queries, indexes, joins, or constrains an individual setting independently.

## Decision

Each Project database owns exactly one `project_settings` row. The row has a
singleton id constrained to `1` and one JSON `document` containing the complete
versioned Project Settings document.

Core owns:

- the current document shape and sole default value;
- AJV validation before every write and after every read;
- initialization during migration and Project creation;
- focused read and full-document replacement operations;
- the `project-settings` resource key; and
- the resolved generation workflow policy projected in Generation Context.

Studio and CLI pass the complete parsed document to Core as `unknown`. They do
not merge fields, synthesize defaults, validate individual settings, or rebuild
mutation resource keys. A future document-shape change uses a one-way Drizzle
data migration. Runtime reads do not repair, default, or support obsolete
versions.

Director Context exposes the raw current document for agent coordination. The
deterministic FDX importer remains limited to canonical import and candidate
evidence; enabled import preferences tell the movie-director workflow whether
to continue with continuity facts and bindings, continuity images, screenplay
analysis, Scene Beats, and storyboard images after each stage's real
prerequisites are satisfied. Core does not run those creative workflows.

Generation Context exposes Preview display preference, preferred execution
path, per-run conversational confirmation, and effective concurrency for the
Renku-managed and Codex built-in lanes. Explicit user direction and a path
already authored on a saved GenerationSpec take precedence. Codex remains an
agent-external harness capability and is not added to Engines. If that
capability is unavailable, the agent asks instead of silently starting a paid
Renku run.

Renku-managed execution still validates the saved spec, obtains the exact
current estimate and approval token, and passes that token unchanged for each
run. The Project setting controls only the additional conversational pause; it
does not weaken tool permission, provider authentication, exact token,
inspection, or attachment boundaries.

## Consequences

- Project workflow preferences travel with the Project database.
- There is one settings document, one row, one Core validator, one read
  operation, and one full replacement operation.
- Individual SQL columns, patch interfaces, generic settings APIs, runtime
  compatibility readers, and adapter-local defaults are intentionally absent.
- Concurrency remains agent-owned scheduling of independent requests; this
  decision adds no durable queue, worker, retry system, or cross-process
  guarantee.
- Decision 0040 is superseded only for the policy source and defaults; its
  agent-external Codex/Engines boundary remains accepted.
- Decision 0043 is narrowed only for the extra conversational confirmation;
  its exact live-run estimate and approval-token integrity remains accepted.
