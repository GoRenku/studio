# Shot Video Take-Owned Media Ownership

Date: 2026-07-12

Status: accepted

Role: architecture decision

## Decision

Shot Video Take-owned media and reusable project references have different
lifecycle ownership.

Take-owned media consists of:

- one optional First Frame image;
- one optional Last Frame image;
- one optional Video Prompt image;
- the final video attached through the focused `shot.video-take` command;
- an exact generated reference revision stored only in the Take generic spec
  when that asset has no Cast, Location, Lookbook, Scene, Sequence, or Project
  relationship.

Reusable references remain owned by their existing domains:

- Cast Character Sheets;
- Location Sheets;
- Lookbook Sheets;
- Scene Dialogue Audio takes;
- other exact assets with an active project-domain relationship.

The active `shot.video-take` spec stores reference selection and inclusion. It
does not transfer ownership of a reusable domain asset to the Take.

## Persistence

Image ownership is recorded by `scene_shot_video_take_image` with role
`first-frame`, `last-frame`, or `video-prompt`. Final video ownership is
recorded by `scene_shot_video_take_video`. Exact
generation references are recorded in `media_generation_spec.references_json`.
The pre-cutover Shot media-input tables were consumed by migration 0052 and
removed by migration 0053; current runtime code does not recognize or write
them.

Final video attachment creates the Asset and AssetFile without a synthetic
Scene relationship. A matching Renku receipt preserves the real generation run
as provenance. An external final video has no synthetic run or provenance.

The direct `shot.first-frame`, `shot.last-frame`, and `shot.video-prompt`
purposes create the matching focused Take image attachment. Each role and the
final video are unique per Take; duplicate attempts fail through structured
Core diagnostics before a database constraint is exposed.

Once any Take-owned generated image or final video exists, authoring that Take
is immutable. Shot membership, structure, direction, model setup, and reference
changes require a new Take through the regeneration/copy workflow.

Image Revision of an exact Shot reference creates a new exclusive Asset and
AssetFile, updates the exact spec selection, and preserves the actual revision
run. It does not create a broad Scene asset relationship.

## Trash Rules

Discarding a Take is recoverable. Core discards:

- the Take row and ordered Shot membership;
- the final-video ownership row;
- final video files exclusively owned by that Take;
- exact no-owner reference assets used only by that Take spec.

Core does not discard reusable references with another domain owner. If an
exclusive asset/file is referenced by another active Take spec or final-video
row, deletion fails with a structured ownership diagnostic before changing
durable state. There is no repair compatibility command; invalid shared
take-owned state must be corrected by attaching distinct current media.

Restore reinstates the same Take, membership, conflict-free picked state, final
video, and exclusive files. Empty Trash can then move only files with no active
owner.

## Ownership Boundary

These rules belong in Core. Studio routes and CLI handlers call focused Core
commands; React and Skills do not classify ownership, copy canonical media, or
decide what deletion may cascade to.

Project file paths remain governed by
`project-asset-storage-conventions.md`.
