# 0043 Use Explicit Live Provider Run Approval

Date: 2026-07-04

Status: accepted

## Context

Renku Studio needs a cost approval guard so agents, CLI commands, and Studio
actions do not start live paid provider generation without the user seeing and
approving the relevant cost.

This guard must stay separate from dependency planning. Dependency plans are
human and agent to-do lists. They help users understand which generated inputs
are still needed, what can be reused, what must be imported, and what the likely
full workflow cost is. They are not automatic execution graphs.

The cost rail may estimate a full dependency to-do list. The execution rail runs
one generation at a time.

## Decision

Use explicit live provider approval for one live generation command or browser
action.

Estimates are display-only. A persisted-spec estimate returns cost state, but no
approval artifact, request digest, or reusable run permission. A live run of a
spec requires caller intent immediately before provider execution:
`approveLiveProviderRun: true` in Core service input or
`--approve-live-provider-run` in the CLI.

That approval means the user approved this one live provider request attempt for
the current prepared generation request Core is about to send. Core enforces the
approval gate immediately before provider execution. The resulting durable
`media_generation_run` row records the run facts themselves, including provider,
model, spec snapshot, provider payload, estimate snapshot, simulation flag,
status, outputs, diagnostics, and timestamps. It does not store a separate
approval marker.

If an agent or UI changes the prompt, model, parameters, selected inputs, or
prepared provider request after preview/estimate review, the changed request
must be reviewed again and needs a fresh live-run approval gesture before
another provider call.

Full dependency estimates remain allowed and expected. A dependency plan may
walk the full to-do list, estimate every generated dependency line, estimate the
root generation line, and show an aggregate total. Those line estimates are
planning information only. Parent plans must not expose approval artifacts for child
dependency lines and must not produce approval bundles.

`packages/core` owns Studio's approval decision. Studio server handlers, CLI
handlers, React components, and agents pass approval intent to core; they do not
enforce the approval policy themselves.

`packages/engines` does not own Studio approval matching. Engine generation
running owns provider execution, provider payload validation, input file loading,
simulated fallback generation, live provider invocation, output persistence, and
receipts. Engine cost estimation remains available as the pricing API used by
core cost projections, but engine live execution must not rediscover Studio
approval validity by hashing provider payload details.

Mechanical provider setup does not require user cost approval. For example,
Kling transient `kling-video/create-voice` creates a short-lived provider
`voice_id` needed by a final Kling video request. That setup should run
automatically when needed, use its cache when possible, and fail clearly when the
provider setup fails. It must not require a second user approval gesture and must
not create a reusable approval artifact.

## Consequences

- Estimates can be broad; approvals are narrow.
- Dependency inventory remains a to-do list, not an execution plan.
- A parent estimate can include dependency costs, but a parent run cannot
  generate missing dependencies.
- Approval artifacts are not graph artifacts.
- Approval is caller intent for one live provider request, not a reusable value.
- The core approval gate must not walk dependency plans.
- The engine runner must not reject a core-approved run because it reconstructed
  slightly different pricing inputs from provider payload shape.
- Provider setup such as Kling transient voice ids is part of the final provider
  handoff, not a separate approved generation step.

## Limit

The live-provider approval flag protects Renku Studio generation surfaces. It is
not a sandbox against arbitrary code that has direct access to provider
credentials. Direct provider credential access must be controlled by tool and
credential policy, not by media generation dependency planning.
