# 0052 Separate Scene Beats From Shot Authoring

Status: accepted
Date: 2026-07-16

## Context

Renku Studio currently stores a Scene Shot List whose entries mix narrative
developments with camera and production direction. Those entries are then used
as members of Scene Shot Video Takes. This makes one object own two different
concerns:

- what changes in the story and visual situation;
- how a camera and production workflow realizes that change.

The resulting Shot Video Take aggregate also assumes that several of these
entries form either a Continuous Move or Multi-Cut group. References,
generation, media ownership, selection, trash, and production export all depend
on that grouping.

Those assumptions are not an acceptable foundation for the next Shot workflow.

## Decision

A Beat and a Shot are separate concepts.

A Beat is a Scene-owned narrative object. It describes a meaningful physical,
emotional, relational, informational, or power change and the visual situation
in which that change occurs. It may describe setting, meaningful placement,
spatial relationships, important elements, and atmosphere. It does not own shot
size, framing, lens, camera movement, cuts, coverage, performance direction, or
production execution.

The existing versioned Scene Shot List becomes a versioned Scene Beat Sheet.
Its ordered entries become Beats. Beat storyboard images remain owned by the
exact Beat Sheet and Beat from which they were created.

The current Scene Shot Video Take aggregate is deleted rather than renamed.
Studio has no durable Shot model until a later decision defines one.

The Scene surface contains:

```text
Narrative | Beats | Shots
```

The Beats tab presents the current Beat Sheet and storyboard review experience.
The Shots tab contains an inert **New Shot** add card and persists nothing.

Composition, Motion, Dialogs, AI Production, and optional video preview UI are
retained as a controlled, persistence-free Shot authoring kit. The kit has no
Take API, Take type, Beat membership, grouping mode, or reference workspace
dependency.

The Shot References tab and Shot-owned reference persistence are removed.
Shared generation references remain available to Generation Preview and Image
Revision.

Scene Dialogue Audio Takes remain because they are real candidate outputs owned
by Scene Dialogue Audio and do not depend on the rejected Shot grouping model.

The current production export is removed because its ordering and selection
contract is entirely based on picked Shot Video Takes. Export may return only
after the future Shot/output model defines production order and selected
outputs.

## Consequences

- Scene Beat Sheet contracts, validation, storage, commands, resources, CLI
  commands, routes, selection state, and skills use Beat terminology directly.
- Beat persistence contains only Beat-owned narrative, visual-setting,
  relationship, and screenplay-source facts.
- Existing Beat Sheet history and storyboard relationships are transformed by
  a one-way migration.
- Shot Video Take tables, purposes, routes, services, references, trash
  ownership, media destinations, and export behavior are removed.
- No compatibility aliases, old route readers, dual JSON fields, empty Take
  routes, or placeholder Shot rows remain.
- The future Shot design starts from a clean contract instead of inheriting the
  current Take aggregate.

## Supersedes

This decision supersedes:

- Decision 0038, scoped Shot Video Take reference projections;
- Decision 0039, uniform Shot Video Take sheet reference selection;
- Decision 0050, one successful generation per Shot Video Take;
- Shot/Take-specific clauses in Decisions 0049 and 0051.

Those decisions remain as historical records.
