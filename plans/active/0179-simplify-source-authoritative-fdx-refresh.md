# 0179 Simplify Source-Authoritative FDX Refresh And Keep FDX Flat

Status: completed
Date: 2026-08-15
Completed: 2026-08-15

## Review Attention

- This is a corrective follow-up to completed Plan 0178. Do not edit or reopen
  Plan 0178; it remains historical evidence of what was implemented.
- An FDX-backed Screenplay is completely read-only in Renku. This includes
  opening text, Scenes, headings, Action, Dialogue, Parentheticals, Scene
  numbers, references, and organization. The only Screenplay mutation path is
  importing a new authoritative FDX source.
- Remove the detailed refresh diff, removal preview, approval token, stale-token
  diagnostic, and nested identity reconciliation. A changed valid FDX applies
  automatically and atomically because Renku has no competing Screenplay edits
  to protect.
- Identity handling is deliberately narrow. Exact whole-file SHA-256 equality
  is the no-write gate. On a changed source, an exact canonical Scene-content
  hash may reuse one unchanged Scene graph only when that hash occurs exactly
  once in both the current and proposed Screenplays. Any change to a Scene,
  including one Dialogue character, replaces the entire Scene and every nested
  Block, Dialogue Turn, and Dialogue Part identity. No field-level diff or
  nested matching remains.
- Scene order comes from ordered FDX `Content`. An imported Scene number is an
  opaque source value, not an ordering key or identity key. A moved Scene may
  keep or change its number in the source; Renku accepts both without guessing.
- Every FDX projection is intentionally flat: `sections` is always empty and
  every Scene has one root-level structure entry in exact source order. Final
  Draft `New Act`, `End of Act`, `Sequence`, `Outline 1`, `Outline 2`, and
  `Outline 3` paragraphs, plus the other built-in Outline Elements `Summary`
  and `Note`, are retained in the exact source file but do not create Renku
  Sections or screenplay content. Plain `ACT ONE` text is never inspected for
  hierarchy.
- Final Draft's named act elements are paragraph types used to format explicit
  act breaks in documents that use them, and its outline lanes are customizable
  planning tracks. Neither is a universal, trustworthy mapping to Renku's
  narrative Acts or Sequences. This plan therefore removes the existing marker
  state machine instead of trying to prove increasingly specific FDX hierarchy
  semantics.
- Screenplay Analysis already reads only the canonical Screenplay from the
  Project database; it does not open the retained FDX or parse XML. Because FDX
  imports become flat, analysis receives `sourceActMode: 'flat'` and derives its
  own three analytical Act segments from ordered Scenes. A Core integration test
  must prove marker-heavy FDX input cannot influence analysis Acts.
- The public import report changes and the CLI/skill approval workflow is
  removed. This is an intentional breaking change with direct caller updates;
  no aliases, deprecated fields, or compatibility branches are added.
- There is no database migration, source-file deletion, revision deletion, or
  broad cleanup framework. The only populated local FDX-backed Project checked
  during planning is already flat. Previously retained FDX sources and
  Screenplay revisions remain readable; a normal changed refresh writes the new
  flat projection.
- The Analysis navigation, analysis history/freshness behavior, Renku-authored
  Act/Sequence organization, Studio screenplay tree, and downstream production
  workflows implemented alongside Plan 0178 remain unchanged. Acts and
  Sequences are not removed from the general Screenplay domain.
- Good coverage means a traceable scenario matrix across parser/mapper unit
  tests, Core transaction integration tests, CLI workflow tests, and one Studio
  browser journey. Test count or synthetic XML alone is not accepted as proof
  of Final Draft compatibility.
- No remaining product or architecture decision requires approval. This plan
  deliberately makes no FDX-to-Section interpretation, so no controlled Final
  Draft hierarchy fixture or application-version gate is required.

## Summary

Replace the current reconciliation-and-approval refresh implementation with a
small source-authoritative workflow.

The FDX file owns the complete Screenplay. An identical source hash is an exact
no-op. A changed valid source is parsed and mapped as the complete next
Screenplay. Exact, uniquely occurring Scene-content hashes may preserve an
unchanged Scene as one indivisible graph; a changed or ambiguous Scene is
replaced wholesale. Renku never tries to determine which Dialogue Part, Block,
heading, neighbor, production number, or structural position represents “the
same” changed Scene.

Keep the existing atomic source retention, singleton import record, aggregate
replacement, revision history, source-ownership gate, and resource invalidation
boundaries. Remove machinery that exists only to reconcile two editable copies
or ask permission before mirroring the sole source of truth.

Correct the format claim at the same time. Final Draft structural and planning
paragraphs are retained as source-only material and never interpreted as Renku
Acts or Sequences. Existing Fountain-hosted screenplays remain valuable
third-party interoperability and stress fixtures, but must not be described as
genuine Final Draft conformance evidence.

## Context

### Accepted architecture

- [`docs/architecture/data-model-and-storage.md`](../../docs/architecture/data-model-and-storage.md)
  defines Scenes as canonical and Act/Sequence Sections as optional, non-owning
  organization.
- [`docs/architecture/screenplay-fdx-import.md`](../../docs/architecture/screenplay-fdx-import.md)
  owns the current FDX import contract and must be corrected by this plan.
- [`docs/decisions/0071-use-scene-first-screenplay-and-direct-project-story-metadata.md`](../../docs/decisions/0071-use-scene-first-screenplay-and-direct-project-story-metadata.md)
  accepts Scene-first Screenplays, optional Sections, exact source retention,
  and one-way FDX refresh.
- [`docs/decisions/0073-keep-screenplay-derived-artifacts-weak.md`](../../docs/decisions/0073-keep-screenplay-derived-artifacts-weak.md)
  accepts downstream screenplay references as weak historical context. FDX
  refresh therefore does not need to preserve a changed Scene identity, inspect
  downstream artifacts, cascade updates, or block source changes.
- [`docs/decisions/0072-use-hierarchy-independent-screenplay-analysis.md`](../../docs/decisions/0072-use-hierarchy-independent-screenplay-analysis.md)
  keeps analytical Act segments owned by Analysis rather than screenplay
  Section IDs. Its wording must be clarified alongside the current
  `sourceThreeAct` contract: FDX always uses the flat path, while valid
  Renku-authored three-Act organization may supply Scene membership.
- [`docs/decisions/0075-use-stable-production-numbering-and-scene-beats.md`](../../docs/decisions/0075-use-stable-production-numbering-and-scene-beats.md)
  accepts exact FDX-authored Scene numbers and the FDX read-only gate. Its
  reconciliation consequence must be superseded narrowly by the new ADR.
- [`docs/architecture/reference/structured-diagnostics.md`](../../docs/architecture/reference/structured-diagnostics.md)
  owns package-boundary FDX diagnostics.
- Completed
  [`plans/active/0178-continuous-fdx-import-and-screenplay-organization.md`](./0178-continuous-fdx-import-and-screenplay-organization.md)
  is the implemented baseline, not a document to revise.

### Current implementation

Core currently spreads refresh behavior across:

- `packages/core/src/server/screenplay/fdx/reconciliation.ts` (459 lines),
  which matches Scenes through production-number-plus-heading, longest common
  subsequences of Scene fingerprints, heading and neighbor heuristics, then
  separately reconciles Sections, Blocks, Dialogue Turns, and Dialogue Parts;
- `packages/core/src/server/screenplay/fdx/diff.ts` (200 lines), which computes
  detailed field- and removal-level changes;
- `packages/core/src/server/screenplay/fdx/approval.ts`, which binds the diff,
  proposed source, Screenplay, and current revision into a retry token; and
- `packages/core/src/server/screenplay/fdx/refresh.ts`, which coordinates all
  three before persisting a refresh.

That design solves a bidirectional merge problem that does not exist. Core
already rejects every generic Screenplay mutation and revision restore for an
FDX-backed Screenplay with `SCREENPLAY_FDX_BACKED_READ_ONLY`. There is no Renku
Screenplay state to merge into the source.

The current identity factory also trusts unique FDX `UUID`/`Id` attributes
across source changes. That can preserve a changed Scene or nested element ID,
which conflicts with whole-Scene replacement. Source IDs may remain in the
retained XML, but they must not control canonical identity.

The current 627-line `fdx-import.test.ts` covers many parser and persistence
cases, but its refresh assertions encode reconciliation, destructive approval,
and synthetic Act/Sequence hierarchy. The CLI unit test repeats the approval
branch. The three Studio FDX E2E inputs are flat, third-party-produced FDX files
from Fountain. There is no full CLI initial/no-op/changed refresh journey, no
browser refresh journey, and no integration assertion that marker-heavy FDX
still reaches analysis only as a flat canonical Screenplay.

Screenplay Analysis already uses the correct boundary:

- `packages/core/src/server/screenplay-analysis/commands/context.ts` opens the
  current Project session and delegates to `projectScreenplayAnalysisContext`;
- `packages/core/src/server/screenplay-analysis/context.ts` calls
  `readCanonicalScreenplay(session)` and projects canonical opening, Scenes, and
  references; it never reads a retained source Asset/File or FDX XML; and
- `packages/core/src/server/screenplay-analysis/eligibility.ts` returns
  `sourceActMode: 'flat'` when canonical `screenplay.sections` contains no Acts.

The importer is therefore the only incorrect coupling. Once it always writes
`sections: []`, FDX markers cannot become source Acts for analysis. The general
analysis behavior for a Renku-authored Screenplay with exactly three source Acts
remains valid and unchanged.

### Final Draft format findings

The relevant format evidence supports non-interpretation:

- Final Draft's official keyboard documentation names `New Act`, `Sequence`,
  and `End of Act` as screenplay paragraph elements:
  [Final Draft keyboard shortcuts](https://kb.finaldraft.com/hc/en-us/articles/27977488282644-What-keyboard-shortcuts-can-I-use-in-Final-Draft).
- Final Draft's official Outline documentation defines exactly five built-in
  Outline Elements—`Summary`, `Outline 1`, `Outline 2`, `Outline 3`, and
  `Note`—and permits custom outline elements:
  [Outline elements](https://kb.finaldraft.com/hc/en-us/articles/27647459087252-What-are-outline-elements).
- The default Outline Editor may label lanes Acts, Sequences, and Scenes, but
  users can rename and change those lanes:
  [Outline Editor](https://kb.finaldraft.com/hc/en-us/articles/27613546469652-How-do-I-use-the-Outline-Editor).
- Final Draft warns that FDX files produced by Fountain-based third-party tools
  may not behave like genuine Final Draft XML:
  [Fountain-based files](https://kb.finaldraft.com/hc/en-us/articles/15575076862228-Can-Final-Draft-import-a-file-written-in-a-Fountain-based-screenwriting-program).
- Final Draft documents `New Act` and `End of Act` as configurable paragraph
  elements used to format explicit act breaks. Their existence does not
  establish a universal Renku narrative Act partition.
- Public exported examples show ordered paragraphs such as
  `Paragraph Type="New Act"` and `Paragraph Type="End of Act"`. They also show
  why Outline labels are unsafe: an actual file uses `Outline 2` for “Central
  Conflict,” not a Sequence.
- No public official FDX XSD or DTD was located. More importantly, this product
  does not need undocumented boundary semantics because it does not project
  these markers into canonical hierarchy.

The repository's small synthetic FDX files may test the accepted parser rule:
known planning/formatting paragraphs are retained in the exact source but
omitted from the canonical flat Screenplay. They are not conformance evidence.
Fountain files continue to exercise broad third-party interoperability and
scale, not genuine Final Draft application output.

## Decisions

### Source authority and write policy

An FDX-backed Screenplay has exactly one authoring surface: the external FDX
source. Renku may read and project the imported Screenplay, but cannot mutate
any part of it.

| Input state | Result |
| --- | --- |
| No import and empty Screenplay | Validate, retain the source, create the complete Screenplay, create the import record and first revision. |
| No import and non-empty Renku Screenplay | Fail with `SCREENPLAY_NOT_EMPTY`; do not convert or merge. |
| Existing FDX import and identical source SHA-256 | Return `unchanged`; write no database row or file and emit no resource keys. |
| Existing FDX import and changed SHA-256, canonical Screenplay unchanged | Retain the new exact source and advance the import pointer atomically; do not replace the aggregate, create a Screenplay revision, stale analysis, or emit Screenplay resource keys. |
| Existing FDX import and changed canonical Screenplay | Retain the new source, replace the complete aggregate, update the import pointer, create one revision, and emit the existing Screenplay resource keys atomically. |
| Changed source is invalid or unsupported | Fail before any committed database/file change; keep the prior source pointer, aggregate, and revision current. |

The source-only refresh case covers editor metadata, formatting, ScriptNotes,
and other retained-but-noncanonical FDX changes. It avoids claiming the
Screenplay changed when its canonical projection did not.

There is no removal approval. A valid changed source may add, remove, or alter
anything in the canonical Screenplay because it is the sole authority. The
report describes the resulting state, not a current-to-proposed diff.

### Scene content equality and replacement

Core computes a canonical SHA-256 for each imported Scene from only its complete
canonical value:

- exact optional `productionNumber` presence and string value;
- exact heading and any other canonical Scene fields;
- the complete ordered Block sequence;
- Block type and exact canonical text/value fields;
- complete Dialogue and Dual Dialogue Turns, cue names, extensions,
  Parentheticals, speeches, and their order; and
- no database IDs, FDX `UUID`/`Id`, source path, structural parent, or position.

On a changed source:

1. Count each Scene-content hash in the current and proposed Screenplays.
2. Reuse the current Scene as one complete object only when the same hash occurs
   exactly once on both sides.
3. Redirect the proposed structure entry and import candidates to the reused
   Scene graph as one mechanical substitution.
4. Keep every other proposed Scene and all of its newly generated nested IDs.

This is equality reuse, not reconciliation. The implementation must not compare
individual fields to decide identity. It must not preserve only a Dialogue
Turn, Block, or Dialogue Part from a changed Scene. The traversal that redirects
candidate IDs for an exactly equal reused Scene may follow identical ordered
shapes, but it cannot make an independent nested matching decision.

If an exact Scene hash occurs more than once on either side, identity is
ambiguous. Core makes no positional, heading, numbering, or neighbor guess; all
proposed instances use new identities. This is safe and deterministic.

Opening content is rebuilt from the changed source. FDX projection never creates
Section identities. The complete semantic Screenplay hash ignores all IDs and
encodes opening content, ordered Scene values, and the root-level Scene
structure so a source-only change can be identified without a detailed diff.

When that complete semantic hash is equal, Core keeps the entire current
aggregate. Because the current and proposed canonical shapes are then exactly
equal, import candidates may be redirected to current IDs by ordered structural
correspondence, including duplicate Scenes. This is not a survival decision or
fallback match: no canonical Screenplay replacement occurs in this branch. It
is only an equality optimization inside the current contract.

### Ordering and production Scene numbers

Ordered FDX `Content` and the resulting Screenplay structure define display
order. `productionNumber` is an optional, exact, opaque label.

- Renku never sorts by production number.
- Renku never identifies a Scene by production number.
- Renku never renumbers an FDX-backed Scene.
- If the source moves an otherwise identical Scene and retains its number, the
  exact Scene hash may preserve the complete Scene identity while its structure
  position changes.
- If the source also changes the number, the Scene hash changes and the whole
  Scene is replaced.
- Tests must cover both source forms without claiming that Final Draft always
  chooses one behavior.

### Flat FDX projection and planning paragraphs

FDX import has one canonical organization rule: Scenes are flat and ordered by
their `Scene Heading` paragraphs in `FinalDraft/Content`.

- `screenplay.sections` is always `[]`.
- `screenplay.structure` contains exactly one root-level Scene entry per Scene,
  in the same order as the source. No entry has `parentSectionId`.
- `New Act`, `End of Act`, and `Sequence` paragraphs are recognized as
  source-owned formatting/planning markers and omitted from the canonical
  Screenplay. They do not create Sections, opening Blocks, Scene Blocks, or
  analysis input.
- `Summary`, `Outline 1`, `Outline 2`, `Outline 3`, and `Note` paragraphs are
  likewise recognized as source-owned planning material and omitted from the
  canonical Screenplay.
- Outline/Beat Board data outside `Content`, including `ListItems` and
  `DisplayBoards`, remains retained in the exact source and ignored by the
  canonical mapper.
- `ScriptNote`/`Script Note` keeps its current retained-only behavior.

Omission here is not silent data loss: the exact FDX remains retained and is the
sole editable screenplay source. Renku is deliberately projecting only the
screenplay content it owns semantically, not importing Final Draft's planning
workspace as screenplay prose or hierarchy.

The rule is type-based, never text-based. A paragraph whose real type is
`Action` or `General` and whose text happens to be `ACT ONE`, `Sequence 4`, or
another structural-looking phrase follows the supported mapping for that
paragraph type. The importer must not inspect capitalization, wording, numbers,
or Outline lane labels to infer hierarchy.

An unknown or custom visible paragraph type still fails atomically with
`SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT`, including its stable FDX path and
paragraph type. Core cannot safely assume that an arbitrary custom type is
noncanonical planning content. The accepted retained-only list above is finite
and directly tested.

### Analysis boundary

Screenplay Analysis must continue to consume only the canonical Project
Screenplay. It must not gain a dependency on the FDX parser, retained source
Asset/File, import record, or raw marker text.

For every FDX-backed Screenplay, `screenplayAnalysisMethod` therefore receives
zero source Acts and returns:

```ts
{ supported: true, model: 'threeAct', sourceActMode: 'flat' }
```

The analyst then derives three analysis-owned segments from ordered canonical
Scenes under the existing hierarchy-independent workflow. This plan does not
change that analysis algorithm or its output schema. It also does not change
Renku-authored Screenplays: exactly three valid Renku-authored Acts may still
produce `sourceActMode: 'sourceThreeAct'`.

The marker exclusion is exact: known FDX marker/outline paragraph types are
absent from canonical context, so analysis cannot use them. Genuine canonical
Action or General prose remains available to analysis even when its wording
resembles an act label; the importer does not reinterpret or censor authored
screenplay content by matching text.

### Retained history and downstream artifacts

Do not migrate or rewrite an existing imported Screenplay just because this
algorithm changes. The next changed FDX refresh compares current canonical
Scene values with the proposed projection and transitions in one normal
refresh.

Previously retained source Assets and Screenplay revisions remain immutable.
When a changed Scene receives a new identity, downstream Analysis, Scene Beat,
Shot Plan, or Dialogue Audio history may still contain the old weak reference.
Refresh does not inspect, rewrite, delete, or block on those artifacts. Existing
historical-read and missing-current-target behavior remains responsible for
displaying that history safely.

## Requirement Ledger

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| R1 | Every canonical field of an FDX-backed Screenplay is read-only in Renku. | Core tests exercise prose, Dialogue, references, Scene operations, and revision restore through the shared read-only gate. |
| R2 | An identical exact source is a no-write refresh. | Integration test compares import row, source files, aggregate, revision count, and resource keys before/after. |
| R3 | A changed valid source applies automatically without diff preview or approval. | Removal/addition/change integration cases return `refreshed` in one call and the CLI exposes no import approval workflow. |
| R4 | A changed Scene is replaced as one whole graph. | Hash-sensitivity tests cover heading, production number, Block type/text/order, Character, extension, Parenthetical type/text, speech, and Dual Dialogue values; replacement tests recursively assert entirely new nested IDs. |
| R5 | One exact, uniquely occurring unchanged Scene may retain its whole graph identity. | Reorder and adjacent-Scene-change tests preserve the complete unchanged graph, including nested IDs, without field matching. |
| R6 | Duplicate exact Scene content never triggers a heuristic identity guess. | Pure content-identity coverage gives proposed duplicate Scenes new identities and preserves correct order/content. |
| R7 | FDX source order is authoritative and production numbers are opaque. | Tests cover reorder with unchanged numbers, reorder with changed numbers, non-monotonic/alphanumeric numbers, and missing numbers without sorting or invention. |
| R8 | Source-only XML/editor changes update provenance without creating a false Screenplay revision. | Changed-SHA/equal-canonical integration case advances source Asset/File and import pointer, retains aggregate/revision IDs, and emits no Screenplay resource keys. |
| R9 | Every FDX canonical projection is flat regardless of Final Draft act, sequence, or outline markers. | Mapper and Core integration tests assert `sections: []`, root-only Scene structure, and exact Scene order for marker-heavy inputs and refreshes. |
| R10 | Known Final Draft formatting/planning paragraphs are retained-only and never guessed into screenplay content or hierarchy. | Unit tests cover `New Act`, `End of Act`, `Sequence`, `Summary`, `Outline 1/2/3`, `Note`, and non-`Content` editor metadata; a custom unknown visible type still fails path-aware and atomically. |
| R11 | FDX markers cannot influence Screenplay Analysis Acts. | Core integration imports marker-heavy FDX, reads analysis context through the public service, and proves `sourceActMode: 'flat'`, ordered canonical Scenes, and no raw FDX marker/source payload. Existing Renku-authored three-Act tests continue to prove `sourceThreeAct`. |
| R12 | Successful semantic refresh atomically retains the source, replaces the aggregate, advances the import pointer, and creates one revision. | Core transaction integration inspects state after success, unsupported content, source races, missing historical files, and exact prior-source reuse. |
| R13 | Weak historical downstream artifacts do not make refresh bidirectional. | One representative downstream-history integration case remains stored against the old Scene while the new Scene applies without cascade or blocker. |
| R14 | Public report and CLI contracts are smaller and direct. | Schema/type/CLI tests accept only `imported`, `refreshed`, and `unchanged`; obsolete approval/diff and Act/Sequence count fields are absent. |
| R15 | Agent skills treat refresh as automatic flat source replacement. | Skill docs/evals contain no removal confirmation/token branch, forbid partial merge or imported Screenplay edits, and state that FDX markers are not source Acts for analysis. |
| R16 | Coverage is layered and scenario-traceable. | The test matrix below maps every requirement to at least one owning-layer test and includes Core, analysis-context, CLI, and browser integration journeys. |
| R17 | Unrelated behavior remains unchanged. | Analysis/navigation/freshness, Renku-authored organization, and existing Studio projections pass their existing tests; no FDX parser or source read enters analysis. |

## Architecture Shape Gate

### Owner and public entrypoint

`packages/core` remains the sole owner of FDX parsing, mapping, source
authority, content equality, read-only enforcement, transaction policy,
revision creation, and structured errors.

Callers continue to use the existing public Core service method:

```ts
projectData.importFdxScreenplay({
  projectName,
  sourcePath,
  homeDir?,
  configPath?,
})
```

The CLI remains a thin adapter over that method. No Studio route, React
component, CLI handler, or skill decides whether content changed, whether a
Scene is reusable, or whether a refresh may apply.

### Intended Core module shape

`packages/core/src/server/screenplay/fdx/` keeps these focused owners:

- `source.ts`: source path validation, byte reading, UTF-8/XML envelope, and
  exact SHA-256;
- `parser/`: bounded XML syntax extraction and rejection of unsafe or unsupported
  XML shapes without deciding screenplay hierarchy;
- `mapping/`: one-pass semantic classification and conversion from ordered
  paragraph types to a complete flat proposed Screenplay, candidates, technical
  log, and counts; `mapping/screenplay.ts` owns the finite retained-only
  paragraph list and rejects unknown/custom visible paragraph types;
- `identifiers.ts`: deterministic proposal IDs from importer version, exact
  source SHA-256, and semantic source path only; no FDX UUID inventory;
- new `content-identity.ts`: canonical Scene/flat-Screenplay hash input
  construction, exact unique whole-Scene reuse, and the mechanical ID
  redirection required by proposed structure/candidates, including full ordered
  redirection when the complete canonical Screenplay is equal;
- `initial-import.ts`: validate and persist the first source/import/aggregate/
  revision transaction;
- `refresh.ts`: thin orchestration of source hash, content identity, validation,
  source-only refresh, semantic refresh, persistence, and report construction;
- `persistence/`: retained source Asset/File and singleton import-record reads/
  writes; and
- `report.ts`, `contracts.ts`, and `schemas.ts`: the small public result contract
  and validation.

Delete, rather than empty or wrap:

- `packages/core/src/server/screenplay/fdx/reconciliation.ts`;
- `packages/core/src/server/screenplay/fdx/diff.ts`; and
- `packages/core/src/server/screenplay/fdx/approval.ts`;
- `packages/core/src/server/screenplay/fdx/mapping/sections.ts`.

`mapping/screenplay.ts` directly appends root-level Scene structure entries and
maintains a single root position counter. It contains no Act/Sequence state
machine and never constructs a `ScreenplaySection`.

Remove FDX `UUID`/`Id` extraction from `parser/types.ts` and
`parser/document.ts` once no current canonical behavior consumes it. The exact
attributes remain preserved in the retained source bytes.

No new `index.ts` is needed inside `fdx/`. The existing package
`packages/core/src/server/index.ts` remains the intentional thin public
entrypoint and exports only the existing public command/service types needed by
callers.

### Bounded internal algorithm

`content-identity.ts` may branch only over the existing finite Screenplay Block,
Dialogue Part, reference target, and Scene structure-entry unions needed to
construct canonical values and redirect exact-equality IDs. It is not a generic
object serializer or sync engine. It does not need Section traversal because an
FDX proposal cannot contain Sections.

The module must not contain:

- edit distance, LCS, fuzzy matching, normalized heading keys, neighbor
  matching, production-number matching, source-ID matching, or position-based
  fallback identity;
- Block-, Dialogue Turn-, or Dialogue Part-level survival decisions;
- a change inventory, removal examples, or approval-token generation;
- persistence, file I/O, database access, reporting, or diagnostics; or
- logic for downstream Analysis, Scene Beats, Shot Plans, or media.

`refresh.ts` must remain orchestration. It may select unchanged, source-only,
or semantic-refresh persistence, but may not absorb canonicalization,
recursive ID traversal, XML mapping, detailed reporting, or downstream cleanup.

The existing screenplay-analysis modules remain the owning layer for analysis.
Do not add an FDX-aware analysis adapter, ownership branch, marker filter, or
source reader. The only planned analysis-area production change is none; focused
integration coverage proves the existing canonical boundary after import.

### Stop conditions

Stop and revise before implementation continues if:

- any FDX marker, planning paragraph, lane label, capitalization pattern, or
  paragraph text is proposed to create a Renku Act/Sequence Section;
- analysis is proposed to read retained FDX bytes, FDX XML, import records, or
  raw marker paragraphs;
- an unknown/custom visible paragraph type is silently discarded instead of
  using the existing path-aware structured diagnostic;
- `content-identity.ts` begins making identity decisions below whole-Scene
  equality;
- a new “sync,” “matching,” “migration,” or “source policy” abstraction is
  proposed for this single one-way importer;
- the CLI or skill starts reproducing content-authority rules;
- `refresh.ts` becomes a combined parser, matcher, persistence service, and
  formatter;
- a compatibility field/alias is proposed for the removed report; or
- tests can pass only by accepting source-text assertions for private function
  names or a monolithic FDX test file.

## Contracts

### Import input

Replace the current FDX-specific input shape with:

```ts
export interface ImportFdxScreenplayInput extends RenkuConfigPathOptions {
  projectName: string;
  sourcePath: string;
}
```

Remove `approvalToken` from this interface and from all Screenplay CLI command
plumbing. The global CLI `--approval-token` remains for generation runs, where
it is an accepted independent contract; help text must no longer imply that it
applies to FDX import.

### Import report

Replace `ImportFdxScreenplayReport` with the exact current-state report:

```ts
export interface ImportFdxScreenplayReport {
  valid: true;
  warnings: [];
  status: 'imported' | 'refreshed' | 'unchanged';
  project: { id: string; projectName: string };
  screenplayImport: {
    id: ScreenplayImportId;
    sourceAssetId: string;
    sourceAssetFileId: string;
    importerVersion: typeof FDX_IMPORTER_VERSION;
    importedAt: string;
    sourceFilename: string;
    sha256: string;
  };
  counts: {
    scenes: number;
    blocks: number;
    dialogueTurns: number;
    productionSceneNumbers: number;
  };
  candidates: ScreenplayImportCandidates;
  resourceKeys: string[];
}
```

Remove these FDX report concepts completely:

- `operation`;
- `FdxRefreshChanges` and `changes`;
- `currentScreenplayRevisionId`;
- `approvalToken`; and
- `approvalRequired`.

`imported` means the first aggregate was created. `refreshed` means a different
exact source was accepted, whether it changed canonical Screenplay content or
only retained source/editor data. `resourceKeys` is non-empty only when the
canonical Screenplay changed. `unchanged` means exact source SHA-256 equality
and no writes.

Update `importFdxScreenplayReportSchema` to require only this shape and reject
the removed fields through `additionalProperties: false`. Update all callers
directly; do not accept both shapes.

### Diagnostics

Delete `SCREENPLAY_FDX_APPROVAL_STALE` from production code and diagnostic
documentation. Do not replace it with a “destructive refresh” warning.

Keep existing structured diagnostics for source, XML safety/limits, invalid
dialogue/structure, unsupported visible content, source retention races,
destination conflicts, invalid stored import state, source-in-use, non-empty
initial import, and the FDX-backed read-only gate.

Known retained-only planning paragraphs do not emit diagnostics. Keep
`SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT` for unknown/custom visible
paragraph types; its message/location must name the encountered paragraph type
and stable FDX path. Do not create special diagnostics for marker omission or
guessed legacy interpretations.

### Persistence

Keep the existing `screenplay_imports` singleton schema, retained
`screenplay_source` Asset/File contract, Screenplay aggregate tables, and
Screenplay revision tables. No Drizzle schema or migration changes are needed.

For a changed-SHA/equal-canonical refresh, add a focused persistence path that
retains the new source and updates the singleton import record in the existing
database/file write-set boundary without replacing the aggregate or inserting a
revision. Do not expose a generic import-record patch API.

## Implementation Slices
### Slice 1: Fix the format boundary and fixture claims

Update the existing synthetic fixture README so `representative.fdx` is clearly
only a parser/mapper feature fixture. Keep or add small repository-authored
paragraph examples only to test the accepted retained-only classification;
never describe them as proof of a universal Final Draft hierarchy.

Update the Studio E2E data README so Fountain files are described as official
Fountain downloads and third-party interoperability/stress inputs, not official
Final Draft fixtures. Do not add controlled Final Draft Act/Sequence/Outline
fixture infrastructure: no FDX hierarchy interpretation remains to prove.

Record the official Final Draft documentation above in the architecture/ADR
rationale. It explains why named format elements and customizable outline lanes
are deliberately not mapped to Renku narrative Sections.

### Slice 2: Collapse the Core identity model

In `identifiers.ts`, generate every proposed ID from exact source SHA-256,
importer version, and semantic source path. Remove source-ID counting and the
optional FDX source-ID argument.

Remove now-unused FDX `UUID`/`Id` extraction from parser types and mapper call
sites. Keep those attributes only in retained bytes.

Add `content-identity.ts` with pure, directly tested functions for:

- canonical Scene content hashes;
- canonical complete flat-Screenplay content hash, excluding IDs but preserving
  exact values and ordered root Scene organization;
- unique exact whole-Scene reuse; and
- candidate/structure ID redirection for an exactly equal reused Scene, plus
  ordered candidate redirection when the complete canonical Screenplay is
  unchanged and the current aggregate is retained.

Delete `reconciliation.ts`. Do not move any heuristic from it into the new
module.

### Slice 3: Replace refresh diff/approval with direct atomic refresh

Refactor `refresh.ts` into the three paths in the source-authority table:

1. exact source no-op;
2. changed source with equal canonical Screenplay; and
3. changed canonical Screenplay.

The exact-source path exits from SHA-256 equality without semantic comparison or
writing. Parsing and mapping still run before that gate because the public
report returns deterministic counts and source candidates and those
noncanonical candidates are not persisted. Every changed source parses, maps,
and validates before persistence. The semantic-refresh path reuses exact unique
unchanged Scene graphs, validates the final complete Screenplay once through the
existing Core validator, then performs one complete aggregate replacement. It
does not issue row-level partial Screenplay updates.

Delete `diff.ts` and `approval.ts`. Remove approval and change-report inputs
from `commands/fdx-import.ts`, `initial-import.ts`, `refresh.ts`, and
`report.ts`.

Ensure a failed parse, mapping, validation, retained-source verification,
database write, or file commit does not advance the import pointer or current
Screenplay revision. Preserve the existing write-set rollback boundary.

### Slice 4: Make every FDX projection flat

Delete `mapping/sections.ts`. Update `mapping/screenplay.ts` so each mapped Scene
immediately receives a root-level structure entry with the next source-order
position. The resulting `sections` array remains empty for every FDX import.

Classify the finite retained-only paragraph set in `mapping/screenplay.ts`:

- `New Act`, `End of Act`, and `Sequence`;
- `Summary`, `Outline 1`, `Outline 2`, `Outline 3`, and `Note`; and
- the already ignored `ScriptNote` / `Script Note` forms.

These paragraphs create no canonical Block, Section, structure entry, candidate,
or technical warning. Ignore non-`Content` Outline/Beat Board/editor metadata.
Continue to reject unknown/custom visible paragraph types with the existing
path-aware structured error.

Do not infer Act or Sequence from text such as `ACT ONE`, `Sequence 4`, outline
level, lane position, or Section-looking capitalization. An Action/General
paragraph is handled according to its declared supported type, even when its
text resembles a marker.

### Slice 5: Shrink the public report and CLI adapter

Update:

- `packages/core/src/server/screenplay/fdx/contracts.ts`;
- `packages/core/src/server/screenplay/fdx/schemas.ts`;
- `packages/core/src/server/screenplay/fdx/report.ts`;
- the Core public service/export types;
- `packages/cli/src/commands/screenplay/fdx-import.ts`;
- `packages/cli/src/commands/screenplay/index.ts`; and
- global CLI help wording in `packages/cli/src/cli.ts`.

Human output has only three outcomes:

- `Imported <filename>`;
- `Refreshed <filename>`; or
- `FDX source is unchanged: <filename>`.

Imported/refreshed output retains exact SHA-256, Scene/Block/Dialogue/number
counts, and candidate counts. Remove Act and Sequence counts from the public
report, JSON schema, human output, CLI snapshots, and skill examples because FDX
imports cannot produce either.

The CLI sends a Studio screenplay mutation notification only when the Core
report contains resource keys. It never computes semantic change itself.

### Slice 6: Replace the test structure with layered coverage

Split the current broad Core FDX test file into focused parser/mapper/content-
identity unit tests and persistence/service integration tests. Keep helpers
close to the owning test layer; do not build a general FDX fixture DSL.

Add a focused Core integration file under
`packages/core/tests/integration/screenplay-fdx-refresh.test.ts` using isolated
temporary Projects and the real `createProjectDataService` boundary.

Extend the existing screenplay-analysis integration coverage with one
marker-heavy FDX import followed by the public analysis-context read. Assert
`sourceActMode: 'flat'`, exact canonical Scene order, and absence of FDX marker
text/raw source fields. Keep the existing Renku-authored `sourceThreeAct` tests
as the counterexample; do not introduce any FDX-specific analysis code.

Add a focused CLI workflow file under
`packages/cli/tests/integration/screenplay-fdx-workflow.test.ts` rather than
adding more cases to the already large general CLI workflow file.

Extend the existing Studio Playwright FDX fixtures and regression spec with one
small synthetic initial/no-op/changed refresh journey through the production
CLI and browser projection. Keep the detailed mutation matrix in Core; do not
duplicate it in Playwright.

### Slice 7: Correct accepted docs, ADRs, and agent contracts

Add
`docs/decisions/0079-use-source-authoritative-replacement-for-fdx-refresh.md`.
It records whole-source/no-op and whole-Scene equality replacement, removal of
approval/reconciliation, source-only refresh semantics, and the flat FDX
projection boundary. Add concise supersession notices to ADRs 0071 and 0075
only where their old reconciliation or FDX hierarchy consequence would
otherwise remain current. Add a concise clarification to ADR 0072 that FDX
cannot supply `sourceThreeAct`; current Renku-authored three-Act membership
remains separate. Do not rewrite their historical context.

Update the current architecture, CLI, diagnostics, fixture, Studio E2E, and
skill documents named below. Leave completed Plan 0178 unchanged.

## Tests And Guardrails

### Unit coverage

Parser tests must cover:

- safe supported XML envelope and exact ordered `Content` extraction;
- unsafe DTD/entity input, malformed XML, depth/attribute/text/paragraph/source
  limits, invalid UTF-8, and unsupported visible children;
- exact Scene `Number` strings, split Text runs, tags, Dialogue,
  Parentheticals, cue extensions, and both Dual Dialogue encodings;
- exact extraction and source order for `New Act`, `End of Act`, `Sequence`,
  `Summary`, `Outline 1`, `Outline 2`, `Outline 3`, `Note`, ScriptNotes, and a
  custom paragraph type; and
- noncanonical editor metadata remaining outside the canonical `Content`
  sequence.

Mapper tests must cover:

- flat opening and Scene order;
- complete ordered Action/Dialogue/Parenthetical/Dual Dialogue mapping;
- missing, alphanumeric, duplicate, and non-monotonic production numbers
  without sorting or invention;
- marker-heavy input always producing `sections: []`, exactly one root
  structure entry per Scene, no `parentSectionId`, and exact source Scene order;
- every known formatting/planning paragraph producing no Section, Block,
  structure entry, candidate, or technical warning;
- Action/General text such as `ACT ONE` never being inspected for hierarchy;
- Outline/editor metadata producing no Sections and unknown visible content
  failing with a path-aware structured diagnostic; and
- all import candidates pointing at current proposed/reused IDs.

`content-identity.ts` tests must cover:

- IDs, source paths, positions, and FDX UUIDs do not affect Scene content hash;
- every canonical Scene field, Block order/value, Dialogue Turn/value,
  Dialogue Part/value, extension, and production number does affect the hash;
- one exact unique Scene reuses the whole current graph;
- a one-character speech change reuses no identity within that Scene;
- reorder-only retains unique exact Scene graphs and changes only organization;
- duplicate hashes on either side are never paired; and
- complete Screenplay semantic equality accounts for opening, Scenes, and
  ordered root Scene structure while excluding IDs, and redirects candidates to
  the retained current aggregate even when identical duplicate Scenes exist.

### Core transaction integration coverage

Each case uses a temporary real Project database and retained project files:

1. initial flat import creates source Asset/File, import record, complete
   aggregate, first revision, candidates, and resource keys;
2. identical exact source returns `unchanged` and changes no row, file,
   timestamp, revision, or resource key;
3. changed ignored/editor-only XML returns `refreshed`, retains the new exact
   bytes/import pointer, and leaves aggregate/revision/resource keys unchanged;
4. one Scene heading change replaces that complete Scene graph;
5. one Action change replaces that complete Scene graph;
6. one Character/cue extension/Parenthetical/speech change replaces that
   complete Scene graph;
7. one Dual Dialogue-side change replaces that complete Scene graph;
8. adding and removing Scenes applies immediately in one call;
9. reordering Scenes follows source order while exact unique Scene graphs may
   survive;
10. production-number-only change replaces that Scene; non-monotonic source
    numbers never reorder Scenes;
11. duplicate exact Scenes do not receive guessed old identities;
12. initial and changed marker-heavy sources always persist zero Sections and
    root-only source-ordered Scene structure;
13. adding, removing, renaming, or reordering only known marker/planning
    paragraphs produces a source-only `refreshed` result: exact new bytes and
    import pointer, but no aggregate replacement, revision, freshness change, or
    Screenplay resource keys;
14. Action/General prose that resembles `ACT ONE` remains canonical prose and
    does not create Sections;
15. unknown/custom visible content fails with no new retained file, import
    pointer, aggregate, or revision;
16. after marker-heavy import, `readScreenplayAnalysisContext` returns
    `sourceActMode: 'flat'`, preserves canonical Scene order, and contains no raw
    FDX marker/source payload;
17. destination conflict/source-changed-during-retention failure preserves the
    entire prior state;
18. successful semantic refresh creates exactly one revision and exposes the
    existing Screenplay resource keys;
19. one representative weak historical dependent remains stored against the
    replaced Scene and neither blocks nor cascades the refresh; and
20. all generic Screenplay mutation categories and revision restore remain
    rejected for FDX ownership, including Dialogue and reference operations.

The test should compare complete before/after Scene ID sets and recursively
collect nested IDs. A changed-Scene assertion that checks only its top-level ID
is insufficient.

### CLI coverage

CLI unit tests cover only adapter responsibilities:

- `--file` normalization/requirement and Core delegation;
- JSON serialization of the exact new schema;
- imported/refreshed/unchanged human output;
- notification only when `resourceKeys` is non-empty; and
- no FDX use of `--approval-token` or approval-specific output.

The CLI integration journey creates a Project, imports a small marker-heavy
synthetic fixture, reruns the exact source, imports a changed source that removes
and changes content, and reads back the canonical Screenplay. It asserts
`imported -> unchanged -> refreshed`, one-call removal application, zero
Sections, exact source order/numbers, complete changed-Scene ID replacement,
and no Act/Sequence counts in JSON or human output.

### Studio browser coverage

One Playwright regression journey must:

1. create an isolated Project;
2. import a small marker-heavy synthetic FDX fixture through the production CLI
   boundary;
3. show a flat Scene tree with no Act/Sequence rows;
4. rerun the exact source and verify no duplicate rows or visible refresh churn;
5. import the second synthetic source state with a moved, changed, added, and
   removed Scene;
6. verify the browser tree and selected Scene content reflect only the new
   source; and
7. verify no Screenplay authoring control appears for the FDX-backed Project.

Keep the existing Big Fish, Brick and Steel, and Last Birthday Card E2E cases as
flat third-party interoperability/stress coverage. They remain intentionally
separate from the small marker-retention regression fixture.

### Coverage accounting and guardrails

Do not introduce a repository-wide percentage gate or a new coverage provider
solely for this slice. Numerical line coverage would not prove the import
transitions, flat projection, or analysis boundary the user is concerned about.

Instead, completion evidence must include:

- a requirement-to-test table naming the exact test for R1-R17;
- direct unit coverage for every remaining production module under
  `screenplay/fdx/` that owns branching behavior;
- branch assertions for all three refresh outcomes and every retained FDX
  structured diagnostic family;
- full Core, analysis-context, and CLI integration suites, not only mocked
  command tests;
- the focused Studio refresh Playwright journey plus existing real-world cases;
- before/after test counts and an explicit list of any untested production
  branch; no listed gap is allowed at completion; and
- mutation-oriented assertions for changed Scene graphs, atomic failure, and
  no-op writes rather than snapshot-only success checks.

Architecture guardrails protect stable behavior and package boundaries:

- Core runtime tests prove invalid input fails before durable writes;
- CLI tests prove it delegates rather than owns source-authority decisions;
- Studio continues to consume Core projections and contains no FDX parser or
  identity logic; and
- no source-text architecture test names private helpers or maintains a list of
  implementation function names.

Use final `rg`/diff inspection to confirm the obsolete approval/diff workflow
is gone; do not add brittle runtime tests that freeze deleted private names.

## Documentation

Update in the Studio repository:

- `docs/architecture/screenplay-fdx-import.md` for sole source ownership,
  hash/no-op/direct refresh, whole-Scene identity, source-only refresh,
  always-flat canonical projection, and retained-only planning paragraphs;
- `docs/architecture/data-model-and-storage.md` where it currently implies
  reconciliation or imported FDX hierarchy rather than source-authoritative,
  flat replacement;
- `docs/architecture/reference/structured-diagnostics.md` to remove
  `SCREENPLAY_FDX_APPROVAL_STALE` and keep path-aware rejection only for unknown
  visible paragraph types;
- `docs/cli/commands.md` for the smaller statuses/report, automatic changed
  refresh, flat FDX projection, smaller counts, and removal of the import
  approval option;
- `docs/ui/studio-screenplay.md` to state that FDX-backed Screenplays always
  render as a flat Scene tree while Renku-authored Screenplays may use Sections;
- `docs/architecture/reference/studio-skills.md` to clarify that FDX-backed
  Screenplays reach the analyst as flat canonical context;
- `docs/decisions/0079-use-source-authoritative-replacement-for-fdx-refresh.md`;
- concise clarification/supersession notes in ADRs 0071, 0072, and 0075;
- `packages/core/src/server/screenplay/fdx/fixtures/README.md` for synthetic
  scope and retained-only marker coverage;
- `packages/studio/e2e/test-data/screenplay-fdx/README.md` and
  `packages/studio/e2e/README.md` for the third-party Fountain distinction; and
- no historical edit to Plan 0178.

Update in the sister `studio-skills` repository:

- `skills/screenplay-drafter/SKILL.md`;
- `skills/screenplay-drafter/references/screenplay-json-workflow.md`;
- `skills/screenplay-drafter/evals/fdx-import-enrichment.md`;
- `skills/screenplay-analyst/SKILL.md`;
- `skills/screenplay-analyst/references/screenplay-analysis-cli-workflow.md`;
- `skills/screenplay-analyst/evals/hierarchy-independent-analysis.md`;
- `skills/movie-director/references/workflow-playbooks.md`; and
- `skills/movie-director/references/specialist-handoff-checklists.md` where its
  current FDX handoff language mentions refresh approval.

The skills must say that a valid changed FDX refresh applies in one call, the
result is exact source replacement rather than merge, every imported
Screenplay field is read-only, and FDX markers/planning paragraphs must never be
invented as Act/Sequence organization. The analyst guidance must state that it
uses only the returned canonical analysis context: FDX-backed Screenplays arrive
as `sourceActMode: flat`, while `sourceThreeAct` remains possible only for
canonical Renku-authored three-Act organization. Remove the destructive
confirmation/token branch; do not weaken user confirmation policy for unrelated
generation runs.

## Final Verification

### Fixture verification

- Confirm small synthetic fixtures are documented only as deterministic
  parser/mapper inputs, not Final Draft conformance evidence.
- Inspect marker-heavy fixture order and verify every accepted retained-only
  paragraph is represented.
- Confirm the Fountain fixtures are still checksum-pinned and documented only
  as third-party interoperability/stress inputs.

### Automated verification

Run focused tests while implementing, then:

```bash
pnpm --dir packages/core test
pnpm --dir packages/core test:integration
pnpm --dir packages/cli test
pnpm --dir packages/cli test:integration
pnpm --filter @gorenku/studio test
pnpm --dir packages/studio test:integration
pnpm --dir packages/studio test:e2e -- screenplay-fdx-import.regression.spec.ts
pnpm check
pnpm test
pnpm test:integration
pnpm build
git diff --check
```

Run the sister `studio-skills` repository validation, release tests, and
relevant forward evals according to its local instructions.

### Real local project verification

Use copies of local Projects for changed-source testing. Do not mutate the
user's populated live Projects.

1. Run the current Big Fish exact source against a copied Project and verify
   `unchanged`, zero writes, 202 source-ordered Scenes, zero Sections, and exact
   production numbers.
2. On an isolated copied/fixture Project, apply a changed FDX that alters one
   Dialogue character, removes one Scene, adds one Scene, and reorders another.
   Verify one-call `refreshed`, complete changed-Scene graph replacement,
   survival only of exact unique unchanged Scenes, and no approval step.
3. Open the Project in Studio and verify the tree/content immediately reflects
   the imported source and exposes no Screenplay authoring controls.
4. Read analysis context after marker-heavy fixture import and verify
   `sourceActMode: 'flat'`; confirm the retained FDX markers are absent from the
   context payload.
5. Verify existing historical analysis/production artifacts remain readable or
   show their accepted missing-current-target state without blocking refresh.

### Architecture-shape review

- Inspect `git diff --stat` and the complete diff in both repositories.
- Confirm `reconciliation.ts`, `diff.ts`, and `approval.ts` are deleted rather
  than wrapped, renamed, or left as compatibility paths.
- Confirm `mapping/sections.ts` is deleted and `mapping/screenplay.ts` creates
  only root-level Scene structure entries.
- Inspect `content-identity.ts` and `refresh.ts` in full; confirm neither became
  a god file and no nested matching/diff/approval logic remains.
- Confirm mapper/parser files contain only the finite retained-only paragraph
  classification and supported screenplay-content mapping.
- Confirm CLI and skills do not decide source authority or semantic equality.
- Confirm screenplay-analysis production code has no FDX parser, retained-source,
  or marker-reading dependency and still supports Renku-authored three Acts.
- Confirm `packages/core/src/server/index.ts` and other `index.ts` files remain
  thin public entrypoints.
- Confirm no source-text architecture test encodes private implementation names.
- Confirm no unrelated Analysis behavior, Renku-authored organization, Studio
  UI, or generation approval behavior changed.
- Confirm no checklist item was satisfied by accepting unreviewable code
  structure or synthetic fixtures presented as Final Draft conformance.

## Completion Evidence

Completed: 2026-08-15

- The FDX-focused test surface increased from 20 broad/adapter/browser cases to
  28 layered cases: 12 parser/mapper/content-identity/report unit cases, seven
  real-database Core refresh cases, four CLI adapter cases, one full CLI
  workflow, and four Playwright cases.
- Core integration covers initial import, exact-source no-op, source-only
  refresh, semantic add/remove/reorder/change, unique whole-Scene reuse,
  duplicate ambiguity, historical analysis freshness, prior-source reuse,
  missing historical retained bytes, source mutation during retention,
  unsupported-content atomicity, and the shared read-only gate.
- The marker-heavy analysis-context case proves `sourceActMode: 'flat'`, exact
  canonical Scene order, and absence of marker/XML payload. Existing analysis
  tests continue to cover Renku-authored `sourceThreeAct` and unsupported Act
  counts.
- The complete FDX Playwright file passes all four cases: Big Fish (including
  exact re-import no-op), Brick and Steel, The Last Birthday Card, and the
  synthetic initial/no-op/changed marker-heavy browser journey.
- `pnpm check`, `pnpm test`, `pnpm build`, focused Core/CLI integration, Studio
  integration, focused FDX Playwright, sister-repository release tests, and
  `git diff --check` pass. The full `pnpm test` result is 238 files and 1,482
  passing tests.
- The aggregate `pnpm test:integration` command reaches four unrelated existing
  CLI expectation failures (Lookbook reference slots, Cast Voice path naming,
  and two Studio server-policy projections). The new FDX CLI workflow and all
  Core/Studio integration tests pass. A broad Playwright run similarly exposed
  unrelated sample-fixture and visual-snapshot failures; the complete focused
  FDX browser suite passes after correcting its stale retained-path assertion.
- Final inspection confirms the old reconciliation, diff, approval, and FDX
  Section-mapping modules are deleted rather than renamed, `content-identity.ts`
  and `refresh.ts` remain focused, public entrypoints stay thin, and no FDX
  parsing or marker interpretation entered Screenplay Analysis.

## Completion Checklist

### Review Area

- [x] Confirm completed Plan 0178 remains unchanged and this plan is the sole
      corrective implementation plan.
- [x] Confirm every canonical part of an FDX-backed Screenplay remains read-only
      in Renku, including Dialogue and references.
- [x] Confirm every new FDX projection is flat and no Final Draft marker or
      planning paragraph creates a Renku Section.
- [x] Confirm Renku-authored Acts/Sequences and their existing analysis behavior
      remain supported and outside the importer simplification.
- [x] Confirm the implementation preserves Core ownership and thin CLI/Studio/
      skill adapters.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new general sync policy, migration framework, broad dispatcher,
      catch-all helper, or god file was added.
- [x] Confirm Analysis navigation/history/freshness and downstream production
      behavior remain unchanged.
- [x] Confirm synthetic marker fixtures are not described as Final Draft
      conformance evidence and Fountain fixtures remain labeled third-party.

### Architecture And Contracts

- [x] Keep `importFdxScreenplay` as the single public Core mutation entrypoint.
- [x] Remove `approvalToken` from `ImportFdxScreenplayInput` and all FDX callers.
- [x] Replace the report statuses with `imported`, `refreshed`, and `unchanged`.
- [x] Remove `operation`, detailed `changes`, current revision ID, approval token,
      and approval-required fields from type and schema.
- [x] Remove FDX Act and Sequence counts from the report type, JSON schema, CLI
      output, tests, docs, and skill examples.
- [x] Update callers directly with no compatibility aliases or fallback reader.
- [x] Delete `SCREENPLAY_FDX_APPROVAL_STALE` without a replacement warning.
- [x] Keep all remaining package-boundary errors structured and path-aware.
- [x] Keep the current database schema, singleton import record, retained source
      model, revision model, and write-set boundary.
- [x] Add only a focused source-only import-pointer persistence path; do not add
      a generic state patch API.

### Identity Simplification

- [x] Generate proposal IDs from source SHA/importer version/path only.
- [x] Remove FDX UUID/Id extraction and identity weighting from canonical code.
- [x] Implement canonical Scene hashes over every canonical Scene value and no
      IDs, source paths, positions, or FDX IDs.
- [x] Reuse a Scene only for a unique exact hash on both sides.
- [x] Reuse the exact whole Scene graph or none of it.
- [x] Give every changed Scene and all nested Blocks/Turns/Parts new identities.
- [x] Treat duplicate hashes as ambiguous and make no identity guess.
- [x] Redirect structure/candidate IDs mechanically only after whole-Scene
      equality is established.
- [x] Implement canonical complete flat-Screenplay equality without a field-
      level change report or Section traversal.
- [x] Rebuild opening content from a changed source; do not reconcile it
      independently.
- [x] Delete reconciliation, diff, and approval modules and their tests.
- [x] Confirm no LCS, fuzzy, heading, neighbor, production-number, source-ID, or
      position fallback matching remains.

### Refresh And Flat Projection Implementation

- [x] Implement exact-source `unchanged` with zero writes and resource keys.
- [x] Implement changed-source/equal-Screenplay provenance refresh without an
      aggregate replacement, Screenplay revision, or freshness invalidation.
- [x] Implement changed-Screenplay automatic atomic source retention, complete
      aggregate replacement, import-pointer update, and one revision.
- [x] Validate the complete final aggregate once at the Core boundary before
      persistence.
- [x] Preserve rollback behavior for parse, mapping, validation, source race,
      destination, database, and file failures.
- [x] Derive Scene order only from ordered FDX content/structure.
- [x] Preserve exact optional production numbers without sorting, inference, or
      renumbering.
- [x] Delete `mapping/sections.ts` and every FDX Act/Sequence state transition.
- [x] Make `mapping/screenplay.ts` create exactly one root-level structure entry
      per Scene and keep `sections: []`.
- [x] Treat `New Act`, `End of Act`, `Sequence`, `Summary`, `Outline 1/2/3`, and
      `Note` as retained-only paragraphs with no canonical output.
- [x] Ignore noncanonical Outline/Beat Board editor metadata.
- [x] Never inspect paragraph text, capitalization, numbering, or lane names to
      infer hierarchy.
- [x] Reject unknown/custom visible paragraph types atomically with the existing
      path-aware structured unsupported-content diagnostic.
- [x] Do not inspect, cascade, repair, or block on weak historical downstream
      artifacts.

### CLI, Studio, And Agent Surfaces

- [x] Remove the FDX approval branch and token plumbing from the CLI.
- [x] Keep the global generation approval-token contract unchanged.
- [x] Print only imported/refreshed/unchanged FDX human outcomes.
- [x] Notify Studio only when Core returns Screenplay resource keys.
- [x] Keep Studio as a projection consumer with no FDX parser, hash, or source-
      authority rules.
- [x] Keep screenplay-analysis production code independent of FDX parsing,
      retained source files, import records, and marker text.
- [x] Confirm imported marker-heavy FDX reaches analysis as
      `sourceActMode: 'flat'` and analysis derives its own segments.
- [x] Update screenplay-drafter import guidance and reference workflow.
- [x] Update screenplay-analyst guidance to distinguish flat FDX context from
      canonical Renku-authored `sourceThreeAct` context.
- [x] Update movie-director workflow/handoff guidance.
- [x] Replace the destructive-refresh skill eval with automatic exact-source
      replacement and complete read-only assertions.
- [x] Confirm skills never infer Acts/Sequences from FDX markers, marker text,
      or Outline lanes.

### Tests And Guardrails

- [x] Split the monolithic FDX test into focused unit and integration ownership.
- [x] Add direct unit tests for parser, mapper, content identity, report schema,
      and every remaining branching FDX production module.
- [x] Cover every canonical Scene field in hash sensitivity tests.
- [x] Recursively assert complete changed-Scene nested ID replacement.
- [x] Cover unique unchanged Scene reuse and duplicate-hash ambiguity.
- [x] Cover source order independently from missing/alphanumeric/duplicate/non-
      monotonic production numbers.
- [x] Cover exact source no-op and source-only provenance refresh.
- [x] Cover Scene add/remove/change/reorder through real Core persistence.
- [x] Cover marker-heavy initial import and refresh with zero Sections and root-
      only Scene structure.
- [x] Cover marker-only changes as source-only refreshes with no Screenplay
      revision, resource keys, or analysis freshness change.
- [x] Cover every known retained-only planning paragraph and Action/General text
      that resembles an Act marker.
- [x] Cover unknown/custom visible content as an atomic no-write failure.
- [x] Add a Core integration test that imports marker-heavy FDX and reads public
      analysis context as `sourceActMode: 'flat'` with no raw marker/source data.
- [x] Keep existing Renku-authored `sourceThreeAct` tests passing.
- [x] Cover every invalid/unsupported refresh as an atomic no-write failure.
- [x] Cover one weak historical downstream artifact without cascade or blocker.
- [x] Cover all generic Screenplay mutation categories, including Dialogue and
      references, through the shared FDX read-only gate.
- [x] Add a full CLI imported/unchanged/refreshed workflow with automatic
      removals and read-back.
- [x] Add one Studio browser initial/no-op/changed refresh journey.
- [x] Keep existing three flat real-world interoperability/stress E2E cases.
- [x] Produce an R1-R17 requirement-to-test table, before/after test counts, and
      an empty list of untested FDX production branches.
- [x] Do not add architecture tests that encode private function or file
      inventories as source-text names.

### Documentation And ADRs

- [x] Add ADR 0079 for source-authoritative FDX replacement and always-flat FDX
      projection.
- [x] Add narrow clarification/supersession notes to ADRs 0071, 0072, and 0075
      without rewriting history.
- [x] Correct the FDX architecture, data-model, and Studio Screenplay wording.
- [x] Correct CLI contract and structured-diagnostic documentation.
- [x] Document synthetic/third-party fixture evidence boundaries without adding
      an unused controlled Final Draft hierarchy fixture system.
- [x] Update current Studio E2E fixture documentation.
- [x] Update the named screenplay-drafter, screenplay-analyst, and movie-director
      skill docs and evals.
- [x] Leave completed Plan 0178 unchanged.

### Final Verification

- [x] Verify synthetic marker fixtures exercise the finite retained-only list
      and are not labeled as conformance inputs.
- [x] Run focused Core unit and integration tests.
- [x] Run focused Screenplay Analysis context/validation/write tests.
- [x] Run focused CLI unit and integration tests.
- [x] Run Studio unit/integration tests and focused FDX Playwright regression.
- [x] Run sister-repository skill validation, release tests, and relevant evals.
- [x] Run `pnpm check`, `pnpm test`, `pnpm test:integration`, and `pnpm build`.
- [x] Run `git diff --check` in both repositories.
- [x] Verify unchanged Big Fish behavior on a copied Project and changed refresh
      behavior on an isolated Project.
- [x] Inspect `git diff --stat` and the complete diff in both repositories.
- [x] Inspect every new large or heavily modified file in full.
- [x] Confirm deleted reconciliation/diff/approval behavior was not renamed or
      moved elsewhere.
- [x] Confirm deleted FDX Section mapping was not moved into the parser, mapper,
      analysis, CLI, Studio, or skills.
- [x] Confirm `content-identity.ts` and `refresh.ts` remain focused and shallow.
- [x] Confirm all `index.ts` files remain thin public entrypoints.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure, FDX hierarchy inference, or synthetic conformance claims.
- [x] Only then mark this plan complete.
