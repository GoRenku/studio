# 0126 Guide Empty States With Agent Requests

Date: 2026-10-22

Status: accepted

Applies [ADR 0041](0041-keep-ai-artifacts-and-prompts-opaque.md) and
[ADR 0023](0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md).
Implemented by plan 0241.

## Context

Almost everything in a Renku Studio project is made by asking the user's
agent (Claude or Codex), but Studio never said so. A new project showed
blank grids, "nothing yet" messages that led nowhere, and tabs that only
appeared once their data existed. The Cast Member Arc tab was the clearest
case: it stayed hidden until a screenplay analysis wrote an arc.

A design study on 2026-10-22 audited 25 such places. The user chose a quiet
request pattern everywhere, a faint preview on two visual pages, and a
project-level path of production steps.

## Decision

- **One empty-state pattern.**
  - Every page-level empty state uses `PanelEmptyState` (`src/ui`). It shows
    a title, one plain sentence, and one primary `AgentRequest`: a request in
    the user's voice with a Copy button. It may add up to two quieter
    requests.
  - Pages that already have content use a single `AgentRequestHint` instead
    of a full empty state.
- **Requests are interface copy.**
  - Every request lives in
    `packages/studio/src/features/movie-studio/agent-request-copy.ts`.
  - Requests are filled in with names the page already shows, such as a
    scene heading or a Cast Member's name. `[Bracketed]` words mark what the
    user should edit.
  - Studio never sends, parses or checks a request.
  - Requests never name skills, CLI commands, providers or models.
- **Previews are decoration.** Screenplay Analysis and Scene Beats draw a
  faint outline of the filled page behind the request. The outline reads no
  analysis or beat data.
- **The Production Path is a core read model.**
  - `readProductionPathResource` in `packages/core` reports eight production
    steps, from screenplay to video takes. For each step it gives a status
    (`notStarted`, `started` or `complete`), optional progress, and the next
    step that is not complete.
  - It shares its readiness checks with the director context in
    `production-readiness/`.
  - The Project Details Overview tab only presents it.
- **Missing work is visible.**
  - The Arc tab always shows. `CastMemberCharacterArcSummary` reports
    `notWritten` with whether the screenplay is analyzed, so the tab can ask
    for the right request.
  - Tabs whose content has not been made yet may show a small hollow dot
    (`LineTabsItem.pending`).

## Consequences

- A new empty surface adds its request to `agent-request-copy.ts` and
  renders `PanelEmptyState`; it does not invent its own layout.
- A rule about which step is done or next belongs in
  `packages/core/src/server/production-path/stages/`, never in React.
- Plan 0240's rule that the Arc tab appears only when an arc exists is
  replaced.
