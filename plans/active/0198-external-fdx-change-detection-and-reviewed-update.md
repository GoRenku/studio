# 0198 External FDX Change Detection And Reviewed Update

Status: implemented
Date: 2026-09-06

## Summary

Give an FDX-backed Project one predictable external export destination. When
the user exports an updated screenplay there, Studio detects changed bytes,
offers an update dialog, explains the actual effect on the current screenplay
and production links, and applies only the version the user reviewed.

The external editor remains the sole screenplay author. Renku continues to
read the accepted canonical projection from SQLite. Detection never imports
automatically, and the workflow does not merge two editable screenplays.

The recommended implementation is content polling for one bounded local file,
with checks on Project entry and browser focus. Reuse the current parser,
whole-Scene identity rules, retained-source history, transaction/write-set
boundary, and Studio resource invalidation.

## Review Attention

- **Export destination:** introduce `<project>/screenplay/edit/script.fdx` as
  the mutable handoff file. Never tell users to overwrite a retained
  `screenplay_source` Asset. This additional folder is necessary to preserve
  accepted source history under ADR 0092. Renku can create the directory on an
  explicit folder action; it never writes, seeds, restores, or deletes the
  external handoff file.
- **Important existing limitation:** a one-character dialogue change currently
  replaces the affected Scene and every nested Block/Turn/Part identity.
  Downstream work survives as historical data, but does not automatically
  attach to the replacement Scene. This plan exposes that impact; it does not
  promise production continuity across edits.
- **New contracts:** four focused Core operations, four Studio HTTP endpoints,
  browser-safe status/review contracts, one update dialog, and structured
  unavailable/stale-review errors. No Settings, arbitrary-path picker,
  watch daemon, new dependency, database schema, or migration is proposed.
- **Confirmation scope:** the detected-file Studio workflow always requires
  explicit confirmation. The existing explicit CLI `screenplay import-fdx`
  command retains its immediate-import contract. It remains capable of a
  destructive refresh; docs/skills must say so. Changing that independent
  command to require approval is a separate product choice, not hidden here.
- **Data effects:** only confirmed application replaces canonical screenplay
  rows and advances accepted source history; the existing source-only/no-op
  distinctions remain. No downstream cascade, automatic cleanup, file moves,
  live-project conversion, or new undo promise is included.
- **Assumptions for this proposal:** the external editor can export repeatedly
  to one exact local path; detection is needed while the Project is open or
  when it is reopened, not as an operating-system notification while Studio
  is closed. Keep current identity matching unless the user elects the
  separate continuity work described below. These recommendations were
  accepted through the implementation request on 2026-09-06.

## Requirements And Scope

Each requirement has one origin; implementation slices and tests refer to
these IDs so the scope remains traceable.

| ID | Origin | Required outcome |
| --- | --- | --- |
| R1 | User request | Detect an exported FDX change in an FDX-backed Project without manually invoking import. |
| R2 | User request | Give users an exact repeatable export destination and instructions. |
| R3 | User request | Show a dialog and obtain a decision before updating Renku. |
| R4 | User request | Warn about destructive effects before the final mutation, including incremental dialogue edits, additions/removals, and Scene changes/reordering/deletion. |
| R5 | User request | Keep screenplay authorship one-way from the external editor into Renku. |
| R6 | ADRs 0073, 0079, 0092 | Preserve weak downstream history, current identity semantics, immutable retained sources, flat FDX projection, and read-only ownership. |
| R7 | Data-integrity boundary | Incomplete exports, file replacement, missed checks, stale reviews, concurrent imports, and I/O failures must not apply an unreviewed or mismatched screenplay. |
| R8 | Architecture boundary | Core owns filesystem/domain decisions and application; adapters translate; React renders intent and projections. |

Explicit non-goals: screenplay editing in Studio; two-way synchronization;
automatic refresh or regeneration; fuzzy matching; manually pairing Scenes;
rewriting Beats, Shots, prompts, or media; universal dependency graphs; history
recovery UI; configurable monitoring policy; editor plugins; cloud file sync;
recursive folder discovery; choosing the newest of several FDX files; initial
FDX upload/import UI; mobile support.

## Context And Implementation Evidence

### Current owners and behavior

| Evidence | Finding and implication |
| --- | --- |
| `packages/core/src/server/screenplay/commands/fdx-import.ts` | The public command reads/parses/maps a source, then chooses initial import or refresh. Initial import requires an empty Screenplay. Reuse this pipeline; detection must not call it automatically. |
| `screenplay/fdx/source.ts`, `limits.ts`, `parser/`, `mapping/` under that Core server tree | Exact byte SHA-256, UTF-8/XML checks, a 10 MiB source limit, bounded parser, and supported canonical mapping already exist. Polling needs only a bounded envelope/hash read; semantic review reuses the parser. |
| `screenplay/fdx/content-identity.ts` | Complete canonical equality preserves the aggregate. Otherwise, only uniquely equal whole Scenes are reused. Heading, production number, source UUID, and position are not matching fallbacks. |
| `screenplay/fdx/refresh.ts` | Exact source is a no-op. Different bytes with equal canonical content advance source history only. Canonical differences replace the aggregate and add a revision immediately. There is no current preview or approval. |
| `screenplay/fdx/persistence/source-asset.ts` | Retained sources are verified immutable Assets; the copied file hash must match the parsed hash. Existing source-race and write-set rollback handling is useful but is not a preview-to-commit precondition. |
| `screenplay/persistence/scenes.ts` | Scene records absent from the final aggregate are deleted. The resulting current Scene list changes even when downstream records survive. |
| `packages/core/src/server/schema/scene-beats.ts`, `shot-plans.ts` | Downstream Scene IDs are weak context. Scene Beats revisions and Shot Plans do not have cascading Scene foreign keys. Current audio is owned by Shot Plans, not directly by a screenplay Dialogue Turn. |
| `packages/core/tests/integration/screenplay-fdx-refresh.test.ts` | Existing tests explicitly cover one-character identity replacement, add/remove/reorder, exact no-op, source-only refresh, stale analysis, historical source reuse, source races, and the read-only mutation gate. |
| `packages/studio/server/routes/screenplay/`, `src/features/movie-studio/screenplay/` | Current Studio has no FDX change detector or import dialog. Screenplay root is a Beat gallery, with Narrative in each Scene. The controller must mount for the open Project, not only a Narrative tab. |
| `packages/studio/src/hooks/use-studio-resource-refresh.ts`, Core `studio-coordination/events.ts` | Scoped resource-change notifications already refresh Studio. Use them after successful application; no new transport/event family is needed for polling. |
| `packages/studio/server/platform/open-containing-folder.ts` | Existing platform adapter can open the containing directory of a Core-resolved export pathname, including before the file exists. Reuse it. |
| `packages/cli/src/commands/screenplay/fdx-import.ts` | CLI explicitly invokes immediate import and formats its report. Keep it as the manual path, without using it as a background detector. |

Read-only local evidence on 2026-09-06: Urban Basilica's
`.renku/project.sqlite` contains **0 FDX imports, 10 Scenes, 4 Scene Beats
revisions, 3 Shot Plans, and 5 Shot Plan Dialogue Audio Takes**. There is no
live FDX handoff to exercise there. Its populated downstream model informs
coverage; testing must not convert or mutate this Project.

### Accepted constraints and overlapping plans

- `docs/architecture/screenplay-fdx-import.md`,
  `docs/architecture/data-model-and-storage.md`, and
  `docs/ui/studio-screenplay.md` own the current screenplay contract.
- ADR 0079 owns automatic explicit refresh, source authority, and whole-Scene
  identity; ADR 0073 owns weak downstream history; ADR 0092 protects every
  retained source, including older imports.
- Plan 0178 is completed historical evidence of an earlier approval workflow.
  Plan 0179 subsequently completed its removal and identity simplification.
  Do not restore the deleted reconciliation system or rewrite those plans.
- Plan 0196 is complete. Plan 0197 is implemented with current uncommitted
  Supporting Files/upload refinements. Its FDX uploads are opaque supporting
  material, not authoritative imports. The new detector must ignore them and
  every retained FDX except as the accepted comparison baseline.
- Follow `AGENTS.md`, naming/coding practices, current frontend guidance in
  `docs/architecture/reference/front-end-guidelines.md`, and structured
  diagnostics. Keep all feature controls in local shadcn UI primitives.
- `data-model-and-storage.md` has general number-grammar wording alongside the
  explicit FDX exception. The FDX architecture and implementation preserve
  exact external numbers; this plan does not impose number validation.

### Option comparison and recommendation

1. **Reuse explicit import unchanged:** correct source replacement, but does
   not detect anything and offers no warning. Insufficient for R1/R3/R4.
2. **Extend the existing FDX owner with detection and a reviewed update:**
   recommended. It adds the missing interaction and a commit precondition while
   sharing the exact replacement algorithm. A mutable export path is the only
   new filesystem concept.
3. **Build a watcher/sync or reconciliation subsystem:** unnecessary for one
   10 MiB-capped file. It adds lifecycle/configuration or identity choices that
   the current request does not establish.

Use periodic actual-content reads, not modification time as identity. Node
documents platform differences and inode replacement caveats for `fs.watch`;
a file-only watcher can remain attached to the old inode after replacement.
See [Node filesystem watch caveats](https://nodejs.org/api/fs.html#caveats),
checked 2026-09-06. A directory watcher plus periodic verification is viable,
but the periodic check already supplies the needed correctness for this scope.
Do not add the event optimization until a measured latency or I/O requirement
justifies it. This is an engineering recommendation, not a claim that polling
provides an atomic snapshot of an external editor's save.

The preferred editor workflow is to keep the native editing document wherever
the user works and export to the fixed handoff path. If the native document
itself is FDX, saving that document to the handoff path also works. No editor
autosave/export capability is assumed. Changing Scene matching to preserve
production links across edits is a worthwhile **separate proposal**: first
obtain repeated exports from the actual editor proving a stable identity
contract, then define duplicate/missing IDs and nested dialogue behavior.
Do not silently substitute headings, numbers, or fuzzy text for that evidence.

## Product Behavior

### External export destination

The Screenplay root gains an **External screenplay** action for FDX-backed
Projects. Its dialog shows the full, copyable, server-resolved path:

```text
<project-folder>/screenplay/edit/script.fdx
```

Use concise copy: “Export your updated screenplay as FDX to this file,
replacing the previous export. Renku will ask before updating.” Provide
**Copy path**, the existing platform-specific **Open in Finder / File
Explorer** action, and **Check for changes**. The folder action creates only
`screenplay/edit/` through Core and opens it; no file is copied there.

The handoff file is filesystem-owned and not an Asset. Registered retained
sources remain under their existing destinations. Existing Projects require
no migration: a missing export file simply shows the export instructions.
Never initialize the accepted hash from the current disk file; compare against
the retained current import's stored content hash on every check.

Only this exact pathname is monitored. Another `.fdx`, a numbered export,
temporary save file, retained source, or Supporting Files upload cannot become
authoritative through discovery. Moving/renaming/removing the handoff file
does not remove any screenplay Scene. Show the intended path and let a later
correct export resolve the condition.

### Detection and file stability

- Mount one controller in `MovieStudioScreen` for the current Project. Check
  immediately on entry, every 3 seconds while visible, on focus/visibility
  return, and after connection recovery. Schedule the next ordinary check
  after the current one finishes, so requests never overlap in one controller.
- Stop scheduled checks when hidden or leaving the Project. Reopening catches
  the latest disk state, including changes made while Studio was stopped.
  No background OS notification or discovery of intermediate exports is promised.
- Core gates on the existing singleton FDX import row. Non-FDX Projects return
  `notApplicable` and require no filesystem read or visible action.
- Reopen the path for each check and hash its bounded bytes. Size/mtime/inode
  can reveal an unstable read, but cannot replace content hashing. Enforce the
  byte cap while reading, including if the file grows after the initial stat.
- If bytes differ from the accepted hash, obtain a second complete bounded
  read after 750 ms. Both reads must have stable before/after file metadata,
  refer to the current path, and have the same SHA-256 before reporting a
  pending candidate. Do not hold a database transaction while waiting.
- A changing, briefly missing, locked, or zero-length export is not a deletion
  request. Return settling/unavailable state, retain the accepted screenplay,
  and retry on the normal schedule. Persistent invalid content is displayed
  when review parses it; it never enables Apply.
- Quiescence reduces partial-save exposure but cannot prove editor completion:
  a writer could pause with valid XML. User review, a fresh apply-time check,
  and retained-byte verification remain essential.

### Update dialog and decision

For a newly observed stable differing hash, open **Update screenplay?** at the
Project level. The dialog loads the Core review before exposing the final
action. Use **Later** and **Update screenplay**. No Enter/default submission
may accept a dialog merely because it appeared while the user was typing.

Present the external source path, Scene counts before/after, retained Scene
count, added/currently removed-or-replaced Scenes, order changes, and relevant
production-history counts. Use readable headings and the exact optional
production numbers for Scene rows. Keep long lists scrollable, with summary
and actions visible at ordinary desktop sizes. Do not require the user to read
every row to discover that existing work loses its current Scene connection.

Dismissal remembers the last dismissed candidate hash in session-scoped browser
presentation state keyed by Project identity. It does not mark that file as
imported. Show **Screenplay update available** on the Screenplay root/action so
the user can reopen review. A different export gets a new prompt; the same
export does not reopen on every poll. A new browser session may remind again.
This is presentation state, not durable project acceptance or an ignore policy.

Only the focused, visible browser instance opens a new modal; another visible
instance may display availability. Do not stack this dialog over another open
modal. Keep the candidate available and open it after the blocking dialog
closes or when the user selects the action. Mount only one local dialog owner.

Continue checking while the dialog is open. If the file changes again, becomes
unavailable, or the accepted Project baseline changes, disable Apply, show
“The screenplay changed again. Review the latest export,” and load a new
review only through **Review latest export**. Do not silently replace the
contents beneath an enabled confirmation button.

### Honest impact reporting

| Export change | Result and required warning |
| --- | --- |
| Exact accepted bytes, including a new timestamp | No dialog, no mutation, no revision, no resource event. |
| Different formatting/editor metadata with equal canonical content | Offer “Only the source file changed. Screenplay content and production links stay the same.” Confirmation retains the new source only. |
| Dialogue punctuation/text, added/removed dialogue, Action, heading, or number changes | The entire affected Scene graph may be replaced. Say that existing Scene-linked work remains in history and is not attached to the replacement Scene. Small edits must not be labeled harmless. |
| Reorder unique unchanged Scenes | Reuse their identities and preserve their links. Apply source order exactly; analysis can need refresh. |
| Add a Scene | Include new Scene count/list; preserve uniquely unchanged Scenes. |
| Delete a Scene | Remove it from the current screenplay after confirmation; retain its downstream records/media and warn about loss of current navigation/context. |
| Duplicate equal Scenes in a changed canonical screenplay | Use the actual proposed identities; warn for every current identity that will disappear. Do not claim a safe match by position or heading. |

Compute impact from the exact final aggregate produced by the existing identity
algorithm, including its complete-equality branch. The authoritative facts are
which current IDs survive, which do not, which IDs are introduced, and the
relative order of surviving IDs. Inserting one Scene must not be described as
reordering every later Scene simply because absolute positions shifted.

Without a matching contract, an edited Scene cannot always be distinguished
from deletion plus insertion. Use **Removed or replaced in Renku** and **New
in Renku**, not invented “edited” pairings or a supposedly exact deletion count.
Show the old Scene's production work beside its affected row. Warn prominently
whenever any current Scene identity disappears, even when counts are zero.

Counts inspect only relational ownership/context metadata: active Scene Beats
pointers, retained Beat revision rows, non-discarded Shot Plans and Shots, and
non-discarded Dialogue Audio Takes owned by those plans. Never parse Beat/Shot
prose, prompts, media, or audio Turn labels to decide validity or repair work.
Existing history is advisory context, not a refresh veto. Retained history
does not imply that every record remains reachable from ordinary current-Scene
navigation, nor that a one-click undo can restore all production connections.

### Apply, concurrency, and failure

Core issues a `reviewFingerprint` binding the candidate SHA-256, Project ID,
current import identity/source hash/import timestamp, current Screenplay
revision, importer version, and the deterministic impact evidence. Include
affected downstream row IDs, active pointers, and update versions where they
influence the warning. Do not hash opaque creative artifact contents.

Build each review from one consistent database read transaction after the
stable file read finishes. A report must not combine the screenplay from one
accepted import with impact metadata or an import pointer from another.

On Apply, Core rereads the fixed export path, validates/maps it again, and
checks the review fingerprint against the current Project inside the same
SQLite write transaction that will commit replacement. Refactor the shared
refresh boundary to acquire an immediate write transaction before reading
the current aggregate/import/revision used for decisions. All explicit and
reviewed imports use that transaction boundary, so concurrent CLI imports
cannot slip between baseline verification and replacement.

No filesystem settling wait or asynchronous operation belongs inside the
transaction. Retain source bytes through the existing write set and verify
that the retained bytes match the parsed candidate. Keep that verification for
source-only refresh and exact historical Asset reuse as well. Changes after
capture may be detected on the next check; the database must always describe
the exact verified bytes accepted, never a later unreviewed export.

- A stale fingerprint causes `SCREENPLAY_FDX_UPDATE_REVIEW_STALE` with no
  write. The UI offers fresh review rather than retrying Apply automatically.
- Another tab already accepting the same bytes returns the existing
  `unchanged` no-op result. Two simultaneous confirmations create at most one
  canonical revision and one accepted source identity.
- Parser, validation, permission, disk/copy, or database failure preserves
  the previous canonical aggregate, revision, and source pointer using the
  existing transaction/write-set rollback mechanism.
- If the response is lost after commit, the next status check reports whether
  those exact bytes are accepted. Do not claim failure means rollback or
  automatically resubmit a mutation with uncertain outcome.
- On success, dispatch the existing report's resource keys through current
  Studio coordination. All tabs refresh relevant resources. If the selected
  Scene disappeared, navigate to the Screenplay root using existing selection
  resolution; never guess a replacement Scene by its heading or number.

This extends normal transactional failure safety. It does not claim a new
cross-filesystem/SQLite crash-atomic storage system or add a recovery daemon.

## Architecture Shape Gate

### Intended module layout and ownership

All paths below are repository-relative. New files are explicitly marked.

| Owner/file | Responsibility |
| --- | --- |
| Core client `screenplay/fdx-updates.ts` (new) | JSON-safe status, review, Scene impact, and reviewed-apply contracts. Export through existing intentional client indexes. |
| Core server `screenplay/fdx/external-file.ts` (new) | Fixed project-relative handoff path, safe directory preparation, bounded stable reads and change detection. No parser or downstream query logic. |
| Core server `screenplay/fdx/update-review.ts` (new) | Read-only candidate preparation using current parser/mapper/identity functions; constructs review and its fingerprint from current baseline and impact. |
| Core server `screenplay/fdx/update-impact.ts` (new) | Compare actual current/final IDs and order; batch-query bounded downstream metadata for affected Scenes. No mutation or creative-content inspection. |
| Core server `screenplay/commands/fdx-import.ts` | Keep explicit import and add focused reviewed-apply orchestration. Share source preparation, error translation, and write-set cleanup internally. Own the immediate transaction and supply its session to refresh; no public generic mutation options or callbacks. |
| Core server `screenplay/fdx/refresh.ts` and `fdx/persistence/refresh.ts` (new) | Within the supplied transaction, `refresh.ts` reads the current baseline, owns the finite no-op/source-only/canonical decision, and verifies the reviewed precondition. Move its two persistence paths into `persistence/refresh.ts`, which performs retention and aggregate/pointer/revision writes using that same session. Remove the prior duplicate transaction bodies from `refresh.ts`; do not open a second transaction around the write phase. |
| Core existing `fdx/source.ts`, `content-identity.ts`, `persistence/source-asset.ts` | Reuse and narrowly extend bounded reads/comparison inputs. Preserve identity and retained-source rules rather than building another parser or matcher. |
| Core `project-data-service-contracts.ts`, `project-data-service-wiring/screenplay.ts`, `screenplay/index.ts`, server `index.ts` | Deliberate public entrypoints and shallow wiring only. Preserve current Supporting Files work. |
| Studio server `routes/screenplay/fdx-updates.ts` (new) | Four fixed routes, typed request parsing, token enforcement, Core delegation, structured error serialization, and existing platform folder launch. No path choice or impact logic. |
| Studio `src/services/screenplay/fdx-updates.ts` (new) | HTTP calls and typed errors. Import Core browser contracts directly. No duplicate DTO model or feature imports. |
| Studio feature `screenplay/external-file/use-fdx-update.ts` (new) | Poll lifecycle, cancellation/stale-response exclusion, session dismissal, modal availability, and reviewed user actions. No hash, parse, or Scene matching. |
| Studio feature `screenplay/external-file/fdx-update-dialog.tsx` (new) | Local shadcn Dialog composition for path/instructions, loading/error/review states, readable impact rows, and explicit confirmation. |
| Studio feature `movie-studio-screen.tsx`, `screenplay/screenplay-beat-gallery.tsx` | Compose one Project-level controller/dialog and pass the root action/availability to the existing Screenplay surface. Keep root business logic out. |

Use the existing finite initial-import/refresh branches and a small typed
status union. No generic watch registry, import-mode framework, matching
strategy registry, event family, server background scheduler, or approval
database is needed. No new directory needs an `index.ts` merely for convenience.
Only existing package/bounded screenplay public indexes may re-export API.

Stop and revise before implementation continues if a proposed patch:

- decides identity, impact, accepted baseline, or filesystem safety in HTTP,
  CLI, React, or a Skill;
- duplicates parser/mapping/identity behavior between review and apply;
- adds a generic callback/patch escape hatch to the persistence boundary;
- puts polling, parsing, downstream queries, SQL, and presentation in one file;
- requires arbitrary paths, a durable sync state machine, new database tables,
  or changes to downstream lifecycle to complete this workflow;
- treats whole-Scene replacement as preservation of incremental production
  links, or adds source-ID/fuzzy matching without a revised accepted plan;
- permits checklist completion by accepting a god file or a renamed facade.

## Contracts

### Core operations

Expose through the existing ProjectDataService and intentional server entrypoint:

1. `readFdxUpdateStatus({ projectName, ...configPaths })` → `FdxUpdateStatus`.
   Reads only; determines FDX ownership and the exact fixed file's status.
2. `prepareFdxExportFolder({ projectName, ...configPaths })` →
   `{ exportPath: string }`. Requires FDX ownership, safely creates only the
   directory, and returns the absolute file path for the existing folder
   adapter. Never overwrites a file or repairs a retained source.
3. `reviewFdxUpdate({ projectName, sourceSha256, ...configPaths })` →
   `FdxUpdateReview`. Requires the exact detected stable candidate; parses,
   validates, compares, and reads impact without writes.
4. `applyFdxUpdate({ projectName, reviewFingerprint, ...configPaths })` →
   existing `ImportFdxScreenplayReport`. Requires FDX ownership and a nonempty
   fingerprint for any change. Resolves its own fixed source path. No optional
   skip-review flag, caller-authored impact, or arbitrary-source input.

`configPaths` means the existing `RenkuConfigPathOptions`, not a new type.
The current `ImportFdxScreenplayInput` and CLI flags stay unchanged. Both apply
entrypoints use the same replacement/persistence implementation; the reviewed
entrypoint owns a distinct fixed-file and precondition contract.

### Browser-safe projections

`FdxUpdateStatus` is a closed discriminated union:

- `{ state: 'notApplicable' }` for a Project without an FDX import;
- otherwise common fields `exportPath: string` (absolute display/copy path),
  `acceptedSourceSha256: string` (current retained hash), and one of:
  - `{ state: 'missing' }`;
  - `{ state: 'settling' }`;
  - `{ state: 'unavailable', diagnostics: DiagnosticIssue[] }`;
  - `{ state: 'current', sourceSha256: string }`;
  - `{ state: 'pending', sourceSha256: string }`.

All hashes are exact lowercase 64-hex SHA-256. A pending hash establishes file
identity, not XML validity or user acceptance. Polling does not issue a review
fingerprint. The Core review operation validates the candidate before enabling
an update. Dates/mtime are not acceptance fields.

`FdxUpdateReview` has these complete fields:

- `sourceSha256: string`: reviewed candidate identity;
- `reviewFingerprint: string`: opaque equality precondition, not an auth token
  or a human-confirmation audit record; never derive it in an adapter;
- `change: 'sourceOnly' | 'screenplay'`: canonical comparison result;
- `beforeSceneCount: number`, `afterSceneCount: number`;
- `retainedSceneCount: number`: number of exact current Scene IDs in final;
- `survivingSceneOrderChanged: boolean`: compare relative order of survivors;
- `openingChanged: boolean`: deterministic canonical opening comparison;
- `removedOrReplacedScenes: FdxSceneUpdateImpact[]`: current order;
- `newScenes: FdxSceneUpdateLabel[]`: proposed order;
- `analysisNeedsRefresh: boolean`: whether the active analysis will be stale
  after this result, reusing existing freshness rules;
- `diagnostics: DiagnosticIssue[]`: actionable review warnings, no opaque
  artifact-content validation.

`FdxSceneUpdateLabel` contains `sceneId: string`, `heading: string`, optional
`productionNumber: string`, and optional `title: string`, all from the actual
current/proposed Scene. `FdxSceneUpdateImpact` extends that label with
`activeSceneBeats: boolean`, `sceneBeatsRevisionCount: number`,
`shotPlanCount: number`, `shotCount: number`, and `dialogueAudioTakeCount: number`.
Counts are nonnegative integers with the scope defined in Product Behavior.
No raw screenplay/Beat/Shot documents or candidate bytes enter these payloads.
An already accepted candidate during Review returns the existing structured
source-changed diagnostic with a suggestion to recheck; the UI closes the
stale review and loads status. It does not manufacture an empty review.

Define schemas with the same Core validation conventions as current FDX
contracts; optionality and discriminators must agree across TypeScript,
schemas, service projections, HTTP, and UI.

### HTTP and resource invalidation

All paths are beneath `/studio-api/projects/:projectName/screenplay`:

| Method/path | Input | Core operation |
| --- | --- | --- |
| `GET /fdx-update` | No path/body parameters beyond Project | `readFdxUpdateStatus` |
| `POST /fdx-update/open-folder` | Empty body | `prepareFdxExportFolder`, then existing `openContainingFolder(exportPath)` |
| `POST /fdx-update/review` | `{ sourceSha256 }` | `reviewFdxUpdate` |
| `POST /fdx-update/apply` | `{ reviewFingerprint }` | `applyFdxUpdate` |

Apply existing Studio origin/runtime-token policy; require the mutation token
on every POST. Return `Cache-Control: no-store` for status/review. Use existing
Project error translation and resource notification conventions. No route may
accept filesystem paths or serve mutable FDX bytes as an unreviewed HTTP Asset.

### Diagnostics and filesystem boundaries

Reuse current source-not-found/not-file/unreadable/too-large, invalid XML,
unsupported-visible-content, source-changed, retained-destination-conflict,
and Core project-relative-path diagnostics. Add only:

- `SCREENPLAY_FDX_UPDATE_NOT_APPLICABLE`: focused operation needs an existing
  FDX import; status uses `notApplicable` instead;
- `SCREENPLAY_FDX_EXPORT_PATH_INVALID`: fixed export directory/file is unsafe,
  not the required kind, resolves outside the Project, or aliases retained
  source storage;
- `SCREENPLAY_FDX_UPDATE_REVIEW_STALE`: candidate, accepted baseline, or
  material impact differs from the supplied review fingerprint;
- `SCREENPLAY_FDX_UPDATE_REPLACES_SCENES` (warning): current Scene identities
  disappear and existing production connections do not move automatically.

Core must validate real paths for existing path segments and validate the
new directory's parent before creation. Reject symlinked handoff file/directory
segments and hard-link identity with retained source files; do not let an
apparently separate mutable pathname alias protected history. Check at read,
folder preparation, and apply boundaries using shared focused path logic.
Missing files are an expected detector state, not a reason to create or clear
a screenplay. Structured errors distinguish inaccessible files from absence.

No schema change or migration is required. Do not add persistent last-seen
hashes, pending candidates, review tokens, source modes, or auto-apply flags.

## Implementation Slices

1. **Core external file and contracts — R1/R2/R5/R7/R8.** Add the named
   client contract and `external-file.ts`; wire status/folder preparation.
   Refactor the current bounded reader only as needed to share envelope and
   hashing behavior. Prove exact-path, stable-read, ownership, and no-write
   detection. No parser in the polling adapter.
2. **Shared review and transaction boundary — R3/R4/R6/R7/R8.** Add
   `update-review.ts` and `update-impact.ts`. Extract refresh persistence as
   specified, moving baseline decisions under the write transaction. Add
   `applyFdxUpdate` without duplicating import. Bind exact source and impact,
   preserve no-op/source-only/canonical paths, and retain normal rollback.
3. **HTTP and Project-level interaction — R1–R4/R7/R8.** Register the focused
   route, service, hook, and dialog. Compose into MovieStudioScreen and expose
   the Screenplay root action. Implement focus/reopen checks, dismissal,
   long-review layout, explicit acceptance, stale review, errors, resource
   refresh, and missing-selected-Scene navigation. Keep existing root and
   route indexes thin.
4. **Documentation and representative verification — R1–R8.** Record the
   narrowed ADR, update user/agent export guidance, and verify complete desktop
   export/review/apply journeys against isolated FDX Projects. Preserve the
   manual CLI contract and current Supporting Files changes explicitly.

## Tests And Guardrails

### Core: own the full behavior and failure matrix

- Stable hash detection after in-place overwrite, atomic rename-over, deletion
  and recreation, same-size/same-mtime content change, and identical-byte save.
- Changed file at Project entry/reopen; comparison always uses accepted source
  hash rather than initializing a new baseline from disk.
- Partial, zero-length, changing, locked/unreadable, oversize/growing, malformed
  UTF-8/XML, and unsupported-content exports cannot mutate or enable Apply.
  Cover valid-but-changing XML and replacement between the stability reads.
- Directory/symlink/hard-link/path-escape cases and folder-create failures;
  status and review leave database rows, revisions, source files, and handoff
  bytes unchanged. Folder preparation creates only the missing directory.
- Exact/source-only/canonical change reviews predict the actual importer
  result. A one-character dialogue edit, added/removed dialogue, Action edit,
  changed heading/number, Scene add/delete, opening-only edit, unique Scene
  reorder, and duplicate Scene cases exercise current identity consequences.
- Preserve unmodified Scene and nested IDs. Assert whole affected-graph
  replacement explicitly; avoid only comparing Scene counts.
- Verify production impact counts through actual relational fixtures: active
  and historical Beats, live/discarded Shot Plans and Shots, live/discarded
  audio Takes. Prove warnings do not inspect creative contents or block
  confirmation because history exists.
- Source change, concurrent explicit import, revision change, and material
  production-impact change after review reject before writes. A separate
  connection/process must exercise the transaction boundary, not just a
  mocked stale boolean.
- Double confirm/concurrent tabs accept identical bytes once; source-only
  concurrent acceptance creates no canonical revision. Returning to previously
  retained bytes verifies exact immutable history rather than overwriting it.
- Existing source-copy race, destination, missing historical bytes, SQL error,
  and write-set rollback remain covered. No false resource notifications on
  failure/no-op; source-only changes refresh Assets without staling screenplay.
- Existing FDX create/apply/dialogue/reference/organization/revision-restore
  read-only gate and weak-history no-cascade tests continue to pass.

### Adapters and browser: test their own responsibilities

- Server: typed parsing, token enforcement, correct Core delegation, no-store,
  structured error mapping, folder adapter invocation, resource notifications.
- CLI: existing explicit import workflow still passes against the refactored
  transaction boundary. Do not copy the Core invalid-file matrix into CLI tests.
- Hook/UI: one poll request at a time; immediate entry/focus checks; timer and
  in-flight cleanup on Project switch/unmount; stale response exclusion;
  non-FDX absence; no duplicate/stacked auto-open; session dismissal and new
  candidate prompting; invalid/stale review disables Apply; no implicit Enter
  acceptance; usable long Scene lists and visible destructive explanation.
- Desktop E2E: export one dialogue edit into the fixed file while a production
  tab is open; Later leaves state unchanged; reopen review and accept; confirm
  current screenplay and history behavior. Add reorder/delete, rename-over,
  newer export during review, reopen catch-up, and two-tab acceptance journeys.
  Assert selected removed Scene returns safely to Screenplay.

Use runtime no-write/retained-history assertions and existing import-boundary
checks. Do not add source-text tests naming private functions, file inventories,
or retired approval implementation names. Use focused lint complexity/depth
enforcement if the touched dispatcher/command needs it; no formatter sweeps.

## Documentation

On acceptance/implementation, add
`docs/decisions/0093-review-detected-external-fdx-updates.md` (verify the next
unused ADR number before creating it). It records the fixed mutable handoff,
reviewed detected-file updates, unchanged immediate manual import, identity
limitations, and no-cascade/source-protection rules. Add only a concise notice
to ADR 0079 explaining this narrower detected-file workflow and linking the
new decision. Preserve its historical body and completed Plans 0178/0179.
ADR 0073 remains intact: impact reads are advisory, not reverse dependencies.

Update:

- `docs/architecture/screenplay-fdx-import.md`: fixed handoff versus retained
  history, lifecycle, exact review/commit preconditions, and manual CLI scope;
- `docs/architecture/reference/project-files-and-assets.md`: new filesystem-
  owned export location; no Asset enrollment or changes to retained files;
- `docs/ui/studio-screenplay.md`: external screenplay action, detection,
  confirmation and error states, unchanged read-only Narrative;
- `docs/cli/commands.md`: explain explicit immediate refresh and distinguish
  it from detected-file review; do not invent new flags;
- relevant structured diagnostics reference: new focused codes only;
- sister `studio-skills/skills/screenplay-drafter/SKILL.md`,
  `references/screenplay-json-workflow.md`, `evals/fdx-import-enrichment.md`:
  exact external export instructions, no writing retained sources, identity
  impact, and no automatic CLI import as a substitute for the pending dialog;
- sister `skills/movie-director/references/workflow-playbooks.md` and
  `references/specialist-handoff-checklists.md`: same handoff and consequences.

Skill wording must distinguish the interactive Studio workflow from a user-
explicit manual import. Skills must not promise continuity or turn metadata
warnings into semantic validation/repair of creative artifacts. Follow sister
repository instructions and validation when those files are implemented.

## Final Verification

This task creates a plan only. No production code, database, source file, or
Skill implementation is changed by this document.

During implementation, use focused package tests while developing, then run:

```bash
pnpm test:core
pnpm --dir packages/core test:integration
pnpm test:cli
pnpm --dir packages/cli test:integration
pnpm test:studio
pnpm --dir packages/studio test:integration
pnpm --dir packages/studio test:e2e -- screenplay-fdx-import.regression.spec.ts screenplay-fdx-update.regression.spec.ts
pnpm check
pnpm test
pnpm build
git diff --check
```

Use current package test partitions; register new tests in the appropriate
unit/integration/E2E partition. Run the sister repository's documented skill
validation/evals for edited guidance. Report unrelated failures separately
without weakening assertions or treating them as passed.

Use an isolated Project from existing FDX fixtures, enriched through normal
Core commands with Beats, Shot Plans, and audio fixtures. Do not change Urban
Basilica to make it FDX-backed. Exercise a real editor export if available,
clearly separating actual-editor evidence from synthetic write/rename tests.
Measure detection latency and read cost with representative and maximum-size
sources; expected visible-tab detection is within one poll plus settling/read
time under normal local I/O, not an unconditional real-time guarantee.

Inspect full desktop dialogs at 1440×900, including long lists, keyboard focus,
pending/error/stale states, and surrounding Studio context. Confirm the user
can export repeatedly to the same path, defer, review, accept, and continue
without reloading the browser.

Final architecture inspection: review `git diff --stat` and complete diffs in
both repositories; inspect large/heavily modified files in full; verify
`refresh.ts` shrank where persistence moved, indexes remain thin, and no
duplicate import pipeline, adapter-owned rule, source-policy system, creative
content validator, formatting churn, or downstream cascade was introduced.

## Implementation And Verification Record

Implemented on 2026-09-06. Accepted behavior is documented in
`docs/decisions/0093-review-detected-external-fdx-updates.md` and the current
architecture, filesystem, UI, CLI, diagnostics, and sister Skill documentation.
The implementation adds no Settings, dependencies, schema changes, migrations,
or matching changes. Urban Basilica and existing Supporting Files work were
left untouched. The explicit CLI import remains immediate.

Core owns the fixed path, bounded reads, stable-byte detection, metadata-only
impact, fingerprint, and shared immediate transaction. The HTTP handlers and
React controller delegate those decisions. Refresh persistence is a focused
module; public indexes remain thin. Complete diffs and large/modified files
were inspected for ownership, formatting churn, and prohibited facades.

Validation evidence:

- `pnpm check` and `pnpm build` passed; Studio typecheck/lint and all seven
  focused hook/dialog tests passed again after the final UI corrections.
- Core FDX integration: 36 tests passed, including 27 reviewed-update cases.
  CLI integration: 31 passed. Studio integration: 36 passed.
- CLI unit tests: 79 passed; engines: 76 passed; Studio: 386 passed before the
  last two focused regressions were added, with the final focused set passing.
- The initial root run exposed a slow Supporting Files assertion comparing a
  2 MiB Buffer with generic deep equality. After the user approved the focused
  fix, the test uses `Buffer.equals()` for the same exact byte comparison.
  The complete root `pnpm test` now passes with default timeouts; all 405 Core
  tests passed and the previously failing test took 1.55 seconds. No timeout
  configuration or production behavior was changed.
- Six desktop Playwright regressions passed: existing import fixtures plus
  external detection on a production tab, keyboard deferral, reviewed apply,
  reorder/delete, reopen, long impact lists, stale exports, two-tab acceptance,
  invalid XML, and source-only acceptance. Reviewed 1440 by 900 screenshots
  confirm the full path wraps and long lists preserve visible decision buttons.
- Browser verification exposed a Review-to-Apply DOM reuse hazard. Distinct
  keyed buttons now prevent a pending review click from becoming confirmation;
  a focused regression protects that behavior and focus handling.
- A real Beat export was imported into an isolated temporary Project. Changing
  `Wait.` to `Wait!` in Beat and exporting directly into its prepared handoff
  produced pending status, one removed/replaced Scene and one new Scene, no
  mutation during review, a successful explicit apply, and current status.
- Bounded read/hash measurements (20 local iterations) averaged approximately
  0.35 ms at 100 KB and 6.38 ms at 10 MiB. Settling waits occur outside SQLite
  write transactions.
- Sister repository `pnpm test` and screenplay-drafter/movie-director Skill
  validation passed. Both repositories passed `git diff --check`.

## Completion Checklist

### Review Area

- [x] Accept the fixed mutable export path and polling lifecycle assumptions.
- [x] Explicitly acknowledge that small edits still replace whole Scene graphs.
- [x] Confirm matching changes remain outside this plan unless separately accepted.
- [x] Confirm detected-file confirmation and immediate manual CLI scope are clear.
- [x] Confirm retained sources and downstream history remain protected.
- [x] Preserve existing Supporting Files work and leave Urban Basilica untouched.
- [x] Confirm final module shape passes every Architecture Shape Gate condition.

### Architecture And Contracts

- [x] Add the complete status/review/impact contracts and agreeing schemas.
- [x] Wire the four focused Core operations through existing public entrypoints.
- [x] Keep path ownership, stable reads, comparison, impact, and preconditions in Core.
- [x] Keep one shared parser, mapper, identity algorithm, and refresh persistence path.
- [x] Move current-state reads and verification into the shared write transaction.
- [x] Bind source, accepted baseline, revision, and material impact to the fingerprint.
- [x] Add only the named diagnostics and preserve structured adapter serialization.
- [x] Introduce no database schema, migration, stored pending state, or Settings flags.

### Core Implementation

- [x] Implement exact `screenplay/edit/script.fdx` resolution and folder-only preparation.
- [x] Reject unsafe/aliased paths without rewriting user files or retained history.
- [x] Implement bounded hash checks and two-read stability with no transaction waits.
- [x] Preserve missing/settling/unavailable/current/pending distinctions.
- [x] Generate review from the actual final aggregate and metadata-only impact.
- [x] Report edited/deleted ambiguity honestly as removed-or-replaced Scene identities.
- [x] Keep exact no-op, source-only retention, and canonical replacement distinct.
- [x] Implement reviewed application, stale rejection, and concurrent no-op behavior.
- [x] Preserve retained-source verification, file-write rollback, and weak history.

### Studio, CLI, And Agent Surfaces

- [x] Add fixed routes, typed service calls, token checks, and no-store responses.
- [x] Mount one Project-level controller with entry, interval, focus, and reconnect checks.
- [x] Add External screenplay action, exact copyable path, and existing folder action.
- [x] Implement deferred availability, session dismissal, and new-export prompting.
- [x] Implement non-stacking dialog, loading/error/review states, and explicit confirmation.
- [x] Show production-link warning for incremental changes and clear source-only copy.
- [x] Disable stale reviews and require review of a newer export before applying it.
- [x] Handle uncertain responses by rechecking status, not automatic mutation retries.
- [x] Refresh all relevant tabs and safely resolve a removed current Scene selection.
- [x] Keep the manual CLI import interface unchanged and accurately documented.
- [x] Update the named screenplay-drafter and movie-director guidance/evals.

### Tests And Guardrails

- [x] Cover overwrite/rename/recreate/same-metadata/identical-byte detection at Core.
- [x] Cover incomplete, invalid, growing, unavailable, and unsafe exports with no writes.
- [x] Cover all listed incremental, structural, opening, and duplicate-Scene impact cases.
- [x] Verify actual downstream counts, discard scope, history survival, and no prose parsing.
- [x] Prove source/baseline/impact races and cross-connection transaction safety.
- [x] Prove duplicate confirmation, historical reuse, source-only, and rollback invariants.
- [x] Keep existing read-only and no-cascade tests passing.
- [x] Test adapters for translation and UI for lifecycle/visible behavior without duplication.
- [x] Add representative desktop external-export, defer/apply, stale, reopen, and two-tab E2E.
- [x] Preserve boundary tests without implementation-name source strings.

### Documentation And Final Verification

- [x] Add the new ADR and narrow notice on ADR 0079 without rewriting history.
- [x] Update architecture, filesystem, UI, CLI, diagnostics, and named sister Skill docs.
- [x] Run focused tests, relevant integration/E2E suites, root checks, and build.
- [x] Run sister validation/evals and report any unrelated failures accurately.
- [x] Verify full desktop dialog layout, keyboard handling, latency, and repeated exports.
- [x] Inspect complete diffs, large files, shared transaction code, and thin indexes.
- [x] Confirm no formatting churn, god file, broad dispatcher, facade, or parallel state.
- [x] Confirm no checklist item was satisfied through an unreviewable code structure.
- [x] Only then mark the implementation complete.
