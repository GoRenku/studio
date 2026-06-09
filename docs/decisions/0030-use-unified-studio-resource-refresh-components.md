# 0030 Use Unified Studio Resource Refresh Components

Date: 2026-06-09

Status: accepted

## Context

ADR 0006 established that project SQLite owns durable project data and Studio
coordination events own local UI coordination. ADR 0017 established scoped
resource invalidation through `studio.projectResourcesChanged` events after
durable mutations.

That direction is still correct, but the implementation has drifted across
feature areas:

- some CLI commands mutate project data and return resource keys but do not
  append a Studio resource-change event;
- some Studio server routes receive resource keys from core and discard them
  before returning a browser mutation response;
- some browser surfaces subscribe to `renku:studio-resource-changed` directly,
  while others rely on incidental parent reloads or local revision counters;
- resource-key strings are still assembled as ad hoc literals in multiple
  package boundaries.

The visible symptom is that Studio can stay stale after Renku CLI changes until
the user refreshes the browser. Cast Voice attachment and removal are concrete
examples: the CLI writes durable Cast Voice data, but the open Cast Member
surface does not always hear a resource-change signal.

Renku Studio needs a uniform resource-refresh architecture, not a set of
feature-specific notification systems.

## Decision

Studio resource refresh is one cross-package system with package-owned
components. Feature areas must use these components instead of inventing their
own event detail types, resource-key literals, append helpers, local revision
systems, or browser event listeners.

The accepted components are:

- core resource-key catalog:
  `packages/core/src/server/studio-coordination/resource-keys.ts`;
- core mutation reports for visible durable mutations, carrying project
  identity and resource keys;
- CLI resource-change appender:
  `packages/cli/src/commands/studio-resource-event-command.ts`;
- Studio server mutation responses that preserve resource keys returned by
  core;
- browser resource-refresh hook and matcher module under
  `packages/studio/src/hooks`.

### Core

Core owns the resource-key vocabulary.

Resource keys are invalidation contracts, not domain events. They describe the
visible resource that may be stale, such as a Cast Member surface, location
navigation page, Lookbook, Scene Shot List, or project shell. They do not
describe the mutation action that happened.

Core mutation functions that change visible project data should return a
project-aware mutation report with `resourceKeys`. Callers should not recreate
those keys from local knowledge at the CLI, server, or browser boundary.

If a current key name is too vague, rename the key and update all callers
directly. Do not keep compatibility aliases.

### CLI

After a successful durable mutation, CLI commands append
`studio.projectResourcesChanged` through the single CLI appender.

The CLI appender is the CLI boundary for local Studio refresh coordination. It
does not own the resource-key vocabulary and does not infer feature-specific
keys. It receives project identity and resource keys from the mutation result.

The CLI appends resource-change events only after successful durable mutations.
It does not append for read-only, validation-only, preflight, estimate, list,
show, or dry-run commands.

If appending the coordination event fails after the durable mutation succeeds,
the command should keep the durable mutation successful and report a structured
warning. The warning should tell the user that an open Studio browser may need
manual refresh.

### Studio Server

Studio server mutation routes preserve resource keys returned by core mutation
reports.

Browser-initiated mutations do not need to wait for their own coordination
event to update local state, but route responses must still expose the same
resource invalidation contract so sibling surfaces and shared services can
react consistently.

Route response contracts stay explicit and route-specific. Do not hide all
mutation responses behind a generic facade just to carry `resourceKeys`.

### Browser

The browser owns one shared resource-refresh hook and matcher module.

That shared module owns:

- the `renku:studio-resource-changed` event detail type;
- project filtering;
- resource-key matching helpers;
- event listener setup and cleanup.

Feature panels, app shell code, and navigation hooks own the actual resource
reloads for their surfaces. They provide the shared refresh system with the
current project, the resource keys or matcher they own, and the callback that
reloads the visible resource.

Feature code must not define local copies of the resource-change event detail
type. Feature code must not attach raw
`window.addEventListener('renku:studio-resource-changed', ...)` listeners.
Feature code must not invent resource-key strings that should come from the
core catalog.

The browser refresh system is not a global project-data store. It coordinates
resource invalidation and lets each owner reload from its normal Studio API.

### Project Shell And Navigation

Project shell, project library, and screenplay navigation are first-class
resource owners.

They participate in the same browser refresh system as detail panels. Shell and
navigation code should refresh only the data it owns, such as project
information, cast navigation, location navigation, act lists, sequence pages, or
scene pages.

Do not use a broad project reload for every scene, asset, shot-list, or design
resource change.

## Consequences

- New visible resources must add their key builders to the core catalog.
- New durable mutations for visible resources must return resource keys from
  core.
- New CLI mutation handlers must use the shared CLI resource-change appender
  when their mutation result includes resource keys.
- New Studio server mutation routes must preserve returned resource keys.
- New browser surfaces must subscribe through the shared resource-refresh hook
  or module.
- Existing local browser revision counters should be removed where resource
  keys now provide the freshness contract.
- Focus requests remain separate from resource refresh requests.
- Coordination events remain UI coordination, not project history or domain
  audit data.

The system adds some explicit ceremony when new surfaces are created, but it
keeps refresh behavior reviewable and prevents stale UI bugs from returning
feature by feature.

## Verification Rules

The implementation should include architecture or static tests that make this
decision enforceable:

- direct `renku:studio-resource-changed` listeners are allowed only in the
  shared browser refresh module and focused tests;
- browser feature code does not define its own
  `StudioResourceChangedDetail`;
- resource-key literals outside the accepted core catalog, tests, and focused
  matcher code are rejected or explicitly reviewed;
- CLI mutations that return non-empty resource keys append exactly one
  `studio.projectResourcesChanged` event after successful mutation;
- CLI dry-run, read-only, validation-only, estimate, preflight, list, and show
  commands do not append resource-change events;
- Studio server routes that mutate visible resources return resource keys;
- visible browser resources have an owner that subscribes through the shared
  refresh system.

## Related Decisions

- `0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `0017-use-scalable-studio-resource-loading.md`
- `0026-use-thin-structured-cli-command-handlers.md`
