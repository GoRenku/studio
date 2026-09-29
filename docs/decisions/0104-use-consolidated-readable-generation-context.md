# 0104 Use Consolidated Readable Generation Context

Date: 2026-09-29

Status: accepted

## Context

Generation briefings repeated complete Assets across subject, Shot, Lookbook,
voice and candidate positions. Agents also spent calls and code extracting
sections from JSON solely to read them. Reducing creative context by purpose
would risk losing information needed by a particular request.

## Decision

Core returns one complete provenance-free Asset inventory. Relationships refer
to exact Asset and File identities while retaining membership, role, order,
availability, selection and dialogue range. Full designs and their identity,
current creative documents, alternative media and opaque voice identity remain.
Target Lookbooks and Shots occur once in their containing context.

The existing CLI context command renders this report as labeled readable text
by default. Explicit `--json` returns the structured report. Both presentations
derive from one Core read; the CLI owns no context selection or creative rules.
Skills choose based on the next operation: text for direct reading, JSON for
programmatic consumption or explicit user preference. Relevant state and scope
changes justify fresh reads.

The shared Scene Beat visual-reference consumer exposes its own `assets`
inventory alongside those relationships. Full domain resources, storage,
generation execution, Preview, Inspector and authorization are unchanged.

## Consequences

JSON consumers and distributed Skills must be delivered with the updated Studio
contract. They resolve identities through the inventory. Readable text is not a
stable parsing API. Core reports inconsistent projections through a structured
diagnostic rather than silently selecting one conflicting Asset representation.

No purpose-based creative context pruning is introduced. Payload measurements
and behavioral evaluation limits are recorded in
[CLI Performance](../architecture/cli-performance.md).
