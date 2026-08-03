# 0072 Use Hierarchy-Independent Screenplay Analysis

Date: 2026-08-03

Status: accepted

## Context

The previous three-act analysis stored Act and Sequence ids from the mandatory
screenplay hierarchy. Once Acts and Sequences became optional organizational
Sections, those ids could no longer define analytical ownership. Analysis must
remain meaningful for flat and differently organized screenplays.

## Decision

Screenplay Analysis derives its own structure from canonical ordered Scenes:

- exactly three `actSegments` with roles `actOne`, `actTwo`, and `actThree`;
- exactly one `sceneAnalysis` for every current Scene in order;
- optional `sceneGroups` that form another complete ordered Scene partition;
- every accepted key-beat role exactly once, with optional `sceneId` when the
  screenplay genuinely embodies that beat; and
- suggested Scenes anchored before or after exactly one current Scene.

Act segments and Scene groups are analysis-owned interpretation. They never
reference or infer ownership from screenplay Sections. Scores, criteria,
critiques, evidence, suggestions, immutable history, and active selection stay
within Core-owned validated persistence. CLI, HTTP, React, and Skills consume
that contract without reproducing its partition rules.

## Consequences

- Analysis works for flat Screenplays and every accepted optional Section
  arrangement.
- Reorganizing or deleting Sections does not invalidate analysis merely because
  an organizational id changed.
- Every current Scene remains accounted for exactly once in analytical
  partitions and Scene analyses.
- Missing beats are represented without invented Scene placements.
- The migration preserves current critique meaning while removing Act/Sequence
  ids and duplicated Scene titles from stored analysis JSON.
