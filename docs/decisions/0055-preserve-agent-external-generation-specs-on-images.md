# Preserve Agent-External Generation Specs On Images

Date: 2026-07-17

Status: accepted

## Context

Codex can generate an image outside Renku Engines. The request previously lived
only in the Codex task, so opening Image Revision for the imported image could
not show the prompt, values, references, provider, or model that produced it.

## Decision

`GenerationSpec.executionKind` distinguishes `renku-managed` requests from
`agent-external` requests. Before Codex generates an image, the agent saves an
agent-external GenerationSpec containing the actual request and provider/model
identity. The accepted image is imported with that spec id.

The AssetFile stores the saved spec id. Image Revision loads that spec as
read-only context. Editing
the image still uses the existing Renku-managed `image.edit` workflow, with the
current image as its source and the normal Renku model and setting choices.

Agent-external specs do not create Renku runs, receipts, estimates, approval
tokens, costs, or provider payloads. Core does not hardcode a Codex model.

## Consequences

- The original Codex request remains inspectable from the image.
- Renku Engines remains responsible only for Renku-managed execution.
- External media with no saved request can still be imported without generation
  provenance.

This decision narrows Decisions `0040` and `0047`: an externally executed image
has no synthetic Renku run, but it may retain its real saved GenerationSpec.
