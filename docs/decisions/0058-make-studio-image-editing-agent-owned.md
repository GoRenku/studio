# 0058 Make Studio Image Editing Agent-Owned

Date: 2026-07-19

Status: accepted

## Context

Studio's Image Revision dialog duplicated part of the generic generation
lifecycle. It constructed mutable revision drafts, selected modes, estimated,
ran, and attached output from a feature-specific UI path. That gave Studio a
second editing state machine while agents still needed to inspect outputs and
decide with the user whether a generated edit should enter the project.

Generated images also need a durable way to show the exact request that made
the displayed AssetFile, including frozen agent-external requests and safe
project-file references.

## Decision

Studio image editing is agent-owned. The existing generic GenerationSpec,
Preview, managed-run, external-freeze, and focused media-import contracts remain
the only generation lifecycle.

Studio replaces Image Revision with a read-only Generation Request inspector on
the existing eligible media cards. The inspector reads provenance for the exact
displayed AssetFile and reuses the Generation Preview resource to show the exact
saved prompt, selected references, provider, model, and values. It has no edit,
estimate, execution, or attachment action.

An agent edits an image by authoring a new `image.edit` request against the
source Asset with the exact source AssetFile locked in `source/source-image`.
After request review and execution, the agent displays the output and obtains a
separate output-acceptance decision before importing it through the source
owner's real Cast, Location, or Lookbook destination. Managed output uses its
exact receipt; external output uses its exact frozen source spec.

Core permits the `image.edit` source target to differ from the import target
only when the exact locked source currently belongs to that destination owner.
Import creates a separate unselected generated asset and preserves the source
asset, file, ownership, and selection state.

Lookbook Image and Sheet ownership is represented only by Lookbook membership;
attachment no longer creates a parallel project relationship.

## Consequences

- Studio provides durable request inspection without another generation editor.
- Preview approval and output acceptance remain separate user decisions.
- Agents own creative inspection and editing while Core owns provenance,
  destination eligibility, paths, and persistence.
- `image.editOutput`, Image Revision routes, contracts, and feature code are
  removed without aliases or compatibility behavior.
- This decision supersedes the Image Revision portions of Decisions 0053,
  0055, and 0057.
