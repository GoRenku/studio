# 0178 Continuous FDX Synchronization And Screenplay Analysis Navigation

Status: completed
Date: 2026-08-15
Completed: 2026-08-15

## Review Attention

- This plan adds continuous FDX refresh, content-bound destructive approval,
  source-Act-aware three-act analysis eligibility, analysis freshness, and the
  top-level Analysis navigation described below. It adds no adjacent workflow.
- Public contract changes are limited to the typed FDX refresh report and
  approval token, `sourceOwnership`, analysis eligibility/freshness fields, the
  `--approval-token` import option, and the documented structured diagnostics.
- There are no database migrations, cleanup operations, file moves, or data
  deletions. Existing FDX sources and analysis revisions remain immutable.
- Generic FDX-backed Screenplay mutations, the analysis JSON/table shape, the
  existing analysis chart, Renku-authored batch operations, and all three live
  project databases remain deliberately unchanged; the chart only gains the
  required missing-historical-Scene fallback.
- Live-project verification was non-destructive: the three known states were
  audited and Big Fish's current source was exercised as an identical no-op.
  Mutating refresh, analysis, and hierarchy acceptance used isolated project
  fixtures so no unreviewed analysis or organization was written to live work.
- No remaining scope expansion or implementation decision requires approval.

## Summary

Extend the existing one-time Final Draft import into a continuous, one-way FDX
synchronization workflow. For an FDX-backed screenplay, the imported file is
the sole source of truth for screenplay prose, Scene existence and order,
exact authored Scene numbers, and any explicit Act/Sequence hierarchy.

Do not create a second Renku organization overlay for an imported screenplay.
If the FDX is flat, the Screenplay sidebar remains a flat Scene list. If the FDX
contains Acts or Sequences, import that hierarchy exactly and display it as
read-only. A later FDX refresh mirrors additions, removals, renames, reordered
Sections, Scene moves, and all screenplay content changes from the source.

Keep Screenplay Analysis separate from screenplay organization. Move the
existing Screenplay Analysis destination beneath a new top-level **Analysis**
sidebar section without redesigning the existing analysis display. “Analyze
this screenplay” continues to persist a self-contained analysis JSON document
and make it active while leaving the Screenplay aggregate untouched.

Screenplay Analysis supports only the three-act methodology in this iteration:

- With no source Acts, derive three analytical Act segments inside the existing
  analysis JSON. They appear only in the Analysis display and do not create
  Screenplay Sections or move Scenes.
- With exactly three source Acts, use the source Acts as the current structure,
  evaluate their effectiveness, and express better-boundary feedback through
  the existing suggestions UI. Do not create competing analytical boundaries
  or mutate the source Acts.
- With any other number of source Acts, do not analyze. The agent explains that
  Renku currently supports only three-act analysis. Other named methodologies
  may be added deliberately in future work.

Retain the existing analysis revision history and self-contained JSON storage.
Do not introduce analysis hierarchy tables, Act/Sequence foreign keys, or new
cross-document relationships. Existing historical analyses must remain
loadable even when their Scene references no longer exist in the current
screenplay.

Changed FDX refreshes use a preview-first safety flow. When the proposed
refresh removes screenplay material or hierarchy, return a complete removal
summary and an approval token. The agent must explain those removals and obtain
explicit confirmation before applying the exact source-backed result.

No FDX export, bidirectional merge, conversion of a Renku-authored screenplay
into an FDX-backed screenplay, alternate analysis methodology, analysis-history
comparison format, or browser-based screenplay organization authoring is part
of this plan.

## Decisions

### Source ownership

| Screenplay kind | Screenplay owner | Act/Sequence behavior |
| --- | --- | --- |
| FDX-backed, flat | FDX | Remains flat; Renku and the agent cannot create organization |
| FDX-backed, organized | FDX | Import and mirror the source hierarchy exactly; read-only in Renku |
| Renku-authored | Renku | The AI agent may create and revise Acts/Sequences through existing batch Screenplay operations |
| Renku-authored later given an FDX | Unsupported | Do not attempt conversion or merge in this iteration |

For any FDX-backed screenplay, generic Screenplay mutations and revision
restores remain blocked by `SCREENPLAY_FDX_BACKED_READ_ONLY`. There is no
special organization exception.

### Analysis behavior

| Source Act state | “Analyze this screenplay” behavior |
| --- | --- |
| No Acts | Derive and persist a three-act analysis; analytical segments live only in analysis JSON |
| Exactly 3 Acts | Analyze the source structure; persist the existing analysis shape; suggest boundary improvements without changing Acts |
| 1, 2, 4, 5, or more Acts | Refuse before generation and explain that only three-act analysis is supported |

Source Sequences are useful context but do not select the analysis methodology
and do not become analytical Scene Groups automatically. A screenplay with
Sequences but no Acts follows the “No Acts” behavior.

When exactly three source Acts exist, every current Scene must be representable
in their ordered hierarchy for analysis to proceed. A malformed source
hierarchy is reported as unsupported input rather than silently repaired.

### Source structure versus structural feedback

Source Acts are factual screenplay organization. The analysis evaluates that
organization critically.

If the analyst believes an Act boundary should move, the persisted analysis
uses the existing suggestions contract to identify the relevant Scene and
recommend moving the boundary earlier or later. The analysis does not apply
that recommendation.

The user can respond outside this workflow:

- For an FDX-backed screenplay, change the boundary in the screenwriting tool,
  export a new FDX, and refresh the Renku import.
- For a Renku-authored screenplay, ask the AI agent to apply the accepted
  structural change through existing batch Screenplay operations.

### Analysis persistence and history

Preserve the current persistence model:

- `screenplay_analysis.document` remains one self-contained JSON document.
- `screenplay_analysis_state.active_analysis_id` continues to select the active
  document.
- Each rerun creates a new analysis revision and makes it active.
- Earlier analysis documents remain available as history.
- No new analysis tables, organization rows, Section links, or source-revision
  foreign keys are introduced.

Validation has two intentionally different modes:

1. **New write validation** validates the proposed analysis shape and verifies
   its Scene references against the current screenplay.
2. **Historical read validation** verifies only that the stored document is a
   readable supported analysis document. It must not reject the document
   because a referenced Scene was later changed or removed.

The existing UI must render a historical or active analysis with unresolved
historical Scene references without crashing. Missing current-scene navigation
is disabled or shown as unavailable while the original analysis text remains
readable.

Defining a richer agent-facing comparison format for multiple historical
analyses is deferred. This plan only preserves the documents and guarantees
that they remain readable for future UI and agent-history work.

### Analysis freshness

An active analysis remains visible after the screenplay changes. Its status is
shown as **Needs refresh** with tooltip/help text:

> Screenplay changed since this analysis.

Derive this state from existing analysis and Screenplay revision timestamps (or
an equivalent value already available in the current persistence model). Do
not create a new analysis-to-revision relationship merely to display freshness.

The state changes only after a successful screenplay mutation or changed FDX
refresh. An unchanged FDX no-op does not mark the analysis as needing refresh.
Renku never invokes an LLM automatically during import.

### Destructive FDX refresh approval

Initial import keeps the existing validate-and-import flow because it cannot
remove an existing screenplay.

For a changed refresh:

1. Parse and validate the complete proposed FDX.
2. Reconcile stable imported identities conservatively.
3. Compute the exact current-to-proposed diff.
4. If the diff includes removals, return `approvalRequired` with the complete
   removal summary and a content-bound approval token. Do not mutate data.
5. The agent explains the removals to the user and requests confirmation.
6. On confirmation, rerun with the approval token.
7. Reject a stale token if the current Screenplay revision or source-file hash
   differs from the preview.
8. Apply the exact proposed screenplay and source hierarchy atomically.

The removal summary covers at least:

- Opening elements;
- Acts;
- Sequences;
- Scenes;
- Scene blocks and dialogue content; and
- references removed because their target screenplay content disappeared.

Report renames, additions, reordered items, Scene moves between source
Sections, and Scene-number changes as non-removal changes so the user sees the
full impact of the refresh. The confirmation requirement is specifically
triggered by removals.

The applied result must mirror the confirmed FDX exactly. Approval does not
enable a partial merge or selective retention of deleted source material.

## Requirement Ledger

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| R1 | FDX remains the only source of truth for imported screenplay content, Scene order, Scene numbers, and explicit hierarchy. | Imported content and Sections change only through initial/refresh import; generic apply and restore remain blocked. |
| R2 | A flat FDX must remain flat in the Screenplay UI. | Big Fish continues to contain 202 root Scenes and zero Screenplay Sections after analysis. |
| R3 | Explicit source Acts and Sequences must be imported and mirrored exactly. | Fixtures cover add, remove, rename, reorder, nesting, and Scene movement between source Sections. |
| R4 | Source-backed Acts and Sequences are read-only. | Core, CLI, agent, and Studio tests prove no organization-editing path exists for FDX-backed Screenplays. |
| R5 | Renku-authored Screenplays may be organized by the AI agent. | Existing `screenplay apply` batch creates/revises Acts and Sequences atomically for a Renku-owned fixture. |
| R6 | Analysis never mutates screenplay content or organization. | Before/after aggregate equality tests cover flat, 3-Act FDX, and Renku-authored Screenplays. |
| R7 | Flat Screenplays support three-act analysis. | Big Fish analysis persists three analytical segments in the existing JSON and appears under Analysis. |
| R8 | Exactly 3 source Acts are evaluated as the screenplay’s current structure. | Analysis context exposes source boundaries; suggestions can recommend earlier/later boundaries without alternate Sections. |
| R9 | Other source Act counts are unsupported. | Preflight tests reject 1, 2, 4, and 5 Acts before model generation with a clear three-act-only message. |
| R10 | Screenplay Analysis moves beneath a top-level Analysis sidebar section without a redesign. | Existing analysis component and document rendering tests pass at the new navigation destination. |
| R11 | Analysis history survives screenplay evolution. | Historical JSON with removed Scene IDs loads in CLI/context and renders without referential-validation failure. |
| R12 | Changed screenplay makes active analysis show Needs refresh. | Successful changed import/apply toggles the badge; unchanged import does not; tooltip text is exact. |
| R13 | Destructive refresh requires explicit confirmation. | Preview makes no writes; stale or missing tokens fail; confirmed token commits the reviewed diff. |
| R14 | Continuous import preserves exact source Scene numbers and stable identities where unambiguous. | Reimport fixtures cover text edits, insertions, deletions, reordering, and renumbering. |
| R15 | Keep analysis persistence simple. | No new analysis table, hierarchy projection, Section foreign key, or hidden organization is added. |
| R16 | No user-facing migration is needed for the three known projects. | Local audit records Big Fish as flat FDX, Urban Basilica as organized Renku-authored, and Free Willy as empty. |

## Current Evidence

### Local project audit

Read-only inspection on 2026-08-15 found:

| Project | FDX import | Acts | Sequences | Scenes | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Big Fish | 1 | 0 | 0 | 202 | Valid flat FDX-backed state |
| Free Willy | 0 | 0 | 0 | 0 | Empty Screenplay |
| Urban Basilica | 0 | 3 | 5 | 10 | Valid Renku-authored organized state |

There is no FDX-backed project with Renku-created Acts or Sequences. Do not add
a user-facing migration or compatibility behavior for that unsupported state.

### Existing batch behavior

`renku screenplay apply --file <operations-json>` already accepts one JSON
document containing an arbitrary non-empty `operations` array. Core validates
the final aggregate and commits it atomically in one transaction.

Keep this batch behavior for Renku-authored screenplays. The agent can create
or revise Acts and Sequences in one call even for a large screenplay. No new
organization command or `screenplay-organizer` skill is needed.

For FDX-backed screenplays, the current read-only gate remains the correct
behavior. Do not weaken it to permit Section-only operations.

### Existing analysis behavior

The current Screenplay Analysis is already hierarchy-independent:

- It stores one JSON document.
- It references Scenes but not Screenplay Section IDs.
- It contains three analytical Act segments.
- It validates before writing.
- It retains prior documents and an active-analysis pointer.
- It does not mutate Scenes.

This plan changes context selection and navigation, not the fundamental
analysis storage design or existing analysis display.

### Existing import limitations

The current importer:

- only imports into an empty Screenplay;
- stores one singleton `screenplay_import` record;
- rejects any later import;
- retains exact source bytes as a Project Asset/File; and
- derives imported IDs from the entire source SHA-256 plus importer version and
  XML semantic path.

The whole-file hash in every ID means any byte change currently churns all
imported identities. Continuous refresh therefore requires conservative
identity reconciliation, but it does not require a new organization model or
new analysis relationships.

### Big Fish analysis evidence

The temporary free-form analysis remains at:

```text
/Users/keremk/renku-movies/big-fish/tmp/scratch/big-fish-three-act-analysis.txt
```

It proposes analytical Act I as Scenes 1–49, Act II as Scenes 50–136, and Act
III as Scenes 137–202. It is review input only and is not a Screenplay Section
hierarchy or alternate source of screenplay truth.

## Architecture Shape Gate

### Core ownership

Core owns:

- FDX parsing and normalization;
- initial-versus-refresh command selection;
- conservative imported identity reconciliation;
- exact source hierarchy projection;
- current-to-proposed diff calculation;
- destructive-change approval-token calculation and verification;
- atomic source retention and Screenplay replacement;
- analysis eligibility from source Act count;
- current-write versus historical-read analysis validation; and
- analysis freshness calculation.

CLI and HTTP adapters only parse input, call Core, and serialize typed reports.
React reads typed state and renders it.

### Persistence constraints

Prefer the existing persistence model:

- Keep one current `screenplay_import` record pointing at the latest retained
  source Asset/File.
- Use existing immutable Project Asset/File storage for each accepted source
  file.
- Use existing `screenplay_revision` snapshots for screenplay history.
- Keep `screenplay_analysis` and `screenplay_analysis_state` unchanged unless a
  concrete implementation blocker proves a minimal column change necessary.
- Do not add source-organization, analysis-organization, analysis-Act,
  analysis-Scene-group, or analysis-to-revision tables.
- Do not add a user-facing data migration for the three local projects.

Approval tokens are deterministic and content-bound. They do not require a
persistent approval table.

### Intended module boundaries

Keep focused modules rather than expanding one import service:

```text
packages/core/src/screenplay/
  screenplay-fdx-importer.ts              existing parser/normalizer
  screenplay-fdx-import-command.ts         initial import orchestration
  screenplay-fdx-refresh-command.ts        refresh orchestration
  screenplay-fdx-reconciliation.ts         conservative identity matching
  screenplay-fdx-diff.ts                   typed source diff and removals
  screenplay-fdx-approval.ts               preview token binding/verification
  screenplay-analysis-command.ts           analysis write/read/history
  screenplay-analysis-eligibility.ts       flat/3-Act/unsupported decision
  screenplay-analysis-freshness.ts         Needs refresh calculation
```

Exact filenames may follow current repository conventions, but the ownership
boundaries must remain visible and independently testable.

### Forbidden shapes

- No Renku organization overlay for an FDX-backed screenplay.
- No compact range organization document for imported Screenplays.
- No `screenplay organization` CLI family.
- No `screenplay-organizer` skill.
- No analysis-triggered Screenplay mutation.
- No hidden Screenplay Sections created from analytical Acts.
- No alternate Act hierarchy stored beside source Acts.
- No new analysis hierarchy or linkage tables.
- No referential revalidation of historical analyses against the latest
  screenplay during reads.
- No automatic LLM analysis during import.
- No silent application of source removals.
- No partial merge that retains content deleted from a confirmed FDX.
- No Scene-number allocation or normalization for FDX Scenes.
- No conversion of a Renku-authored Screenplay into an FDX-backed Screenplay.

## Public Contracts

### Continuous import command

Keep one user-facing command:

```bash
renku screenplay import-fdx --file /absolute/path/script.fdx --json
```

Behavior:

- No import record and empty Screenplay: initial import.
- Existing import and identical retained source hash: successful no-op.
- Existing import and changed source: validate and compute a refresh.
- Existing non-FDX Screenplay: fail as unsupported; do not convert.
- Changed refresh with no removals: apply atomically and report the diff.
- Changed refresh with removals: return approval-required preview without
  mutation.

Confirmed destructive refresh:

```bash
renku screenplay import-fdx \
  --file /absolute/path/script.fdx \
  --approval-token <token> \
  --json
```

Representative preview response:

```json
{
  "status": "approvalRequired",
  "operation": "refresh",
  "sourceSha256": "...",
  "currentScreenplayRevisionId": "screenplay_revision_...",
  "changes": {
    "acts": { "added": 0, "removed": 2, "renamed": 0, "reordered": 0 },
    "sequences": { "added": 0, "removed": 4, "renamed": 0, "reordered": 0 },
    "scenes": { "added": 3, "removed": 17, "updated": 28, "moved": 5 },
    "productionNumbersChanged": 3,
    "blocksRemoved": 41,
    "referencesRemoved": 6
  },
  "approvalToken": "sha256:..."
}
```

The exact report follows shared diagnostics conventions and includes bounded
examples of removed titles/numbers plus complete machine-readable counts.

### Analysis context

`renku screenplay analyze context --json` must expose enough factual structure
for the agent to select the supported path without another traversal:

```json
{
  "analysisMethod": {
    "supported": true,
    "model": "threeAct",
    "sourceActMode": "flat"
  },
  "screenplay": {},
  "activeAnalysis": null,
  "activeAnalysisFreshness": "current"
}
```

For exactly three source Acts, `sourceActMode` is `sourceThreeAct` and the
context includes their ordered Scene membership. For any other positive Act
count, `supported` is false and the diagnostic explains the three-act-only
restriction.

Do not add Screenplay Section IDs to the persisted analysis document merely
because source Acts were used as context.

### Analysis reads and writes

Keep the existing validate/write/show/history contracts. Clarify their
validation responsibilities:

- `validate` and `write` for a new analysis use current-screenplay validation.
- `show --active`, historical `show`, and history listing do not fail because
  old Scene IDs are absent from the current screenplay.
- Responses include the computed freshness state for the requested document.
- The active response exposes `needsRefresh: true|false` and tooltip/help copy
  without altering the stored analysis JSON.

### Renku-authored organization

Use the existing batch contract:

```bash
renku screenplay apply --file <operations-json> --json
```

The screenplay-drafter skill may produce one operations document containing
all required Section additions and Scene moves. Core applies the operations in
one transaction. The skill must preflight provenance and refuse to author the
batch when an FDX import record exists.

## Conservative Identity Reconciliation

Continuous import must preserve durable Scene and nested-content IDs when the
same source element can be matched unambiguously. It must not use fuzzy prose
similarity to guess identity.

Apply deterministic evidence in order, removing matches after each pass:

1. Stable source identifiers explicitly present in FDX, when available and
   unique.
2. Unique unchanged production number plus compatible Scene identity evidence.
3. Longest common subsequence of exact normalized Scene fingerprints.
4. Unique exact Scene heading constrained by already matched neighboring
   Scenes.
5. Allocate a new ID when identity remains ambiguous.

Nested blocks, dialogue values, source Sections, and structure entries use the
same conservative parent-local principle. Exact source numbers remain opaque
labels and are never sort keys or general identity.

Reconciliation output feeds the diff preview. An unmatched current item is a
removal; an unmatched proposed item is an addition. The approval token binds
the reconciled proposed result, not just the raw filename.

## Implementation Slices

### Slice 1 — Lock the simplified ownership decision

- Update the plan and architecture decision language so FDX hierarchy is
  source-owned, not a Renku annotation overlay.
- Remove proposed organization provenance, translation, range contracts, and
  organizer-skill work from scope.
- Document the three supported project states and the unsupported conversion.
- Record the three-project audit as acceptance evidence.

### Slice 2 — Separate parser output from persisted imported IDs

- Make the FDX parser produce a normalized candidate aggregate with source
  evidence suitable for reconciliation.
- Preserve all existing XML safety, size, nesting, and diagnostic limits.
- Continue importing explicit Acts/Sequences and flat Scenes exactly as parsed.
- Keep exact authored production numbers unchanged.

### Slice 3 — Add conservative refresh reconciliation

- Match current imported Scenes and nested values to the normalized candidate.
- Preserve IDs only on unambiguous evidence.
- Allocate new IDs for ambiguous/new values.
- Produce stable ordered before/after aggregates and reconciliation diagnostics.
- Ensure flat source remains flat and explicit hierarchy exactly mirrors source.

### Slice 4 — Add typed diff and destructive approval

- Compute additions, removals, updates, moves, renames, reordered Sections,
  Scene-number changes, and reference effects.
- Classify removals as approval-requiring.
- Build a deterministic token from the current Screenplay revision, retained
  source hash, proposed source hash, importer version, and normalized diff.
- Return preview without persistence.
- Verify the token before confirmed apply and reject stale approvals.

### Slice 5 — Turn import into initial-or-refresh orchestration

- Preserve initial empty-Screenplay import behavior.
- Return a successful no-op for an identical source hash.
- Apply non-destructive changed refreshes atomically.
- Require approval for destructive refreshes.
- Retain accepted FDX bytes as the current source Asset/File.
- Write one new Screenplay revision and update the singleton import pointer in
  the same transaction.
- Preserve FDX read-only enforcement after every path.

### Slice 6 — Make analysis source-structure-aware

- Add a pure eligibility function for zero, exactly three, and unsupported Act
  counts.
- Include explicit source Act/Sequence context in the analysis-context command.
- For a flat screenplay, keep current analytical Act derivation.
- For exactly three source Acts, require analysis segments to reflect the
  source Scene partition and place ideal-boundary disagreement in suggestions.
- Reject all other positive Act counts before model work.
- Keep the analysis JSON and table model unchanged.

### Slice 7 — Make historical analysis reads forgiving

- Separate document-shape parsing from current-screenplay referential checks.
- Keep current validation strict for new writes.
- Skip current referential checks for stored historical reads.
- Make current UI scene-link helpers tolerate a missing Scene.
- Preserve all historical prose, evidence, scores, and suggestions.
- Do not add the deferred multi-analysis comparison/context format.

### Slice 8 — Add Needs refresh state

- Compute freshness using existing Screenplay revision and analysis timestamps.
- Add typed freshness state to analysis read/context responses.
- Show **Needs refresh** with tooltip “Screenplay changed since this analysis.”
- Keep the active analysis visible and otherwise unchanged.
- Do not mark it after unchanged import no-ops.

### Slice 9 — Move navigation under Analysis

- Add a top-level Analysis sidebar section designed to accept future analysis
  document types.
- Add only Screenplay Analysis in this iteration.
- Move/repoint the current Screenplay Analysis navigation entry.
- Reuse the existing analysis display, routes/state owners where practical, and
  document rendering without visual redesign.
- Do not add empty Character, Theme, or Structure Analysis placeholders yet.

### Slice 10 — Update agent skills

- Update `screenplay-analyst` so “Analyze this screenplay” always validates and
  writes a new active analysis revision.
- Teach it the flat, source-three-Act, and unsupported-Act-count branches.
- Require it never to call Screenplay mutation commands during analysis.
- Teach it to express source-boundary criticism through existing suggestions.
- Update `screenplay-drafter` so organization edits are available only for
  Renku-authored Screenplays and are sent as one operations batch.
- Update FDX import guidance so the agent reports destructive preview details
  and obtains confirmation before retrying with the approval token.
- Update `movie-director` routing for the new Analysis sidebar destination.
- Do not create a screenplay-organizer skill.

### Slice 11 — Documentation and real-project acceptance

- Update FDX import, Screenplay ownership, CLI, and analysis documentation.
- Run Big Fish flat-analysis acceptance.
- Run Urban Basilica Renku-authored hierarchy acceptance.
- Keep Free Willy unchanged.
- Remove superseded plan language and temporary implementation fixtures only
  when they are no longer needed for review.

## Tests And Guardrails

### FDX parsing and exact hierarchy

- Flat FDX imports zero Sections and all Scenes at root.
- Nested explicit Acts/Sequences import in exact source order.
- Source titles and nesting are preserved.
- Scenes outside source Sections are mirrored rather than repaired.
- Added, removed, renamed, and reordered Sections are mirrored on refresh.
- Scene movement between source Acts/Sequences is mirrored.
- Source removal of all Sections returns the screenplay to a flat list after
  confirmed destructive refresh.
- Existing XML safety, invalid-format, and size-limit tests remain green.

### Source read-only enforcement

- All generic `screenplay apply` operations fail for FDX-backed Screenplays,
  including Section-only batches.
- Screenplay revision restore remains blocked for FDX-backed Screenplays.
- Studio exposes no editable controls for imported Acts/Sequences.
- Agent skill evals never attempt imported organization mutation.
- Analysis never changes aggregate JSON, revision count, Scene order, numbers,
  Sections, or structure entries.

### Continuous refresh and identity

- Identical source hash is a no-op and does not create a revision.
- Scene text edit preserves Scene ID where identity is unambiguous.
- Scene insertion allocates one new ID and preserves neighboring IDs.
- Scene deletion preserves surviving IDs and reports one removal.
- Scene reorder follows FDX order without renumbering or identity churn.
- Exact source renumbering is reflected without treating the number as order.
- Ambiguous duplicate headings/numbers allocate new IDs instead of fuzzy match.
- Nested block/dialogue identity is preserved only when unambiguous.
- Atomic failure retains the previous source pointer and complete Screenplay.

### Destructive approval

- Removal preview performs zero database and file-pointer writes.
- Preview reports Act, Sequence, Scene, block, and reference removals.
- Additions/renames/moves/renumbers are visible in the same report.
- Missing approval token rejects destructive apply.
- Token for a different source hash rejects.
- Token for an earlier current revision rejects.
- Confirmed token applies exactly the previewed result.
- Reusing a consumed/stale token after state changes rejects.
- Non-destructive refresh follows the documented no-approval path.
- Agent eval quotes the important removal counts and asks for confirmation
  before executing the confirmed command.

### Three-act analysis eligibility

- Zero Acts permits three-act analysis.
- Exactly three Acts permits analysis.
- One, two, four, five, and six Acts reject before generation.
- Sequences with zero Acts still permit flat three-act analysis.
- Three Acts with nested Sequences permit analysis.
- Three source Acts that cannot partition all Scenes reject as malformed input.
- Unsupported diagnostic clearly states that only the three-act method is
  currently known/supported.

### Analysis semantics

- Flat analysis partitions every current Scene once across three analytical
  Act segments.
- Exactly-three-source-Act analysis reflects the source Scene membership.
- Boundary criticism appears as suggestions and creates no alternate hierarchy.
- Analysis writes a new revision and makes it active.
- Prior analysis revisions remain stored.
- “Analyze this screenplay” performs no Screenplay mutation calls.
- Big Fish persists the existing three-act JSON shape while Screenplay remains
  202 root Scenes and zero Sections.

### Historical read compatibility

- A historical analysis whose Scene still exists loads and navigates normally.
- A historical analysis whose Scene was removed still loads.
- Missing Scene navigation is unavailable without hiding analysis prose.
- Historical reads do not run current-scene coverage validation.
- New writes still reject missing, duplicate, out-of-order, or incomplete
  current Scene references.
- Older supported analysis JSON versions continue to parse under the existing
  compatibility policy.
- History listing does not require every historical document to validate
  against current screenplay state.

### Needs refresh

- Current analysis without later Screenplay revision has no badge.
- Changed FDX refresh shows Needs refresh.
- Renku-authored Screenplay apply shows Needs refresh.
- Unchanged FDX no-op does not show Needs refresh.
- The active analysis remains visible and selectable.
- Tooltip text is exactly “Screenplay changed since this analysis.”
- Writing a new analysis clears Needs refresh for the new active revision.
- Older history remains historical and loadable.

### Renku-authored batch organization

- One operations document can add three Acts, nested Sequences, and move many
  Scenes in one transaction.
- Batch validation is atomic: one invalid operation writes nothing.
- Scene IDs and production numbers remain unchanged by organization.
- Agent skill uses one `screenplay apply` call, not one call per Scene.
- Provenance preflight prevents the same workflow on an FDX-backed Screenplay.

### Studio navigation and rendering

- Analysis appears as a top-level sidebar section.
- Screenplay Analysis is its only child in this iteration.
- Existing Screenplay Analysis content and layout remain visually unchanged.
- Flat FDX screenplay tree remains flat after analysis.
- Source Acts/Sequences render in the Screenplay tree after import/refresh.
- Imported hierarchy has no authoring controls.
- Needs refresh badge and tooltip are accessible by keyboard and assistive
  technology.
- Missing historical Scene targets do not crash rendering.

### Architecture guardrails

- No analysis code imports Screenplay mutation commands.
- No FDX refresh code imports analysis generation/model code.
- No organization-overlay table or service exists.
- No new analysis hierarchy/link table exists.
- No Section IDs are added to persisted analysis JSON.
- No controller or React component owns reconciliation or approval rules.
- Focused Core files remain within repository size/complexity thresholds.

## Documentation

Update:

- `docs/architecture/screenplay-fdx-import.md` for initial/refresh/no-op,
  source-owned hierarchy, reconciliation, and destructive approval;
- Screenplay CLI documentation for `--approval-token` and typed reports;
- analysis documentation for flat versus source-three-Act semantics,
  three-act-only eligibility, history reads, and Needs refresh;
- Studio navigation documentation for the new Analysis parent;
- `screenplay-analyst`, `screenplay-drafter`, and `movie-director` skill
  references and evals; and
- relevant ADR language that could otherwise imply Renku may overlay Sections
  on an imported screenplay.

Document explicitly:

- FDX-backed screenplay and hierarchy are read-only;
- a flat FDX remains flat;
- analytical Acts are analysis content, not Screenplay organization;
- non-three-Act source structures cannot currently be analyzed;
- destructive source removals require preview and confirmation;
- historical analysis documents remain readable after screenplay changes;
- Needs refresh is advisory and does not hide the analysis; and
- Renku-to-FDX conversion and FDX export are unsupported.

## Final Verification

Run focused unit and integration tests while implementing each slice, then the
repository-required suites. At minimum:

```bash
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm --filter @gorenku/studio test
pnpm test:cli
pnpm test
pnpm lint
pnpm type-check
pnpm build
git diff --check
```

Run skill validation/evals in the sister `studio-skills` repository according
to its local instructions.

Real-project acceptance:

1. Open Big Fish and verify 202 Scenes, zero Acts, and zero Sequences.
2. Run Screenplay Analysis and persist the accepted three-act analysis.
3. Verify Analysis displays it under the new sidebar parent.
4. Verify Screenplay remains byte-for-byte structurally flat and exact Scene
   numbers remain unchanged.
5. Refresh a copy of Big Fish with a non-destructive source edit and verify
   stable surviving IDs plus Needs refresh.
6. Refresh a fixture with source removals and verify preview, agent warning,
   confirmation, exact apply, and historical analysis readability.
7. Open Urban Basilica and verify its Renku-authored 3 Acts/5 Sequences remain
   editable through one agent-authored batch.
8. Verify Free Willy remains unchanged.

## Completion Checklist

- [x] FDX initial import, unchanged no-op, non-destructive refresh, and
      destructive confirmed refresh are implemented.
- [x] FDX source bytes and exact Scene numbers remain authoritative.
- [x] Explicit FDX Acts/Sequences mirror exactly and remain read-only.
- [x] Flat FDX Screenplays remain flat.
- [x] No FDX organization overlay, translation, or organizer skill exists.
- [x] Conservative identity reconciliation preserves unambiguous imported IDs.
- [x] Destructive preview makes no writes and approval tokens are stale-safe.
- [x] Analysis supports flat and exactly-three-Act source Screenplays only.
- [x] Analysis critiques source boundaries through suggestions without mutation.
- [x] Analysis persists on ordinary “Analyze this screenplay” requests.
- [x] Existing analysis JSON storage and visual display remain intact.
- [x] Historical analyses with missing current Scenes remain readable.
- [x] Needs refresh and its tooltip are implemented without a new relationship.
- [x] Analysis is a top-level sidebar section with Screenplay Analysis beneath.
- [x] Renku-authored hierarchy editing remains agent-only and batch-efficient.
- [x] FDX-backed hierarchy editing is blocked at every entry point.
- [x] No user-facing migration is added for the three local projects.
- [x] Tests cover every state and transition in the requirement ledger.
- [x] Architecture, CLI, Studio, skill, documentation, and real-project
      verification all pass.

### Completion Evidence

- `pnpm test`: Core 359/359, CLI 64/64, Engines 702 passed with 12 existing
  todo cases, and Studio 356/356.
- `pnpm --dir packages/studio test:integration`: 51/51.
- `pnpm check`: type checks, test type checks, lint, architecture guards, test
  partition checks, and release tests passed. Lint retains one pre-existing
  `packages/studio/server/bin.ts` console warning and no errors.
- `pnpm build` and `git diff --check` passed.
- The companion `studio-skills` repository passed all three `quick_validate.py`
  checks, its 6/6 release tests, forward scenario review, and diff check.
- Live audit: Big Fish is FDX-owned with 202 Scenes and no Sections; its exact
  source returns `unchanged` with no resource keys. Urban Basilica is
  Renku-owned with 3 Acts, 5 Sequences, and 10 Scenes. Free Willy remains empty.
