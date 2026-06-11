# 0006 Use SQLite for Project Data and Studio Events for UI Coordination

Date: 2026-05-07

Status: accepted

Updated by:

- `0031-use-studio-server-owned-coordination-delivery.md`

## Context

Renku Studio has two kinds of state that are easy to confuse:

- durable project data, such as project information, cast members, sequences,
  scenes, clips, pins, bindings, generated asset records, and costs;
- local UI coordination state, such as what Studio is currently showing, what an
  agent asked Studio to focus, and whether Studio should refresh project-facing
  UI after a command already changed project data.

Both kinds of state need to be readable by local tools. The browser Studio UI,
the `renku` CLI, and agents all need a shared local coordination mechanism.
However, making one event log own everything would blur the data model and make
it unclear which store is authoritative.

Renku Studio is local-first and pre-customer, but it still needs a hard boundary
so future features do not accidentally turn UI coordination events into a shadow
project database.

## Decision

Use project-local SQLite as the source of truth for durable project data.

Use the local Studio coordination event store only for UI coordination:

- focus requests from CLI, agents, or integrations;
- applied focus observations from Studio;
- browser session activity used to decide current UI focus;
- UI refresh requests after project data was already changed in SQLite;
- failed or rejected focus requests;
- agent-readable current Studio context derived from live UI focus and project
  data.

The Studio coordination event store is not a durable project history log.

Coordination events may include references to project records and small refresh
hints, such as changed field names, but those values are UI coordination hints.
They must not be used as the durable record of what changed.

The boundary is:

```text
project SQLite
  -> durable project metadata and relationships
  -> generation history, pins, bindings, costs, assets, and project facts

Studio coordination event store
  -> current Studio focus
  -> focus requests and failures
  -> browser session activity
  -> UI refresh requests
  -> agent-readable local UI context
```

## Boundary Rules

- Do not add `project.*`, `cast.*`, `clip.*`, or other domain-event namespaces to
  the Studio coordination event store.
- Coordination events should use the `studio.` namespace and describe UI
  coordination facts or requests.
- Do not store before/after project values in coordination events.
- Do not rebuild project metadata, project history, generation history, pins,
  bindings, costs, assets, or relationships from the coordination event store.
- Project data services must not consume the coordination event store as an input
  to domain reads or writes.
- CLI commands that mutate SQLite may notify the running Studio server after
  success so the server can append live coordination events. The SQLite mutation
  remains authoritative.
- If Studio appears to be running and live notification fails after a SQLite
  mutation succeeds, report the partial coordination failure clearly; do not
  imply the durable mutation was rolled back. Missing or stale Studio runtimes
  are normal no-ops for resource-refresh hints.
- Adding a new coordination event type must include a short explanation of why it
  is UI coordination state rather than durable project state.

## Consequences

- Project reads remain deterministic and come from project SQLite.
- Agents can ask Studio what the user is currently looking at without turning UI
  focus into durable project metadata.
- A stopped Studio session does not provide actionable current UI focus; agents
  must ask the user for missing context instead of using historical focus as a
  guess.
- UI refresh events can be safely compacted or ignored without losing project
  data.
- The coordination event store can fail or contain malformed historical lines
  without corrupting project data.
- Future features must choose explicitly whether new state is durable project
  data or local UI coordination before choosing a store.

## Regression Checks

Use tests and review checks to keep this boundary clear:

- project data reads should still pass when the coordination event store is empty
  or malformed;
- coordination projections should not treat event payloads as project records;
- new coordination event types should use `studio.` names;
- SQLite mutation tests should cover partial event-append failure when commands
  also request UI refresh or focus;
- architecture reviews should reject event-store changes that recreate durable
  project tables, audit logs, or project-history behavior.
