# 0112 Select One Dialogue Audio Take Per Line

Date: 2026-10-09

Status: accepted

## Context

[ADR 0090](0090-use-shot-plan-dialogue-audio-and-provider-neutral-cast-voices.md)
stores each Shot Plan Dialogue Audio Take with a consecutive Turn range and
made selection independent and multi-select, with every Take starting
unselected. Video Generation Context projects every selected Take as one exact
reference. With multi-select, two selected Takes can cover the same Dialogue
Turn, so video generation cannot tell which performance to use for that line.
Directors also expect the most recent generation to be the one in use without
an extra selection step.

Multi-Turn Takes were previously produced only by Seed Audio. Eleven v4 Text to
Dialogue now produces multi-speaker Takes for a consecutive range too.

## Decision

- At most one selected Take covers each Dialogue Turn within a Shot Plan.
- Selecting a Take sets its selection and, in the same transaction, clears the
  selection of every other active Take in the same Shot Plan whose inclusive
  Turn range overlaps it. Adjacent ranges and other Shot Plans are untouched.
- Attaching a Take stores it selected and clears overlapping selections in the
  same transaction. This applies to every attachment path, including
  conversational `renku media import`.
- Clearing a selection affects only that Take.
- Discarding the selected Take leaves its lines unselected. Core never
  reselects an older Take. Restoring a Take from Trash returns it unselected.
- Multi-Turn Takes may come from Seed Audio or Eleven v4 Dialogue. Core stays
  provider- and model-neutral; provenance remains the only record of the
  generating route.
- `ShotPlanDialogueAudioResource` gains `lines`: the number, speaker name,
  Cast Member id and plain text of every current screenplay Dialogue Turn
  covered by an active Take in the Shot Plan, sorted by number. Turn numbers
  that no longer exist in the current screenplay are omitted.

## Consequences

- Video Generation Context sees at most one selected reference per line.
- Selection is no longer an independent toggle per Take: selecting one Take can
  silently deselect overlapping Takes, which surfaces as a refreshed resource.
- A newly imported Take replaces the overlapping selection without a separate
  select command.
- Studio surfaces can show line text for Takes without reading the screenplay
  separately.
- The Take table schema is unchanged. Existing Urban Basilica data has no
  overlapping selected Takes, so no migration or cleanup is required.

## Verification

Core tests cover attach-selects with overlap clearing but not adjacent ranges,
select clearing overlaps only within the same Shot Plan, clear leaving other
Takes untouched, discard and restore selection behavior, and the `lines`
projection omitting missing Turn numbers.
