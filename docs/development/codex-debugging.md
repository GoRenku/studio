# Codex Debugging Workflow

Status: current

This workflow keeps Codex attached to the user's existing Studio dev server
instead of starting extra Vite servers.

## Canonical Dev Server

The canonical Studio development URL is:

```text
http://localhost:5173
```

Studio dev mode is configured for `localhost`, port `5173`, and `strictPort`.
If that port is already in use, a second dev server must fail instead of moving
to `5174`, `5175`, or another auto-incremented port.

When the canonical `localhost:5173` server starts, it may replace a fresh
runtime descriptor that points at a non-canonical dev server such as
`127.0.0.1:5174`. This lets the canonical server recover from older duplicate
dev servers. It must still fail when another fresh canonical `localhost:5173`
descriptor already exists.

A descriptor is considered fresh for agent attach purposes only when its
heartbeat is current and the recorded server process is still alive. A recent
descriptor left behind by Ctrl-C or a crashed process must not block the next
canonical `localhost:5173` start.

## Agent Attach Check

Before browser debugging, run:

```bash
renku studio server status --json
```

Use the server only when:

- `server.descriptor.present` is `true`;
- `server.descriptor.fresh` is `true`;
- `server.descriptor.matchesCanonical` is `true`;
- `server.canonicalUrl` is `http://localhost:5173`.

If the descriptor is missing, stale, or non-canonical, report that state to the
user. Do not run `pnpm dev:studio` from Codex unless the user explicitly changes
the attach-only policy for that task.

## Browser Debugging

Use the in-app Browser against:

```text
http://localhost:5173
```

Browser access is mandatory when the Browser plugin or Browser skill is present
in the session. Do not treat a missing direct browser tool from tool discovery
as Browser unavailability. In that case, read the Browser skill and connect
through its documented browser-client bootstrap before attempting any fallback.

Use local Playwright only when the Browser plugin/skill is genuinely absent, or
when the documented Browser bootstrap fails. If a fallback is used, record the
specific Browser access failure in the work notes or final verification.

For Codex's own test tab, treat Browser evidence as the source of truth:

- current URL and title;
- DOM snapshot;
- console errors and warnings;
- screenshot when visual state matters;
- scoped interaction proof for the tested workflow.

`renku studio current --json` reports the user's active Studio context. It is
useful for understanding what the user is working on, but it may not describe
Codex's own browser test tab when multiple Studio tabs are active.

## API Access

Protected Studio API mutations require the page-injected Studio API token. Codex
must not scrape or expose that token.

Use this split instead:

- use CLI/core commands for domain mutations;
- use Browser interactions for UI-protected flows;
- use unprotected `GET /studio-api/...` routes only for read-only inspection.

The runtime descriptor may expose whether a CLI notification token exists, but
status output must never print token values.

## Logs

Studio dev-server lifecycle diagnostics are written to:

```text
tmp/studio-dev-server.log
```

This file is ignored by git. It may contain server lifecycle messages such as
start, listen, descriptor claim failure, heartbeat failure, release failure, and
close events. It must not contain runtime API tokens.
