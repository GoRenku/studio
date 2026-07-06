# Studio Coordination Events

Date: 2026-05-12

Status: current

Role: topic overview

Studio coordination events connect the browser Studio UI, the `renku` CLI, and
agent workflows without turning UI state into durable project data.

The durable boundaries are:

- project SQLite owns project data;
- Studio coordination events own local UI coordination;
- browser URLs own routable Studio screens;
- core validates project references before coordination requests are accepted or
  applied.

The current event contract, event types, service shape, CLI flows, and browser
application rules are documented in
`docs/architecture/reference/studio-coordination-events.md`.

Resource-aware project mutations should use scoped
`studio.projectResourcesChanged` events from ADR 0017 instead of broad project
refreshes. ADR 0030 defines the uniform implementation shape: core owns the
resource-key catalog, CLI commands notify the running Studio server through one
resource-change notifier, Studio server mutation routes preserve returned
resource keys, and browser surfaces subscribe through one shared
resource-refresh hook or module. ADR 0031 defines the delivery boundary: the
Studio server appends live coordination events, and closed Studio sessions do
not accumulate offline resource-refresh backlogs.
`studio.projectRefreshRequested` remains available for the narrower project
information and project library refresh cases.

Generation previews use `studio.generationPreviewRequested`. This event opens or
updates the read-only Generation Preview Dialog with the exact prompt, model,
resolved references, provider preview data, typed configuration projection,
diagnostics, and prompt-sheet metadata that an agent is about to submit. The
CLI/agent request uses logical project references only; the Studio server
resolves those references into Studio-safe browser URLs before appending the
event.

`preview.configuration` is a Core-authored sectioned review projection. It
describes the model route, provider route, and effective parameter values that
Renku will send or deliberately leave to provider defaults. Studio renders that
projection as read-only UI and must not inspect `providerPreview.payload`, parse
provider schemas, or infer model-specific field support.

The user-facing dialog intentionally renders only the review surface users
need: prompt prose, resolved references, user-relevant configuration, footer
cost estimate when present, and diagnostics when Core reports them. Low-level
provider payloads and provider token order can remain in the event contract for
CLI, agent, and future developer tooling without being visible in the Studio
dialog. It is live UI coordination only: closed Studio sessions do not
accumulate preview backlogs, and project services must not treat preview events
as generation history.

Decision history:

- `../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `../decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
- `../decisions/0008-use-url-owned-studio-routes.md`
- `../decisions/0017-use-scalable-studio-resource-loading.md`
- `../decisions/0030-use-unified-studio-resource-refresh-components.md`
- `../decisions/0031-use-studio-server-owned-coordination-delivery.md`
