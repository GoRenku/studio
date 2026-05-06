# 0005 Use Latest-Only Save Queues for Autosave

Date: 2026-05-06

Status: accepted

## Context

Renku Studio editors save full project-facing records while people are still
typing and adjusting controls. These saves are asynchronous HTTP requests, and
network responses can finish in a different order than they started.

That creates a data-loss risk for autosave flows. For example:

- the title autosaves as `Draft A`;
- the user keeps typing and changes the title to `Draft B`;
- the `Draft B` request finishes first;
- the slower `Draft A` request finishes later and writes the older full payload
  back over the newer project information.

Debouncing reduces request volume, but it does not solve response ordering. A
version check in the React hook is also not enough if the stale save has already
performed server or UI side effects.

Renku Studio needs one reusable rule for all autosave and repeated manual-save
flows that write full records: the newest user intent must win, and older
in-flight requests must not be allowed to apply stale returned data after a
newer edit has been queued.

## Decision

Use a latest-only save queue for debounced autosave and equivalent repeated
save flows in `packages/studio`.

The shared save queue owns these rules:

- only one save request may run at a time for a single editor/save surface;
- if another save is requested while a save is in flight, keep only the newest
  pending value;
- discard intermediate pending values because full-record saves only need the
  latest complete value;
- after the current save settles, immediately save the newest pending value;
- report whether a completed save is still the latest known value;
- apply returned server data to UI state only when the completed save is latest.

React hooks may add input readiness checks, debounce timing, and status display
around the shared queue. They should not reimplement save ordering themselves.

Save callbacks should return the server result instead of applying it directly
when the result can update shared UI state. The queue or hook should apply that
result only after confirming the saved value is still latest. This keeps stale
responses from briefly or permanently overwriting newer local intent.

Use `createLatestOnlySaveQueue` as the default primitive for Studio autosave
coordination.

## Consequences

- Autosave behavior is consistent across Project Information and future editing
  panels.
- Future save flows should reuse the queue instead of adding local in-flight
  flags, ad hoc request counters, or per-component stale-response checks.
- Full-record autosaves are serialized. This may delay the newest save until an
  older in-flight request finishes, but it prevents older full payloads from
  landing after newer ones.
- Intermediate form states may never be sent to the server. This is intentional:
  autosave persists the latest complete editor state, not every keystroke.
- UI components that need returned server data should separate the network save
  from the UI application step. The save returns data; the latest-only queue
  decides whether the UI should consume it.
- If a future save operation supports cancellation or server-side revision
  checks, those mechanisms can be added underneath or alongside the queue. The
  user-facing contract remains that the latest edit wins.
