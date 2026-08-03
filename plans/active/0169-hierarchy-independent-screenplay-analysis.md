# 0169 Hierarchy-Independent Screenplay Analysis

Status: complete
Date: 2026-08-03

Canonical Project/Screenplay model:
[0166 — Scene-First Screenplay Data Model And Backend](0166-scene-first-screenplay-data-model-and-backend.md#canonical-data-model).

Studio UI consumer:
[0167 — Scene-First Screenplay Studio UI](0167-scene-first-screenplay-studio-ui.md).

Cross-phase product context:
[Scene-First Screenplay And FDX Import — Shared Design Context](assets/0166-0168-screenplay/shared-design-context.md).

## Summary

Replace the current Screenplay Analysis contract that treats stored screenplay
Acts and Sequences as analytical truth.

Screenplay Analysis remains durable, agent-authored critique history, but its
three-act structure becomes an analysis of canonical Scene order. It does not
own or reference organizational Sections. A screenplay may therefore be flat,
may omit Sequences, or may organize Scenes differently from the analysis while
the Story Arc continues to represent the same analytical model.

This plan also removes the inherited Scene `storyFunction` input from analysis.
The analyst derives Scene purpose, structural beats, and dramatic movement from
the semantic screenplay and records those conclusions only in Screenplay
Analysis.

The real `urban-basilica` active analysis is converted without losing its
title, summary, criteria, scores, Act-segment titles and critique, key beats,
Scene synopses and critique, Sequence-level analytical meaning, suggested
Scenes, history identity, timestamps, or active selection.

## Delivery Relationship

Plans 0166 and 0169 are separate ownership plans but one coordinated backend
cutover:

- Plan 0166 owns Project, Screenplay, Scene, Section, structure, reference, and
  block contracts.
- Plan 0169 owns Screenplay Analysis, its context, persistence conversion, CLI,
  Story Arc backend resource, and analyst Skill.
- The generated/custom database changes are assembled and tested together.
- The real project migration is not applied and neither backend plan is marked
  complete until both plans pass their completion gates.
- No temporary reader, compatibility JSON shape, legacy route, or intermediate
  analysis mode exists between them.
- Plan 0167 starts its Story Arc UI cutover only after both backend plans are
  complete.

This split limits implementation scope without pretending the two persisted
models can be migrated safely in unrelated releases.

## Requirement Ledger

| Requirement | Accepted behavior | Owner |
| --- | --- | --- |
| Analytical ownership | Three-act structure belongs only to Screenplay Analysis, not to Scene or organizational Sections. | Core analysis contract |
| Scene-first input | Analysis context supplies opening content and Scenes in canonical screenplay order without Act/Sequence ancestry. | Core analysis context |
| No Scene planning tags | Scene has no `storyFunction` replacement; the analyst derives and persists analytical conclusions. | Plans 0166 and 0169 |
| Independent Act segments | Exactly three analytical Act segments partition the ordered Scenes for the `threeAct` model. | Core analysis validator |
| Optional analytical grouping | An analysis may omit Scene groups; when present, groups are analytical partitions and are not screenplay Sections. | Core analysis contract |
| Stable references | Analysis, evidence, beats, and suggested placement refer only to durable Scene IDs. | Core analysis validator |
| Current-analysis preservation | The Basilica analysis content, history row, timestamps, and active pointer survive the one-time conversion. | Drizzle migration |
| Story Arc continuity | The backend resource exposes analytical Act segments, beats, Scene scores, critique, and summary without Section ancestry. | Core resource; Plan 0167 renderer |
| Agent sufficiency | The analyst receives Project story context, opening, full Scene content, references, Cast, Locations, and Props. | Core context and analyst Skill |
| Thin adapters | Existing `renku screenplay analyze` commands and the Story Arc HTTP route delegate to Core. | CLI and Studio server |
| Direct cutover | Only the new contract exists after migration; there are no aliases, fallback readers, or old-shape diagnostics. | All layers |

## Product Behavior

### Analysis is separate from organization

The Screenplay tree answers where Scenes are currently organized. Screenplay
Analysis answers how the story works dramatically. Those are different
questions.

For example, the user may keep all Scenes flat while the active analysis still
shows Act I, Act II, and Act III. The user may also delete a Sequence Section;
that operation preserves Scene order and does not alter or invalidate an
analysis merely because the wrapper disappeared.

The analytical Act titles shown in Story Arc come from the active analysis.
They do not come from sidebar Section titles. The current Basilica presentation
therefore retains analytical labels such as **The Offer**, **The Patron**, and
**The Sound** even after organizational Sections become optional.

### Analysis is derived, not copied onto Scenes

Scene semantic content contains the heading and screenplay blocks. It does not
store an open-ended list of dramatic labels.

The agent reads the full ordered screenplay and records:

- each Scene's synopsis, optional beat role, scores, and critique;
- the three analytical Act segments;
- the canonical structural beats;
- optional analytical Scene groups when they add useful intermediate critique;
  and
- suggested Scenes with concrete before/after Scene placement.

No analysis write mutates a Scene, Section, screenplay reference, Cast Member,
Location, or Prop.

### No saved analysis

When there is no active analysis, the Story Arc resource returns
`activeAnalysis: null`. Plan 0167 renders the existing intentional no-analysis
state. It must not fall back to Scene planning tags or imply that organizational
Sections are an analysis.

## Explicit Non-Goals

- No general-purpose story-structure framework or plug-in model registry.
- No screenplay rewriting or automatic application of suggested Scenes.
- No Scene, Section, Cast, Location, or Prop mutations from an analysis write.
- No organization UI; Plan 0167 remains read-only for screenplay structure.
- No browser redesign beyond the Story Arc contract cutover owned by Plan 0167.
- No FDX analysis import. Plan 0168 imports semantic screenplay content only;
  an agent runs analysis afterward when requested.
- No migration-on-read, legacy JSON parser, compatibility alias, or dual schema.
- No new analysis staleness/versioning subsystem in this slice.
- No preservation of duplicated Scene-analysis titles when they exactly match
  the current Scene display title; the Scene remains the title owner.
- No automatic analysis run after import or screenplay editing.

## Context And Evidence

### Current persisted analysis

The real project database contains one active Screenplay Analysis row:

- id `screenplay_analysis_x4hq2er3`;
- 37,055 bytes of JSON;
- three Act analyses;
- nine key beats;
- five Sequence analyses;
- ten Scene analyses; and
- three suggested Scene additions.

All ten current Scenes have an analysis entry with independent synopsis,
`beatRole`, scores, and critique. The Story Arc screenshot is driven by those
values. For example, the saved analysis identifies Bombardment as the Hook,
The Test as the Midpoint, and The Maker's Sound as the Climax. It does not read
those conclusions from Scene `storyFunction` values.

All three current suggestions already contain one concrete `afterSceneId`, so
their placement survives without target Act or Sequence IDs.

### Current coupling defects

The current public contract and validator require:

- `ScreenplayActAnalysis.actId` to reference a stored Act;
- `ScreenplaySequenceAnalysis.sequenceId` and `actId` to reference stored
  hierarchy rows;
- every `ScreenplaySceneAnalysis` to repeat `sequenceId` and `actId`;
- every key beat to repeat `actId` and optionally `sequenceId`;
- every suggested Scene to name a target Act and optionally a target Sequence;
- exactly three stored screenplay Acts before a three-act analysis can be
  written; and
- stored analysis JSON to be revalidated against that hierarchy on every read.

The current Story Arc resource also projects organizational Acts and Sequences,
and the React chart uses those rows to position Scene points. Scene
`storyFunction` appears only as fallback tooltip/dialog copy when a Scene lacks
analysis.

### Current owners to refactor

Implementation must trace and replace the current contract through:

- `packages/core/src/client/screenplay-analysis.ts`;
- `packages/core/src/client/screenplay-analysis-json-schemas.ts`;
- `packages/core/src/server/screenplay-analysis-json/validator.ts`;
- `packages/core/src/server/database/access/screenplay-analysis.ts`;
- `packages/core/src/server/commands/screenplay-analysis-commands.ts`;
- `packages/core/src/server/resources/screenplay-ui.ts`;
- `packages/core/src/server/schema/screenplay-analysis.ts`;
- analysis command/resource tests and project-data fixtures;
- `packages/cli/src/commands/screenplay-command.ts` and CLI workflow tests;
- the Story Arc route/response path under `packages/studio/server`;
- `packages/studio/src/features/movie-studio/story-arc/*`, whose UI cutover is
  delivered by Plan 0167; and
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-analyst/*`.

`packages/core/src/server/database/access/screenplay-projection.ts` currently
uses the first Scene `storyFunction` string as `oneLineSummary`. Plan 0166
removes that incorrect projection; analysis is not copied back into the Scene
projection as a replacement convenience field.

### Accepted architecture constraints

- `packages/core` owns analysis validation, history, active selection,
  persistence, and Story Arc projection.
- The CLI parses flags/files and formats Core reports only.
- Studio server routes read HTTP input, call Core, and serialize the result.
- React consumes the Story Arc resource and owns presentation only.
- Agent instructions author analysis content but do not enforce database
  invariants or write SQLite directly.
- JSON columns validate against one closed schema before write and after read.
- The Drizzle TypeScript schema and Drizzle Kit workflow remain authoritative.
- Package-boundary failures use `@gorenku/studio-diagnostics`.
- Current code recognizes only the new contract after cutover.

## Right-Sized Change Decision

### Reuse the current analysis contract unchanged

Rejected. It makes a flat screenplay impossible to analyze and turns optional
organization into required analytical ownership.

### Move analysis fields onto Scene or Section

Rejected. Scene is semantic screenplay content and Section is non-owning
organization. Either location would duplicate an independently authored,
versioned analysis result and recreate the coupling being removed.

### Refactor the existing Screenplay Analysis owner

Accepted. The existing history table, active pointer, command family, default
criteria, score/critique model, resource event behavior, and analyst workflow
already represent the product need. The change replaces only the hierarchy-
dependent contract, validation, projections, and sample data.

### Introduce a generic narrative-analysis platform

Rejected. This slice supports the existing `threeAct` Screenplay Analysis. No
current requirement needs arbitrary analysis models, a plugin registry, or a
generic document framework.

## Canonical Analysis Contract

The following names and shapes are normative. Public JSON represents IDs as
strings; TypeScript uses the `SceneId` type owned by Plan 0166.

```ts
type ScreenplayAnalysisId = string;
type ScreenplayAnalysisStructureModel = "threeAct";

type ScreenplayAnalysisActRole =
  | "actOne"
  | "actTwo"
  | "actThree";

type ScreenplayAnalysisBeatRole =
  | "hook"
  | "incitingIncident"
  | "firstPlotPoint"
  | "firstPinchPoint"
  | "midpoint"
  | "secondPinchPoint"
  | "secondPlotPoint"
  | "climax"
  | "resolution";

interface ScreenplayAnalysis {
  structureModel: ScreenplayAnalysisStructureModel;
  title: string;
  summary: string;
  criteria: ScreenplayAnalysisCriterion[];
  actSegments: ScreenplayAnalysisActSegment[];
  keyBeats: ScreenplayAnalysisKeyBeat[];
  sceneGroups?: ScreenplayAnalysisSceneGroup[];
  sceneAnalyses: ScreenplaySceneAnalysis[];
  suggestedScenes: SuggestedScene[];
}

interface ScreenplayAnalysisCriterion {
  key: string;
  label: string;
  description: string;
}

interface ScreenplayAnalysisActSegment {
  role: ScreenplayAnalysisActRole;
  title: string;
  synopsis: string;
  sceneIds: SceneId[];
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

interface ScreenplayAnalysisKeyBeat {
  key: ScreenplayAnalysisBeatRole;
  label: string;
  sceneId?: SceneId;
  synopsis: string;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

interface ScreenplayAnalysisSceneGroup {
  title: string;
  synopsis: string;
  sceneIds: SceneId[];
  beatRole?: ScreenplayAnalysisBeatRole;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

interface ScreenplaySceneAnalysis {
  sceneId: SceneId;
  synopsis: string;
  beatRole?: ScreenplayAnalysisBeatRole;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

interface ScreenplayAnalysisScoreMap {
  [criterionKey: string]: number;
}

interface ScreenplayAnalysisCritique {
  summary: string;
  strengths?: string[];
  concerns?: string[];
  evidence: ScreenplayAnalysisEvidence[];
  suggestions: string[];
}

interface ScreenplayAnalysisEvidence {
  sceneId?: SceneId;
  text: string;
}

interface SuggestedScene {
  placement: SuggestedScenePlacement;
  title: string;
  purpose: string;
  synopsis: string;
  rationale: string;
  expectedCriterionChanges?: SuggestedCriterionChange[];
}

type SuggestedScenePlacement =
  | { beforeSceneId: SceneId; afterSceneId?: never }
  | { beforeSceneId?: never; afterSceneId: SceneId };

interface SuggestedCriterionChange {
  criterionKey: string;
  direction: "increase" | "decrease" | "clarify";
  reason: string;
}
```

`ScreenplayAnalysis` replaces the vague `ScreenplayAnalysisDocument` name.
The command and storage context already establish that this value is a
Screenplay Analysis, so the redundant `kind: "screenplayAnalysis"` field is
removed. `ScreenplayAnalysisId` identifies the immutable history row and is
supplied by command reports; it is not duplicated inside the JSON analysis.
It is a durable opaque ID, not a title, timestamp, ordering key, or screenplay
revision identifier.

### Field definitions

| Field | Definition, ownership, and validation |
| --- | --- |
| `structureModel` | Declares how structural fields are interpreted. This plan supports only `threeAct`; unlike a redundant document kind, this value selects real validation semantics. |
| top-level `title` | Human-readable title for this saved analysis, authored by the analyst. It is not the Project or screenplay title. |
| top-level `summary` | Overall evidence-backed assessment rendered in the Story Arc Analysis Summary. |
| `criteria` | Ordered definitions for every scored quality. Keys are unique camel-case identifiers. The default Dramatic Energy, Stakes, and Character Agency criteria remain required; additional criteria remain allowed. |
| `actSegments` | Exactly three analytical partitions of canonical Scene order. They are not Sections and contain no Section IDs. |
| `keyBeats` | One analytical assessment for each supported three-act beat role. A beat may cite the Scene where it occurs; absence of `sceneId` means it is assessed between or across Scenes. |
| `sceneGroups` | Optional intermediate analytical groupings of contiguous Scenes. Omission means the analyst chose no sequence-like intermediate breakdown. A group never creates or references a Sequence Section. |
| `sceneAnalyses` | Exactly one analysis for each current Scene, in canonical Scene order. It owns analytical synopsis, optional beat classification, scores, and critique but not the Scene's title or screenplay content. |
| `suggestedScenes` | Non-mutating proposals. Each has one concrete before/after Scene anchor so placement survives all Section changes. |
| `role` | Closed analytical Act role. Array order and roles must be `actOne`, `actTwo`, `actThree`. |
| analytical `title` | Agent-authored label for the analysis, Act segment, group, or suggested Scene named by its containing interface. It never renames a Project, Scene, or Section. |
| `synopsis` | Concise description of what happens in the analyzed scope or proposed Scene. |
| `sceneIds` | Ordered durable Scene membership for an analytical Act segment or Scene group. It is never a writable screenplay order or Section relationship. |
| `key` on a beat | Closed structural role used by validation and Story Arc rendering. Every supported role appears exactly once in `keyBeats`. |
| `label` | Human-readable display label for a criterion or key beat; it does not control identity or validation. |
| `sceneId` | Durable evidence/subject reference to one current Scene. It never implies Act or Sequence ancestry. |
| `beatRole` | Optional analytical classification of a Scene or Scene group. Multiple Scene analyses may share a role; canonical key-beat identity remains in `keyBeats`. |
| `scoreByCriterion` | Integer `0..100` score for every declared criterion key and no undeclared key. Scores are authored analysis, not computed Scene facts. |
| `critique` | Evidence-backed assessment of the containing Act segment, beat, Scene group, or Scene. |
| `strengths` / `concerns` | Optional ordered non-empty analytical observations. Absence means none were authored; it is not equivalent to an empty placeholder message. |
| `evidence` | One or more textual reasons supporting the critique. Optional `sceneId` anchors evidence; `text` explains the actual screenplay behavior rather than copying a generic label. |
| critique `suggestions` | One or more actionable story-development recommendations. They do not mutate screenplay content. |
| `placement` | Exactly one `beforeSceneId` or `afterSceneId` anchor for a proposed Scene. |
| suggested-Scene `purpose` | Dramatic job the proposed Scene would perform. It belongs only to the proposal, not to an existing Scene. |
| `rationale` | Explanation of why the proposed Scene addresses the analysis. |
| `expectedCriterionChanges` | Optional ordered expectations for how the proposal may affect declared criteria; they are not automatically applied scores. |
| `direction` | Closed qualitative expectation: increase, decrease, or clarify. |
| `reason` | Evidence-based explanation for the expected criterion change. |

All required strings are trimmed non-empty values. Critique summaries, evidence
text, suggestions, synopses, purposes, rationales, and criterion-change reasons
retain the existing useful-text minimum rather than accepting placeholder
tokens. Optional arrays, when present, contain non-empty strings and preserve
authored order.

## Analysis Context Contract

`renku screenplay analyze context --json` returns sufficient semantic input
without exposing organizational ancestry or requiring UI scraping.

```ts
interface ScreenplayAnalysisContextReport
  extends ScreenplayAnalysisCommandReport {
  project: ScreenplayAnalysisProjectContext;
  screenplay: ScreenplayAnalysisScreenplayContext;
  cast: ScreenplayAnalysisCastMemberContext[];
  locations: ScreenplayAnalysisLocationContext[];
  props: ScreenplayAnalysisPropContext[];
  defaultCriteria: ScreenplayAnalysisCriterion[];
  activeAnalysis: ScreenplayAnalysisSummary | null;
}

interface ScreenplayAnalysisProjectContext {
  id: ProjectId;
  projectName: string;
  title: string;
  logline?: string;
  synopsis?: string;
  premise?: string;
  intendedAudience?: string;
  format?: string;
  targetRuntimeMinutes?: number;
  primaryGenre?: string;
  secondaryGenres?: string[];
  tones?: string[];
  contentRatingIntent?: string;
  creativeBoundaries?: string[];
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  screenplayDraftStatus?: string;
  researchSources?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  nextSteps?: string[];
}

interface ScreenplayAnalysisScreenplayContext {
  opening: OpeningElement[];
  scenes: ScreenplayAnalysisSceneContext[];
  references: ScreenplayReference[];
}

interface ScreenplayAnalysisSceneContext {
  id: SceneId;
  productionNumber?: string;
  heading: string;
  title?: string;
  blocks: ScreenplayBlock[];
}

interface ScreenplayAnalysisCastMemberContext {
  id: CastMemberId;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver: boolean;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  description?: string;
}

interface ScreenplayAnalysisLocationContext {
  id: LocationId;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
}

interface ScreenplayAnalysisPropContext {
  id: PropId;
  handle: string;
  name: string;
  description?: string;
}
```

Project field meanings are inherited directly from Plan 0166 and are not
redefined differently here. `opening`, `scenes`, blocks, and references use the
exact canonical Screenplay types. `scenes` is serialized in the one canonical
depth-first Scene order produced by Core traversal. Sections and structure
entries are deliberately absent because they are organization, not analysis
input.

Cast, Location, and Prop context includes only narrative facts relevant to
analysis. Designs, media, voices, generation records, paths, Lookbooks, and UI
state remain outside the report. Handles remain useful CLI selectors, but the
analyst resolves screenplay references by durable IDs and never parses handles
from prose.

## Validation Contract

The closed JSON Schema and Core semantic validator enforce the new contract.
Unknown fields are errors because this is an agent-authored application format,
not import YAML.

For `structureModel: "threeAct"`, Core validates:

- `actSegments` contains exactly three entries in role order;
- concatenating `actSegments[].sceneIds` equals canonical current Scene order
  exactly, with every current Scene appearing once;
- `keyBeats` contains every supported beat key exactly once;
- every referenced Scene exists;
- `sceneAnalyses` contains every current Scene exactly once and in canonical
  order;
- when `sceneGroups` is present, each group is non-empty and concatenating all
  group Scene IDs equals canonical current Scene order exactly;
- criteria keys are unique, default criteria are present, and every score map
  contains exactly the declared keys;
- every score is an integer from zero through one hundred;
- every critique contains useful summary, evidence, and suggestion text;
- every suggested Scene has exactly one valid before/after anchor; and
- every expected criterion change names a declared criterion.

No validation path reads, requires, compares, or diagnoses a Section ID. No
fallback infers analytical Act boundaries from Sections.

Stored JSON is validated against the same schema before persistence and after
read. The active pointer continues to reference an immutable history row.
Writing a new analysis inserts a new row and marks it active; it never updates
an old analysis document in place.

## Command And Report Contracts

The existing CLI command names remain the accepted user/agent workflow:

```bash
renku screenplay analyze context --json
renku screenplay analyze list --json
renku screenplay analyze show --active --json
renku screenplay analyze show --analysis <analysis-id> --json
renku screenplay analyze validate --file <analysis-json> --json
renku screenplay analyze validate --file - --json
renku screenplay analyze write --file <analysis-json> --json
renku screenplay analyze write --file - --json
renku screenplay analyze set-active --analysis <analysis-id> --json
```

These commands are not renamed because their product meaning remains correct.
Their input/output types update directly from `ScreenplayAnalysisDocument` to
`ScreenplayAnalysis`; no alias or compatibility parser remains.

```ts
interface ScreenplayAnalysisSummary {
  id: ScreenplayAnalysisId;
  structureModel: ScreenplayAnalysisStructureModel;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface ScreenplayAnalysisCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    id: ProjectId;
    projectName: string;
  };
  resourceKeys: string[];
}

interface ScreenplayAnalysisListReport
  extends ScreenplayAnalysisCommandReport {
  analyses: ScreenplayAnalysisSummary[];
  activeAnalysisId: ScreenplayAnalysisId | null;
}

interface ScreenplayAnalysisReadReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysis | null;
  summary: ScreenplayAnalysisSummary | null;
  activeAnalysisId: ScreenplayAnalysisId | null;
}

interface ScreenplayAnalysisValidationReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysis;
}

type ScreenplayAnalysisChange =
  | {
      type: "screenplayAnalysis.created";
      analysisId: ScreenplayAnalysisId;
    }
  | {
      type: "screenplayAnalysis.activeSet";
      analysisId: ScreenplayAnalysisId;
    };

interface ScreenplayAnalysisWriteReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysisSummary;
  activeAnalysisId: ScreenplayAnalysisId;
  changes: ScreenplayAnalysisChange[];
}
```

`show --active` continues returning `analysis: null` when none is selected.
All file parse, shape, semantic, missing-record, and persistence failures remain
structured diagnostics. No diagnostic names the obsolete hierarchy fields as a
runtime concept after migration.

Report fields have one fixed meaning:

| Field | Definition |
| --- | --- |
| summary/report `id` | Durable Screenplay Analysis history identity. |
| summary `structureModel` | Stored model discriminator copied from the validated analysis. |
| summary `title` / `summary` | The active/history row's analysis title and overall assessment, not Project metadata. |
| `createdAt` / `updatedAt` | UTC timestamps of the immutable history row. They are not screenplay revision timestamps. |
| `isActive` | Projection of whether the row ID equals the single active-analysis pointer. |
| `valid` | Literal success marker returned only when the Core command completed its validation contract. |
| `warnings` | Structured non-fatal issues from the current command. Validation failures remain errors and do not appear as successful reports. |
| report `project` | Durable Project identity and stable project selector for the command scope. |
| `resourceKeys` | Studio coordination capabilities affected/read by the command; they are not persisted analysis membership. |
| `analyses` | History summaries ordered by current analysis-history ordering rules. |
| `activeAnalysisId` | Current active row identity, or `null` when no analysis is selected. |
| `analysis` | The complete validated analysis, or `null` only for the accepted no-active-analysis read. |
| `changes` | Closed successful mutation facts used by coordination/reporting; they are not a generic event store. |

## Story Arc Backend Resource

Core continues to expose one bounded Story Arc resource. The resource combines
canonical ordered Scene identity/display information with the active analysis;
it does not serialize the screenplay organization tree as analytical data.

```ts
interface StoryArcResource {
  project: {
    title: string;
    logline?: string;
    dramaticQuestion?: string;
    premise?: string;
    centralConflict?: string;
    synopsis?: string;
  };
  scenes: StoryArcScene[];
  activeAnalysis: ScreenplayAnalysis | null;
}

interface StoryArcScene {
  id: SceneId;
  productionNumber?: string;
  heading: string;
  title?: string;
}
```

The Story Arc lead uses the first available value in this order: `logline`,
`dramaticQuestion`, `premise`, `centralConflict`, then `synopsis`. These are
direct Project fields from Plan 0166, not analysis or Screenplay duplicates.

`scenes` is in canonical screenplay order. The resource does not contain
organizational Act/Sequence rows, Section IDs, repeated analysis membership,
or fallback dramatic labels. Plan 0167 joins `activeAnalysis.sceneAnalyses` by
`sceneId`, positions beats by the canonical Scene list, and renders Act bands
from `activeAnalysis.actSegments`.

The existing resource keys remain capability-oriented:

```text
surface:story-arc
screenplay-analysis
screenplay-analysis:<analysis-id>
```

Section create/move/delete events refresh screenplay structure consumers but do
not claim that the analysis document was rewritten. A change that alters
canonical Scene order still refreshes Story Arc because its x-axis uses current
Scene order.

## Persistence And One-Time Conversion

The existing tables remain the storage owner:

```text
screenplay_analysis
  id
  structure_model
  document
  created_at
  updated_at

screenplay_analysis_state
  id
  active_analysis_id
  created_at
  updated_at
```

No new table, Section foreign key, or Scene-analysis join table is introduced.
The JSON document is the accepted cohesive analysis artifact; the active-state
table remains the only mutable selection state.

The TypeScript Drizzle schema remains authoritative. Because this plan changes
populated JSON without changing table columns, its one-time data conversion is
a documented custom step in the Drizzle Kit migration sequence coordinated
with Plan 0166.

Before any production-code implementation or database mutation, the existing
Core migration lifecycle creates and verifies the required `VACUUM INTO`
backup and JSON sidecar for `urban-basilica`. The coordinated migration does
not begin if the backup report is absent or `PRAGMA quick_check` fails.

### Conversion mapping

For every saved analysis row, the migration:

1. parses and validates the old JSON while the old Act/Sequence/Scene graph is
   still available;
2. copies `structureModel`, top-level `title`, `summary`, `criteria`, every
   score map, critique, evidence entry, and criterion-change entry exactly;
3. removes the redundant top-level `kind` field;
4. converts each old Act analysis to one `actSegments` entry, renames
   `actRole` to `role`, and replaces `actId` with the ordered Scene IDs that
   belonged to that Act at migration time;
5. converts each old Sequence analysis to one optional `sceneGroups` entry and
   replaces `sequenceId`/`actId` with its ordered Scene IDs;
6. converts each key beat by preserving its key, label, optional `sceneId`,
   synopsis, scores, and critique while removing `actId` and `sequenceId` only
   after validating that the Scene anchor agreed with them;
7. converts each Scene analysis by preserving `sceneId`, synopsis, optional
   beat role, scores, and critique while removing `actId` and `sequenceId` only
   after validating current membership;
8. removes each duplicated Scene-analysis `title` only after verifying it
   equals the corresponding non-empty `Scene.title` in the sample;
9. converts `suggestedSceneAdditions` to `suggestedScenes`, keeps every
   creative field and criterion change, preserves its concrete before/after
   Scene anchor, and removes target Act/Sequence IDs only after verifying the
   anchor belonged to them;
10. validates the complete new `ScreenplayAnalysis` against canonical Scene
    order before updating the row; and
11. preserves analysis row IDs, `structure_model`, timestamps, history order,
    `screenplay_analysis_state`, and the active analysis ID exactly.

The current Basilica data satisfies these guards: all ten Scene titles match,
all three suggestions have one `afterSceneId`, and the five Sequence analyses
map to non-empty ordered Scene groups.

Plan 0166 must not drop the legacy Act/Sequence graph until this conversion has
successfully materialized and validated every new analysis document. The
combined migration transaction rolls back on any mismatch. There is no partial
conversion, repair guess, or fallback reader.

Migration verification compares the backup and migrated database for:

- analysis row count, IDs, timestamps, and active pointer;
- top-level title, summary, criteria, and all creative strings;
- all score maps, beat roles, critiques, evidence, and suggestions;
- analytical Act and Scene-group Scene membership;
- nine key beats and ten Scene analyses; and
- Story Arc resource values used by the current screenshot.

## Architecture Shape Gate

### Package ownership

- `packages/core` owns the public contract, closed schemas, semantic
  validation, context projection, history persistence, active selection,
  analysis commands, migration conversion, resource keys, and Story Arc
  resource.
- `packages/cli` owns argument/file parsing and report formatting for the
  existing analysis command group.
- `packages/studio/server` owns the thin HTTP route only.
- Plan 0167 owns React Story Arc presentation.
- `studio-skills` owns analyst workflow and craft guidance, never runtime
  validation.

### Intended Core client module

```text
packages/core/src/client/
  screenplay-analysis/
    index.ts
    model.ts
    schemas.ts
```

`model.ts` owns all public types and the default criteria constant. `schemas.ts`
owns the closed JSON Schema. `index.ts` contains public exports only. It contains
no schema construction, validation, projection, or compatibility exports.

The old flat `screenplay-analysis.ts` and
`screenplay-analysis-json-schemas.ts` files are deleted after callers move. No
non-index re-export facade remains.

### Intended Core server module

```text
packages/core/src/server/
  screenplay-analysis/
    index.ts
    context.ts
    validation.ts
    persistence.ts
    story-arc-resource.ts
    commands/
      context.ts
      history.ts
```

Responsibilities are bounded:

- `context.ts` projects canonical Project/Screenplay/fact input for agents;
- `validation.ts` owns JSON parsing, AJV validation, and Scene-order semantic
  validation;
- `persistence.ts` owns analysis rows and the active pointer;
- `story-arc-resource.ts` joins ordered Scene display data with the active
  analysis;
- `commands/context.ts` owns the context read command;
- `commands/history.ts` owns list/read/validate/write/set-active orchestration;
  and
- `index.ts` exports the bounded server capability only.

The old `server/screenplay-analysis-json/validator.ts`, flat analysis command,
flat database-access analysis file, and Story Arc logic inside generic
`resources/screenplay-ui.ts` disappear after direct caller migration.

The two command files may share validation/persistence functions but may not
become a generic command dispatcher. No registry is needed because the command
set is fixed and the CLI already names each intent explicitly.

### Intended CLI and Studio server modules

```text
packages/cli/src/commands/
  screenplay/
    index.ts
    analysis.ts

packages/studio/server/routes/
  screenplay/
    index.ts
    story-arc.ts
```

The CLI module parses the existing subcommands and delegates to Core. The route
reads the project selector, calls the Core Story Arc resource, and serializes
the response. Neither layer validates Scene membership, partitions Acts,
calculates chart positions, or interprets critique.

### Existing files expected to shrink or disappear

- Flat Core client analysis files disappear.
- The generic screenplay UI resource no longer assembles Story Arc hierarchy.
- The flat Core analysis command/database/validator files disappear.
- The broad CLI screenplay command loses analysis implementation and composes
  the focused `commands/screenplay/analysis.ts` handler.
- Story Arc React files are updated only by Plan 0167.

### Forbidden code shapes

- Section IDs or Section ancestry in any analysis public/persisted contract.
- A replacement Scene dramatic-purpose/story-function field.
- Analysis conclusions copied into Scene rows or Scene navigation summaries.
- React, HTTP, CLI, or Skill code enforcing analysis partitions or Scene
  reference validity.
- A generic narrative-document or analysis-model plugin framework.
- A temporary old/new JSON union, fallback parser, or compatibility export.
- A monolithic analysis file containing schema construction, database access,
  context projection, commands, and Story Arc projection.
- An `index.ts` with implementation logic.

Stop and revise before implementation continues if:

- an analysis type requires an organizational Section ID;
- a flat screenplay cannot be analyzed;
- Story Arc Act bands still come from sidebar Sections;
- a route or CLI handler begins interpreting analysis content;
- migration relies on an old-shape runtime reader;
- one file accumulates validation, persistence, command, projection, and
  formatting responsibilities; or
- current-analysis preservation can be claimed only by weakening validation or
  dropping creative data without an explicit guarded mapping.

## Implementation Slices

### Slice 0 — Freeze evidence and the coordinated migration gate

- Read the real analysis row and save a read-only verification ledger of every
  preserved field/count; do not copy creative content into a fixture by hand.
- Verify the Plan-0166 pre-migration backup path, sidecar, schema generations,
  size, and `PRAGMA quick_check` result.
- Record the cross-plan rule that legacy hierarchy rows remain available until
  analysis conversion validates.

### Slice 1 — Replace the public analysis contract and schema

- Add the bounded client module with the exact types and field definitions in
  this plan.
- Replace the tagged `ScreenplayAnalysisDocument` schema with the closed
  `ScreenplayAnalysis` schema.
- Remove `kind`, organizational IDs, duplicated Scene-analysis titles, and the
  old Sequence-analysis shape.
- Add analytical Act segments, optional Scene groups, Scene-only references,
  and anchored suggested Scenes.
- Update package exports directly and delete flat paths without re-export
  stubs.

### Slice 2 — Refactor Core validation, persistence, and commands

- Build validation from canonical ordered Scene IDs supplied by the Screenplay
  traversal owner.
- Move history and active-state persistence into the bounded server module
  without changing the table ownership model.
- Update context/list/read/validate/write/set-active commands to the new types.
- Preserve structured diagnostics and resource-event behavior.
- Remove all Act/Sequence graph construction and reference validation from the
  analysis module.

### Slice 3 — Convert analysis context and Story Arc resource

- Project direct story fields, opening, ordered Scenes, blocks, and screenplay
  references into the new context.
- Include relevant Cast, Location, and Prop facts; remove hierarchy and Scene
  `storyFunction` input.
- Replace the hierarchy-shaped Story Arc resource with ordered Scene display
  data plus active analysis.
- Remove fallback dramatic labels and any `oneLineSummary` derivation from
  Scene planning tags.

### Slice 4 — Cut over CLI, HTTP, and sister Skill

- Move analysis CLI handling under `commands/screenplay/analysis.ts` while
  preserving the accepted command names.
- Keep the Studio Story Arc route thin against the new Core resource.
- Update `screenplay-analyst/SKILL.md`, CLI workflow, JSON contract, guidance,
  and `samples/three-act-analysis.json`.
- Instruct the analyst to derive Act segments, Scene groups, beats, and Scene
  purpose from screenplay evidence; never require organizational Sections.
- Add Props and opening content to the documented context workflow.

### Slice 5 — Add and verify the one-time analysis conversion

- Add the documented custom Drizzle migration step with the exact mapping and
  guards above.
- Run it with Plan 0166's schema conversion inside the accepted transaction
  boundary.
- Prove rollback leaves the pre-migration database unchanged on each guarded
  mismatch.
- Compare the migrated active analysis and Story Arc resource with the evidence
  ledger before allowing Plan 0167 to begin.

## Tests And Guardrails

### Core contract and semantic validation

Owning-layer tests cover:

- the exact closed JSON Schema and rejection of unknown fields;
- no redundant `kind` field;
- exactly three Act segments in role order;
- exact Scene partition and canonical ordering across Act segments;
- all nine unique key beats, including multiple roles anchored to one Scene;
- optional Scene groups omitted successfully;
- present Scene groups forming an exact ordered partition;
- exactly one Scene analysis per current Scene in canonical order;
- only current Scene IDs accepted in analyses, evidence, beats, groups, and
  suggested placement;
- exactly one before/after anchor for every suggested Scene;
- declared/default criterion and score-map invariants;
- critique/evidence/suggestion useful-text rules; and
- a valid analysis for a completely flat screenplay and for a screenplay whose
  Sections do not match the analytical Act boundaries.

The complete invalid matrix belongs here. CLI, HTTP, and React tests do not
repeat it.

### Persistence and migration

- History writes remain append-only and set the new row active atomically.
- List/read/set-active retain IDs, timestamps, and ordering.
- Stored JSON is validated after read.
- The populated migration fixture converts all old analysis variants with
  foreign keys enabled.
- Conversion preserves every accepted creative field and active-state value.
- Title, membership, or suggestion-anchor mismatches fail and roll back before
  legacy hierarchy deletion.
- Post-migration runtime code recognizes only the new JSON shape.

### Context, resources, and adapters

- Context contains direct Project metadata, opening, ordered Scenes, blocks,
  references, Cast, Locations, and Props.
- Context contains no Sections, Act/Sequence ancestry, or Scene planning tags.
- Story Arc resource contains ordered Scene display facts plus active analysis
  or `null`.
- Core resource tests prove Section deletion with order preservation leaves the
  analytical document unchanged.
- CLI tests cover file/stdin parsing, Core delegation, JSON serialization, and
  structured-error rendering.
- HTTP tests cover route parameters, Core delegation, response serialization,
  and structured-error translation.

### Story Arc and Skill handoff

Plan 0167 owns visual/interaction tests proving:

- the Basilica curve, beats, Act bands, Scene rail, tooltips/dialogs, and
  Analysis Summary render from the converted analysis;
- no-analysis state has no Scene-tag fallback; and
- Story Arc remains correct for flat or differently organized Scenes.

The analyst Skill evals prove:

- a flat screenplay can produce a valid three-act analysis;
- the agent does not ask the user to create Acts or Sequences first;
- Scene-group omission is accepted;
- when groups are authored, they cite ordered Scene IDs rather than Sections;
- Props and opening content can inform critique; and
- validation/write remain the only persistence path.

Architecture tests protect stable import boundaries and public contract shape.
They must not freeze private helper names or enumerate every internal command
function.

## Documentation

Update current documentation only:

- `docs/architecture/data-model-and-storage.md` to state that Screenplay
  Analysis owns independent analytical structure and stores untagged validated
  JSON;
- `docs/architecture/reference/domain-vocabulary.md` to distinguish
  analytical Act segments/Scene groups from optional screenplay Sections;
- `docs/architecture/json-storage-validation.md` for the current analysis
  schema name;
- `docs/cli/commands.md` for the new JSON contract and context response;
- current Studio Story Arc documentation; and
- the exact `screenplay-analyst` Skill files named above.

Add a new ADR for hierarchy-independent Screenplay Analysis. Add a concise
supersession notice near the top of any earlier ADR that explicitly requires
stored screenplay Acts/Sequences for analysis; do not rewrite historical
reasoning. Plan 0030 remains historical implementation context and is not
edited for a naming sweep.

## Final Verification

Before marking this plan complete:

1. verify the real-project backup and sidecar before applying the coordinated
   migrations;
2. run the generated/custom migration against a populated temporary copy with
   foreign keys enabled;
3. run `PRAGMA quick_check` and `PRAGMA foreign_key_check` afterward;
4. compare the analysis preservation ledger against the migrated database;
5. run focused Core analysis, resource, migration, CLI, HTTP, and Skill evals;
6. run `pnpm build:core`, `pnpm test:cli`, and the focused Studio server tests;
7. run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` for the
   coordinated Plans 0166/0169 backend cutover;
8. inspect the migrated Story Arc resource for all ten Basilica Scenes, nine
   key beats, three Act segments, five Scene groups, three suggestions, and the
   active summary;
9. inspect `git diff --stat` and the complete diff across both repositories;
10. inspect every newly large or heavily modified analysis file;
11. confirm module `index.ts` files remain export-only and the CLI/HTTP adapters
    remain thin; and
12. confirm no checklist item was satisfied through a compatibility reader,
    weakened validation, dropped creative data, or monolithic implementation.

## Completion Checklist

### Review Area

- [x] Confirm Screenplay Analysis and screenplay organization remain separate product concepts.
- [x] Confirm a flat screenplay is fully analyzable without creating Sections.
- [x] Confirm the Plan-0166/0169 coordinated migration gate is explicit and no temporary compatibility stage was introduced.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm centralized Core ownership did not become a monolithic analysis implementation.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Public Contract And Validation

- [x] Implement every canonical analysis type and define every field exactly as specified.
- [x] Replace `ScreenplayAnalysisDocument` with `ScreenplayAnalysis` and remove the redundant JSON kind.
- [x] Remove all organizational Act/Sequence IDs from analysis contracts, schemas, validation, context, and reports.
- [x] Implement analytical Act segments, optional Scene groups, Scene analyses, key beats, critiques, and suggested Scenes.
- [x] Require Scene-only stable references and exact canonical Scene partitions/order where specified.
- [x] Preserve default criteria, custom criteria, score, critique, evidence, and useful-text validation.
- [x] Keep all package-boundary failures structured through `@gorenku/studio-diagnostics`.

### Core Implementation

- [x] Create the bounded Core client and server modules and delete obsolete flat paths directly.
- [x] Keep `index.ts` files export-only.
- [x] Refactor context projection around opening, canonical Scene order, references, Cast, Locations, and Props.
- [x] Remove Scene planning tags and organizational hierarchy from analysis input.
- [x] Preserve immutable analysis history and active-selection behavior in the existing tables.
- [x] Replace the Story Arc backend resource with ordered Scene display data plus active analysis.
- [x] Remove analysis fallback copy and Scene-summary derivation from dramatic planning tags.
- [x] Preserve resource keys and coordination behavior without claiming Section edits rewrite analysis.

### CLI, HTTP, UI Handoff, And Skills

- [x] Move CLI analysis handling under `commands/screenplay/analysis.ts` and preserve accepted command names.
- [x] Keep CLI parsing/reporting thin over Core.
- [x] Keep the Story Arc HTTP route thin over the Core resource.
- [x] Provide Plan 0167 the exact Scene-first Story Arc resource and analysis contract.
- [x] Update the analyst Skill, references, guidance, sample, and evals to derive analytical structure from screenplay evidence.
- [x] Ensure the analyst Skill supports flat screenplays, optional Scene groups, opening content, and Props.
- [x] Ensure no Skill writes SQLite or mutates Scenes/Sections while analyzing.

### Migration And Current Analysis Preservation

- [x] Verify the Core-generated `urban-basilica` backup and sidecar before migration.
- [x] Add the documented custom Drizzle conversion step in the coordinated migration sequence.
- [x] Convert every saved analysis row before legacy hierarchy deletion.
- [x] Preserve row IDs, timestamps, history order, active pointer, summary, criteria, scores, critiques, evidence, beats, groups, and suggestions.
- [x] Guard duplicated Scene-title removal and suggested-placement conversion before dropping old fields.
- [x] Validate the complete new analysis document before updating each row.
- [x] Prove guarded mismatches roll back the complete coordinated migration.
- [x] Leave no old-shape runtime reader, alias, repair branch, or compatibility diagnostic.

### Tests And Guardrails

- [x] Add comprehensive owning-layer schema and semantic validation tests.
- [x] Prove flat and differently organized screenplays validate against independent analytical Acts.
- [x] Add history, active-state, context, Story Arc resource, and migration tests.
- [x] Keep the invalid-state matrix in Core rather than duplicating it through adapters and UI.
- [x] Add focused CLI and HTTP adapter tests.
- [x] Add analyst Skill evals for hierarchy independence and evidence-derived structure.
- [x] Add stable import/contract architecture guardrails without private-name source needles.
- [x] Run the Final Verification commands and database integrity checks.

### Documentation And Decisions

- [x] Update current data-model, vocabulary, JSON-validation, CLI, Story Arc, and Skill documentation.
- [x] Add the hierarchy-independent Screenplay Analysis ADR.
- [x] Add concise supersession notices to affected older ADRs without rewriting their historical bodies.
- [x] Do not edit implemented historical Plan 0030 merely to replace names.

### Final Architecture Verification

- [x] Inspect `git diff --stat` and the complete diff in Studio and `studio-skills`.
- [x] Inspect every new or heavily modified analysis file for mixed responsibilities.
- [x] Confirm Core owns durable rules and CLI, HTTP, React, and Skills remain adapters/consumers.
- [x] Confirm all module `index.ts` files remain thin entrypoints.
- [x] Confirm no new generic analysis framework, hierarchy dependency, Scene planning field, compatibility path, or monolithic owner survived.
- [x] Confirm every Basilica analysis preservation item and Story Arc backend value matches the verified ledger.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [x] Only then mark Plan 0169 complete and allow Plan 0167 implementation to consume the new resource.
