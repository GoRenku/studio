# Previs monitor correction — 2026-09-11

Source visual truth: the user's attached two-player screenshot in this task,
with subsequent explicit corrections: each transport beneath its own player,
compact header selector, no assignment-status row, Link at the revision row's right.
Implementation: the live Urban Basilica revision 6 route, captured through the
in-app browser at a 1440 × 1000 desktop viewport. Screenshot evidence is attached
to this task's “Verify corrected desktop monitor” tool result. The supplied
941-pixel-wide screenshots include Chrome chrome; comparison concerns the monitor
region and relative proportions, not pixel-identical browser framing.

## Findings and correction history

- P1 corrected: two panel-wide transport rows were an incorrect interpretation
  of full duration. Each transport now occupies its own player card, aligned on
  the same horizontal baseline. Neither crosses the gap between players.
- P2 corrected: the separate assignment selector/status row and central Link
  gutter consumed space. The selector is in the Generation header and Link is
  in the revision row. Existing footage opens immediately for transient review.
- P2 corrected: clip labels intersected the slider track in the first segmented
  treatment. Removed section labels and vertical track displacement. Flat alternating neutral
  bands now sit directly behind the centered track. A standalone preview shades
  only its actual duration against the scene scale.

## Fidelity surfaces

- Typography: existing compact heading, monospaced timing and control tokens;
  redundant player-name labels beside transport controls removed.
- Spacing: equal 16:9 panes, existing card padding and narrow two-column gap;
  controls directly beneath each video. No middle control column.
- Colors: existing theme and amber slider tokens retained; alternating subtle
  clip backgrounds rather than a separate clip-button row.
- Images: original Previs and generated footage, contained without recropping.
- Copy: no assignment-status filler; concise Link tooltip and existing take titles.

The header selector now overrides the primitive’s default height explicitly to
24px and fills the remaining header width. The open menu shows complete titles;
long closed values use an ellipsis without clipping the control. Verified in the
live browser with the real 11.96-second take.

## Verification

Live desktop capture confirms both real movie players and per-player transports.
Link toggled on/off correctly. Browser error log was empty. Typecheck, focused
lint and four playback-hook tests passed. The earlier desktop regression passed
take selection, playback, source attribution and the full scene duration scale;
the final per-player placement was checked in the live browser after correction.
No sample clip grouping or generated media changes were made.

Latest spacing pass: reduced workspace top padding from 20px to 8px and increased
player headers from 28px to 40px, with 12px side margins. Removed only the shot-name
header row from Direction cues; the five internal vertical cut markers remain.
The timeline uses natural content height with no nested scrollbar; the cue list
retains its independent scroll. Confirmed in the real movie at 1440 × 1000.

final result: passed
