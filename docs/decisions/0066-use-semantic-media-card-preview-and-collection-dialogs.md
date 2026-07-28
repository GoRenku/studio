# 0066: Use Semantic MediaCard Preview And Collection Dialogs

Date: 2026-07-28

Status: accepted

## Context

Studio already had one shared `MediaCard` and one shared large still-image
viewer, but each image-card feature repeated preview state, viewer wiring, and
focus restoration. Shot image candidates and Reference Picker also repeated
the same Dialog and card-grid anatomy while intentionally using different
frames.

The Shot rail adds a more precise interaction boundary. Activating a rail card
must select the Shot, while its separate image action opens the Shot-image
flow. Candidate-card activation previews an image, and a separate choose
control changes canonical selection.

A generic modal or caller-configurable card action would erase these
boundaries. The shared layer needs semantic, bounded choices while feature
containers retain product data and mutations.

## Decision

`MediaCardActivation` is a discriminated union:

- `callback` invokes caller-owned navigation or product behavior;
- `image-preview` opens the existing shared `ImagePreviewDialog`;
- omitted activation renders no whole-card control.

The MediaCard module owns the activation control, image-preview open state,
viewer composition, and exact-trigger focus return. Selection, corner, and
delete actions remain sibling controls above whole-card activation.

`src/ui/media-card` also owns `MediaCardCollectionDialog`. It accepts ordered,
prepared MediaCard items and bounded loading, error/retry, empty, and ready
states. Its presentation is either:

- `flush`, preserving the Shot-candidate Dialog frame; or
- `inset`, preserving the Reference Picker frame.

The collection Dialog accepts no children, arbitrary action nodes, class-name
overrides, domain objects, fetching, or mutations.

Feature containers continue to own data loading, ordering, labels, and
behavior. In particular:

- Shot rail card activation selects only the Shot;
- when candidates exist, the rail image action opens the exact Shot-image flow;
- zero ready Shot images leave the rail placeholder without an image action or
  Dialog;
- one ready image opens the shared viewer directly without selection;
- multiple ready images open the flush collection Dialog;
- candidate preview and canonical choose remain separate actions;
- Reference Picker uses the inset collection and callback activation.

## Consequences

- Included image-card galleries share one preview mechanism and remove
  duplicate viewer state.
- Shot and Reference Picker share collection anatomy without being visually
  normalized.
- The shared UI layer remains domain-neutral and cannot mutate canonical
  selection.
- A future activation or collection presentation requires a deliberate
  contract decision rather than an arbitrary callback or styling escape hatch.
