# 0049: Use Request-Scoped Generation Reference Choices

Date: 2026-07-14

Status: superseded by Decisions 0050 and 0051

## Decision

The request-scoped exact-choice principle below remains accepted. Decisions
0050 and 0051 supersede this document's candidate-eligibility,
provider-field-binding, guide-validation, and Take-freezing rules.

Generation reference choices belong to one persisted `GenerationSpec`. A
purpose guide exposes current exact candidates in cardinality-one slots, but it
does not store a choice, initialize the first candidate, or read generic asset
selection state. The saved spec is the sole source of the current choice.

Core owns exact persistence and trustworthy Draft candidate projection. Current
candidate membership does not authorize or invalidate saved authoring, and Core
does not bind or validate provider fields. The agent or user owns the exact
choice and creative suitability. Prompt text and media contents remain opaque
to Studio runtime code.

Generation Preview groups optional candidates by slot. Its focused selection
command accepts replace/clear intent and persists exact choices without guide
membership or provider compatibility validation. Draft slots may remain empty;
Completed Takes show only successful-snapshot selections. Additional references
remain a separate universal opaque spec feature.

## Focused Display Choices

Generic asset relationships no longer have `selection` or `selectionOrder`.
Cast Profile and Location Hero display choices use the focused
`cast_profile_display_asset` and `location_hero_display_asset` tables and Core
commands. They never influence generation candidates or production export.

## Take-Owned Requests And Media

First Frame, Last Frame, and Video Prompt Image use direct purposes:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.video-prompt`.

They target one `sceneShotVideoTake` and attach to one focused Take image role.
The final video remains uniquely owned by the Take. Each of these four purposes
has at most one current spec per Take. Supporting Take images do not freeze
authoring. The first successful materializing final-video generation freezes
the Take; every later edit uses the history-empty **New Take** workflow defined
by Decision 0050.

## Production Export

Production export reads only the final video of each picked Shot Video Take and
the exact included Dialogue Audio Take references from that Take's one
`shot.video-take` spec. Lookbooks, Storyboards, display images, frames, prompt
images, and other generic assets are excluded.

## Migration

Migration 0057 is a one-way Drizzle Kit migration. It preserves only explicit
Profile/Hero display choices, drops generic relationship selection columns,
renames only the owned `video-prompt-sheet` slot envelope, and adds focused Take
media/spec uniqueness.

Earlier context-first migration data may contain one authored Take spec plus one
reference-only recovery spec. Migration 0057 merges that pair only when there is
exactly one of each and every overlapping placement identifies the same exact
reference. It fails before schema changes for conflicting or otherwise
ambiguous duplicate state. Prompt text and arbitrary value JSON are untouched.

## Consequences

- Different requests may choose the same candidates differently without
  mutating global project state.
- A purpose adds Core slot declarations, not Preview branches or route-local
  validation.
- Focused display and export behavior remain explicit domain contracts.
- No compatibility commands or aliases remain.
