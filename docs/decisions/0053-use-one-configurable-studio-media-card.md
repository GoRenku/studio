# 0053 Use One Configurable Studio Media Card

Status: accepted
Date: 2026-07-16

Notice: Decision [0058](0058-make-studio-image-editing-agent-owned.md)
supersedes this decision's Image Revision and Edit-action clauses.

## Context

Studio visual media cards had grown into several independent implementations.
They repeated image and video rendering, selection controls, delete controls,
card activation, grids, and styling. Small inconsistencies then appeared,
including selection in different corners and competing delete treatments.

A generic “card that can render anything” would remove duplication but create a
new unbounded UI framework. Studio needs one implementation for its current
visual-card use cases, not arbitrary render slots.

## Decision

`packages/studio/src/ui/media-card` is the single implementation for these
visual-card surfaces:

- Cast and Location overview cards and asset galleries;
- Inspiration folders and grabs;
- Production and Storyboard Lookbook evidence, hero, and assets;
- Scene, Act, and Sequence storyboard cards;
- Project Library cards;
- Generation Preview and Image Revision reference cards;
- Reference Picker candidates;
- Shot Design Composition and Motion options.

The following are presentation media, not cards, and remain outside the module:

- Cast and Location detail feature images;
- the Studio sidebar cover and logo;
- preview-dialog media;
- standalone video players;
- tooltip portraits;
- upload and dropzone visuals;
- audio cards;
- non-media report widgets.

The module has four bounded presentations: overlay, thumbnail, evidence, and
summary. It supports only the image, video, fixed 2x2 mosaic, frame, activation,
selection, Edit, delete, and empty-state contracts required by the included
surfaces.

Action placement is fixed:

- selection is persistent in the lower-right;
- Edit follows selection in the lower-right;
- delete uses one shared top-right treatment and confirmation dialog;
- whole-card activation is a sibling layer behind the action controls.

Feature code owns product data and behavior. The UI module must not import
features, services, server code, or Core domain contracts.

The module must not accept arbitrary React render slots, caller-supplied action
nodes, caller styling overrides, domain-specific variants, or generic mosaic
layouts. When a new surface does not fit the accepted contracts, its inclusion
and required presentation must be decided explicitly before extending the
module.

## Consequences

- Included surfaces share one visual-card implementation and one interaction
  anatomy.
- Selection moves to lower-right and delete becomes consistent; other surface
  layout and look remain unchanged.
- Pure images, video players, upload surfaces, and audio cards are not forced
  into a card abstraction.
- Feature-owned card wrappers and obsolete card/grid primitives are deleted
  instead of retained as aliases.
- Architecture tests protect the UI-to-feature/service boundary without
  freezing private implementation names or enumerating callers.
