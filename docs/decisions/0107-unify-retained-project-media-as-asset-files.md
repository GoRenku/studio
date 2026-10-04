# Unify Retained Project Media As Asset Files

Date: 2026-10-04

Status: accepted; implemented and verified under plan 0222

A retained Project file has one identity, `AssetFile`. Authored metadata,
physical metadata, ownership, provenance, and discard lifecycle belong to that
record. Remove the logical Asset wrapper, its file collection, and its separate
membership row. Each generated output or edit is a distinct retained file.
Domain identities such as Lookbook placements, Cast Voices, Shots, and Takes
remain distinct from their attached file identity.

Every active image AssetFile supports `image.edit`, including Inspiration and
research images. The request uses the exact original file as a model input.
The output is a new, unselected AssetFile in the source's owning collection;
the original bytes, record, and selection remain unchanged. Existing domain
destinations retain their naming, and other image types save beside the exact
source file. Inspiration edits remain in the same Inspiration folder, and
nested research edits remain in the same research directory. Users may discard
either image independently through the existing Trash lifecycle.

Existing file IDs are canonical during conversion. Preserve exact authored
metadata, file bytes and paths, selections, relationships, and Trash history.
Reject ambiguous parent/file cardinality, ownership, lifecycle, and normalized
path collisions instead of choosing a primary file or losing records. Use
Drizzle Kit's schema and documented custom preservation workflow with verified
database backups; do not maintain historical runtime readers or aliases.

Inspiration images and research references use the same retained collection as
generated media. Inspiration files belong to their folder; research references
belong to Project. Import retains bytes and creates the record in one operation.
A matching file already in its requested destination can be adopted in place.
Changed bytes, different ownership, and discarded paths are conflicts. A focused
CLI batch import is atomic; Studio's existing upload batch preserves individual
successes and failures. Inspiration remains an image collection.

Core Project open requires schema readiness and a completed, bounded reference
backfill before publishing a session. The internal backfill completion marker
supports retry after SQL succeeded but content discovery/persistence failed.
Discovery covers registered Inspiration folders and `research/`, not arbitrary
Project trees, caches, staging, or temporary outputs. Completed opens do not
repeat discovery or hashing. Subsequent direct filesystem writes require the
same focused import operation; reads and previews never register content.

A discarded Inspiration folder collected by its current Empty Trash operation
does not require its original directory. Preserve that history without
recreating content or scanning its collected package. Missing active folders or
folders whose current discard has not been collected are failures. An older
collected operation cannot excuse a missing current directory.

Folder rename preserves file IDs, bytes, and lifecycle while moving the existing
directory and updating owned file paths and live Trash restoration paths
together. A failed metadata commit rolls the directory move back. Collected
history, authored requests, provenance, and creative documents remain unchanged.

Core owns selection, import, lifecycle, path safety, and reference eligibility.
CLI, HTTP, React, and MCP project the common contracts and one file ID. Commands
and URLs change directly without aliases. Existing selection targets, provider
constraints, approval behavior, Settings, and generation-review routing remain
unchanged. Reference use does not change canonical display selection.

Prompts and artifact contents remain opaque under ADR 0041. Common file
eligibility checks identity, ownership/lifecycle, containment, regular-file
availability, and deterministic media envelopes. Provider input support still
determines which retained files can be used in a particular request.

This decision supersedes the media grouping and separate file-identity portions
of [ADR 0013](0013-use-core-owned-project-assets-and-production-exports.md),
the filesystem-only Inspiration-image portion of
[ADR 0018](0018-use-project-native-visual-language-inspiration-analysis.md),
and the separate membership/file identity in
[ADR 0064](0064-use-exclusive-asset-membership-and-scoped-selection.md).
The exact-reference behavior in
[ADR 0088](0088-use-exact-request-references-and-source-derived-image-continuation.md)
and retained Shot Plan reference behavior in
[ADR 0099](0099-register-prepared-shot-plan-references.md) remain accepted with
one file identity. The implementation and verification checklist is
[plan 0222](../../plans/active/0222-unified-asset-files-and-reference-imports.md).
