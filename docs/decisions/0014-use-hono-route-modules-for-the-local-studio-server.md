# 0014 Use Hono Route Modules For The Local Studio Server

Date: 2026-05-12

Status: accepted

## Context

The browser Studio app talks to a local Studio HTTP server. That server needs
small, testable route modules for project data, coordination events, health
checks, and future local APIs.

Hand-written routing and mixed route ownership make it harder to test request
handling, structured errors, and future route typing.

## Decision

The local Studio server uses Hono route modules.

The root app composes resource route modules under `/studio-api`. Route modules
adapt HTTP requests to core services and serialize responses. They must not own
domain rules that belong in `studio-core`.

Current route ownership:

```text
/studio-api/health
/studio-api/projects
/studio-api/studio/events
```

Browser route ownership remains governed by ADR 0008. Hono routes provide data
and mutations; they do not infer browser screens from hidden current-project
state.

## Consequences

- Server behavior is easier to test by route module.
- Core remains the source of domain behavior.
- Structured diagnostics can be serialized consistently at the HTTP boundary.
- Future Hono RPC/client typing remains possible without reshaping the server.
