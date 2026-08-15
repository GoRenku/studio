# 0071 Use A Scene-First Screenplay And Direct Project Story Metadata

Date: 2026-08-03

Status: accepted

Decision 0079 makes one source-specific organization rule explicit: FDX-backed
Screenplays always project as a flat Scene list. Final Draft planning paragraphs
never become the optional Renku-authored Act or Sequence Sections described by
this decision.

Decision 0075 supersedes this decision's optional Scene-number rule and former
Beat Sheet terminology. Scene identity, Scene-first structure, and direct
Project story-metadata ownership remain accepted.

Decision 0073 makes Beat Sheet, Analysis, Shot Plan, and Dialogue Audio
relationships to Screenplay content weak historical context. Those artifacts
do not block or cascade with later Screenplay mutations.

## Context

The previous model duplicated story metadata between Project and Screenplay and
required every Scene to belong to one Sequence inside one Act. It also embedded
Cast/Location relationships into screenplay content, used Block array indexes
downstream, and stored production numbers in a separate reservation registry.
Those choices made a flat screenplay impossible and spread screenplay identity
across several competing representations.

## Decision

Project directly owns story and development metadata. The singleton Screenplay
owns only semantic screenplay content:

- `opening` elements before the first Scene;
- canonical ordered Scenes with stable Block, Dialogue Turn, and Dialogue Part
  identities;
- optional Act/Sequence Sections and explicit structure entries; and
- separate Cast Member, Location, and Prop references to Scene, heading, Block,
  dialogue cue/part, or exact text range targets.

Scenes are canonical and exist without Section ancestry. Sections are
non-owning organization. A flat Scene list, root Sequences, direct Scenes in an
Act, and mixed Act children are valid. Deleting a Section promotes its direct
children in place.

Screenplay authoring uses request-local keys for new values and durable IDs for
existing values. Core resolves keys, validates the final aggregate, and commits
one transaction and one revision. CLI and HTTP remain thin adapters.

Production numbers are optional exact non-empty Scene properties. They remain
human references, not durable identity or order. Beat Sheets refer to stable
Block ids and include relevant Prop ids.

The one-time Drizzle migration preserves current Project metadata, canonical
Scene order, screenplay blocks/dialogue identities, references, Beat links,
dialogue audio, revisions, analysis, Assets, and dependent production state.
It aborts on ambiguous or invalid source data instead of guessing.

## Consequences

- Project has one metadata owner and Screenplay has one canonical content
  aggregate.
- Optional organization no longer owns Scenes, Assets, designs, or production
  records.
- Plain screenplay text no longer requires `@handle` mutation for continuity
  subjects.
- Props participate in Screenplay and Beat context through the same reference
  boundary as Cast Members and Locations.
- The separate production-number registry and hierarchy tables are removed.
- Existing callers, routes, docs, and skills move directly to the new contract;
  no compatibility DTOs, aliases, or fallback readers remain.
- Deterministic Final Draft import maps a supported semantic subset into an
  empty aggregate and continuously refreshes an FDX-backed aggregate from the
  source. It retains each accepted exact FDX as a Project Asset and keeps one
  current provenance pointer; canonical runtime reads never depend on or
  reparse the retained source.
- Import candidates never create or auto-match Cast Members, Locations, Props,
  or Screenplay references. Those judgments remain in later user/agent
  collaboration through the owning commands.

This decision supersedes Decision 0060's production-number registry and amends
Decision 0070 so first-class Props may be referenced by Screenplay content.
