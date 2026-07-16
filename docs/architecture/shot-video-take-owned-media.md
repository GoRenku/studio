# Shot Video Take-Owned Media Ownership
Date: 2026-07-15

Status: current

Role: architecture decision

## Decision

Shot Video Take-owned media and reusable project references have different
lifecycle ownership. Ownership is conferred only by focused relationship
tables; a generation spec reference records usage and never transfers
ownership.

Take-owned media consists of:

- one optional current First Frame image;
- one optional current Last Frame image;
- one optional current Video Prompt image;
- one insert-once final video attached by the successful materializing
  `shot.video-take` command.

Reusable references remain owned by their focused domains, including Cast
Character Sheets, Location Sheets, Lookbook Sheets, Dialogue Audio Takes, and
Shot-owned generic references registered through
`scene_shot_reference_asset`.

## Authoring And Materialization

Supporting images are Draft authoring inputs. They may be set or replaced while
the Take has no successful materializing `shot.video-take` run. Their presence
does not freeze Shot membership, structure, direction, model setup, prompt,
provider values, or references.

The first successful final Take generation atomically stores its immutable run
snapshot and attaches the final video. That success completes and freezes the
Take. A second successful run, replacement final video, or later authoring
mutation fails before writes or provider execution.

Failed materializing attempts do not freeze the Take. Supporting-image
generation histories belong to their generated assets and are not displayed as
Shot Video Take run history.

Completed references resolve only the successful run's immutable
`specSnapshot`. Current Scene candidates and purpose guides cannot change that
record.

## New Take

Editing a Completed Take creates a history-empty Draft through the focused
**New Take** command. It copies authored values and reusable exact selections.
For each source Take-owned First Frame, Last Frame, or Video Prompt image, it
also creates an independent Asset, AssetFile, stored file, and focused Take
image relationship, then rewrites copied spec selections to those new ids.

The new Draft shares no mutable Take-owned supporting media with its source and
receives no final video, run, receipt, approval token, provider payload,
diagnostics, generation provenance, or persisted lineage. The source Take and
its successful snapshot remain unchanged.

## Persistence

`scene_shot_video_take_image` records current Take image ownership by role.
`scene_shot_video_take_video` records the current final-video ownership.
`scene_shot_reference_asset` records explicit Shot ownership for generic
reference media. `media_generation_spec.references_json` records exact request
usage only.

An external video attachment does not receive a synthetic successful run or
materialize a Shot Video Take. Imported media may be used as generic/reference
media unless a future accepted workflow defines imported completed Takes.

## Trash And Garbage Collection

Discarding a Take snapshots and discards its Shot membership and every focused
Take image/video relationship. Core collects exclusively owned assets and files
only after checking all active focused owners, including Take images, Take
videos, and Shot generic-reference relationships. Restore reinstates the same
focused rows and conflict-free exclusively owned media.

Generic spec usage is not a lifecycle owner and does not cause a Take cascade.
`scene_shot_reference_asset` is a lifecycle owner and participates in Shot
reference discard, restore, owner counts, shared-owner checks, and garbage
collection. Its focused relationship command owns that lifecycle; generic spec
usage does not.

Supporting-image replacement transfers the active focused ownership pointer in
one transaction. Lifecycle commands collect all conflicts before durable
changes, so failure leaves rows and files unchanged.

## Ownership Boundary

These rules belong in focused Core commands and database access modules. Studio
routes and CLI handlers call those commands; React and skills do not classify
ownership, copy canonical media, or decide what deletion may cascade to.

Project file paths and atomic file/database write sets remain governed by
`project-asset-storage-conventions.md`.
