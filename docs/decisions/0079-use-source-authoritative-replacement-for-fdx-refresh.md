# 0079: Use Source-Authoritative Replacement For FDX Refresh

Date: 2026-08-15

Status: accepted

## Context

An FDX-backed Screenplay cannot be changed in Renku. The earlier refresh design
nevertheless treated the current database projection and the changed FDX as two
editable versions: it reconciled nested identities with ordering, heading,
number, and neighbor heuristics; calculated a detailed diff; and required an
approval token for removals. It also interpreted Final Draft planning paragraph
types as Renku Act and Sequence Sections.

That machinery solved conflicts which the product does not permit. Final Draft
planning elements and customizable outline lanes also do not establish a
portable narrative hierarchy that Renku should claim as canonical.

## Decision

The FDX is the sole authority for an FDX-backed Screenplay. Every import maps to
a flat source-ordered Scene list with no Sections. `New Act`, `End of Act`,
`Sequence`, `Summary`, `Outline 1`, `Outline 2`, `Outline 3`, `Note`, and
ScriptNote forms remain only in retained source bytes. Unknown/custom visible
paragraph types still fail with a path-aware structured diagnostic. The mapper
never interprets paragraph text as hierarchy.

Refresh has three outcomes:

- an exact source SHA-256 match is `unchanged` and writes nothing;
- a changed source with an equal canonical projection advances only the exact
  retained-source pointer; and
- a changed canonical projection atomically replaces the complete Screenplay
  and creates one revision.

There is no refresh diff, removal approval, token, partial merge, or nested
identity reconciliation. Core may reuse an existing Scene only when its entire
canonical content hash occurs exactly once in both current and proposed
Screenplays. The whole Scene graph survives together. Every changed or
ambiguous Scene receives new nested identities.

Screenplay Analysis reads only the canonical database projection. FDX-backed
Screenplays therefore always use `sourceActMode: 'flat'`; Final Draft planning
markers cannot provide analysis Act membership. Exactly three canonical
Renku-authored Act Sections may still provide `sourceThreeAct` membership.

## Consequences

- FDX refresh automatically accepts valid additions, removals, reordering, and
  content changes because no Renku-authored screenplay state can conflict.
- Opening, Scene, dialogue, Section, reference, and revision-restore mutations
  remain behind the shared Core FDX read-only gate.
- Changed Scenes intentionally receive new IDs. Screenplay Analysis, Scene
  Beats, Shot Plans, Dialogue Audio, and other derived artifacts keep their old
  weak historical IDs; refresh neither cascades nor blocks on them.
- Import reports use only `imported`, `refreshed`, and `unchanged`, and contain
  no Act/Sequence counts, diff, current revision, or approval fields.
- Renku-authored Act and Sequence organization remains part of the general
  Screenplay domain and is unchanged by this decision.

This decision supersedes Decision 0075 only where it described reconciliation
or unambiguous identity preservation during FDX refresh. It narrows Decisions
0071 and 0072 only for the FDX projection and analysis-source behavior described
above.
