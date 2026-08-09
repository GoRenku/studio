# 0175 Studio Empty Project Creation Dialog

Status: complete
Date: 2026-08-09

Selected Product Design reference:
[Create Project dialog](assets/0175-studio-empty-project-creation-dialog/selected-dialog.png)

## Review Attention

This is the short review surface for the plan. Acceptance should not require
discovering consequential behavior in later implementation detail.

| Attention item | What this plan does | Why it is here |
| --- | --- | --- |
| Selected UX | Add a yellow **Create Project** button beside **Refresh** in the Project Library. It opens the selected compact dialog over the unchanged library. | Explicit user request and selected Product Design direction. |
| Minimum user input | Require a Project title and Project folder name. The folder name is suggested from the title and remains editable, so the ordinary path requires the user to type only the title. The configured library location is displayed but cannot be changed here. | The existing Core command requires `title` and `projectName`; minimizing active input is the product goal. |
| New public surface | Add browser-safe Core `ProjectCreateRequest`, plus authenticated `POST /studio-api/projects` with that `{ title, projectName }` body and a `201 { report: ProjectCreateReport }` response. The route delegates to existing `ProjectDataService.createMovieProject`. | Studio currently exposes only project-list and project-read routes; one shared intent contract and browser mutation boundary are required. |
| Core validation refinement | Make the existing creation command reject a blank title before filesystem writes and attach field locations to title, invalid-name, and existing-folder diagnostics. No new Project policy is introduced. | The CLI currently checks `--title`, but Core is the durable owner and the dialog needs structured field errors from the same boundary. |
| Filesystem and database effect | Create `<storageRoot>/<projectName>/.renku/project.sqlite`, run the current migrations, and initialize the existing empty-movie rows. Do not eagerly create empty screenplay, cast, location, prop, visual-language, Scene, Storyboard, research, temporary, or production folders. | Direct initialization request plus the accepted lazy feature-folder contract. |
| Existing behavior kept | Keep the current CLI command, default `16:9` aspect ratio, default `en-US` locale, default Project Settings, empty Screenplay singleton, project-name grammar, folder-collision failure, and feature-owned folder writers unchanged. | Reusing the existing creation contract is the smallest architecture-correct change. |
| Explicit non-scope | Do not import FDX, create screenplay content, ask how the screenplay will be authored, collect a logline or other Project Information, generate media, add a template chooser, add project types, change Settings, or redesign the Project Library. | Those are later workflows, not prerequisites for an empty Project. |
| Documentation conflict | Current code and Plan 0018 use empty movie creation, while `docs/architecture/reference/project-create-from-yaml.md` and parts of `naming-guidelines.md` still describe the removed setup-YAML flow. This plan records that pre-existing conflict but does not broaden the Studio UI slice into the full Plan 0018 documentation cleanup. | Required evidence transparency and scope discipline. |
| Migration and cleanup | Add no Drizzle schema migration, data migration, development-data rewrite, file move, deletion, recovery flow, or compatibility layer. Existing low-level partial-initialization recovery behavior remains unchanged. | The current schema and creation command already represent the requested empty Project. |

No additional product decision is required for this proposed plan. The selected
dialog, one-title ordinary path, editable folder name, fixed library location,
and direct opening of the created Project are treated as accepted direction.

## Summary

Renku Studio can list and open Projects, and Core already knows how to create a
clean empty movie Project. The missing capability is a browser path from the
Project Library to that existing Core command.

The smallest useful outcome is:

1. the user clicks **Create Project** in the Project Library header;
2. a compact dialog asks for the Project title and shows an editable suggested
   folder name plus its resolved location;
3. Studio sends one authenticated creation request;
4. Core validates and creates the Project folder, current database schema,
   Project row, empty Screenplay state, default Project Settings, and default
   locale; and
5. Studio closes the dialog and opens the new Project on Project Information.

This is an initialization flow, not an import or creative-brief wizard. It
deliberately leaves the Project ready for a later agent-authored Screenplay or
FDX import without asking the user to choose between those paths during
creation.

## Requirement Ledger

| Id | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | The Project Library header exposes a visible **Create Project** action beside **Refresh** without redesigning the existing screen. | Explicit user request and selected visual. | Studio Project Library feature. | Component test and desktop visual verification. |
| R2 | The selected compact dialog keeps the library visible behind it and contains only Project title, editable folder name, read-only location, concise initialization copy, Cancel, and Create project. | Selected Product Design direction. | Studio create-project dialog. | Component accessibility/interaction tests and desktop comparison. |
| R3 | The normal creation path requires the user to type only a non-blank title; Studio suggests the kebab-case `projectName` and allows deliberate editing before submission. | User request to identify and collect the minimum. | Feature-local Project-name suggestion and dialog state. | Unit and component tests. |
| R4 | The configured `storageRoot` determines the immutable location shown in the dialog; the modal does not add a path picker or Settings behavior. | Existing config and project-location architecture. | Existing Project Library resource plus dialog projection. | Component test using a realistic storage root. |
| R5 | Creation uses the existing Core `createMovieProject` command and initializes the accepted empty Project state without duplicating creation logic in HTTP or React. | Architecture hard gate and current implementation. | `packages/core`. | Core tests and server delegation test. |
| R6 | Blank title, malformed Project name, and existing folder fail before or at the Core owning boundary with structured issues that Studio can associate with the correct field. | Data-integrity and structured-diagnostics boundaries. | Core creation command; Studio error presentation. | Core invalid-state tests and representative dialog error tests. |
| R7 | Core client exports one browser-safe `ProjectCreateRequest`; the authenticated Studio mutation validates only its HTTP envelope, delegates it to Core, and serializes the Core report unchanged. | Studio server, shared-contract, and security architecture. | Core client contract, Studio request parser, and projects route. | Typecheck plus route tests for token, envelope, delegation, response, and Core error serialization. |
| R8 | A successful request closes and resets the dialog, then uses the existing project-selection path to open `/projects/<projectName>` at Project Information. | Explicit requested flow and selected visual copy. | Project Library dialog plus existing `onSelectProject`. | Component callback test and one desktop E2E journey. |
| R9 | Loading and failure states prevent duplicate creation, keep entered values on failure, show field-specific errors when possible, and keep unexpected errors inside the dialog. | Direct reliability and accessibility edge cases. | Studio create-project dialog. | Component tests. |
| R10 | The new empty Project is discoverable to later agent work through the same Project Library and existing Studio-current coordination used by opened Projects; no skill contract changes are needed. | User's later-agent workflow and existing Studio coordination contract. | Existing project navigation and Studio coordination. | E2E open-project assertion and inspection of unchanged coordination behavior. |
| R11 | No FDX, Screenplay authoring, template, Project type, Settings, schema, migration, or eager feature-folder behavior is added. | Explicit scope boundary and accepted architecture. | Entire slice. | Diff inspection, focused repository search, and final architecture review. |

Every planned production concept maps to one of these requirements. There is
no requirement for a new initialization service, Project wizard framework,
template registry, folder scaffold manifest, or creation state machine.

## Product Behavior

### Entry point

The Project Library header keeps its current left-side title and storage-root
summary and right-side search and Refresh controls. A primary yellow button is
added after **Refresh**:

```text
+ Create Project
```

The action remains available whether the library has Projects, is empty, or is
showing zero search matches. Search does not hide or filter the action.

The existing empty-library explanation changes from the technical database-scan
description to concise creation guidance. No second creation button is added to
the empty state; the header action remains the one consistent entry point.

### Dialog content

The selected dialog is implemented with the existing local Shadcn-style
`Dialog`, `Input`, `Button`, and `Alert` primitives. It uses a roughly 560px
desktop width and the current panel/header/footer visual language.

Visible copy and controls are:

- title: **Create project**;
- description: **Start with an empty Renku project. You can create or import a
  screenplay later.**;
- required **Project title** input;
- required **Folder name** input;
- helper: **Automatically suggested from the Project title. You can edit it.**;
- read-only **Location** text using the Project Library `storageRoot` and the
  current valid folder name;
- note: **Renku will create the Project folder and initialize its database.**;
- secondary **Cancel** action; and
- primary **Create project** action.

The implementation intentionally adjusts the selected mock's phrase “core
folders will be initialized.” The accepted folder contract does not promise a
set of empty feature directories.

The Project title receives initial focus. Enter submits when the fields are
valid. Escape, the close button, and Cancel dismiss and reset the form only
when no request is in flight.

### Minimum information

| Value | User interaction | Durable meaning | Default or rule |
| --- | --- | --- | --- |
| Project title | Required text; this is the only value a user normally has to type. | `Project.title`, shown throughout Studio. | Any string with at least one non-whitespace character. Preserve the authored value; use trimming only to test emptiness. |
| Folder name | Required but automatically suggested; editable. | `Project.projectName`, Project folder name, URL segment, and CLI selector. | Existing Core grammar: lowercase ASCII letters/numbers separated by single hyphens. |
| Location | Display only. | `<storageRoot>/<projectName>`. | The configured Project Library root; not selectable in this flow. |
| Aspect ratio | Not collected. | Existing Project Information value. | Existing Core default `16:9`. |
| Base locale | Not collected. | Initial Project locale. | Existing Core default `en-US` / English. |
| Project Settings | Not collected. | Initial Project Settings document. | Existing `DEFAULT_PROJECT_SETTINGS`. |
| Screenplay | Not collected or imported. | Empty current Screenplay aggregate. | Existing Screenplay singleton initialization. |
| Logline, synopsis, cover, genre, format, audience, themes, boundaries, research, and other Project Information | Not collected. | Optional later Project Information. | Absent until authored later. |

There is no Project-type selector because the current product creates a movie
Project only. There is no “Create screenplay” versus “Import FDX” choice because
both remain valid later actions on the same empty Project.

### Project-name suggestion

`suggestProjectName(title)` is a feature-local presentation helper, not a new
Core naming policy. It produces the initial value by:

1. applying Unicode NFKD normalization;
2. removing combining marks so common Latin accents become their ASCII base;
3. lowercasing;
4. replacing each run of characters outside `a-z` and `0-9` with one hyphen;
5. removing leading and trailing hyphens; and
6. collapsing no additional meaning into the result.

Examples:

| Title | Suggested folder name |
| --- | --- |
| `The Glass Harbor` | `the-glass-harbor` |
| `L'été à Cádiz` | `l-ete-a-cadiz` |
| `Draft #2: North` | `draft-2-north` |

The suggestion tracks title edits until the user edits the Folder name field.
After that first manual edit, later title changes do not overwrite the user's
folder choice for that dialog session. Cancel or successful creation resets
the relationship.

If a title cannot produce an ASCII Project name, the Folder name remains empty
and the user enters a valid value. Studio does not transliterate arbitrary
scripts, invent a generic name, append a random value, or allocate a numeric
suffix. A collision is explicit and the user chooses another folder name.

The dialog may validate the accepted regex to provide immediate feedback, but
Core remains authoritative and performs the same existing validation before
any project-folder write.

### Submission and error behavior

Before submission, the primary action is disabled when:

- Project title is blank after trimming;
- Folder name does not match
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`; or
- a request is already in flight.

While creating:

- both inputs and Cancel are disabled;
- the dialog close affordance is hidden or disabled;
- the primary button shows the existing loading spinner treatment; and
- duplicate submission is impossible.

The browser sends exactly:

```json
{
  "title": "The Glass Harbor",
  "projectName": "the-glass-harbor"
}
```

Failure presentation uses `StudioApiError.issues` first:

- an issue located at `title` appears below Project title;
- an issue located at `projectName` appears below Folder name;
- all other failures appear once in a dialog-level `Alert`;
- user-entered values remain intact; and
- the dialog does not silently change the folder name and retry.

Core validation is strengthened so all three normal user-correctable creation
errors have field locations. Studio does not add a parallel code-based field
mapping or compatibility policy.

On success:

1. the dialog receives `ProjectCreateReport`;
2. it closes and resets its draft;
3. it calls the existing `onSelectProject(report.projectName)` callback; and
4. the existing session/navigation flow reads the Project shell and opens
   Project Information at `/projects/<projectName>`.

If opening the newly created Project fails after creation succeeded, the
existing Project session error and library refresh behavior own that failure.
Studio must not resubmit creation, delete the Project, or pretend the creation
failed.

### Initialized Project state

The visible filesystem starts as:

```text
<configured-storage-root>/
  <projectName>/
    .renku/
      project.sqlite
```

The project-local database uses the current Drizzle migration generation and
contains the state already owned by `createMovieProject`:

- one Project row with title, Project name, default aspect ratio, and no cover;
- one empty Screenplay singleton;
- one default Project Settings singleton document;
- one `en-US` base locale; and
- zero Cast Members, Locations, Props, Acts, Sequences, and Scenes.

Feature writers create `screenplay/`, `cast/`, `locations/`, `props/`,
`visual-language/`, `storyboards/`, `scenes/`, `research/`, `tmp/`, and
`production-assets/` only when their current workflow needs those folders.
Folder absence in a new Project is valid, not a state to repair.

### Explicit non-goals

This plan does not:

- change `renku create <project-name> --title <title>` or its optional flags;
- add `--file`, ProjectSetup YAML, or an import-at-create contract;
- upload or parse FDX;
- author or analyze a Screenplay;
- ask for creative metadata already editable in Project Information;
- choose a cover image or generate Project art;
- add Project templates, recent templates, duplication, cloning, or onboarding;
- add a folder picker or edit the configured storage root;
- add series, episode, or other Project types;
- create empty feature folders for visual reassurance;
- add a creation history, resumable creation, cleanup wizard, or compatibility
  path; or
- change agent skills, because they already resolve/open existing Projects and
  can act after Studio opens the created Project.

## Context And Evidence

### Current implementation

- `packages/core/src/server/commands/create-movie-project.ts` already owns
  Project-name validation, storage-root resolution, folder allocation, current
  migrations, the creation transaction, default Project Information, the empty
  Screenplay singleton, default Project Settings, and default locale.
- `CreateMovieProjectInput` already requires `projectName` and `title`; optional
  aspect ratio, logline, and synopsis are not needed by the Studio dialog.
- `ProjectCreateReport` already returns `projectName`, Project path, database
  path, created counts, and warnings.
- The CLI already delegates to `ProjectDataService.createMovieProject` and then
  opens the result as the CLI current authoring Project. This plan does not
  change that command workflow.
- `packages/studio/server/routes/projects.ts` currently supports listing and
  reading Projects but has no create route.
- `packages/studio/src/services/studio-projects-api.ts` owns Project HTTP calls
  and already preserves structured errors through `readStudioApiError`.
- `packages/studio/src/features/project-library/project-library-screen.tsx`
  already owns the header/search/Refresh composition and Project selection.
- `packages/studio/src/ui/dialog.tsx`, `button.tsx`, `input.tsx`, and `alert.tsx`
  provide the required local primitives; no new UI primitive is justified.
- The existing smoke journey opens a minimal Project from the library and
  proves Project Information can render without Screenplay content.

### Real Project evidence

`/Users/keremk/renku-movies/urban-basilica` confirms the current human-facing
folder model and Project-local `.renku/project.sqlite`. Its populated feature
folders are evidence of later feature writes, not a template to copy into a
new empty Project.

The implementation must use isolated test storage roots for creation. It must
not create, delete, rename, or modify Urban Basilica during this work.

### Accepted constraints

- `docs/architecture/reference/project-files-and-assets.md`: feature folders
  are project-root folders and Project creation may create only folders needed
  by current contents.
- `docs/architecture/reference/project-storage-boundaries.md`: SQLite owns
  durable Project metadata and lives at `.renku/project.sqlite`.
- `docs/architecture/reference/front-end-guidelines.md`: features own workflows,
  browser services own fetch calls, local Shadcn primitives own controls, and
  Studio is desktop-first.
- `docs/architecture/reference/studio-server-hono.md`: Studio routes remain
  mechanical adapters over Core.
- `docs/architecture/naming-guidelines.md`: `Project.projectName` is the stable
  storage/CLI selector and `Project.title` is human-facing display text, despite
  the stale setup-YAML sections noted below.
- Plan 0018: Project creation produces a clean empty movie Project and
  Screenplay content is authored later.
- Plan 0170: Core owns Project Information validation and Studio preserves
  structured diagnostic issues.
- Plan 0171: Project creation initializes current Project Settings and the
  default locale through Core.
- Decisions 0003, 0006, 0011, and 0037 continue to govern SQLite, UI
  coordination, migrations, and E2E fixture ownership.

### Pre-existing documentation conflict

The live code, CLI help, tests, and Plan 0018 removed setup-YAML creation.
However:

- `docs/architecture/reference/project-create-from-yaml.md` is still marked
  current;
- `docs/architecture/README.md` still links it as the current creation path;
- `docs/architecture/naming-guidelines.md` retains `ProjectSetup` and
  `createFromSetup` examples; and
- Decision 0004 retains the historical `renku create --file project.yaml`
  example.

This plan does not rely on those stale clauses. It also does not silently turn
the dialog work into a broad CLI/naming documentation rewrite. The implementing
handoff must add a concise current Studio creation section to the frontend and
server references and record the conflict for the existing Plan 0018 cleanup.
If the stale setup-YAML documents are to be removed or superseded in this same
implementation, that expansion must be called out and approved separately.

## Alternatives Considered

### 1. Reuse the existing contract unchanged

Most of the feature should take this path. `createMovieProject` already creates
the correct empty Project and must remain the single creation owner.

It cannot be used literally unchanged because Core currently relies on the CLI
to reject a missing title, while the new HTTP caller can reach Core directly.
Core also does not consistently attach `title` or `projectName` field paths to
creation diagnostics. A narrow validation refinement is required at the owner.

### 2. Extend the existing owner and add thin adapters — chosen

Keep the public Core method and result, factor its two required intent fields
into one browser-safe Core client request, add owner-level blank-title and
diagnostic-location coverage, then add one authenticated HTTP route, one
browser service function, and one focused Project Library dialog.

This introduces no new durable model and updates each existing owner only for
its own missing responsibility.

### 3. Introduce a new Project initializer or wizard model — rejected

A separate initialization service, creation document, template registry,
multi-step state machine, or persisted draft would duplicate the existing Core
command and imply product choices the user did not request. The current model
can represent the complete accepted outcome cleanly.

## Architecture Shape Gate

### Core ownership

`packages/core/src/server/commands/create-movie-project.ts` remains the one
creation implementation. It may gain focused private validation functions and
structured issue construction, but no second creation command, generic
initializer, setup document, or folder-scaffold registry is added.

`packages/core/src/client/project/model.ts` owns one browser-safe
`ProjectCreateRequest` containing the two shared intent fields. The existing
server-only `CreateMovieProjectInput` extends that request with config paths,
optional initial Project Information, and test ID generation. The existing
client `index.ts` files add type exports only.

Public entrypoint remains:

```ts
ProjectDataService.createMovieProject(
  input: CreateMovieProjectInput
): Promise<ProjectCreateReport>
```

`packages/core/src/server/project-data-service-wiring/project-administration.ts`
and the public server `index.ts` remain thin and require no new behavior.

### Studio server ownership

Add:

```text
packages/studio/server/http/project-create-request.ts
```

It owns only HTTP-envelope parsing for the exact allowed fields
`projectName` and `title`, using the existing shared request-validation helpers.
It returns the Core-owned `ProjectCreateRequest` with two strings or throws one
structured request error.

Extend:

```text
packages/studio/server/routes/projects.ts
```

with one token-protected root `POST /` handler. The handler reads JSON, calls
`readProjectCreateRequest`, delegates to `projectData.createMovieProject`, and
returns the Core report. It must not derive names, inspect the filesystem,
choose defaults, insert rows, open SQLite directly, or create feature folders.

No new route index, route registry, or server service layer is added.

### Browser service ownership

Extend:

```text
packages/studio/src/services/studio-projects-api.ts
```

with one `createProject(request: ProjectCreateRequest)` fetch function. The
service owns URL, method, token header, JSON encoding, response extraction, and
`StudioApiError` creation. It does not derive Project names or coordinate the
dialog.

`studio-project-contracts.ts` remains unchanged. `ProjectCreateRequest` and
`ProjectCreateReport` are imported from the browser-safe Core client contract;
Studio must not declare parallel copies.

### Project Library feature ownership

Add the focused feature files:

```text
packages/studio/src/features/project-library/
  create-project-dialog.tsx
  create-project-dialog.test.tsx
  project-name-suggestion.ts
  project-name-suggestion.test.ts
```

- `create-project-dialog.tsx` owns modal state, labels/copy, local validation,
  submission, error projection, reset, and the Create Project trigger.
- `project-name-suggestion.ts` owns only the deterministic presentation
  suggestion described above. It does not inspect storage or allocate a unique
  folder.
- tests stay beside the behavior they protect.

Extend:

```text
packages/studio/src/features/project-library/project-library-screen.tsx
packages/studio/src/features/project-library/empty-project-library.tsx
```

only to compose the dialog trigger in the existing header, pass `storageRoot`
and `onSelectProject`, and make empty-state copy consistent with creation.

`app.tsx` and `use-project-session.ts` should remain unchanged because the
existing `onSelectProject` path already owns loading and navigation. If the
implementation begins adding creation state or routing branches to the root app
or session hook, stop and revise this shape first.

### Public `index.ts` boundaries

No new `index.ts` file is planned. Existing package and module entrypoints
remain thin. New feature files use direct feature-local imports, and the Studio
server imports its request parser directly.

### Dispatch and branching

No switch, registry, dispatcher, command inventory, Project-type branch, or
folder-kind branch is needed. Error-to-field projection is bounded to the two
creation fields and uses diagnostic paths, not a growing code switch.

### Existing files that remain thin

- `packages/core/src/server/project-data-service.ts` remains composition only.
- `packages/core/src/server/project-data-service-wiring/project-administration.ts`
  remains a focused method map.
- `packages/studio/server/routes/projects.ts` gains one short handler but keeps
  all creation behavior in Core and envelope parsing in the HTTP module.
- `packages/studio/src/features/project-library/project-library-screen.tsx`
  keeps layout/search/list composition and does not absorb form state.
- `packages/studio/src/app/app.tsx` remains screen composition.

### Forbidden code shapes

Implementation must stop and revise if it starts to add any of the following:

- React or HTTP filesystem/database writes;
- React-only durable validation or automatic collision allocation;
- a generic `initializeProject`, `createResource`, or arbitrary state-patch API;
- setup YAML, template, Project-type, import, or Screenplay-source branches;
- a broad route request switch or another Project service facade;
- eager creation of the complete documented feature-folder tree;
- a permanent mapping of every Core error code when issue paths can own field
  association;
- raw HTML `button`, `input`, `dialog`, or other interactive controls;
- a new `ui/` primitive for a one-off domain dialog; or
- creation logic moving into `project-library-screen.tsx`, `app.tsx`, or
  `use-project-session.ts`.

Stop before implementation proceeds if the dialog component begins mixing
route construction, Core rules, Project selection internals, and form rendering
in one function. Split only along the file boundaries named above; do not add a
generic form framework.

## Contracts

### Shared creation intent

```ts
export interface ProjectCreateRequest {
  projectName: string;
  title: string;
}
```

`packages/core/src/client/project/model.ts` owns this browser-safe intent. Both
fields are required strings at the HTTP envelope. Core owns semantic validation.
There are no optional create-time creative fields in the Studio request even
though the server-only CLI/Core input supports some optional Project
Information.

```ts
export interface CreateMovieProjectInput
  extends ProjectCreateRequest, RenkuConfigPathOptions {
  aspectRatio?: string;
  logline?: string;
  synopsis?: string;
  idGenerator?: ProjectIdGenerator;
}
```

### HTTP route

```text
POST /studio-api/projects
X-Renku-Studio-Token: <runtime token>
Content-Type: application/json
```

Success:

```json
{
  "report": {
    "projectName": "the-glass-harbor",
    "projectPath": "/Users/keremk/renku-movies/the-glass-harbor",
    "databasePath": "/Users/keremk/renku-movies/the-glass-harbor/.renku/project.sqlite",
    "coverPath": null,
    "created": {
      "languages": 1,
      "castMembers": 0,
      "locations": 0,
      "props": 0,
      "acts": 0,
      "sequences": 0,
      "scenes": 0
    },
    "warnings": []
  }
}
```

HTTP status is `201 Created`.

The route does not return a Project shell. The existing `onSelectProject`
navigation performs the authoritative post-create read exactly as it does for
every Project card.

### Diagnostics

- `STUDIO_SERVER040`: wrapper for a malformed Project creation HTTP request.
- Existing shared inner codes `STUDIO_SERVER010` and `STUDIO_SERVER012` report
  wrong field types/missing strings and unknown request fields.
- `PROJECT_DATA050`: existing Project Information validation family; blank
  creation title receives an issue at `['title']` and a creation-specific
  suggestion before filesystem writes.
- `PROJECT_DATA025`: existing invalid Project name; add issue location
  `['projectName']` without changing its accepted grammar.
- `PROJECT_DATA024`: existing folder collision; add issue location
  `['projectName']` and a suggestion to choose another Folder name.

No new diagnostic is created for FDX, templates, lazy folders, old setup YAML,
or compatibility state.

### Dialog component

```ts
interface CreateProjectDialogProps {
  storageRoot: string;
  onCreated: (projectName: string) => Promise<void>;
}
```

The trigger is owned by the component so one controlled dialog instance owns
its complete draft lifecycle. `onCreated` is called only after the Core report
has been received and the dialog draft has reset.

## Implementation Slices

### Slice 1 — Strengthen the existing Core creation boundary

Expected files:

```text
packages/core/src/client/project/model.ts
packages/core/src/client/project/index.ts
packages/core/src/client/index.ts
packages/core/src/server/project-data-service-contracts.ts
packages/core/src/server/commands/create-movie-project.ts
packages/core/src/server/commands/create-movie-project.test.ts
```

Work:

1. add/export `ProjectCreateRequest` and make the existing server input extend
   it without changing optional CLI/Core fields;
2. validate that `title` contains a non-whitespace character before resolving
   or creating the Project folder;
3. preserve the authored title value rather than silently rewriting it;
4. attach structured issues/suggestions and field paths to blank-title,
   invalid-name, and existing-folder failures;
5. keep current Project-name grammar and collision behavior unchanged;
6. prove all user-correctable validation happens before the target folder is
   created; and
7. expand successful-creation assertions to the empty Screenplay, default
   Settings, default locale, counts, Project folder, and database path where
   current tests do not already cover them.

Do not change the schema, migrations, defaults, CLI flags, result shape, or
low-level failure cleanup semantics.

### Slice 2 — Add the authenticated Studio server mutation

Expected files:

```text
packages/studio/server/http/project-create-request.ts
packages/studio/server/routes/projects.ts
packages/studio/server/routes/projects.test.ts
packages/studio/server/testing/fake-project-data-service.ts
```

Work:

1. parse an exact two-field request with existing shared request validators;
2. add `createMovieProject` to the focused projects-route service pick;
3. mount token middleware on `POST /`;
4. delegate the parsed strings unchanged to Core;
5. return `{ report }` with status 201;
6. serialize Core structured errors through `projectErrorResponse`; and
7. update the fake service only with a realistic creation result needed by
   route tests, without adding generic mutation behavior.

### Slice 3 — Add the browser service and Project-name suggestion

Expected files:

```text
packages/studio/src/services/studio-projects-api.ts
packages/studio/src/services/studio-projects-api.test.ts
packages/studio/src/features/project-library/project-name-suggestion.ts
packages/studio/src/features/project-library/project-name-suggestion.test.ts
```

Work:

1. add `createProject(ProjectCreateRequest)` with POST, token, JSON body,
   response extraction, and existing structured error parsing;
2. reject a successful response that omits `report` with a clear service error;
3. implement the exact deterministic suggestion transform;
4. keep the helper feature-local and free of filesystem/collision logic; and
5. test representative ASCII, punctuation, accent, whitespace, numeric, and
   no-ASCII-result cases.

### Slice 4 — Build the selected dialog in the Project Library

Expected files:

```text
packages/studio/src/features/project-library/create-project-dialog.tsx
packages/studio/src/features/project-library/create-project-dialog.test.tsx
packages/studio/src/features/project-library/project-library-screen.tsx
packages/studio/src/features/project-library/empty-project-library.tsx
```

Work:

1. implement the selected dialog with existing local Shadcn primitives;
2. add the header trigger after Refresh without changing search, cards, or
   library geometry beyond the needed button width;
3. derive and track Folder name until user customization;
4. show the resolved location and accurate lazy-folder initialization copy;
5. implement client feedback, accessible field errors, global Alert, loading,
   dismissal guards, reset, and submit behavior;
6. close/reset on successful creation before selecting the new Project;
7. reuse the existing Project selection callback and session loading screen;
8. update the non-search empty-state copy without adding another button; and
9. compare the implementation at desktop size against the selected reference,
   preserving the live Studio tokens and components over incidental ImageGen
   pixel differences.

### Slice 5 — Integration, current documentation, and final shape review

Expected files:

```text
packages/studio/e2e/pages/project-library-page.ts
packages/studio/e2e/tests/smoke/project-library.smoke.spec.ts
docs/architecture/frontend.md
docs/architecture/reference/studio-server-hono.md
```

Work:

1. add one isolated UI-creation journey using a temporary E2E storage root;
2. verify direct navigation to the created empty Project and Project
   Information rendering;
3. return to the library and verify the created Project card is discoverable;
4. document the authenticated create endpoint and selected Project Library
   workflow in the current frontend/server references;
5. record the stale setup-YAML documentation conflict without editing
   historical decision reasoning or silently absorbing Plan 0018 cleanup; and
6. perform the required architecture/file-size inspection before completion.

The E2E fixture owns cleanup of only the test-created temporary Project. It
must not use Urban Basilica as the mutation target.

## Tests And Guardrails

### Core owning-layer tests

Cover the complete durable rule set once in Core:

- valid title and Project name create the accepted empty state;
- whitespace-only title returns `PROJECT_DATA050` with `title` location before
  the Project folder exists;
- malformed Project name returns `PROJECT_DATA025` with `projectName` location
  before the Project folder exists;
- existing target folder returns `PROJECT_DATA024` with `projectName` location
  and leaves existing contents untouched;
- current defaults and counts remain unchanged; and
- the existing transaction rollback test remains valid for database-row
  failure behavior.

Do not repeat this validation matrix at HTTP, React, and E2E layers.

### Studio server tests

- a valid authenticated request delegates exact `title` and `projectName` and
  returns 201 with the Core report;
- missing/wrong/unknown fields return `STUDIO_SERVER040` with structured inner
  issues;
- an invalid or missing runtime token is rejected by existing middleware;
- a representative Core creation error preserves its code, issues, and
  suggestion; and
- listing and reading existing Projects remain unchanged.

### Browser service tests

- exact endpoint, POST method, JSON body, and runtime token header;
- successful report extraction;
- missing report rejection; and
- structured API error preservation.

### Dialog/component tests

- trigger opens the dialog and title receives focus;
- title produces the expected Folder name and location;
- title keeps updating the suggestion until a manual Folder-name edit;
- a manual edit survives later title changes;
- invalid title/folder name disables submission and exposes accessible error
  copy;
- valid submit sends only the two accepted fields;
- in-flight state prevents duplicate submission and dismissal;
- field-located Core issues render under the correct input;
- an unexpected error renders one global Alert and preserves the draft;
- Cancel resets the draft;
- success resets/closes and calls `onCreated` exactly once; and
- empty and filtered-empty library states keep the header action available.

### Representative E2E journey

At the existing desktop viewport:

1. open the Project Library;
2. open the dialog;
3. type a unique Project title;
4. verify the suggested folder name and configured location;
5. create;
6. verify the browser reaches the new Project Information route;
7. verify the empty Project shell renders without a Screenplay import; and
8. return home and verify the new card appears.

No mobile viewport is added.

### Stable architecture guardrails

No new source-text test should freeze helper/function inventories. Existing
package/import boundaries plus runtime delegation tests are sufficient:

- Studio feature code imports services and `src/ui`, not server/database code;
- Studio server imports Core server entrypoints and never database access;
- Core tests prove invalid input fails before writes; and
- the final diff is inspected for raw interactive HTML and duplicated creation
  logic.

## Documentation

Update:

- `docs/architecture/frontend.md` with the Project Library create-dialog flow,
  selected desktop behavior, and service ownership;
- `docs/architecture/reference/studio-server-hono.md` with the authenticated
  root Project POST and thin delegation contract; and
- this plan's completion state/checklist during implementation.

Do not rewrite Decision 0004's original body or delete/rename the stale
ProjectSetup reference as a hidden side effect. If the broader empty-project
documentation cutover is accepted separately, it should add a current creation
reference and a concise supersession notice while preserving ADR history.

No sister-skill change is planned. Existing Movie Director and Screenplay
Drafter flows already resolve/open an existing Project before authoring.

## Final Verification

Run focused checks first:

```bash
pnpm --dir packages/core exec vitest run \
  src/server/commands/create-movie-project.test.ts \
  src/server/commands/create-movie-project-settings-rollback.test.ts
pnpm --dir packages/studio exec vitest run \
  server/routes/projects.test.ts \
  src/services/studio-projects-api.test.ts \
  src/features/project-library/create-project-dialog.test.tsx \
  src/features/project-library/project-name-suggestion.test.ts
```

Then run package/root verification proportional to the cross-package change:

```bash
pnpm build:core
pnpm build:studio
pnpm check
pnpm test
```

Run the one focused desktop E2E smoke journey using the existing Studio E2E
harness.

Manual desktop verification at approximately 1440×1024 must inspect:

- button placement beside Refresh with populated, empty, and filtered-empty
  libraries;
- selected dialog width, overlay, hierarchy, spacing, footer, and focus ring;
- long storage-root and Project-name location wrapping/truncation without
  clipped actions;
- keyboard focus order, Enter, Escape, Cancel, close, and screen-reader labels;
- loading state and duplicate-submit prevention;
- inline title, invalid-name, and existing-folder errors;
- successful navigation to the empty Project; and
- light and dark theme token behavior if the app's theme toggle is available.

Final architecture-shape review:

1. inspect `git diff --stat` and the complete diff;
2. inspect every new/modified file that grows materially;
3. confirm `create-movie-project.ts` remains a focused command rather than a
   generic initializer;
4. confirm `routes/projects.ts` remains a thin route composition;
5. confirm `project-library-screen.tsx`, `app.tsx`, and
   `use-project-session.ts` did not absorb the workflow;
6. confirm no `index.ts` became a behavior module;
7. confirm no raw interactive HTML appears in Project Library feature code;
8. confirm no schema/migration, FDX, template, Project type, Settings, or eager
   folder change entered the diff; and
9. confirm all test-created folders are isolated from Urban Basilica.

## Completion Checklist

### Review Area

- [x] Confirm the selected compact dialog remains the implemented visual
      direction.
- [x] Confirm the common path asks the user to type only Project title.
- [x] Confirm Folder name remains visible and editable before creation.
- [x] Confirm configured location is read-only and no folder picker was added.
- [x] Confirm the initialization copy promises only the Project folder and
      database, not an eager feature-folder tree.
- [x] Confirm no FDX, Screenplay source, template, Project type, or creative
      metadata choice entered the creation dialog.
- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm centralized Core ownership did not become a monolithic
      initializer.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Keep `ProjectDataService.createMovieProject` as the single durable
      creation owner.
- [x] Add/export Core client `ProjectCreateRequest`, make
      `CreateMovieProjectInput` extend it, and preserve `ProjectCreateReport`.
- [x] Add no parallel Studio request/domain model.
- [x] Add the exact authenticated `POST /studio-api/projects` request and 201
      response contract.
- [x] Keep HTTP parsing limited to the exact two-field envelope.
- [x] Keep Project-name suggestion presentation-only and feature-local.
- [x] Keep Core authoritative for blank title, Project-name grammar, folder
      containment, collision, defaults, migrations, and persistence.
- [x] Add field locations/suggestions to the three user-correctable Core
      creation failures.
- [x] Use `STUDIO_SERVER040` only for malformed creation HTTP envelopes.
- [x] Keep package-boundary diagnostics structured through the browser.
- [x] Add no compatibility shim, setup YAML path, alias, or fallback behavior.

### Core Implementation

- [x] Validate non-blank title before any target Project folder write.
- [x] Preserve the authored title value after validation.
- [x] Preserve the existing Project-name regex and containment guard.
- [x] Preserve explicit collision failure without suffix guessing.
- [x] Preserve current migrations, default aspect ratio, empty Screenplay,
      default Project Settings, default locale, and counts.
- [x] Preserve existing low-level database rollback behavior without adding an
      unrequested recovery subsystem.
- [x] Keep feature folders lazy and content-owned.

### Studio Server And Browser Service

- [x] Add `project-create-request.ts` with exact field/type validation.
- [x] Add a short token-protected root POST handler to `projects.ts`.
- [x] Delegate parsed values unchanged and serialize the Core report.
- [x] Update the fake Project service only for realistic route testing.
- [x] Add `createProject` to the existing browser Project API service.
- [x] Send the Studio runtime token and exact JSON body.
- [x] Reject a malformed success response clearly.
- [x] Preserve structured Core/API errors.

### Studio UI

- [x] Add **Create Project** after Refresh using local `Button` and Plus icon.
- [x] Build the selected dialog with local `Dialog`, `Input`, `Button`, and
      `Alert` primitives only.
- [x] Implement exact title, description, labels, helper, location, accurate
      initialization note, Cancel, and Create project copy.
- [x] Give Project title initial focus and associate helper/error text with the
      correct fields.
- [x] Implement the exact Project-name suggestion algorithm.
- [x] Stop suggestion updates after manual Folder-name editing.
- [x] Show a location preview only from `storageRoot` and the current valid
      Folder name.
- [x] Disable invalid and duplicate submission.
- [x] Prevent ambiguous dismissal while creation is in flight.
- [x] Map diagnostic issue paths to the two fields and unexpected errors to one
      global Alert.
- [x] Preserve draft values on failure.
- [x] Reset on Cancel and success.
- [x] Close/reset before calling the existing Project-selection callback.
- [x] Keep `app.tsx` and `use-project-session.ts` free of new creation state.
- [x] Update empty-library copy without adding a second creation action.
- [x] Preserve search, Refresh, cards, validation-error cards, and Project
      selection behavior.

### Tests And Guardrails

- [x] Add Core creation tests for success, blank title, malformed Project name,
      and existing folder at the owning layer.
- [x] Prove user-correctable invalid input fails before target-folder creation.
- [x] Keep the existing Core transaction rollback test passing.
- [x] Add server request, token, delegation, response, and error tests.
- [x] Add browser service request/response/error tests.
- [x] Add Project-name suggestion unit tests.
- [x] Add dialog focus, derivation, manual-edit, validation, loading, error,
      reset, success, and duplicate-submit tests.
- [x] Add one representative desktop E2E UI-creation journey.
- [x] Use isolated temporary storage and leave Urban Basilica untouched.
- [x] Avoid duplicating the complete Core invalid-state matrix in adapters and
      E2E.
- [x] Add no architecture test that hard-codes private helper names or complete
      implementation inventories.

### Documentation

- [x] Document the Project Library create-dialog flow in current frontend docs.
- [x] Document the authenticated root Project POST and Core delegation in the
      current Studio server reference.
- [x] Record the pre-existing setup-YAML documentation conflict without
      rewriting historical ADR reasoning.
- [x] Do not silently absorb the broader Plan 0018 documentation cleanup.
- [x] Update this plan's status/checklist only as implementation evidence is
      completed.

### Final Verification

- [x] Run focused Core and Studio tests.
- [x] Run Core and Studio builds, `pnpm check`, and `pnpm test`.
- [x] Run the focused desktop E2E smoke journey.
- [x] Compare the live dialog with the selected visual reference at desktop
      size.
- [x] Verify populated, empty, and filtered-empty Project Library states.
- [x] Verify keyboard, focus, loading, field-error, global-error, and success
      behavior manually.
- [x] Review `git diff --stat` and the complete diff.
- [x] Inspect newly large or heavily modified files.
- [x] Confirm no new god file, catch-all module, broad dispatcher, raw control,
      schema migration, or eager folder scaffold was created.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
