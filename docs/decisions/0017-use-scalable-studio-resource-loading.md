# 0017 Use Scalable Studio Resource Loading

Date: 2026-05-13

Status: accepted

## Context

ADR 0016 accepted active project SQLite sessions and eager surface data for
Studio performance. Active SQLite sessions remain the right direction because
they avoid repeatedly opening and validating the project database during normal
local editing.

The eager project-wide browser payload is no longer accepted. A large movie or
series can contain hundreds of clips, many takes per clip, thousands of images,
and many rich text files. Loading all of that as one project JSON document makes
project open time and mutation refreshes grow with the whole project instead of
with the visible work surface.

## Decision

Studio opens a project by loading a bounded project shell, then loads selected
surface resources lazily.

The shell includes identity, cover metadata, counts, languages, first navigation
pages, and route shell data. It does not include all cast assets, all clip
assets, all generated takes, or all Markdown file contents.

Large collections use explicit page contracts. Navigation pages and asset pages
use opaque cursors, and stale loaded data remains visible while visible
resources revalidate in the background.

Series and standalone movies stay distinct. Series projects use episode
navigation and episode-owned sequence pages. Standalone movies use top-level
sequence navigation and do not get a synthetic episode container.

Studio, CLI, and agent-facing mutations should emit scoped
`studio.projectResourcesChanged` coordination events after durable SQLite
mutation succeeds. Resource keys identify the visible UI resources that should
be invalidated, such as `project-shell`, `navigation:cast`, or
`surface:cast-design:<castMemberId>`.

No separate resource revision table or competing freshness hash model is part of
this decision. If the UI later needs hash verification, it should reuse the
existing asset content hash and production export hash vocabulary where that
fits.

## Consequences

- ADR 0016 remains accepted for active project SQLite sessions.
- ADR 0016 is superseded for project-wide eager surface data.
- Browser update routes must not return full project snapshots as convenience
  refresh payloads.
- New Studio surfaces should define selected resource contracts and paginated
  child resources instead of adding fields to the project shell.
- Resource invalidation should be scoped and tested; broad project refreshes are
  reserved for operations that truly affect the shell.
