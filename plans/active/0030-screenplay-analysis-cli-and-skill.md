# 0030 Screenplay Analysis CLI And Skill

Date: 2026-05-28

Status: implemented

## Goal

Add durable, agent-authored screenplay analysis to Renku Studio.

The first implementation should let a Codex agent:

1. read the current screenplay context through the Renku CLI;
2. analyze the screenplay against a v1 three-act story arc model;
3. write a validated `kind: "screenplayAnalysis"` JSON document back through
   the Renku CLI;
4. save that analysis in the project SQLite database as one analysis record in a
   history of analyses;
5. mark the newly written analysis as the active analysis shown by Studio;
6. notify any running Studio UI through scoped Studio resource events.

This plan intentionally does not implement the browser visualization. That work
is planned separately in
`plans/active/0031-story-arc-analysis-visualization-ui.md`.

## References

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/json-storage-validation.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/cli/commands.md`
- `plans/active/0016-screenplay-json-cli-commands.md`
- `plans/active/0022-visual-language-inspiration-analysis-cli-and-skill.md`
- `plans/active/0023-visual-language-lookbook-cli-and-skill.md`

## Product Scope

The feature is for critique and visualization, not automatic rewriting.

The user flow is:

1. The user asks Codex to analyze the screenplay.
2. Codex uses the `screenplay-analyst` skill.
3. The skill calls `renku screenplay analyze context --json`.
4. Codex reads the screenplay context and authors a structured analysis JSON
   document.
5. The skill validates the document with
   `renku screenplay analyze validate --file <path> --json`.
6. The skill writes the document with
   `renku screenplay analyze write --file <path> --json`.
7. Core validates all references and persists the analysis in SQLite.
8. Core marks the new analysis active.
9. Core appends a Studio resource-change event.
10. Studio refreshes the Story Arc resource and renders the active analysis.

The analysis can critique existing acts, sequences, and scenes. It can also
recommend new scenes, but recommendations remain suggestions. They must not
create scene rows or mutate the screenplay graph. A later user or agent action
can apply accepted suggestions through existing screenplay operations.

## Current Baseline

Screenplay authoring data already exists in SQLite:

- `screenplay`
- `act`
- `sequence`
- `scene`
- related cast, location, asset, and relationship tables

The current `screenplay` table still has a `story_arc` JSON column and the
browser-safe screenplay contract still has `screenplay.storyArc`. That authored
story-structure document no longer fits the direction of the product.

The new direction needs:

- multiple analysis records over time;
- one active analysis for display;
- agent-authored critique and evidence;
- flexible criteria that can change between projects and genres;
- scene-level scoring and recommendations;
- UI refresh events when the analysis changes.

Therefore, this plan removes `screenplay.storyArc` and `screenplay.story_arc`
entirely from the current model and adds Screenplay Analysis history as the only
durable structured story-arc critique model.

No backwards compatibility is needed. Do not add old-field readers, migration
fallbacks, obsolete-schema validators, deprecated command aliases, or special
diagnostics whose only purpose is to preserve `storyArc`.

## Naming

Use **Screenplay Analysis** for the durable critique document.

Reasons:

- the CLI command is `renku screenplay analyze`, so the noun "analysis" matches
  the command action without inventing a competing product word;
- the analysis is broader than the chart. It can include story arc scores,
  scene critique, sequence critique, act critique, and suggested scene
  additions;
- "Story Arc Analysis" is useful in UI copy, but the durable object belongs to
  the screenplay as a whole.

Use US English for the CLI verb:

```bash
renku screenplay analyze ...
```

Do not add a British-English alias. Renku Studio is pre-customer software, and
the repo rules explicitly reject compatibility aliases.

This follows the US-English naming rule in
`docs/architecture/naming-guidelines.md`.

## Structure Model

The v1 analysis uses:

```json
"structureModel": "threeAct"
```

The three-act model is the only supported model in this slice. The JSON document
still stores `structureModel` so future models can be added without treating the
v1 document shape as a hard-coded synonym for every possible screenplay
structure.

For `threeAct`, semantic validation should require:

- exactly three current acts in the analysis `acts` array;
- each referenced act id exists in the current screenplay;
- act order in the analysis matches the screenplay act order;
- act roles are one of:
  - `actOne`
  - `actTwo`
  - `actThree`

The current production hierarchy remains:

```text
Act -> Sequence -> Scene -> Clip
```

This plan does not replace `Sequence` as the production hierarchy and does not
move act data into a generic future structure table.

## Default Criteria

The default v1 criteria are:

- `dramaticEnergy`
- `stakes`
- `characterAgency`

The JSON Schema and semantic validator must allow additional user-defined
criteria. The v1 Studio UI will render only the default criteria in the main
chart. Future CLI and skill work can expose custom criteria selection.

Scores use integers from `0` to `100`.

The validator should reject:

- scores below `0`;
- scores above `100`;
- fractional scores;
- score keys that are not declared in `criteria`;
- duplicate criterion keys.

The validator should require the default criteria to exist in `criteria` for
v1 documents.

## Data Model Addition

Remove the old authored story-arc column from the screenplay table:

```text
screenplay.story_arc
```

Remove the corresponding Drizzle field, browser contract field, JSON Schema
property, persistence reader/writer, validation fragment, tests, examples, and
skill instructions. The current implementation should behave as though
`story_arc` never existed.

Add two tables.

```text
screenplay_analysis
  id text primary key
  structure_model text not null
  document text not null
  created_at text not null
  updated_at text not null

screenplay_analysis_state
  id text primary key
  active_analysis_id text references screenplay_analysis(id) on delete set null
  created_at text not null
  updated_at text not null
```

Notes:

- `document` stores the validated `kind: "screenplayAnalysis"` JSON document.
- `structure_model` is duplicated as a small queryable discriminator, not as a
  detailed analysis schema.
- Criteria, scores, evidence, critique, and recommendations stay inside the
  validated JSON document.
- `screenplay_analysis_state` follows the same project-local state pattern as
  `visual_language_state`.
- The state table should have one row with a stable id, for example
  `screenplay_analysis_state`.
- Deleting an active analysis should set `active_analysis_id` to null.
- No JSON columns may be written without AJV validation before persistence and
  after reads.

Migration rules:

- Edit the Drizzle schema in `packages/core/src/server/schema/`.
- Generate the SQL migration with Drizzle Kit from `packages/core`.
- Do not hand-write a TypeScript migration registry.
- Do not copy generated SQL into TypeScript files.
- Decide during implementation whether this is a breaking schema generation
  change according to `docs/architecture/reference/drizzle-migrations.md`.
- Do not keep runtime compatibility code for databases or JSON documents that
  contain `story_arc` or `storyArc`.

Likely files:

```text
packages/core/src/server/schema/screenplay-analysis.ts
packages/core/src/server/schema/index.ts
packages/core/drizzle/
```

## Story Arc JSON Removal

Remove current stored-story-arc support from:

```text
packages/core/src/client/screenplay.ts
packages/core/src/client/screenplay-json-schemas.ts
packages/core/src/client/resources.ts
packages/core/src/server/schema/screenplay.ts
packages/core/src/server/screenplay-json/validator.ts
packages/core/src/server/database/access/screenplay-persistence.ts
packages/core/src/server/database/access/screenplay-resource.ts
packages/core/src/server/resources/screenplay-ui.ts
packages/core/src/server/commands/screenplay-commands.test.ts
packages/studio/src/app/app.test.tsx
```

The exact file list may change during implementation, but the rule is stable:
no current contract should expose `screenplay.storyArc`, and no current table
should keep `screenplay.story_arc`.

The Story Arc page and `selection.type === "storyArc"` may continue to exist as
UI concepts. They name the visualization surface, not the removed screenplay
JSON column.

## JSON Document

The agent-authored document is a tagged document.

```json
{
  "kind": "screenplayAnalysis",
  "structureModel": "threeAct",
  "title": "Three-act screenplay analysis",
  "summary": "Urban's story has a strong moral engine, but Act I delays his active choice after the opening consequence.",
  "criteria": [
    {
      "key": "dramaticEnergy",
      "label": "Dramatic Energy",
      "description": "How strongly the moment pulls the audience forward."
    },
    {
      "key": "stakes",
      "label": "Stakes",
      "description": "How clearly the audience understands what can be lost or gained."
    },
    {
      "key": "characterAgency",
      "label": "Character Agency",
      "description": "How clearly a character's choice drives the story."
    }
  ],
  "acts": [
    {
      "actId": "act_...",
      "actRole": "actOne",
      "title": "The Offer",
      "synopsis": "Urban tries to sell his cannon to Byzantium and learns that need without resources cannot become patronage.",
      "scoreByCriterion": {
        "dramaticEnergy": 54,
        "stakes": 60,
        "characterAgency": 48
      },
      "critique": {
        "summary": "The act has a strong premise but the opening interest dips before Urban makes a choice.",
        "strengths": [
          "The siege consequence gives the story scale immediately."
        ],
        "concerns": [
          "Urban is introduced through consequence before the audience understands his immediate want."
        ],
        "evidence": [
          {
            "sceneId": "scene_...",
            "text": "The first scene emphasizes the cannon's impact more than Urban's decision pressure."
          }
        ],
        "suggestions": [
          "Move Urban's practical problem closer to the opening image."
        ]
      }
    }
  ],
  "keyBeats": [
    {
      "key": "hook",
      "label": "Hook",
      "actId": "act_...",
      "sequenceId": "sequence_...",
      "sceneId": "scene_...",
      "synopsis": "The walls shake under Urban's cannon before the story rewinds to his bargain.",
      "scoreByCriterion": {
        "dramaticEnergy": 62,
        "stakes": 58,
        "characterAgency": 35
      },
      "critique": {
        "summary": "The image is large, but Urban's active choice is delayed.",
        "evidence": [
          {
            "sceneId": "scene_...",
            "text": "The opening shows external destruction before a personal decision is visible."
          }
        ],
        "suggestions": [
          "Tie the opening consequence to a clear unresolved question about Urban."
        ]
      }
    }
  ],
  "sequences": [
    {
      "sequenceId": "sequence_...",
      "actId": "act_...",
      "title": "The Sound That Opens Stone",
      "synopsis": "The siege consequence frames the weapon before the story rewinds to the failed Byzantine offer.",
      "beatRole": "hook",
      "scoreByCriterion": {
        "dramaticEnergy": 62,
        "stakes": 58,
        "characterAgency": 35
      },
      "critique": {
        "summary": "A strong image with weaker immediate agency.",
        "strengths": [
          "The audience understands that the cannon matters."
        ],
        "concerns": [
          "The audience does not yet know what Urban wants in this moment."
        ],
        "evidence": [
          {
            "sceneId": "scene_...",
            "text": "The scene describes outcome before desire."
          }
        ],
        "suggestions": [
          "Let the sequence end on a question about Urban's responsibility, not only spectacle."
        ]
      }
    }
  ],
  "scenes": [
    {
      "sceneId": "scene_...",
      "sequenceId": "sequence_...",
      "actId": "act_...",
      "title": "Bombardment",
      "synopsis": "The cannon's impact establishes the cost of Urban's craft.",
      "beatRole": "hook",
      "scoreByCriterion": {
        "dramaticEnergy": 68,
        "stakes": 55,
        "characterAgency": 30
      },
      "critique": {
        "summary": "The scene is visually forceful but character agency is low.",
        "strengths": [
          "Immediate scale and consequence."
        ],
        "concerns": [
          "Urban is defined by effect rather than decision."
        ],
        "evidence": [
          {
            "text": "The scene's conflict is external; Urban's choice is not yet dramatized."
          }
        ],
        "suggestions": [
          "Add a sharper moment of Urban seeing the cost or choosing not to look away."
        ]
      }
    }
  ],
  "suggestedSceneAdditions": [
    {
      "targetActId": "act_...",
      "targetSequenceId": "sequence_...",
      "placement": {
        "afterSceneId": "scene_..."
      },
      "title": "The Maker Calculates",
      "purpose": "Give Urban an active choice before the opening energy drops.",
      "synopsis": "Urban privately calculates whether his skill can survive without a patron and chooses to keep pursuing the weapon.",
      "rationale": "This would make the hook personal instead of only spectacular.",
      "expectedCriterionChanges": [
        {
          "criterionKey": "characterAgency",
          "direction": "increase",
          "reason": "The audience sees Urban choose pressure rather than merely experience it."
        }
      ]
    }
  ]
}
```

## JSON Schema And Validation

Add browser-safe schema constants:

```text
packages/core/src/client/screenplay-analysis-json-schemas.ts
```

Expected exports:

```ts
export const screenplayAnalysisDocumentSchema = { ... } as const;
```

Add browser-safe contract types:

```text
packages/core/src/client/screenplay-analysis.ts
```

Expected public names:

```ts
export interface ScreenplayAnalysisDocument {
  kind: 'screenplayAnalysis';
  structureModel: ScreenplayAnalysisStructureModel;
  title: string;
  summary: string;
  criteria: ScreenplayAnalysisCriterion[];
  acts: ScreenplayActAnalysis[];
  keyBeats: ScreenplayKeyBeatAnalysis[];
  sequences: ScreenplaySequenceAnalysis[];
  scenes: ScreenplaySceneAnalysis[];
  suggestedSceneAdditions: SuggestedSceneAddition[];
}

export type ScreenplayAnalysisStructureModel = 'threeAct';
```

Server validation should live under:

```text
packages/core/src/server/screenplay-analysis-json/validator.ts
```

Expected functions:

```ts
export function parseScreenplayAnalysisDocument(input: {
  contents: string;
  filePath?: string;
}): ScreenplayAnalysisDocument;

export function validateScreenplayAnalysisDocument(input: {
  document: ScreenplayAnalysisDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticResult;
```

Validation has two passes:

1. AJV validates the JSON structure.
2. Core performs semantic validation against the current screenplay.

Semantic validation must check:

- `structureModel` is `threeAct`;
- default criteria are present;
- criterion keys are unique;
- all score keys reference declared criteria;
- all scores are integers from `0` to `100`;
- every `actId` exists;
- every `sequenceId` exists and belongs to its stated act;
- every `sceneId` exists and belongs to its stated sequence and act;
- `suggestedSceneAdditions.targetActId` exists;
- optional `targetSequenceId` belongs to the target act;
- optional placement scene ids exist and belong to the target sequence when a
  target sequence is provided;
- three-act analysis references exactly the three current acts in screenplay
  order;
- required critique fields are non-empty enough to be useful.

Unknown fields should be rejected for this agent-authored format. This differs
from import YAML, where unknown fields are warnings.

## Core Service Implementation

Add core command report types in:

```text
packages/core/src/client/screenplay-analysis.ts
```

Suggested names:

```ts
export interface ScreenplayAnalysisCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: ScreenplayAnalysisProjectReport;
  resourceKeys: string[];
}

export interface ScreenplayAnalysisWriteReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysisSummary;
  activeAnalysisId: string;
  changes: ScreenplayAnalysisChange[];
}
```

Add database access under a feature-owned server folder, for example:

```text
packages/core/src/server/database/access/screenplay-analysis.ts
```

Expected operations:

```ts
export function listScreenplayAnalysisRecords(...): ScreenplayAnalysisSummary[];
export function readScreenplayAnalysisRecord(...): ScreenplayAnalysisRecord | null;
export function writeScreenplayAnalysisRecord(...): ScreenplayAnalysisRecord;
export function readActiveScreenplayAnalysisRecord(...): ScreenplayAnalysisRecord | null;
export function setActiveScreenplayAnalysisRecord(...): void;
```

Use `Record` only for database-facing row shapes. Public contracts should use
plain domain names without `Record`.

Add command handlers under:

```text
packages/core/src/server/commands/screenplay-analysis-commands.ts
```

Expected public service methods:

```ts
readScreenplayAnalysisContext(input): Promise<ScreenplayAnalysisContextReport>;
listScreenplayAnalyses(input): Promise<ScreenplayAnalysisListReport>;
readScreenplayAnalysis(input): Promise<ScreenplayAnalysisReadReport>;
validateScreenplayAnalysis(input): Promise<ScreenplayAnalysisValidationReport>;
writeScreenplayAnalysis(input): Promise<ScreenplayAnalysisWriteReport>;
setActiveScreenplayAnalysis(input): Promise<ScreenplayAnalysisWriteReport>;
```

`writeScreenplayAnalysis` should:

1. require a current authoring project;
2. require existing screenplay data;
3. parse the tagged document;
4. validate structure with AJV;
5. validate references against current screenplay state;
6. open a short database transaction;
7. insert a new `screenplay_analysis` row;
8. set that row active in `screenplay_analysis_state`;
9. return a command report with resource keys;
10. append Studio resource-change events after the SQLite mutation succeeds.

The write command should create a new history entry every time. It should not
mutate an older analysis row in place.

## Analysis Context Command

`renku screenplay analyze context --json` should return the context an agent
needs to perform the analysis without scraping Studio UI.

The report should include:

- project identity;
- screenplay title, logline, summary, dramatic question, premise, central
  conflict, themes, tone, and genre;
- acts in order;
- sequences in order;
- scenes in order, including scene settings, story function, and blocks;
- cast member labels and handles;
- location labels and handles;
- default criteria metadata;
- active analysis summary when one exists;
- resource keys.

It should not include:

- image assets;
- generated media;
- timings, runtime, page numbers, or post-production concepts;
- absolute local paths;
- Studio UI state beyond the current authoring project.

The skill can still call `renku studio current --json` before analysis when it
needs to orient itself to what the user is looking at, but the analysis command
must be sufficient once the current authoring project is known.

## CLI Command Surface

Add a concise command group:

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

Behavior:

- All commands require a current authoring project.
- Commands that need screenplay content fail with `PROJECT_DATA205` when no
  screenplay data exists.
- `validate` does not write.
- `write` writes a new analysis and makes it active.
- `show --active` returns `{ "analysis": null }` when no active analysis exists.
- `show --analysis <id>` fails when the analysis id does not exist.
- `set-active` changes only the active pointer.
- No British-English alias is added.

Human-readable output should be concise and useful, but the agent workflow uses
`--json`.

Update:

```text
docs/cli/commands.md
packages/cli/src/
packages/cli/src/cli.test.ts
```

## Studio Coordination

After `write` and `set-active`, append a scoped resource-change event.

Suggested resource keys:

```text
surface:story-arc
screenplay-analysis
screenplay-analysis:<analysis-id>
```

The event is a Studio UI coordination signal only. It is not durable project
history; the durable analysis is already in project SQLite.

If event append fails after the SQLite write, the command should report the
mutation success and the coordination warning using the existing project
command-report pattern. Do not roll back the SQLite write because Studio event
append failed.

## Skill Project

Add a new skill under the external Studio Skills project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-analyst
```

Expected structure:

```text
screenplay-analyst/
  SKILL.md
  agents/
    openai.yaml
  references/
    screenplay-analysis-cli-workflow.md
    screenplay-analysis-json-contract.md
    screenplay-analysis-guidance.md
  samples/
    three-act-analysis.json
```

Follow `skill-creator` guidance:

- keep `SKILL.md` short and operational;
- put the JSON contract and craft guidance in references;
- do not add a README or extra auxiliary docs;
- generate or update `agents/openai.yaml` so the skill appears correctly in
  the Studio Skills UI;
- keep samples valid against the current schema.

The skill workflow:

1. Check the current authoring project.
2. Read `renku screenplay analyze context --json`.
3. Inspect the screenplay structure and scene text.
4. Decide whether the v1 defaults are sufficient.
5. Author a `kind: "screenplayAnalysis"` JSON document.
6. Validate it with `renku screenplay analyze validate`.
7. Fix validation issues until valid.
8. Write it with `renku screenplay analyze write`.
9. Report the active analysis id and high-level critique to the user.

Skill non-negotiables:

- never write directly to `.renku/project.sqlite`;
- never mutate screenplay scenes while analyzing;
- never create scene rows for suggested additions;
- do not invent timings, runtime, page numbers, or post-production metadata;
- cite scene ids and evidence when making critique claims;
- keep suggestions actionable enough for a later agent to apply through
  screenplay operations.

## Tests

Add core tests covering:

- schema validation succeeds for a valid `kind: "screenplayAnalysis"` document;
- missing required fields produce structured diagnostics;
- unknown fields are rejected;
- default criteria are required;
- additional criteria are accepted;
- duplicate criteria are rejected;
- invalid score values are rejected;
- score keys not declared in `criteria` are rejected;
- unknown act, sequence, and scene references are rejected;
- sequence-act mismatches are rejected;
- scene-sequence mismatches are rejected;
- `suggestedSceneAdditions` validate references without creating scene rows;
- write persists a new analysis row;
- write sets the new row active;
- previous analysis rows remain in history;
- set-active changes the active analysis;
- stored JSON is validated after database read;
- validation failure performs no database mutation.

Add CLI tests covering:

- `renku screenplay analyze context --json`;
- `renku screenplay analyze validate --file <path> --json`;
- `renku screenplay analyze validate --file - --json`;
- `renku screenplay analyze write --file <path> --json`;
- `renku screenplay analyze write --file - --json`;
- `renku screenplay analyze list --json`;
- `renku screenplay analyze show --active --json`;
- `renku screenplay analyze show --analysis <id> --json`;
- `renku screenplay analyze set-active --analysis <id> --json`;
- no-project failure;
- no-screenplay failure;
- invalid JSON diagnostics;
- invalid reference diagnostics;
- Studio resource keys returned after write and set-active;
- no British-English command alias.

Add skill validation by running through a sample project:

- create or open a project with screenplay data;
- run the skill workflow manually with the sample;
- confirm validation catches an intentionally broken scene reference;
- confirm a valid sample writes and becomes active.

## Documentation

Update:

```text
docs/cli/commands.md
docs/architecture/data-model-and-storage.md
docs/architecture/reference/domain-vocabulary.md
docs/architecture/reference/studio-skills.md
```

## Existing Screenplay Drafter Skill Alignment

Update the existing external skill:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter
```

Required changes:

- keep the default three-act story-shaping guidance for initial screenplay
  generation;
- remove all instructions to write `screenplay.storyArc`;
- remove the `Story Arc` JSON contract section that describes
  `screenplay.storyArc`;
- remove workflow guidance for top-level `storyArc` edits;
- update samples so `screenplayCreate` documents do not include `storyArc`;
- remove or replace update samples whose main purpose is updating
  `screenplay.storyArc`;
- represent initial three-act structure through the actual `act`, `sequence`,
  `scene`, `purpose`, and `storyFunction` fields;
- keep beat labels such as `hook`, `inciting_incident`, `first_turn`,
  `midpoint`, `crisis`, `climax`, and `resolution` in scene or sequence
  purpose/story-function text where useful.

The goal is consistency:

```text
initial screenplay generation -> three-act act/sequence/scene hierarchy
screenplay analysis -> validates and critiques that same hierarchy
```

Add a decision record only after implementation direction is accepted. Suggested
ADR topic:

```text
Use durable Screenplay Analysis history for agent-authored screenplay critique.
```

## Implementation Checklist

- [x] Add `screenplay_analysis` and `screenplay_analysis_state` to the Drizzle
      schema.
- [x] Remove `screenplay.story_arc` from the Drizzle schema.
- [x] Generate the SQL migration with Drizzle Kit.
- [x] Decide and apply any required project schema generation change.
- [x] Remove `screenplay.storyArc` from browser-safe screenplay contracts.
- [x] Remove `screenplayStoryArcSchema` and stored story-arc JSON validation.
- [x] Remove story-arc persistence readers, writers, and tests tied to
      `screenplay.storyArc`.
- [x] Remove `storyArc` from current screenplay CLI schemas and examples.
- [x] Add browser-safe Screenplay Analysis contract types.
- [x] Add browser-safe Screenplay Analysis JSON Schema constants.
- [x] Add server-side AJV parser and validator.
- [x] Add semantic validation against the current screenplay graph.
- [x] Add database access functions for analysis history and active analysis.
- [x] Add core command handlers for context, list, show, validate, write, and
      set-active.
- [x] Add project-data-service contract and wiring entries.
- [x] Add CLI parsing for `renku screenplay analyze`.
- [x] Ensure no British-English command path exists.
- [x] Ensure `write` creates a new history row and sets it active.
- [x] Append scoped Studio resource-change events after successful writes and
      active changes.
- [x] Return consistent JSON command reports and structured diagnostics.
- [x] Update `docs/cli/commands.md`.
- [x] Update architecture references after the contract is accepted.
- [x] Add the `screenplay-analyst` skill in the external Studio Skills project.
- [x] Add skill reference files and a valid sample analysis.
- [x] Add or regenerate `agents/openai.yaml`.
- [x] Update the existing `screenplay-drafter` skill to remove
      `screenplay.storyArc` and keep three-act initial generation guidance in
      the act/sequence/scene hierarchy.
- [x] Add core tests for schema, semantic validation, persistence, and active
      analysis state.
- [x] Add CLI tests for all new commands.
- [x] Run focused core and CLI tests.
- [x] Verify the skill can read context, validate output, write analysis, and
      leave Studio ready to refresh.

## Resolved Decisions

- The CLI namespace is `renku screenplay analyze`.
- The durable noun is Screenplay Analysis.
- US English is required for command and contract names.
- The v1 structure model is `threeAct`.
- The default v1 criteria are `dramaticEnergy`, `stakes`, and
  `characterAgency`.
- Scores use integer `0` to `100` values.
- The schema allows additional criteria, but the v1 UI renders only the default
  criteria.
- Suggested scene additions are recommendations only and do not mutate the
  screenplay graph.
- The skill name is `screenplay-analyst`.
- Implementation is split into this data/CLI/skill plan and the separate UI
  visualization plan.
