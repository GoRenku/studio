# 0236 Studio First Run: Sample Film, Three Starts And A One-Time Star Note

Status: proposed
Date: 2026-10-15

## Summary

After first-run setup, a new user lands on an empty Project Library that says
"No projects found" and "Create an empty Project to initialize its database,
then use the agent to import an FDX or develop a screenplay." There is nothing
to look at. The finished Basilica sample exists, but reaching it today means
following a website tutorial that requires Git and a terminal.

This plan makes three changes:

1. **Open the sample film.** The empty Project Library offers one button. Studio
   downloads the latest published release of the existing Basilica sample from
   the `GoRenku/sample-project` GitHub repository, places it in the Project
   Library as `sample-project`, lets Core's existing open path bring its
   database up to the installed schema, and opens it. No API keys, provider
   calls or spend. An agent can do the same with `renku sample-film install`.
2. **Four starts replace "No projects found".** Open the sample film (leading
   card); start an empty project; have the agent create a project and import an
   FDX; or have the agent write a one-page scene. The two agent starts show a
   copyable prompt. A Library that already has projects shows a sample tile at
   the end of the grid until the sample is in the Library.
3. **A one-time star note.** The first time Studio shows one of the user's own
   projects that has real generation activity (at least one generated video
   take, scene storyboard image, character sheet or location sheet, whether
   the agent or Studio made it), Studio shows a dismissible note: Renku is free
   and open source, and a GitHub star helps others find it. Core decides from
   stored project state and records that it was shown; it never appears again.
   No telemetry.

The smallest useful scope reuses the existing Create Project dialog, Core's
project open and upgrade path, the Sonner toast, and the already installed
`radix-ui` package. It adds no npm dependency, no Project schema change, no
migration and no website change.

## Review Attention

**Added beyond the literal request, and why**

- **Latest sample release (maintainer-approved revision, 2026-10-18).** Core
  resolves GitHub's latest published release only when installation starts.
  No Studio version, size, checksum or schema pin is maintained. Publishing
  a new sample requires no Studio change or release. Reported size is optional;
  progress shows received bytes when there is no total. Existing samples stay
  local and are never automatically updated. Core's existing database store
  upgrades older databases. A sample made by a newer Renku is checked after
  unpacking and stopped before it reaches the Library with
  `SAMPLE_FILM_REQUIRES_NEWER_RENKU`, whose suggestion says exactly how to
  update ("Update Renku with the update button in the Studio header, or run
  `renku update` in a terminal. Then open the sample film again."), so the
  Library stays clean and the sample tile stays available. Core's general
  newer-database error (`PROJECT_DATA044`) carries the same suggestion, and the
  Project Library card now shows an error's suggestion under its message.
- **A free-space check and a stalled-download timeout.** Studio refuses to
  start when less than twice the reported download size is free (when
  available), and stops a download
  that receives no data for 60 seconds. Without these a user can wait minutes
  for a predictable failure or watch a frozen progress bar.
- **A new CLI command, `renku sample-film install`** (decision D2), so an agent
  can fetch the sample when the user asks in conversation.
- **Star note re-check on resource changes.** Most generation happens through
  the agent while Studio is open, so Studio asks Core again whenever the open
  project's resources change, not only on open. Core answers from the state
  file alone once the note has been shown, so later checks do not open the
  database.
- **A fourth start and a sample tile** (maintainer review of the study,
  2026-10-18): creating an empty project must be as easy as the other starts,
  and a user who created a project first must still be able to get the sample.
  `SampleFilm` therefore gains `inLibrary`, decided by Core, and
  `CreateProjectDialog` gains optional `triggerVariant`/`triggerClassName` props
  so the start can use an outline trigger. The dialog itself is unchanged.
- **A small CLI refactor.** The "refresh the Project Library in Studio" notice
  that `renku create` sends moves into a shared CLI file so both commands use
  it instead of a copy.

**New or changed public contracts**

- Core: `installSampleFilm`, `readSampleFilm`, `startSampleFilmInstallation`,
  `offerStarNote`; client types `SampleFilm`, `SampleFilmInstallation`,
  `SampleFilmInstallationReport`, `StarNoteOffer`.
- Studio routes: `GET` and `POST /studio-api/sample-film`;
  `POST /studio-api/star-note`.
- CLI: `renku sample-film install [--json] [--storage-root <path>]`.
- Diagnostics: six `SAMPLE_FILM_*` codes, two `STAR_NOTE_*` codes,
  `STUDIO_SERVER042`, `CLI168` (listed under Contracts).
- New state file `star-note.json` in the Renku state directory.
- New UI primitive `packages/studio/src/ui/progress.tsx`.
- One new ADR.

**Effects on the user's disk**

- Only when the user clicks or runs the command: a `sample-project` folder
  is written into the Project Library. Its size depends on the published
  release. It never overwrites or
  merges. If that folder already holds a Renku project, Studio opens it without
  downloading. If it holds anything else, Studio stops with an error and
  touches nothing.
- The first open upgrades the sample's database through the existing Core
  path, which leaves a verified backup inside the sample's
  `.renku/project-database-backups/` folder (current behavior).
- The download is staged in a hidden `.sample-project-download-<random>` folder
  inside the Project Library and removed on success or failure. If Studio or
  the CLI is killed mid-download, that hidden folder
  remains for the user to delete.
- `star-note.json` is written once. No Project database change, migration or
  data cleanup.

**Deliberately unchanged**

- The website's `git clone` tutorial still works and is not edited. Plan 0233
  owns any repointing.
- The Create Project dialog, Project Library header, agent/CLI-only FDX import,
  screenplay skills, project upgrade and backup lifecycle, update notice, and
  Studio release archives (which still contain no sample data).
- No telemetry. The only sample network requests are the user-started release
  lookup on api.github.com and archive download from github.com.
  GitHub counts release-asset downloads on its own side; Studio
  sends nothing else. The star link opens only when clicked.

**Assumptions**

- The first sample release is cut from a new `GoRenku/sample-project` commit
  holding the generation-73 database (the maintainer's local copy already went
  70 → 73 through Core's upgrade). Later Studio releases upgrade it on first
  open through the same path.
- macOS and Windows 10+ include a system `tar` that unpacks `.tar.gz`; the
  platform installers already depend on it.
- Generation activity is read from `asset_file` rows that are not discarded,
  have `origin = 'generated'` and have type `shot_plan_video`,
  `scene_storyboard_image`, `character_sheet` or `location_sheet`. Image edits
  of those types count, because they are generations too.
- D5 changed: the v1.0.0 sample content is prepared in a separate session
  (generation-73 database plus newer Basilica assets). Subsequent sample
  releases are published independently of Studio.

**Decisions:** D1, D2 approved as recommended; D3 and D5 changed by the
maintainer (2026-10-18), recorded below; D4 settled: direction B revised
(sample-led, four starts, sample tile) with the proposed copy.

## Decisions For Approval

| ID | Decision | Recommendation | Alternative |
| --- | --- | --- | --- |
| D1 | Where the sample archive is hosted | GitHub Release asset on `GoRenku/sample-project`: no credentials or upload script, immutable assets | R2 mirror under `downloads.gorenku.com`, which needs an upload step with R2 credentials |
| D2 | Agent parity | Add `renku sample-film install` | Studio button only |
| D3 | Star note moment | **Changed:** the first time Studio shows one of the user's own projects (not the sample film) that has generation activity: a generated video take, scene storyboard image, character sheet or location sheet. Checked on project open and on resource changes | Original: first Studio-only pick, rejected because most picks happen through the agent |
| D4 | Visual direction and copy | **Selected:** sample-led layout with four starts and a sample tile, as described in Product Behavior; copy as proposed | Three equal starts; compact list (rejected) |
| D5 | First sample release content | **Changed:** commit the migrated generation-73 database and newer Basilica assets to the sample repository first (separate session), then tag `v1.0.0` | Original: tag current `main` at generation 70 |

## Product Behavior

### Empty Project Library

When the Project Library has loaded and contains no projects, the content area
shows the heading **Start your first film**, the line "Your Project Library is
empty. Pick one way in.", a leading sample card and three equal starts below
it. When the library has projects but the search matches none, it keeps
today's **No matching projects** / "Try a different title, project name, or
logline." The loading state and the header (search, Refresh, Create Project,
Settings, Theme) are unchanged.

1. **Explore the sample film** (leading card) — "Basilica, a short film taken
   from screenplay to storyboards, shot plans and video in Renku. Browse
   everything; no API keys needed." Primary button **Open the sample film**.
   Supporting line "Downloads about {N} MB from GitHub."
2. **Start an empty project** — "Name your film and begin from a clean project.
   Bring in a screenplay or write one whenever you are ready." The existing
   **Create Project** dialog with an outline trigger.
3. **Import a screenplay** — "Copy this request into your agent. It creates the
   project and imports the screenplay." A read-only prompt with **Copy**:
   `Create a new Renku project called "[project title]" and import the Final Draft screenplay at [full path to your .fdx file].`
4. **Write a scene with your agent** — "Describe an idea; your agent creates the
   project and drafts a one-page scene." A read-only prompt with **Copy**:
   `Create a new Renku project and write a one-page scene about [your idea].`
   The existing Screenplay Drafter skill creates the project with
   `renku create`, which already tells a running Studio to refresh the Library.

When the Library has projects, no search is active and Core reports
`inLibrary: false`, a dashed **Explore the sample film** tile ("Basilica, taken
from screenplay to video in Renku. No API keys needed.") sits at the end of the
project grid with the same button and states.

**Copy** changes to **Copied** after success. On clipboard failure it shows
"Unable to copy. Select the text and copy it manually." (the existing FDX
dialog wording).

### Sample film states

| State | What the user sees |
| --- | --- |
| Ready to start | The start described above |
| Downloading | With a total, a progress bar and "Downloading {received} of {N} MB"; otherwise "Downloading {received} MB"; the button is disabled |
| Preparing (unpack, place, upgrade database) | "Preparing the sample film…" with a spinner |
| Done | The Library refreshes and Studio opens the project (it appears as **Basilica**) |
| Failed | An error alert with Core's message and suggestion, and **Try again** |

Sizes are decimal megabytes rounded to whole numbers. Leaving the Library during
a download does not stop it: the Studio server continues, and returning shows
the current progress. Stopping Studio stops the download.

The CLI performs the same installation. In human mode it prints a line at each
10% of the download, then "Preparing the sample film…", then the project title
and path. In `--json` mode it prints only the final report. It does not change
the current authoring project.

### Star note

When Studio opens a project, and whenever the open project's resources change,
Studio asks Core whether to show the note. Core says yes exactly once per user
on this machine, never for the sample film, only when the project has
generation activity (a generated video take, scene storyboard image, character
sheet or location sheet that is not in Trash), and records it before
answering. Studio then shows a toast at
the bottom right that stays until closed:

- title **Renku is free and open source**;
- description "A star on GitHub helps other filmmakers find it.";
- action **Star on GitHub**, opening `https://github.com/GoRenku/studio` in a new
  tab; and a close button.

If the request fails, nothing is shown; the pick itself has already succeeded.
Reloading the page does not bring the note back.

## Requirement Ledger

| ID | Source | Requirement | Owner and verification |
| --- | --- | --- | --- |
| R1 | User | Empty Library offers **Open the sample film**; Studio fetches, places and opens Basilica with no keys or spend | Core install command; React start; desktop journey |
| R2 | User + review memory (release owners); maintainer revision 2026-10-18 | Resolve the latest published sample without coupling it to Studio releases | Evidence below; sample release procedure; release lookup tests |
| R3 | User + Plan 0223 | Bring the sample database to the installed schema through the existing upgrade owner | Core `openProjectStore` path; real release verification |
| R4 | User | Define existing-folder behavior, size, progress and failure | Core rules and tests; React states |
| R5 | User + AGENTS.md | Core command, thin route, CLI command, React projection | Architecture Shape Gate; import-boundary test |
| R6 | User | Replace the empty state with four starts and a sample tile, intentional copy, shadcn controls only | Project Library feature; component tests; design gate |
| R7 | User | One-time dismissible star note at an honest success moment; state owned by Core; no telemetry | Core star note; route; toast; tests |
| R8 | Data integrity / security | Never overwrite user folders; place atomically; check reported download size when available | Core install rules and tests |
| R9 | Review memory (visual target) | Establish and approve the visual target before building this design-sensitive surface | Slice 1 study (temporary); final check against Product Behavior |
| R10 | Distribution doc, Plan 0176 R10 | Project databases and media are not Studio release inputs | Sample stays a separate release; existing archive content checks unchanged |

## Evidence

### How the sample is obtained today

- The website tutorial (`packages/website/src/data/tutorials.ts`, slug
  `sample-project`) tells users to `cd` into the Project Library and run
  `git clone https://github.com/GoRenku/sample-project.git`, then choose
  Refresh and open the **Basilica** card. The quick-start page links to it.
- `GoRenku/sample-project` is public, was created on 2026-09-25, and has two
  commits on `main` (`01cb890`, `96b6ca6`). It has **no tags, no GitHub
  Releases and no license file**. GitHub reports a repository size of 357,767
  KB, which is the history a clone downloads; every future media change adds
  to it.
- The tracked content is 152 files, 374,850,253 bytes (about 375 MB): 15 MP4
  videos (largest 34 MB), 73 PNGs, 14 MP3s, three `.blend` files, one 29 MB
  `.spz` world, and `.renku/project.sqlite`. Its `.gitignore` excludes backups,
  Trash and SQLite WAL/SHM files.
- The committed database (read from `HEAD` into the scratchpad, read-only)
  holds project name `sample-project`, title `Basilica`, id
  `project_fgmha8us`, schema generation **70**, journal mode `delete`, and
  passes `PRAGMA quick_check`.
- The maintainer's local checkout at `/Users/keremk/renku-movies/sample-project`
  has an **uncommitted** `.renku/project.sqlite` at generation 73, with Core's
  upgrade backups for 70→71, 71→72 and 72→73. This proves the automatic upgrade
  works on this content. A release built with `git archive` from a tag ignores
  uncommitted files.
- This repository is distinct from the obsolete in-repository `sample-project/`
  folder and `sample-project.yaml` that AGENTS.md retires; those no longer exist
  (removed in `bc4f8b83`). Urban Basilica (4.5 GB) remains internal and is never
  a public sample (`docs/architecture/project-database-distribution.md`).

### How it should be obtained

| Concern | `git clone` of `main` | Latest published release archive (chosen) |
| --- | --- | --- |
| Needs Git | Yes | No |
| Download | Whole history (about 350 MB now, growing) | One archive of current files only |
| Version | Moving branch | Latest published tag `vX.Y.Z` and release asset |
| Database compatibility | Can be newer than the user's Studio | Existing Core store upgrades older databases and rejects newer ones |
| Progress | Must parse Git output | Reported total when available; received bytes otherwise |

**Release owner:** the `GoRenku/sample-project` repository, released by the
maintainer. Its annotated tag `vX.Y.Z` is the sample version. The GitHub Release
of that tag carries one asset made from the tag with `git archive`. Assets are
never replaced; new content means a new tag. Studio and the sample never share a
version. Core resolves the latest published release at installation time; no
Studio edit or release is needed to update the sample. The procedure is documented in
`docs/operations/distribution-and-release.md` (Slice 8). No release script is
added to the sample repository.

### Database compatibility and upgrade

- Core's `openProjectStore({ projectFolder, create: false })` automatically
  upgrades a database whose generation is lower than the runtime's, after a
  verified backup (`database/lifecycle/store.ts`, Plan 0223). A newer
  generation fails with `PROJECT_DATA044`. The Library listing opens projects
  through the same path.
- The current runtime generation is 73 (`drizzle/0091_generation_lanes.sql`).
  v1.0.0 ships at 73, so it opens as is; a later Studio upgrades it on open.
- There is no sample schema manifest or Studio release gate. The existing
  store owns database compatibility; maintainers verify new sample releases
  against the Studio versions they intend to support.

### Existing folder and naming

- Studio opens a project by its stored project name, resolved to
  `<storageRoot>/<projectName>` (`files/project-paths.ts`). The sample must
  therefore live at `<Project Library>/sample-project`; the tutorial says the
  same.
- The empty start appears only when the Library has no projects. A
  `sample-project` folder that already contains `.renku/project.sqlite` is a
  listed project, so in Studio a conflict can only be a folder without that
  database (for example a partial clone). The CLI can run at any time, so Core
  also handles the "already a project" case.
- `readProjectLibrary` lists only folders whose direct child is
  `.renku/project.sqlite`. A hidden staging folder that holds
  `sample-project/.renku/project.sqlite` one level deeper is never listed.

### Create, import and screenplay paths

- Studio's Create Project dialog (`create-project-dialog.tsx`) calls
  `POST /studio-api/projects` and then opens the new project.
  `docs/architecture/frontend.md` says FDX import and screenplay authoring stay
  agent workflows, not dialog branches.
- There is no FDX import UI in Studio. Import runs through
  `renku screenplay import-fdx`, driven by the Screenplay Drafter skill; the
  website quick-start uses an agent prompt for it.
- Screenplay Drafter supports a new screenplay from a rough idea and creates
  projects with `renku create <project-name> --title <title>`. That command
  appends `studio.projectRefreshRequested` so a running Studio refreshes the
  Library (`create-project-command.ts`, warning `CLI027` on failure).

### What Core can observe for the star note

- Every generated media file is an `asset_file` row (`schema/asset-files.ts`).
  `origin = 'generated'` marks generated media; imports use `imported` or
  `external`, so `type` alone is not enough (reference imports can create
  `character_sheet` rows).
- The four activity types are `shot_plan_video` (video takes),
  `scene_storyboard_image`, `character_sheet` and `location_sheet`. Discarded
  files have `discarded_at` set.
- Media the agent attaches reaches Studio as `studio.projectResourcesChanged`
  events (ADR 0054). Studio uses such an event only as a reason to ask Core
  again; it never reads the resource keys for this rule.
- Mutable per-user state belongs in the Renku state directory (ADR 0116:
  `~/.local/state/renku` on macOS, `%LOCALAPPDATA%\Renku\Studio\State` on
  Windows). ADR 0085's "no onboarding-completion state" stays true: the star
  note is not onboarding state, and the empty-library starts store nothing.

### Reusable pieces

- `radix-ui` 1.4.3 is already a Studio dependency and includes Progress, so
  `src/ui/progress.tsx` needs no new package.
- Sonner's `Toaster` is mounted in `App`; features already call `toast`.
- Core has no archive library. The installers unpack with the system `tar`
  (`tar.exe` on Windows). Core already starts child processes (Drizzle Kit,
  update handoff).
- Plan 0212's `renku-release-check.ts` and `renku-update-handoff.ts` set the
  precedents for an injectable `fetcher`, `...WithOptions` test seams, and a
  Core-owned in-process guard used by a token-protected Studio `POST`.
- The Studio Playwright page object clicks
  `getByRole('button', { name: 'Create Project' })`; with a second trigger in
  an empty Library that locator becomes ambiguous.

### Overlapping plans and decisions

- **0008** (draft, May): narrative-starter YAML creation. Not implemented and
  not used here.
- **0010** (draft): a development skill for maintaining the external sample.
  Not implemented; sample upkeep stays manual. Not constraining.
- **0223** (implemented locally): Core automatic upgrade with verified backups.
  Reused unchanged.
- **0212** (complete): update check and handoff. Followed as a structural
  precedent; unchanged.
- **0176** (implemented; publication pending): left public sample projects out
  of its scope and rejects sample data in Studio archives. The sample stays a
  separate release.
- **0199** (proposed, not implemented): isolated Renku home. Verification here
  uses the existing E2E server mode with a scratch `HOME` instead.
- **0230** (proposed): reserves ADR 0119.
- Siblings: **0233** may repoint the tutorial and Quick Start step 02; this
  plan changes neither. **0237** owns all telemetry, consent and the "Where did
  you hear about Renku?" question; it may count a completed
  `installSampleFilm` with outcome `installed` as `project_created` with
  source `sample`. This plan adds no event and leaves that hook to 0237.

## Architecture Shape Gate

### Ownership

- **Core** owns everything durable or risky: latest-release lookup, storage-root
  resolution, the folder rules, the free-space check, download, reported-size
  checks, unpacking, atomic placement, opening and upgrading
  through the existing store, the Studio-process single-flight state, and the
  star note decision and state file.
- **Studio server** routes read the request, call Core, serialize the result,
  and map structured errors.
- **CLI** parses flags, calls Core, prints progress and the report, and sends
  the existing Library refresh notice.
- **React** shows Core's state, sends user intent (start, offer), polls while
  active, and opens the project Core reports. It never inspects folders,
  project names or download validity.

### File layout

```text
packages/core/src/client/
  sample-film.ts                SampleFilm, SampleFilmInstallation, SampleFilmInstallationReport
  star-note.ts                  StarNoteOffer
  index.ts                      add type exports only

packages/core/src/server/sample-film/
  sample-film-release.ts        SampleFilmRelease, SAMPLE_FILM_PROJECT_NAME, resolveSampleFilmRelease
  sample-film-errors.ts         SAMPLE_FILM_* StructuredError constructors
  archive-download.ts           streamed download: optional reported-size check, 60 s stall timeout, progress callback
  archive-unpack.ts             platform tar path, unpack into staging, expected-folder check
  install-sample-film.ts        prepareSampleFilmInstallation (preflight), completeSampleFilmInstallation (stage → place → open), installSampleFilm
  studio-installation.ts        Studio-process single flight: readSampleFilm, startSampleFilmInstallation
packages/core/src/server/star-note/
  star-note.ts                  offerStarNote: sample exclusion, state file read/validate, activity check, atomic write
  generation-activity.ts        hasGenerationActivity(session): one query over asset_file
packages/core/src/server/index.ts   add export lines only

packages/studio/server/
  routes/sample-film.ts         GET and POST /studio-api/sample-film
  routes/star-note.ts           POST /studio-api/star-note
  http/star-note-request.ts     readStarNoteRequest
  app.ts                        mount the two routes
  errors.ts                     map the SAMPLE_FILM_ prefix to 400
  architecture.test.ts          forbid node:child_process in route files

packages/cli/src/commands/
  sample-film-command.ts        runSampleFilmCommand (install subcommand)
  project-library-refresh.ts    appendProjectLibraryRefreshEvent, moved from create-project-command.ts
  create-project-command.ts     imports the moved helper; shrinks
  registry.ts                   one 'sample-film' entry
packages/cli/src/arguments.ts   one help line

packages/studio/src/
  ui/progress.tsx               shadcn Progress on radix-ui
  services/sample-film-api.ts   readSampleFilm, startSampleFilmInstallation
  services/star-note-api.ts     requestStarNoteOffer
  app/star-note.tsx             offerStarNote(projectName) and the toast content
  app/use-star-note.ts          asks on project open and on resource changes of the open project
  features/project-library/
    project-library-starts.tsx       heading, the leading sample card and the three starts
    sample-film-start.tsx            sample lead card and grid tile, and their states
    use-sample-film-installation.ts  read on mount, start, 500 ms polling while active, completion
    agent-prompt.tsx                 read-only prompt Textarea and Copy Button
    no-matching-projects.tsx         the existing no-match message
    empty-project-library.tsx        deleted
    project-library-screen.tsx       chooses starts, no-match or cards (plus sample tile)
    create-project-dialog.tsx        optional triggerVariant/triggerClassName only
packages/studio/e2e/pages/project-library-page.ts   scope the Create Project locator to the header
```

The `sample-film/` folder has no `index.ts`; `server/index.ts` exports directly
from its files, as it does for `installation/`. No re-export file is added.

### Bounded branches

- `archive-unpack.ts` has exactly two tar locations: `%SystemRoot%\System32\tar.exe`
  on `win32`, `/usr/bin/tar` elsewhere. No generic command runner.
- `install-sample-film.ts` keeps the existing-folder rule in one function used
  both in preflight and when the final move finds the target already present.
- The star note has one Core decision function. React has one app-level hook.

### Forbidden shapes

- Download, archive, filesystem or process logic in a route, CLI
  command or React file.
- React or route checks of folder names, project names or star note
  eligibility.
- A route or command that accepts a URL, path, checksum or shell argument from
  the caller.
- Any `git` invocation, a new npm dependency, a new Studio coordination event
  type, or streaming progress over the events channel.
- A general "notices" registry or state document; onboarding or first-run
  state.
- Star note logic inside Core generation or selection commands, a new count
  in `ProjectCounts`, or reading resource-change keys to decide eligibility.

### Stop conditions

- System `tar` cannot unpack the archive on a supported target: stop and ask
  before adding an archive dependency.
- The latest sample does not open with the candidate Studio through the
  existing store: stop and fix the sample release or the 0223 upgrade owner;
  add no sample-specific repair code.
- The selected visual direction changes the Library header, onboarding or the
  Create Project dialog: stop; that is separate scope.
- The star note needs more than the one app-level hook: stop and revisit D3.
- `install-sample-film.ts` starts holding HTTP state, progress formatting or
  output text: split before continuing.

## Contracts

### Latest release (Core server-internal)

```ts
// packages/core/src/server/sample-film/sample-film-release.ts
export interface SampleFilmRelease {
  version: string;          // sample version; the release tag is `v${version}` in GoRenku/sample-project
  archiveUrl: string;       // immutable GitHub Release asset URL
  archiveBytes: number | null; // size reported by GitHub when available
}
export const SAMPLE_FILM_PROJECT_NAME = 'sample-project';
export function resolveSampleFilmRelease(fetcher: typeof fetch): Promise<SampleFilmRelease>;
```

Core reads `https://api.github.com/repos/GoRenku/sample-project/releases/latest`
and selects that release's `sample-project-X.Y.Z.tar.gz` asset. Version, URL and
optional size come from the response, never from hand-maintained Studio metadata.

**Archive layout:** a gzip tar with a single top-level folder
`sample-project/` that contains `sample-project/.renku/project.sqlite`,
produced by `git archive --format=tar.gz --prefix=sample-project/ v1.0.0`.

### Client contracts

```ts
// packages/core/src/client/sample-film.ts
export interface SampleFilm {
  archiveBytes: number | null;          // reported size; null before lookup or when unavailable
  inLibrary: boolean;                   // the sample folder holds a Project database
  installation: SampleFilmInstallation; // this Studio server process's current attempt
}

export type SampleFilmInstallation =
  | { state: 'idle' }                                // nothing started in this process
  | { state: 'downloading'; receivedBytes: number }  // bytes written so far
  | { state: 'preparing' }                           // unpacking, placing and opening
  | { state: 'ready'; projectName: string }          // placed or already present; open this project
  | { state: 'failed'; error: ProjectDataError };    // the existing serialized structured-error shape

export interface SampleFilmInstallationReport {
  outcome: 'installed' | 'alreadyInLibrary';
  projectName: string;          // stored project name; equals the folder name
  projectPath: string;          // absolute folder path
  title: string;                // read from the opened project ('Basilica')
  version: string | null;       // downloaded release version; null for an existing local project
  warnings: DiagnosticIssue[];  // non-blocking, for example a staging folder that could not be removed
}

// packages/core/src/client/star-note.ts
export interface StarNoteOffer {
  show: boolean; // true exactly once, after Core has recorded the note as shown
}
```

### Core functions (exported from `@gorenku/studio-core/server`)

- `installSampleFilm(input: RenkuConfigPathOptions & { onProgress?: (sampleFilm: SampleFilm) => void }): Promise<SampleFilmInstallationReport>`
  — the CLI path; runs preflight and completion in one call.
- `readSampleFilm(input: RenkuConfigPathOptions): Promise<SampleFilm>` — Studio `GET`.
- `startSampleFilmInstallation(input: RenkuConfigPathOptions): Promise<SampleFilm>`
  — Studio `POST`. Returns the current state if an attempt is running. Otherwise
  it runs preflight and throws its structured errors; returns `ready` without
  downloading when the project is already present; or starts the background
  completion and returns `downloading`.
- `offerStarNote(input: RenkuConfigPathOptions & { projectName: string }): Promise<StarNoteOffer>`.

Test seams follow Plan 0212: `installSampleFilmWithOptions` accepts `release`,
`fetcher`, `statfs` and `tarExecutable`; no environment variable or
customer-facing override is added.

### Installation rules (Core)

1. Resolve the storage root through existing config; create it if missing.
2. Target `<storageRoot>/<projectName>`:
   - a folder with `.renku/project.sqlite`: open it (step 8) and return
     `alreadyInLibrary`; nothing is downloaded;
   - anything else at that path: `SAMPLE_FILM_FOLDER_IN_USE` with the path and
     "Move or rename that folder, then try again."; nothing is touched.
3. Resolve the latest published release after checking the local target.
   When GitHub reports a size, free space must be at least `2 × archiveBytes`, otherwise
   `SAMPLE_FILM_INSUFFICIENT_SPACE`, reporting the needed and available
   megabytes.
4. Create `<storageRoot>/.sample-project-download-<6 random lowercase letters or digits>`
   exclusively.
5. Stream `archiveUrl` to `<staging>/archive.tar.gz`. Never buffer the archive
   in memory. Check the reported size when available. Abort when no data arrives for
   60 seconds, including the initial connection. A network failure, a non-2xx
   status, a stall or a reported-size mismatch is `SAMPLE_FILM_DOWNLOAD_FAILED`.
   No checksum is required. Report progress as `downloading`.
6. Report `preparing`. Run `<tar> -xzf <archive> -C <staging>`. A missing tar
   or non-zero exit is `SAMPLE_FILM_UNPACK_FAILED` with a stderr excerpt; so is
   a missing `<staging>/<projectName>/.renku/project.sqlite`. If the staged
   database was written by a newer Renku (Core's
   `projectDatabaseRequiresNewerRuntime`, a read-only schema generation check),
   stop with `SAMPLE_FILM_REQUIRES_NEWER_RENKU`; nothing is placed.
7. Rename `<staging>/<projectName>` to the target. If the target appeared during
   the download, apply rule 2 to the existing folder and leave it untouched.
   Other filesystem errors in steps 4–7 are `SAMPLE_FILM_STORAGE_FAILED` with
   the native code and syscall.
8. Open the placed folder with `openProjectStore({ projectFolder, create: false })`,
   which upgrades an older database after a verified backup. Read the title
   with `readProjectFromSession`, then close the session. Open and upgrade
   errors keep their existing `PROJECT_DATA` codes and backup details. The
   placed folder is kept: it is now a normal project with the existing recovery
   path.
9. Always remove the staging folder. A failed removal after a successful
   placement becomes a `SAMPLE_FILM_STORAGE_FAILED` warning in the report
   instead of failing the install.
10. In the Studio single flight, any non-structured error is stored as
    `SAMPLE_FILM_INSTALLATION_FAILED` with the original message.

### Star note rules (Core)

- State file `<Renku state directory>/star-note.json`:
  `{ "version": 1, "shownAt": "<ISO-8601 UTC timestamp>" }`.
- `projectName === SAMPLE_FILM_PROJECT_NAME` returns `{ show: false }`
  without reading or writing.
- File absent: open the project and check generation activity. None:
  `{ show: false }`, nothing written. Some: write the file (temporary file,
  then rename) and return `{ show: true }`. A write failure is
  `STAR_NOTE_STATE_WRITE_FAILED`; Core never returns `show: true` without the
  write. Project open errors keep their existing codes.
- File present and valid: `{ show: false }`. Present but unreadable or invalid:
  `STAR_NOTE_STATE_INVALID` (the note then never shows).

### Routes

- `GET /studio-api/sample-film` → `200 { sampleFilm: SampleFilm }`, with
  `Cache-Control: no-store`.
- `POST /studio-api/sample-film` → requires `X-Renku-Studio-Token`; reads no
  body; `200 { sampleFilm: SampleFilm }`. Preflight errors use
  `projectErrorResponse`, and the `SAMPLE_FILM_` prefix maps to 400.
  Download-stage failures arrive as `failed` in later `GET` responses.
- `POST /studio-api/star-note` → requires the token; body exactly
  `{ "projectName": string }` (invalid: `STUDIO_SERVER042`);
  `200 { offer: StarNoteOffer }`.

### CLI

```text
renku sample-film install [--json] [--storage-root <path>]
```

It reports the outcome, project name, path, title and version; in `--json`
mode it prints the full report. After `installed` or `alreadyInLibrary` it
appends `studio.projectRefreshRequested` (surface `projectLibrary`, source
`{ kind: 'cli', command: 'sample-film install' }`) through the shared helper;
a failed append keeps the existing `CLI027` warning, with a neutral message. A
missing or unknown subcommand is `CLI168` with the suggestion "Use
`renku sample-film install`."

### Diagnostics

| Code | Meaning |
| --- | --- |
| `SAMPLE_FILM_FOLDER_IN_USE` | `sample-project` exists and is not a Renku project |
| `SAMPLE_FILM_INSUFFICIENT_SPACE` | Less than twice the download size is free |
| `SAMPLE_FILM_DOWNLOAD_FAILED` | Network error, HTTP status, stall, or wrong size |
| `SAMPLE_FILM_UNPACK_FAILED` | Tar missing or failed, or the expected project folder is absent |
| `SAMPLE_FILM_REQUIRES_NEWER_RENKU` | The downloaded sample was made by a newer Renku; nothing is placed |
| `SAMPLE_FILM_STORAGE_FAILED` | Filesystem error while staging or placing (error), or staging cleanup failed (warning) |
| `SAMPLE_FILM_INSTALLATION_FAILED` | Unexpected non-structured failure in the Studio background attempt |
| `STAR_NOTE_STATE_INVALID` | `star-note.json` is unreadable or invalid |
| `STAR_NOTE_STATE_WRITE_FAILED` | `star-note.json` could not be written |
| `STUDIO_SERVER042` | Invalid star note request body |
| `CLI168` | Unknown `sample-film` subcommand |

## Implementation Slices

1. **Visual target (design gate, done).** The maintainer compared three
   directions and chose the sample-led layout, then asked for an empty-project
   start and a sample tile for a Library that already has projects (D4). The
   study and its captures were temporary and are not kept in the repository;
   Product Behavior is the record of the selected design.
2. **Sample release v1.0.0 (maintainer).** This does not depend on Studio code
   and can happen first. In `GoRenku/sample-project`, commit the prepared
   content (D5), tag it `v1.0.0`, build `sample-project-1.0.0.tar.gz` with
   `git archive --format=tar.gz --prefix=sample-project/ v1.0.0`, push the tag,
   and create the latest GitHub Release with the asset.
3. **Core sample film.** Add the client contract, latest-release lookup,
   errors, download, unpack, install and Studio single flight. Export from `server/index.ts` and
   `client/index.ts`. Tests build a small fixture archive from a project
   created with `createMovieProject` in a temporary folder, packed with the
   system tar, and serve it through an injected `fetcher`.
4. **Core star note.** Add `star-note.ts`, `generation-activity.ts`, its client
   type, the export and tests.
5. **Studio server.** Add `routes/sample-film.ts`, `routes/star-note.ts`,
   `http/star-note-request.ts`, mounts in `app.ts`, the `SAMPLE_FILM_` mapping
   in `errors.ts`, and the `node:child_process` rule in `architecture.test.ts`.
   Pass `homeDir` from the app options as setup and credentials already do.
6. **CLI.** Move `appendProjectLibraryRefreshEvent` from
   `create-project-command.ts` into `project-library-refresh.ts`, taking the
   command source and a neutral warning message as parameters; update `create`
   to use it. Add `sample-film-command.ts`, the registry entry and the help
   line.
7. **Studio UI.** Add `ui/progress.tsx`, the two service files,
   `project-library-starts.tsx`, `sample-film-start.tsx`,
   `use-sample-film-installation.ts`, `agent-prompt.tsx` and
   `no-matching-projects.tsx`. Delete `empty-project-library.tsx` and update
   `project-library-screen.tsx`. When the attempt becomes `ready`, call the
   screen's existing `onRefresh` and then `onSelectProject(projectName)`. On
   mount, show progress only for `downloading` or `preparing`; other states
   show the start. Add `app/star-note.tsx` and `app/use-star-note.ts`, mounted once
   where the open project and its resource-change events are already known. Scope the
   E2E page object's Create Project locator to the header. Match the selected
   design in Product Behavior.
8. **Documentation and ADR** (see Documentation), then the real-release
   verification below.

## Tests And Guardrails

**Core, owning layer (complete matrix)**

- Install success from the fixture: placed folder, opened title, report
  fields, staging removed, progress increasing up to `archiveBytes`, then
  `preparing`.
- Existing project folder: `alreadyInLibrary`, no fetch. Existing non-project
  folder or file: `SAMPLE_FILM_FOLDER_IN_USE`, no fetch, contents byte-identical.
- Insufficient space through an injected `statfs`: error before the archive
  download or staging folder, using the size reported by the release lookup.
- Network error, HTTP 404, stall (fake timers), oversize stream and short
  stream: `SAMPLE_FILM_DOWNLOAD_FAILED`, staging removed, target absent.
- Tar failure and an archive without the expected folder:
  `SAMPLE_FILM_UNPACK_FAILED`, staging removed, target absent.
- A sample database newer than the runtime: `SAMPLE_FILM_REQUIRES_NEWER_RENKU`
  with its update suggestion, staging removed, target absent.
- Target created during download: project → `alreadyInLibrary`, otherwise
  `SAMPLE_FILM_FOLDER_IN_USE`; the existing folder untouched, staging removed.
- `listLibrary` returns no projects while a staging folder holds the nested
  sample.
- Studio single flight: two concurrent starts cause one fetch; states move
  idle → downloading → preparing → ready; a failed attempt can restart; a
  preflight error leaves the state unchanged.
- Release lookup: use the latest published release's asset; accept an absent
  size; report HTTP, network, malformed response and missing-asset errors.
  Status reads and existing local sample opens make no GitHub requests.
- Star note: a project with no generated media does not show or write; each of
  the four activity types shows; an imported character sheet and a discarded
  generated file do not count; first offer shows and writes version 1 with an
  ISO timestamp; second does not show and does not open the project; the sample
  project name never shows or writes; an invalid file raises
  `STAR_NOTE_STATE_INVALID`; an unwritable directory raises
  `STAR_NOTE_STATE_WRITE_FAILED` and never shows.

**Studio server (adapter only)**

- Sample film `GET` serialization; `POST` token requirement, delegation and a
  preflight error mapped to 400 with the structured body.
- Star note token requirement, body validation (`STUDIO_SERVER042`),
  delegation and serialization.
- Architecture: route files import no `node:child_process`.

**CLI (adapter only)**

- Delegation with `--storage-root`; human progress lines at 10% steps;
  `--json` prints only the report; structured error output; refresh event
  appended; `CLI027` warning when appending fails; `CLI168`.
- Existing `create` tests keep passing with the moved helper.

**Studio UI**

- `project-library-screen.test.tsx`: empty Library → starts; non-matching search
  → no-match message; projects → cards.
- `sample-film-start.test.tsx` with mocked services and fake timers: offer text
  with size; downloading progress; preparing; ready → refresh then open the
  reported project; failed and POST error → message, suggestion and Try
  again; a mount during downloading resumes polling; a mount with an earlier
  `ready` or `failed` shows the start.
- `agent-prompt.test.tsx`: copy success and failure text.
- `star-note.test.tsx`: `show` → toast title, description, link and close;
  `show: false` or error → nothing.
- `use-star-note.test.tsx`: asks on project open and on a resource change for
  the open project; does not ask again after a `show: true`.
- Existing Playwright smoke passes with the header-scoped locator.

Representative end-to-end coverage is the manual real-release journey; no
environment override is added to point the server at a fake download.

## Documentation

- **New ADR** `docs/decisions/0122-offer-a-pinned-sample-film-and-a-one-time-star-note.md`
  (0119, 0120, 0121 and 0123 are reserved by Plans 0230, 0237, 0234 and
  0231). It records the
  independent sample release owner, latest-release lookup and existing Core
  database compatibility rules, Core-owned download, unpacking, placement and opening,
  the never-overwrite rule, the empty-library starts, and the star note moment
  and state. No older ADR is superseded. ADR 0085's "no onboarding-completion
  state" remains true.
- `docs/operations/distribution-and-release.md`: a new **Sample Film Release**
  section with the owner repository, tag rules, the exact `git archive`,
  `git push origin vX.Y.Z` and `gh release create` commands,
  the never-replace-assets rule and verification after publishing a sample.
- `docs/architecture/project-database-distribution.md`: a short **Sample
  Film** paragraph saying the sample is released separately and upgraded on
  first open through the same Core path.
- `docs/architecture/frontend.md`: extend **Project Library Lifecycle** with the
  empty-library starts, the sample film states and the star note call sites.
- `docs/architecture/reference/studio-server-hono.md`: the two new routes and
  their token rules.
- `docs/architecture/reference/structured-diagnostics.md`: the new codes.
- `docs/cli/commands.md`: a `renku sample-film install` section, and
  `star-note.json` added to the state directory table.
- No website, tutorial or Studio Skills change. The `git clone` tutorial
  remains correct.

## Final Verification

1. Focused tests: `pnpm --filter @gorenku/studio-core test -- sample-film star-note`,
   `pnpm test:cli`, the Studio server and UI tests named above, and
   `pnpm --dir packages/studio test:e2e:smoke`.
2. Root: `pnpm build`, `pnpm lint`, `pnpm check`, `pnpm test`.
3. Real release, CLI: after `pnpm build`, run
   `node packages/cli/dist/cli.js sample-film install --storage-root <scratchpad>/library --json`.
   Confirm `installed`, title **Basilica**, the database now at the runtime
   generation, a backup in `.renku/project-database-backups/`, no staging
   folder, and the report's version matching the latest published sample. Run it
   again and confirm `alreadyInLibrary` with no download.
4. Real release, desktop: start the Studio dev server in its existing isolated
   E2E mode on port 5174 (`HOME`, `RENKU_STUDIO_E2E_SERVER_ENABLED=1`,
   `RENKU_STUDIO_E2E_ISOLATED_HOME_DIR` pointing to a scratch home, with
   `XDG_CONFIG_HOME` and `XDG_STATE_HOME` unset). Finish first-run setup, skip
   provider keys, and verify at 1440×900 in light and dark against Product
   Behavior: the four starts and the sample tile; Copy on both prompts; Create Project from the
   start; sample download progress, preparing and opening into **Basilica**.
   Verify a pre-created non-project `sample-project` folder produces the folder
   error with the folder untouched. Opening the sample film, which has
   generated media, shows no star note and creates no `star-note.json` in the
   scratch state directory.
5. Star note positive path: a scratch home has no non-sample project with
   generated media without paid generation, so the positive path is proven by
   Core tests against real project databases and a real state file, the route
   tests, and the hook and toast component tests. The toast's appearance is checked
   against Product Behavior.
6. Shape review: `git diff --stat` and the full diff; inspect
   `install-sample-film.ts`, `studio-installation.ts`, `sample-film-start.tsx`
   and `project-library-screen.tsx`; confirm `index.ts` files only gained export
   lines, the routes and CLI command stay thin, there is no formatting churn,
   and no forbidden shape exists.
7. Windows unpacking and placement are implemented but verified natively only
   on the maintainer's Windows machine (deferred, as in Plans 0212 and 0223).

## What Only The Maintainer Can Do

- Select the visual direction and copy (done).
- Optionally add a license file to `GoRenku/sample-project` before its first
  release; it currently has none.
- Review and commit the prepared sample content, then publish sample release
  v1.0.0: tag it, build the archive with
  `git archive`, push the tag, and create the GitHub Release with the asset.
  Or explicitly authorize Claude to run those commands.
- Release Studio (`pnpm release`); later sample releases need no Studio release.
- Run the Windows check on the Windows machine when available.

## Deferred

- Starting Studio without keeping a terminal open for `renku studio start`:
  separate plan.
- "Export for sharing": separate plan.
- Mentioning `renku sample-film install` in Studio Skills or the website
  tutorial: Studio Skills maintainers and Plan 0233.

## Completion Checklist

### Review Area

- [x] D1, D2 approved; D3 and D5 changed by the maintainer and recorded.
- [x] D4: direction B revised and the proposed copy recorded in this plan.
- [ ] No adjacent change to the Library header, onboarding, Create Project
      dialog, FDX import, website or Studio Skills.
- [ ] The final module layout matches the Architecture Shape Gate; no god file,
      catch-all helper or broad dispatcher.
- [ ] No telemetry, analytics, consent or "where did you hear" behavior added.

### Architecture And Contracts

- [ ] `SampleFilm`, `SampleFilmInstallation`, `SampleFilmInstallationReport` and
      `StarNoteOffer` added to the Core client with documented fields.
- [ ] Core resolves the latest published sample release; no hardcoded version,
      size, checksum or schema generation; no public URL or path override.
- [ ] `installSampleFilm`, `readSampleFilm`, `startSampleFilmInstallation` and
      `offerStarNote` exported from `@gorenku/studio-core/server`; the index
      files contain only export lines.
- [ ] Routes `GET`/`POST /studio-api/sample-film` and `POST /studio-api/star-note`
      are thin; both `POST` routes require the token.
- [ ] `renku sample-film install` is thin and uses the shared refresh helper.
- [ ] All new diagnostics are structured with the codes in the table;
      `SAMPLE_FILM_` maps to HTTP 400.

### Implementation Slices

- [x] Slice 1 study shown in both themes and a direction selected; the study
      is not kept in the repository.
- [ ] Sample release v1.0.0 published on `GoRenku/sample-project` from a tag,
      with the expected archive asset attached and marked latest.
- [ ] Core install follows rules 1–10: existing-folder rule, free space,
      exclusive hidden staging, streamed download with optional reported-size
      check, stall timeout, system tar, atomic rename, open through
      `openProjectStore`, staging always removed.
- [ ] Studio single flight prevents duplicate downloads and reports states.
- [ ] Star note shows only for a project with generation activity; state file
      written atomically once; the sample is excluded; errors never produce
      `show: true`.
- [ ] `appendProjectLibraryRefreshEvent` moved; `create` updated; no copy left
      behind.
- [ ] `ui/progress.tsx` added on `radix-ui`; no new dependency.
- [ ] Four starts, sample tile, sample states, prompts with Copy, and no-match message
      implemented with local UI primitives only; `empty-project-library.tsx`
      deleted.
- [ ] Ready opens the Core-reported project through the existing selection path.
- [ ] Star note toast wired through the single app-level hook.
- [ ] E2E page object scoped to the header Create Project trigger.
- [ ] Publishing another sample release requires no Studio source change.

### Tests And Guardrails

- [ ] Core install, single flight, latest release lookup and star note matrices pass.
- [ ] Server adapter tests and the `node:child_process` route rule pass.
- [ ] CLI command and moved-helper tests pass.
- [ ] Studio screen, sample start, prompt, star note and hook tests pass.
- [ ] Playwright smoke passes.

### Documentation

- [ ] ADR 0122 written.
- [ ] Sample Film Release section added to the distribution doc.
- [ ] Project database distribution, frontend, Hono reference, diagnostics and
      CLI docs updated, including the state directory table.
- [ ] Historical plans and ADRs left unedited.

### Final Verification

- [ ] Focused tests, `pnpm build`, `pnpm lint`, `pnpm check` and `pnpm test`
      pass.
- [ ] Real-release CLI install and re-run verified, including the database
      upgrade and backup.
- [ ] Desktop journey verified in isolated E2E mode at 1440×900 in both themes
      against Product Behavior, including the folder-conflict case and no
      star note when opening the sample film.
- [ ] Star note positive path covered by Core, route and component tests; toast
      appearance matches Product Behavior.
- [ ] `git diff --stat` and the full diff reviewed; large files inspected; no
      formatting churn.
- [ ] Windows native verification recorded as deferred.
- [ ] No checklist item satisfied by accepting unreviewable structure; only
      then mark the plan complete.
