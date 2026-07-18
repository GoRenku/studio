# Freeze Generation Specs At Live Execution

Date: 2026-07-18

Status: accepted

## Context

A saved generation request remained editable while a managed provider or Codex
was executing it. The durable request linked to an output could therefore differ
from the exact revision submitted for execution.

## Decision

A saved GenerationSpec record is a mutable draft until live execution begins.
Live submission permanently sets `frozen_at` on the exact saved revision.
Renku-managed execution freezes automatically immediately before calling
Engines. Agent-external execution uses `generation spec freeze` immediately
before invoking the external tool.

Estimate and simulation do not freeze. A failed live request remains frozen and
may be retried unchanged. Any changed request must be saved as a new ordinary
GenerationSpec. There is no unfreeze, clone, fork, or compatibility command.

Agent-external attachment requires a frozen same-purpose, same-target source
spec. Managed runs keep their immutable per-run spec snapshot. External images
continue to link directly to the frozen spec without a synthetic run, receipt,
estimate, or second snapshot.

Core owns one durable envelope validator used by create, update, validate, and
freeze. Arbitrary external values remain JSON-safe opaque data; this decision
adds no secret, path, URL, provider, or creative-content heuristics.

## Consequences

- Preview can edit saved drafts and renders frozen saved requests read-only.
- A live provider failure cannot reopen or mutate the submitted request.
- Image Revision receives a focused request projection with model, authored
  values, and meaningful Asset-title reference labels, never raw identifiers or
  paths.
- Decision `0055` remains valid but its source spec is now frozen before Codex
  execution and attachment.
