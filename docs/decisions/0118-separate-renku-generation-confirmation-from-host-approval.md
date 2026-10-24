# 0118 Separate Renku Generation Confirmation From Host Approval

Date: 2026-10-12

Status: accepted

Status: accepted

[ADR 0127](0127-cast-looks-costumes-and-casting-rounds.md) makes a consumed
Casting Round Generate the confirmation for every candidate in that round.

Updates [ADR 0105](0105-select-generation-review-by-preference-and-host-capability.md)
and [ADR 0106](0106-install-codex-plugin-and-route-generation-review.md).

## Context

The image edit and dialogue direction panels skipped the combined review, and
their Generate message claimed to be the user's approval. Codex wraps panel
messages as untrusted input, so its approvals reviewer refused that claim. The
underlying escalation came from CLI writes outside the permission profile
([ADR 0116](0116-publish-the-skill-default-model-list-to-the-renku-state-directory.md)).

## Decision

- Every generation follows the same stages: target, route choice, authoring,
  review and execution. Execution, import and reporting always stay with the
  agent; no MCP tool executes generation.
- "Ask Before Generating" is Renku's confirmation. When it is on, Codex opens
  the combined review panel with prompt, references, settings and the
  estimate; other harnesses use Studio Generation Preview, or text when Studio
  is not running. A consumed Submit, or Ask off, confirms the generation.
- The review panel offers "Generate without asking next time"; the server
  applies it to the lane only with Submit.
- Purpose desk Generate is an authoring step. Its conversation message is a
  neutral notice naming the session and action; it carries no approval.
- Host approval is a separate layer Renku does not control. When the host
  still asks, the agent requests approval once with an honest description; if
  refused, it asks the user once in chat. Skills never quote panel text as
  authorization, never retry around a denial and never coach the reviewer.
- The global `codexGenerationReview` preference, its `CONFIG015` diagnostic
  and the Visualize path are removed
  ([ADR 0091](0091-cache-generation-configuration-visualizations-for-24-hours.md)
  is superseded). `codexGenerationReviewDisplayMode` stays.

## Consequences

- Under the recommended permission profile, Renku generation commands stay
  inside the sandbox and the approvals reviewer never runs.
- Turning off both interruptions for a lane gives uninterrupted generation.
