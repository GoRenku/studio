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

Decision history:

- `../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `../decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
- `../decisions/0008-use-url-owned-studio-routes.md`
