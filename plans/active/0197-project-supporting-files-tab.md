# 0197 Project Supporting Files Tab

Status: implemented
Date: 2026-09-06

## Accepted Implementation Correction

User-requested upload addition: `ui/file-upload-area.tsx` owns shared whole-region
drag state, picker submission, busy exclusion, and inline errors. Both GrabsTab
and SupportingFilesTab compose it with their own grid sizing. The trailing card
uses the existing FileUploadDropzone. `services/file-uploads.ts` owns shared
sequential byte uploads; the two feature APIs supply their endpoint.
`POST /studio-api/projects/:projectName/supporting-files?fileName=` is token-protected
and delegates to Core `uploadScreenplaySupportingMaterial`, whose focused
`screenplay/supporting-material/uploads.ts` validates a filename, stages bytes in
an isolated temporary directory, calls the existing importer, and cleans staging.
No schema or canonical screenplay behavior changes. Uploaded FDX is opaque
supporting material, not an authoritative-screenplay refresh. The existing
Core importer continues to own deduplication, durable file placement, and Assets.

Approved card design: a uniform 13:8 media grid with a 240px minimum width,
wrapped regular-weight filenames on the shared bottom gradient, and the same
info action placement for every format. Document cards use the selected large
outline motif and extension label (amber FDX, terracotta PDF, slate-blue MD).
Registered PNG/JPEG/WebP/GIF and MP4/WebM sources use existing MediaCard image
and hover-muted video components. This supersedes the original document-only
4:3 thumbnail/footer treatment. Stored import MIME/bytes are unchanged.

Latest user-directed layout: standard uppercase File information title with a
small regular filename beneath, one icon centered across both lines, no file
location, and **Open In Folder** on every OS. The button sits to the right of
the dates with its bottom aligned to the Last updated row; there is no footer.
This supersedes the earlier dialog variations recorded below.

The subsequent dialog redesign uses a single 540px surface with 32px insets,
a filename-led heading, vertically aligned date rows, a quiet path section,
one folder action, and the standard close icon. Explanatory paragraphs and
the duplicate Close button are removed. Dates use local date/time to the minute.
This supersedes the original dialog-copy and layout details below.

The user's desktop verification found the iframe viewer blank and requested
simply opening the file in a tab. The final implementation opens
`/studio-api/projects/:projectName/supporting-files/:assetId/content` directly.
The browser displays supported files and downloads unsupported formats. FDX
remains literal XML text. The custom viewer route, React viewer, FilePreview
primitive, preview capability DTO field, and UTF-8 pre-scan have been removed.
Native browser decoding owns text display; file bytes remain unchanged.
This correction supersedes the custom-viewer and preview-failure-page details
in the original implementation record below. Card/info/Trash/folder behavior
and Core file ownership/path checks remain as planned.

Verification: clicked the Sintel card in Chrome and inspected a screenshot of
the directly opened FDX, confirming visibly readable text without the wrapper.

## Summary

Add **Supporting Files** immediately to the right of **Covers** in Project
Details. Show registered screenplay source and supporting-material files in the
shared media-card grid, open a file in a separate browser tab, and expose import
time, last update, and file location through each card's lower-right info action.
Use existing recoverable Asset deletion and open the containing folder on the
Studio server computer using its native desktop file manager.

## Review Attention

- No new Asset kind, database schema, migration, file relocation, import UI,
  Settings, CLI command, or file-content analysis is proposed.
- New read/delete HTTP surfaces and a safe document-viewing response are needed.
  They reuse Core Asset ownership, file resolution, and Trash. Shared MediaCard
  gains a neutral document presentation and an information icon variant.
- **User-confirmed deletion rule:** protect all retained FDX sources, including
  historical imports. Core currently protects only the source referenced by
  `screenplay_import`; extend the existing lifecycle guard to every retained
  `screenplay_source` Asset. Other supporting files use normal recoverable
  deletion, with no canonical screenplay changes. This is the only accepted
  source-lifecycle expansion; it does not introduce a source-policy setting.
- **User-confirmed folder opening:** it invokes the desktop of
  the Studio server machine. A browser connected to a remote server cannot use
  this to open a folder on its own computer. No desktop wrapper or browser
  extension is proposed. The user explicitly deferred remote-access behavior;
  retain existing token/origin protection without a new loopback-only policy.
- Imported/updated timestamps mean the existing Asset `createdAt`/`updatedAt`
  metadata, not the original external file's dates or filesystem modification
  time. A changed import creates a separate retained Asset.
- Browser-native formats can show contents; DOCX and arbitrary binary files need
  a clear unsupported-preview page with a download action. Building an Office
  renderer/conversion service is not included. FDX opens as literal XML text,
  not a newly formatted screenplay.
- No real movie data was changed. Destructive interactions were tested in an
  isolated Project fixture. No schema, migration, or file relocation was needed.
- The new `surface:project:assets` resource key fills an existing gap: Project
  Asset mutations previously returned no Project Asset refresh key. Import,
  discard, and restore now share that key; canonical screenplay keys are unchanged.

## Requirement Ledger

| ID | Requirement and authority | Owner / acceptance |
| --- | --- | --- |
| R1 | User: tab after Covers, including FDX and other imports | Project Details; scoped Asset collection |
| R2 | User: grid and existing media-card deletion | Shared MediaCard/Grid; Core discard/Trash |
| R3 | User: activation opens contents in separate tab | Browser viewer and safe HTTP file response |
| R4 | User: lower-right info dialog with three facts | MediaCard corner action; Asset metadata and Core path resolution |
| R5 | User: investigate Finder and platform equivalents | Research below; optional bounded host operation |
| R6 | Accepted architecture: opaque imports and source authority | Preserve import bytes, parser behavior, and Core FDX guard |
| R7 | Hard boundary: registered file access and inert untrusted content | Core ownership/path checks; HTTP presentation safety |
| R8 | User clarification: protect retained FDX files | Core lifecycle guard; no delete action for current or historical FDX |

## Product Behavior

### Collection and cards

Use the existing flush `LineTabs` row, adding `supporting-files` after `covers`.
Load the collection only when opened. It contains active Project-owned
`screenplay_source` and `screenplay_supporting_material` Assets, including retained
FDX editions. Do not enumerate `screenplay/` or `research/`; unregistered scratch
files, Covers, and generated production media are not supporting-file imports.

Use a single newest-first grid, ordered by Asset creation time and ID as the
stable tie-breaker, with cursor pagination and the shared grid's spacing.
Preserve the Covers tab's content insets and scrolling. Use a consistent 4:3
document tile with a file icon and the Asset title. Here the imported filename
is meaningful source-document identification, already stored as the title;
do not expose Asset IDs or type identifiers. Do not generate thumbnails or
semantically inspect files to construct cards.

Provide loading, empty, failed-load/Retry, and Load more states. Keep successful
pages visible if a later-page request fails. Project switches must discard old
requests/results. Use shared resource refresh for import, discard, and restore;
use the shared `surface:project:assets` resource key rather than polling or expanding the
Project shell. The FDX importer currently emits no keys for source-only refresh:
emit that project Asset key when a new retained source becomes visible,
without emitting a canonical screenplay change or revision.

### Delete and information

Use the shared top-right delete action and confirmation dialog. Successful
supporting-material deletion moves the Asset to existing Studio Trash, removes
its card, and leaves its external original and authored movie content alone.
Cancel changes nothing; errors remain visible and the card remains present.
Restore through existing Trash makes the card reappear. Do not add an immediate
permanent-delete action or a separate trash mechanism.

Use an always-visible lower-right info button with accessible label **File
information**. It must not trigger card activation. Open a local shadcn Dialog,
approximately 560px wide on desktop, with title supplied by the Asset, three
clearly spaced label/value rows, a wrapping/selectable path, and Close:

- **Imported:** Asset `createdAt`, formatted in the user's locale with timezone.
- **Last updated:** Asset `updatedAt`, same formatting. Describe this as Studio
  metadata time in the dialog; do not imply external-file synchronization.
- **File location:** resolved absolute location of the retained Project copy.

Metadata remains inspectable when bytes are missing; the file-open action then
reports the missing-file error. Never invent dates from filesystem timestamps.
Every retained FDX card omits deletion and its information dialog explains
**Retained screenplay source files cannot be deleted.** Enforce the same rule
in Core for direct API/CLI calls, including historical FDX Assets.

### Separate-tab viewing

Activation opens a stable Studio viewer URL synchronously from the click, with
`noopener`; keyboard activation behaves identically. Opening a tab is subject
to browser preferences. The new page handles loading and structured errors and
does not require the originating Project tab to remain open.

Use a bounded, presentation-only extension table: PDF, PNG/JPEG/WebP/GIF,
MP3/WAV/OGG, MP4/WebM, and UTF-8 TXT/MD/CSV/JSON/XML/FDX. Native media/PDF can be
displayed by browser controls; textual formats display escaped literal text.
HTML/SVG are literal text rather than executable content. Unknown/binary formats,
including DOCX, show the filename, **Preview is not available for this file
type**, and Download. This is a viewing limitation, never an import restriction.
Invalid encoding or a failed browser decoder must produce an explicit preview
failure with Download; do not repair, transform, or reject the retained Asset.

Keep octet-stream persistence for supporting material unchanged. Preview-specific
response headers may identify a browser media format, but must never update
the durable MIME field. Apply `nosniff`, restrictive sandbox/CSP headers, safe
Content-Disposition encoding, and no-store to this document delivery path.
Never execute source HTML, stylesheet processing instructions, scripts, macros,
or document-linked external resources. Do not use third-party online viewers.
Download returns exact retained bytes as an attachment. Large documents stream
or use browser navigation rather than loading arbitrary files into React state.

## Context And Evidence

- `plans/active/0196-screenplay-supporting-material.md` is complete. Its Core
  importer already stores one opaque source file per Project-owned Asset, titles
  it with the imported filename, preserves exact bytes, and deduplicates by hash.
  The present plan adds a browser surface without changing that import contract.
- `docs/architecture/screenplay-fdx-import.md` defines the source-authoritative
  FDX pointer, exact retained source, and historical source reuse. Source removal
  must not implicitly make the screenplay editable or alter canonical Scenes.
- `packages/core/src/server/commands/discard-asset.ts` already checks ownership,
  expected type, and the active FDX pointer before invoking shared Trash.
  `screenplay/fdx/persistence/import-record.ts` throws
  `SCREENPLAY_FDX_SOURCE_IN_USE` for the current source, not all historical ones.
- `assets/resources.ts` and `assets/projection.ts` already own Asset paging and
  file resolution. Their current type filter is singular; a combined collection
  requires filtering both source types before pagination, not filtering a mixed
  Project page in React or merging two independently paginated streams.
- `packages/studio/server/routes/assets.ts` and
  `server/http/asset-file-response.ts` provide ID-addressed file serving. The
  latter uses durable MIME and immutable caching, so unchanged raw serving is
  insufficient for opaque documents and safe literal XML/text previews.
- `project-details/project-details-panel.tsx`, `project-covers/`, and
  `ui/media-card/` provide tabs, collection layout, confirmation, activation,
  and lower-right inspection placement. Reuse them. The selectable collection
  hook assumes canonical selection; do not create dummy selection handlers for
  documents or copy that hook wholesale.
- Accepted constraints: `docs/architecture/data-model-and-storage.md`,
  `project-asset-storage-conventions.md`, `naming-guidelines.md`,
  `coding-practices.md`, `reference/front-end-guidelines.md`,
  `reference/structured-diagnostics.md`, and
  `reference/project-files-and-assets.md`; ADRs 0041 and 0053.
- Sister Skill `studio-skills/skills/screenplay-supporting-material-importer/`
  already returns imported Assets and preserves opaque files. No new CLI/Skill
  workflow is necessary; add only a short browser-discovery note after delivery.
- Read-only inspection of
  `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` found no
  `screenplay_source` or `screenplay_supporting_material` Assets, and no
  `screenplay/` directory. Do not infer imports from the screenshot or mutate
  this movie to fabricate populated evidence. Verify the running server's
  configured library during implementation if it differs from this folder.

### Reuse decision

Unchanged reuse handles card actions, metadata, file identity, and Trash, but
cannot supply a combined paged collection or safe document preview. Extend
those existing owners with a focused supporting-files resource and document
presentation. A new storage aggregate, import registry, or document-processing
system would duplicate existing Assets and is rejected.

## Folder Opening Investigation — Accepted Scope

The native equivalents exist:

| Platform | User label | Native capability / proposed minimal implementation |
| --- | --- | --- |
| macOS | Open in Finder | Open the containing directory using `/usr/bin/open`; native AppKit also supports selecting a file |
| Windows | Open in File Explorer | Launch `explorer.exe` with the containing absolute directory as one argument; native Shell API supports selection |
| Linux | Open containing folder | `xdg-open` on the containing directory in the user's desktop session |

Opening the containing folder satisfies the request without promising identical
file selection across desktop environments. Finder's native reveal API is
[NSWorkspace.activateFileViewerSelecting](https://developer.apple.com/documentation/appkit/nsworkspace/activatefileviewerselecting(_:));
Windows offers
[SHOpenFolderAndSelectItems](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shopenfolderandselectitems).
Linux's desktop integration is documented by
[xdg-utils](https://wiki.freedesktop.org/www/Software/xdg-utils/).
These establish platform feasibility, not tested Renku integrations.

A normal browser is not an OS file-manager API. Use the existing local server,
not `file://` links or a new helper service. Browser local-file isolation is
described in [MDN's same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).
The server action opens a folder on the server host; remote browser access,
containers, SSH sessions, and headless Linux cannot promise a desktop window.

Add a token-protected POST taking Project/Asset identity only,
using the established Studio token/origin protection. Resolve the
registered active file through Core, enforce realpath containment and regular
file identity, then pass its parent to the platform launcher without a shell.
Never accept an arbitrary path or shell command from the browser. Return a
structured failure when the platform/session/launcher is unavailable; do not
silently invoke a different application. Keep the path visible regardless.
An accepted process launch means the OS request was dispatched, not proof a
window appeared. No Settings or dependency installation is part of this option.

## Architecture Shape Gate

### Core

- Add `server/screenplay/supporting-files/resources.ts` for scoped paged reads
  and information resolution, and `commands.ts` for the focused discard intent.
  `index.ts` is an intentional export-only entrypoint.
- Add client `screenplay/supporting-files.ts` for the small read projection
  below. Wire methods through existing project-data-service contracts/wiring.
- Extend the existing internal Asset page query to accept a set of types for
  this Core resource; preserve its cursor/order mechanics. Do not expose a
  second public generic filtering API solely for this UI.
- Reuse `discardAsset`, existing file resolvers, source guards, and project
  resource keys. Lifecycle decisions remain Core-owned. No database writes in
  routes and no filesystem-derived membership.
- Extend the source guard in `screenplay/fdx/persistence/import-record.ts` to
  reject any `screenplay_source` Asset with `SCREENPLAY_FDX_SOURCE_PROTECTED`.
  Update current callers/tests directly; keep no alias for the replaced code.
  The scoped read projection consumes this same lifecycle rule rather than
  independently deciding deletion availability. No cleanup of previously
  discarded files or database migration is authorized.

### Studio

- `server/routes/supporting-files.ts`: thin list/info/discard adapters.
- `server/http/supporting-file-response.ts`: inert preview/download headers,
  bounded format dispatch, and streaming. Reuse Core resolution; no domain rules.
- `src/services/supporting-files.ts`: request functions and viewer URL assembly.
- `src/features/movie-studio/supporting-files/`: `supporting-files-tab.tsx`
  owns load/paging/refresh state, `supporting-file-cards.tsx` maps cards,
  `supporting-file-info-dialog.tsx` renders the three facts,
  `supporting-file-viewer.tsx` owns the separate-tab read-only surface.
- Extend `ui/media-card/media-card-contract.ts` and the existing visual/actions
  components with `media.kind: 'document'` and `cornerAction.kind: 'info'`.
  Preserve existing `inspect` behavior and icons for other users.
- The application router only registers the viewer, and Project Details only
  adds the tab. Existing files remain thin; no production files need deletion.
- Folder opening uses `server/platform/open-containing-folder.ts`
  for a bounded three-platform launcher. The route authenticates and delegates;
  Core owns file identity/path validation. No process API in React or generic
  execute-command endpoint.

Stop if preview requires content interpretation/conversion, the FDX rule changes
without a decision, platform support requires a new runtime dependency, or any
module combines paging, import, lifecycle, document parsing, and OS launching.
Keep shared indexes thin; prohibit facades, compatibility paths, and a broad
file-management registry.

## Contracts

All routes below are under `/studio-api/projects/:projectName`.

- `GET /supporting-files?cursor=&limit=` calls
  `listProjectSupportingFiles({ projectName, cursor?, limit? })` and returns
  `{ items: ProjectSupportingFile[], nextCursor: string | null }`.
- `ProjectSupportingFile` contains `asset: Asset`, `sourceAssetFileId: string`,
  and `deleteBlock: null | { code: string; message: string }`. Reuse Asset
  fields; do not mirror title, timestamps, or path on the projection. Core
  supplies deletion availability from the shared retained-FDX lifecycle rule.
- `GET /supporting-files/:assetId/information` calls
  `readProjectSupportingFileInformation({ projectName, assetId })`, returning
  `{ supportingFile: ProjectSupportingFile, absolutePath: string }`.
  The HTTP adapter adds `previewType: string | null` and `folderActionLabel: string`
  as presentation/host capabilities, without persisting them in Core.
  Resolve the registered path even if bytes are missing; opening separately
  verifies file existence and containment. Do not put absolute paths into
  generation previews or persisted metadata.
- `DELETE /supporting-files/:assetId` requires the existing token middleware,
  calls `discardProjectSupportingFile({ projectName, assetId })`, and returns
  the existing `RecoverableMutationReport`. Core accepts only the two scoped
  Project types, applies source protection, then uses ordinary Asset discard.
- Browser route `/projects/:projectName/supporting-files/:assetId` opens the
  viewer. `GET /supporting-files/:assetId/content` and `/download` resolve its
  registered source file and return inert preview/exact attachment respectively.
- Reuse existing owner, file-not-found, and path diagnostic codes; use
  `SCREENPLAY_FDX_SOURCE_PROTECTED` for all retained FDX sources. Add
  `SCREENPLAY_SUPPORTING_FILE_INVALID_ASSET` only for the supporting-file scope
  or missing/ambiguous registered source envelope. Preview-unavailable is a
  normal presentation state, not corrupt project data.
- `POST /supporting-files/:assetId/open-folder` resolves the source ID
  in Core and returns `{ dispatched: true }`; use
  `STUDIO_FOLDER_OPEN_UNAVAILABLE` and `STUDIO_FOLDER_OPEN_FAILED` for host
  capability/launch failures. No arbitrary request body path is accepted.

## Implementation Slices

1. Apply the confirmed retained-FDX protection and record it in an ADR.
   The user accepted native folder opening, preview limits, and timestamp meanings
   before implementation.
2. Implement the Core resource/projection over existing Asset queries and focused
   discard orchestration. Preserve paging, ownership, Trash, source authority,
   and source-only import resource invalidation; split query and command files.
3. Add thin HTTP/service adapters and isolated safe file delivery. Register the
   viewer route without embedding document handling into application composition.
4. Extend the shared MediaCard document/info variants, then compose the tab,
   paged grid, information dialog, and viewer. Reuse confirmation/refresh;
   do not introduce canonical selection or content editing.
5. Add the bounded platform launcher and dialog action with existing
   token/origin checks. Keep it independent from content rendering.
6. Update accepted documentation after approval, verify tests and desktop UI,
   and inspect the implementation shape and complete diff.

## Tests And Guardrails

Core owns the full invariant coverage: both types included, other owners/types
excluded, stable mixed pagination, discarded entries excluded, exact source-file
identity, wrong Project/Asset/File rejection, missing bytes, traversal/symlink
escape rejection on byte access, current and historical FDX protection through
both scoped and ordinary discard commands, supporting-material discard/restore, and no
canonical screenplay mutation. Verify source-only refresh invalidates the
collection without producing a screenplay revision. Preserve existing importer
deduplication and exact-byte tests rather than repeating them in the UI.

HTTP tests cover request parsing, Core delegation, token checks, error mapping,
headers, escaped text, attachment filename handling, and representative active
content isolation. Include FDX with XML stylesheet instructions, HTML/SVG, an
opaque DOCX, and a failed media decoder. Never claim arbitrary formats render.

UI tests cover tab order, lazy load, pagination failure/retry, project-switch
races, refreshed imports/restores, card title, keyboard/new-tab activation,
independent info/delete controls, dialog timestamps and long paths, cancellation,
delete failure, protected FDX explanation, and unknown-format download.

Platform tests use a fake process runner for exact argument arrays,
spaces/Unicode/metacharacters, missing launcher, and no shell execution. HTTP
tests reject cross-origin and unauthenticated launch requests. Native
desktop checks must run on each supported OS before claiming native verification;
Linux must include a graphical desktop and a headless unavailable case.

Use existing import-boundary/lint checks for React/server/Core ownership and
shadcn controls. Do not freeze private helper names in source-text tests.

## Documentation And ADR Effects

Update `docs/architecture/reference/project-files-and-assets.md` with the tab,
timestamp meanings, preview limits, Trash, and retained-copy location. Update
`reference/front-end-guidelines.md` for document/info card variants. Add a brief
discovery note to the sister supporting-material importer Skill; no commands or
creative workflow change. Keep completed plan 0196 unchanged.

Record the accepted all-retained-FDX deletion protection in a new ADR before
implementation and link it from `screenplay-fdx-import.md`; preserve historical
decision text and add a supersession notice only if an older decision explicitly
allowed historical source deletion. Optional folder opening should be documented
with its local-server limitation when accepted.

## Final Verification

Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` once the integrated
change is ready. Use the affected packages' focused tests during development;
do not install dependencies or run full-file formatters.

On desktop, verify the supplied Project Details composition, tab placement,
grid spacing, scrolling, long filenames, info dialog and keyboard focus at
approximately 1440×900. Verify Urban Basilica's actual configured empty state
read-only; populate a separate fixture through real import commands for FDX,
PDF, text, and DOCX, then test open/delete/restore. Preserve exact bytes and
screenplay state across that journey. Capture screenshots of grid and dialog.
Do not test mobile or mutate the user's movie for fixture creation.

Inspect `git diff --stat`, the complete diff, large/heavily modified files,
public indexes, and every new module. Confirm no formatting churn, god file,
adapter-local domain rule, re-export facade, or generic mutation/OS escape hatch.

## Completion Checklist

### Review Area

- [x] Confirm protection of all retained FDX files with the user.
- [x] Accept native folder opening on the server computer explicitly.
- [x] Confirm preview coverage/limits and metadata timestamp semantics.
- [x] Confirm every addition maps to R1–R8 and the Architecture Shape Gate.

### Architecture And Contracts

- [x] Add scoped Core reads/discard over existing Asset/Trash ownership.
- [x] Filter the two Asset types before stable cursor pagination.
- [x] Reuse Asset fields and resolve source IDs/paths in Core.
- [x] Protect current/historical FDX deletion while preserving authority and import storage.
- [x] Keep package-boundary errors structured and public indexes thin.
- [x] Deliver source-only import and Trash refresh through the shared Project Asset key.

### UI And HTTP Slices

- [x] Add Supporting Files after Covers with lazy load and a single media grid.
- [x] Add shared document visual and lower-right info action without regressions.
- [x] Show meaningful titles and loading/empty/retry/Load more states.
- [x] Show Imported, Last updated, and retained absolute File location in Dialog.
- [x] Isolate info/delete clicks; implement confirmation, failure, and restore.
- [x] Show the agreed FDX deletion protection and enforce it in Core.
- [x] Open independent browser viewer tabs with safe literal/native content.
- [x] Provide unknown-format/failed-preview download of exact original bytes.
- [x] Keep HTML/XML/SVG inactive and apply safe content/attachment headers.
- [x] Implement local folder POST and bounded OS launcher.

### Tests And Documentation

- [x] Complete Core ownership/paging/source/lifecycle and path-safety tests.
- [x] Complete HTTP delegation/security/content response tests.
- [x] Complete card, dialog, paging, refresh, and new-tab interaction tests.
- [x] Verify real import/open/discard/restore in an isolated fixture Project.
- [x] Test launch arguments/errors and record native OS evidence and limitations below.
- [x] Update file/Asset and shared-card docs and sister Skill discovery note.
- [x] Record all-retained-FDX protection in ADR 0092 and update the current reference.

### Final Verification

- [x] Run build, package tests, lint, and check without dependency installation; record root-test timeouts below.
- [x] Capture and inspect desktop grid/dialog screenshots; reuse shared keyboard-accessible controls.
- [x] Confirm Urban Basilica was not changed to manufacture test content.
- [x] Inspect full diff/stat, large files, indexes, and ownership boundaries.
- [x] Remove formatting churn and reject broad dispatchers or catch-all modules.
- [x] Confirm no checklist item is satisfied by unreviewable structure.
- [x] Record implementation completion and verification limits explicitly.

## Implementation Evidence — 2026-09-06

- `pnpm build` and `pnpm check` pass, including lint, architecture checks,
  production/test type checks, and release checks. No dependencies were installed.
- Normal `pnpm test` encountered timeout failures in existing database-heavy
  Core tests. The complete Core suite passed with
  `pnpm --dir packages/core exec vitest run --no-file-parallelism --testTimeout 15000`:
  84 files / 400 tests. CLI passed 79 tests, Engines 76, and Studio 362.
  Follow-up focused tests cover invalid UTF-8 preview, cancellation/deletion
  failure, and stale Project responses after those full-suite runs.
- Desktop Chrome inspection at 1733×1255 verified the empty Urban Basilica tab,
  a populated six-file isolated Project grid, long-title truncation, 560px info
  dialog spacing, timestamps/timezone, retained path, and lower-right actions.
  The fixture used real Core imports for FDX, PDF, Markdown, HTML, TXT, and DOCX.
  Its Markdown file moved to Trash, restored, and reappeared in the grid.
- Separate browser tabs displayed literal FDX XML and the native PDF viewer.
  Unsupported-format download is covered by UI tests; exact bytes and inactive
  text headers are covered by HTTP tests. UTF-8 validation streams bytes without
  semantic parsing or retained-file mutation.
- The Finder action was exercised successfully on macOS against an existing
  retained source. Windows/Linux launch arguments and failures use mocked
  process tests; native Windows, graphical Linux, and headless Linux were not
  available here and are not claimed as verified.
- User movie data remained unchanged. The separate QA host was temporary;
  the normal Studio dev server remains on port 5173 with the implementation.
- The module split follows the Architecture Shape Gate. Shared indexes remain
  export-only; no schema, generic process endpoint, content parser, compatibility
  layer, or unrelated formatting rewrite was added.
