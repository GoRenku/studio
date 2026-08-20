# 0083 Use Project-Owned Cover Assets And Conversation-Directed Generation

Date: 2026-08-19

Status: accepted

## Context

Project Library and Studio sidebar imagery previously came from one special
root-level `cover.png` named by `project.cover_file`. That contract had no
candidate history, no canonical selection, no focused generation attachment,
and a special HTTP path outside ordinary Asset File delivery.

Cover generation also needs creative context, but sending every Project fact
and image to an agent would obscure the user's direction and duplicate
request-planning policy in runtime context.

## Decision

A Project Cover is an ordinary Project-owned image Asset with type
`project_cover`, one active primary image Asset File, and an optional canonical
selection at target `{ kind: "project" }`. The selected Asset File supplies the
compact `Project.coverImage` identity used by Project and Project Library
projections. Studio builds its display URL through the generic Asset File
route.

The focused `project.cover` generation purpose fixes 16:9 for the current
Project Library/sidebar surface, recommends medium quality and Nano Banana 2
for managed generation, and attaches accepted outputs beneath `covers/`.
Generated files use `cover-gxxx.<ext>`; external imports retain a normalized
source basename under the common storage convention.

Generation Context remains intentionally small and exposes no automatic
reference-guide sections. Media Producer starts from the conversation, then
reads only missing Project Info and exact relevant Production Lookbook, Cast,
Location, Prop, Scene, or analysis context. The Storyboard Lookbook is read
only for an explicitly storyboard-like direction. Prompts, reference choices,
and generated pixels remain opaque to Studio runtime validation.

Core validates the ownership, exact Asset type, availability, and exactly one
active primary image before changing selection. Discarding a selected cover
clears selection atomically. Restoring the Asset restores only the candidate;
it does not silently select it again.

The root `cover.png`, `project.cover_file`, filesystem resolver, special cover
HTTP route, and create-YAML cover input are removed in the same cutover. There
is no compatibility reader, fallback, duplicate field, or synchronization
write.

## Consequences

- Projects retain multiple cover candidates while selecting at most one.
- Project Details adds a lazy Covers gallery using the existing MediaCard
  preview, selection, and Trash interactions.
- Candidate-only changes refresh the Covers surface; selection changes also
  refresh Project shell and Project Library projections.
- schema generation 64 drops `project.cover_file` through migration 0079,
  whose precondition aborts when a legacy value is non-null rather than
  discarding it.
- Generic `image.create`, Project Info/Settings, Project Library/sidebar card
  anatomy, Trash behavior, and non-cover media workflows remain unchanged.
