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
resource-refresh hook or module. ADR 0054 defines the string resource-key
vocabulary and the `surface:` and `navigation:` projection namespaces.
ADR 0031 defines the delivery boundary: the Studio server appends live
coordination events, and closed Studio sessions do not accumulate offline
resource-refresh backlogs.
Project Settings replacement uses the Core-owned `project-settings` resource
key; CLI and Studio server adapters forward the Core mutation report unchanged.
`studio.projectRefreshRequested` remains available for the narrower project
information and project library refresh cases.

Scene focus uses the current `narrative`, `beats`, and `shotPlans` tab
vocabulary. The Beats tab may carry `beatId`. The Shot Plans tab may carry a
Scene-owned `shotPlanId` and, beneath it, a plan-owned `shotId`. Core validates
both ownership relationships before the browser consumes the focus. The
collection and in-page detail use the same URL-backed selection; Back clears
only the nested plan and Shot focus.

Generation previews use `studio.generationPreviewsRequested`. This event opens or
updates the Generation Preview Dialog with an ordered array projected from
temporary review documents. Each entry retains the exact provider, model, media
kind, top-level prompt, opaque native request, recursively discovered local
references, and envelope diagnostics. The Studio server resolves those logical
references into protected browser URLs before appending the event.

Preview and Asset Inspection render the same request view. Preview alone allows
editing the top-level prompt; references and recursively presented configuration
remain read-only. Update and Close do not generate media or resume an agent. The
event is live UI coordination only: closed Studio sessions do not accumulate
preview backlogs, and project services must not treat preview events as
generation history or durable provenance.

Decision history:

- `../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `../decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
- `../decisions/0008-use-url-owned-studio-routes.md`
- `../decisions/0017-use-scalable-studio-resource-loading.md`
- `../decisions/0030-use-unified-studio-resource-refresh-components.md`
- `../decisions/0031-use-studio-server-owned-coordination-delivery.md`
- `../decisions/0054-use-string-resource-keys-for-studio-projection-invalidation.md`
- `../decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`
