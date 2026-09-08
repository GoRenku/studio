# 0094 Use Previs Shot Plans and retained render revisions

Date: 2026-09-08
Status: accepted

## Decision

Use **Shot List** (`shot-list`) and **Previs** (`previs`) as the two Scene Shot Plan
representations. Preserve the Scene-local numbering/root. A Previs plan has its
own editable implementation and directing parameters, exact completed source
revisions and registered procedural render Assets. Code may be adapted between
plans; this work does not introduce a shared previs engine.

Retain `previs/source/`, `previs/revisions/rNNN/` and `previs/renders/` under the
plan root. Core owns revision/Asset registration and file allocation. SQLite links
the exact source revision to a video Asset with origin `rendered`. AI takes use
the existing generation path and storage. Creative parameters and playback JSON
remain opaque, with no Cast/Beat/dialogue relationship model.

The same director-authored dialogue timing informs previs performance and AI
prompt/audio intent. Lightweight legend/cues support a future player; no overlays
are burned into the MP4. The player and directing UI are deferred.

Temporary frames remain available for resume and iteration until the user invokes
**Clean up temporary files** in Project Settings and confirms. No automatic expiry,
post-render deletion or active-process coordination is added. Cleanup protects
registered files and retained authoring work outside top-level `tmp/`.

## Consequences

Decision 0076's temporary-work convention now distinguishes disposable operations
from retained Previs authoring source. Existing AI destinations and provenance are
unchanged. Existing plans migrate to Shot List; existing Harbor exploration files
are not relocated or removed by this implementation.

See `../architecture/project-asset-storage-conventions.md` for the full contract.
