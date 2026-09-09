# 0095 Use Previs playback display metadata

Date: 2026-09-09
Status: accepted

Implementation of plan 0201 authorizes the narrow display contract described
here. Registration retains exact optional `description.md` and `playback.json`
bytes with each revision. Core reads the Description unchanged and projects
explicit subjects, point/range cues and exact optional audio AssetFile references.
It validates structural envelopes, times, display colors and safe file identity;
it never interprets creative prose or checks performance against annotations.
Missing optional files are normal. Malformed display files and unavailable audio
produce localized warnings without hiding revision history or blocking video.

This supersedes ADR 0094's opaque playback JSON rule only for the explicit
display envelope in plan 0201. ADR 0041 still governs creative contents.

Generated Assets may carry an indexed nullable weak Previs revision reference,
exposed as `authoredFrom.previsRevisionId`. Core validates supplied identities
against the target Previs plan before attachment. No inference, backfill, foreign
key, cascade or ownership change is introduced. Video edits preserve this context.
The existing media import command accepts `--previs-revision`.

The browser receives safe Asset URLs and display metadata through the existing
Previs read owner. Playback clocks and revision/take browsing belong to React.
Two equal monitors, one transport, colored cues and the existing highlighted
Description viewer form the director's monitor inside Studio's normal shell.
