# 0049: Use Request-Scoped Generation Reference Choices

Date: 2026-07-14

Status: accepted

## Decision

Generation reference choices belong to one persisted `GenerationSpec`. A
purpose guide exposes current exact candidates in cardinality-one slots, but it
does not store a choice, initialize the first candidate, or read generic asset
selection state. The saved spec is the sole source of the current choice.

Core owns candidate eligibility, exact asset/file membership, cardinality,
provider-field binding, and persistence. The agent or user owns creative
suitability. Prompt text and media contents remain opaque to Studio runtime
code.

Generation Preview groups candidates by slot. Its existing spec update accepts
replace/clear intent, rebuilds current context, validates the chosen exact file,
binds it to one unambiguous model media field, and persists prompt and reference
changes in the same spec transaction. Empty optional slots remain visible to
agents in context but are omitted from Preview when they have no candidate and
no saved choice. Additional references remain a universal opaque spec feature.

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
has at most one current spec per Take. Once any generated Take image or final
video is attached, Core rejects in-place authoring changes; a revised request
must use the existing new-Take/regeneration workflow.

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
