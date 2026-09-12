# 0099 Register Prepared Shot Plan References

Date: 2026-09-12

Status: accepted

## Decision

Chosen image, video and audio derivatives prepared for a Shot Plan request are
registered before Preview through `renku shot-plan reference import`. Core
copies the source into the existing Plan folder and persists a Project-owned
`shot_plan_video_reference` Asset with exact weak Plan authorship. Previs imports
require the exact revision, stored in the existing Asset attribution field.

The command accepts existing media; it does not extract, generate or interpret
creative content. Locally prepared derivatives use the existing external-import
origin and null generation provenance. Authored summaries retain source identities
and extraction facts. Actual AI-generated references continue through the existing
provenance-bearing media import boundary and may retain explicit Previs revision.

The existing Plan Assets collection supports all three reference media kinds.
Its Reference Images heading becomes References; image-only contract names and
routes are renamed directly. First Frames, Last Frames and Storyboards remain
image-only. Reference media does not become a Dialogue Take or raw video take.

Exact request markers use the registered AssetFile paths returned by Core.
Existing registered subject references are reused without copying. Preview reads
remain side-effect-free and serve active registered files only. Unavailable
references retain warnings, shown with authored labels in the References tab.

## Scope

This extends ADR 0088's reference collection beyond images. It adds no database
schema, dependency graph, new AssetOwner, automatic selection, provider schema,
generation purpose, or revision deletion policy. Temporary preparation and QA
files remain temporary until chosen for import. Existing history is not rewritten.

## Verification

Core tests exercise multimodal import, exact bytes and attribution, Preview and
Trash restore, invalid scope and envelopes, copy rollback and image continuation.
CLI/HTTP tests cover delegation; UI tests cover media previews and unavailable
feedback. Skill forward evals require registration before request authoring.
