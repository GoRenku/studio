# 0054 Use String Resource Keys For Studio Projection Invalidation

Status: accepted
Date: 2026-07-17

## Context

Studio coordinates live browser refreshes after Core mutates project data.
Mutation reports and `studio.projectResourcesChanged` events carry
`resourceKeys`, and the browser reloads the current projections that match those
keys.

The resource-key vocabulary has drifted. Some mutations emit keys for proposed
cache units that do not exist, while other mutations emit abbreviated domain
strings that no browser projection consumes. This makes successful durable
attachments remain invisible until the browser is refreshed.

The coordination contract needs one current naming rule and a strict test for
whether a resource key should exist at all.

## Decision

Studio resource keys remain strings.

The key crosses four boundaries unchanged: a Core mutation report, a CLI or
Studio server adapter, the server coordination event log, and the browser
refresh matcher. Those boundaries need a serializable projection address and
perform equality or namespace-aware matching; they do not exchange additional
resource behavior. A structured key object would add another schema plus
adapter translations without changing how any current reload owner works.
Central Core builders and exact contract tests provide the compile-time and
runtime control needed for the string vocabulary.

Core owns their construction in
`packages/core/src/server/studio-coordination/resource-keys.ts`. Core mutation
reports carry the resulting `resourceKeys`. CLI and Studio server adapters
forward those values without deriving feature keys. Browser matching remains in
the shared Studio resource-refresh module.

Resource keys identify browser-owned projection dependencies. They are not
domain events, Asset owner ids, cache records, or durable project history.

The current projection namespaces are:

- `surface:<resource>[:<id>...]` for a selected detail, editor, or workspace
  projection;
- `navigation:<resource>[:<id>...]` for a collection or navigation projection.

The namespace remains part of the key because a domain concept can have both a
collection projection and selected-owner data with different invalidation
scope. `navigation:cast` means Cast collection membership, ordering, or labels
changed. `surface:castMember:<id>` means the data shown for one Cast Member
changed. The Cast Member panel consumes the latter directly, and a Cast
overview may also consume it when one of its cards projects that member's data.
Keeping the namespace in the address prevents a mutation from looking like an
unqualified domain event and states what kind of projection data changed.

Application-level singleton resources retain deliberate standalone names such
as `project-shell`, `project-information`, `project-library`, `screenplay`, and
`trash:list`. Each already names one globally distinct application projection;
adding `surface:` or `navigation:` would not disambiguate its scope.

A resource key is valid only when all of the following exist:

1. a current browser projection dependency represented by that key;
2. a shared browser matcher for a projection that consumes that dependency;
3. a Core mutation that can make that dependency stale.

A mutation returns more than one key only when it makes more than one current
projection stale. A namespace or precise-sounding name is not sufficient reason
to add a key.

### Attachment invalidation

The current attachment contract is:

| Durable attachment owner | Resource key |
| --- | --- |
| Cast Member | `surface:castMember:<castMemberId>` |
| Location | `surface:location:<locationId>` |
| Lookbook | `surface:visual-language:lookbook:<lookbookId>` |
| Scene Beat storyboard | `surface:scene:<sceneId>:beats` |
| Scene Dialogue Audio | `surface:scene:<sceneId>:dialogue-audio` |

Cast and Location Assets tabs are part of their owner surfaces. They load and
refresh with the same owner projection, so they do not have separate
`assets:*` resource keys.

Studio has no other current generic Assets projection. The current resource-key
vocabulary therefore contains no `assets:*` keys.

The general Lookbook collection key is reserved for mutations that change the
Lookbook collection or identity. Attaching media to an existing Lookbook
invalidates only that exact Lookbook surface.

Generic project, Sequence, and Scene Asset targets do not emit target-wide
asset keys because Studio has no corresponding generic asset projection.
Purpose-owned mutations such as Scene Beat storyboard attachment use their exact
current surface key.

### Current surface scope

`surface:castMember:<id>` and `surface:location:<id>` are current projection
addresses. Their panels own both the detail projection and Assets tab data.

`surface:castDesign:<id>` and `surface:locationDesign:<id>` are not independent
reload owners. Cast and Location design-document mutations invalidate their
Cast Member or Location owner surface. The separate design surface keys and the
unused Cast Design browser resource path are removed.

### Contract changes

Key changes update every producer and consumer directly. Studio does not keep
aliases, legacy matchers, fallback project refreshes, or dual-key emission.

Tests may assert exact key strings because those strings are the accepted
cross-package coordination contract. Architecture tests must not inventory
private helper names or internal command implementations.

## Consequences

- One string-key contract coordinates Core, CLI, Studio server, and browser
  refresh behavior.
- `surface:` and `navigation:` state which projection-data class changed.
- Attachment reports carry one exact owner-surface key.
- Proposed cache units and nonexistent browser projections do not receive
  resource keys.
- Core remains the only feature-aware key producer.
- Browser features continue to reload authoritative project data through their
  existing APIs.
- Resource-key naming changes are direct contract changes with no compatibility
  layer.

## Updates

This decision narrows the resource-key naming and ownership rules in:

- `0017-use-scalable-studio-resource-loading.md`;
- `0030-use-unified-studio-resource-refresh-components.md`.

The Studio server delivery boundary from
`0031-use-studio-server-owned-coordination-delivery.md` remains unchanged.
