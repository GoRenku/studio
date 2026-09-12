# 0206 Generation clip timeline

Status: complete
Date: 2026-09-12

## Summary

Make selected clips visibly consecutive in the Generation monitor. The single header dropdown navigates clips and inspects alternatives.
Sections cycle sandstone, terracotta and olive with theme-specific tones.

## Review Attention

Frontend presentation only. No Core, HTTP, CLI, persistence, media edits, new settings,
or migrations. Unlinked Generation uses its actual sequence duration; linked review
retains the common elapsed-time scale. Alternative takes remain explicit auditions.
Existing unrelated working-tree changes are preserved.

## Context

AGENTS.md, docs/product/design-guidelines.md, existing raw clip playback hooks,
and Urban Basilica revision 6 constrain this change.

## Architecture Shape Gate

`packages/studio/src/features/movie-studio/shot-plans/previs` owns this presentation.
`transport.tsx` owns colored sections; `clip-review.tsx` owns
all-clip take inspection and navigation; `monitor.tsx` wires the existing sequence navigation.
`use-clip-playback.ts` retains browser playback ownership. Core selections continue
through the existing API. No dispatcher, public service contract, or index changes.
Stop if timeline presentation starts mutating metadata or parsing creative media.

## Contracts and Implementation Slices

Use existing ClipPlaybackSegment inputs and numbered identities with a repeating
three-color earthy palette. Remove duplicate clip buttons. Keep the amber playhead. Selected take inspection returns
to its sequence offset, not a zero-based single-file audition. Pending clips retain
take access without invented time intervals.

## Tests and Guardrails

Cover proportional sections, clip navigation, selected versus alternative take
inspection, and automatic playback across a boundary. Run focused Vitest, frontend
typecheck/lint and desktop inspection. Update existing raw-clip browser regression.

## Documentation

Update the Previs monitor section of design-guidelines.md with sequence navigation
and unlinked duration behavior.

## Final Verification / Completion Checklist

- [x] Presentation stays frontend-owned; no new durable rules or catch-all module.
- [x] Three-color sections and single header navigation implemented.
- [x] Selected clips remain consecutive; alternative audition stays explicit.
- [x] Focused behavior tests and type/lint checks pass.
- [x] Desktop UI and boundary playback inspected.
- [x] Design guidance updated.
- [x] Full scoped diff and file sizes inspected; no formatting churn or index changes.

## Verification results

21 focused Previs tests passed (19 existing plus 2 new transport tests). Frontend
application and test TypeScript checks, focused ESLint, and git diff --check passed.
Live desktop inspection confirmed blue/purple sequential regions, Clip 2 navigation
at 11.958333 seconds on a 23.875333-second sequence, and automatic continuation from
Clip 1.3 into Clip 2.1 without resetting the playhead. Left paused on Clip 1.
The updated Playwright regression could not start because port 5174 was already
occupied; no existing test server was stopped. No Core/index/public API changes.

Follow-up: replace blue/purple with theme-aware sandstone/terracotta/olive; keep
opaque sandstone distinct under amber progress. Remove clip buttons, restore all
clips in the dropdown, and preserve cumulative selected-take navigation.

Follow-up verification: all 3 transport tests, application TypeScript, focused ESLint
and diff whitespace checks pass. Live Chrome confirms no clip buttons, all takes
in the header dropdown, and Clip 2.1 navigation at 11.96 / 23.88 seconds. Screenshot
inspection confirms sandstone remains visible around the amber progress line.
