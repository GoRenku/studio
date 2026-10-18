# 0122 Offer The Latest Sample Film And A One-Time Star Note

Date: 2026-10-18

Status: accepted

Extends [ADR 0078](0078-use-independent-releases-and-codex-marketplace.md)
with an independently released sample film, and uses the Renku state directory
from [ADR 0116](0116-publish-the-skill-default-model-list-to-the-renku-state-directory.md).
No older ADR is superseded.

## Context

A new user landed on an empty Project Library that said "No projects found",
with nothing to look at. The finished Basilica sample lived in the
`GoRenku/sample-project` repository, and reaching it meant a website tutorial
that needs Git and a terminal. Cloning `main` downloads the whole history,
follows a moving branch. A published release provides an explicit sample update
without requiring Git on the user's machine.

Separately, Renku is free and open source, and a GitHub star helps other
filmmakers find it. Asking for one needs an honest moment: after the user has
made something, not on first launch. Most generation happens through the agent,
not through Studio picks.

## Decision

- **Sample release owner.** `GoRenku/sample-project` releases the sample on its
  own, separate from Studio. Its annotated tag `vX.Y.Z` is the sample version.
  The GitHub Release of that tag carries exactly one asset,
  `sample-project-X.Y.Z.tar.gz`, built from the tag with `git archive`, holding
  one top-level `sample-project/` folder. Assets are never replaced; new
  content means a new tag. Studio release archives never contain the sample.
- **Latest published sample.** When installation starts, Core reads
  `https://api.github.com/repos/GoRenku/sample-project/releases/latest` and
  downloads that release's `sample-project-X.Y.Z.tar.gz` asset. Publishing a
  new sample requires no Studio source change or Studio release. There is no
  hardcoded version, database generation, archive size or checksum. GitHub's
  reported asset size is used when available; otherwise installation proceeds
  without a total or an upfront space estimate. Reading Library status and
  opening an existing sample make no network requests.
- **Core owns installation.** `installSampleFilm` (CLI) and Studio's
  one-attempt-per-process `readSampleFilm` and `startSampleFilmInstallation`
  check free space (twice the archive size, when reported), stream the download
  into a hidden staging folder in the Project Library with a reported-size
  check and a 60-second stall timeout, unpack with the system
  `tar`, move the folder into place in one rename, and open it with the existing
  `openProjectStore`, which upgrades an older database after a verified backup.
  The staging folder is always removed. Routes, the CLI and React only call Core
  and show its state; none of them accepts a URL, path or checksum.
- **Never overwrite.** A `sample-project` folder that already holds
  `.renku/project.sqlite` is treated as already in the Library and opened
  without downloading. Anything else at that path stops with
  `SAMPLE_FILM_FOLDER_IN_USE` and is left untouched.
- **Empty-library starts.** An empty Project Library shows "Start your first
  film": open the sample film, start an empty project, import a screenplay,
  or write a scene with the agent. The two agent starts show a copyable
  request for the agent; they add no import or authoring path to Studio. A
  Library that has projects shows a sample tile at the end of the grid while
  the sample is not in it. `renku sample-film install` gives agents the same
  installation.
- **Star note moment.** Core's `offerStarNote` answers yes once per user on
  this machine, never for the sample film, and only when the open project has
  generation activity: a non-discarded generated `asset_file` of type
  `shot_plan_video`, `scene_storyboard_image`, `character_sheet` or
  `location_sheet`, whether the agent or Studio made it. Studio asks when a
  project opens and whenever that project's resources change, so agent work is
  noticed. Core records `{ "version": 1, "shownAt": "<ISO>" }` in
  `star-note.json` in the Renku state directory before answering yes, and
  never answers yes without that write. Simultaneous requests may show the note
  more than once; strict once-only concurrency is not required.
- **No telemetry.** The only sample network requests are the user-started
  release lookup on api.github.com and archive download from github.com.
  The star link opens only when clicked; Studio
  sends nothing about it.

## Consequences

- Changing the sample means publishing a new sample release. Existing local
  samples are never automatically updated or overwritten.
- The existing Core store upgrades an older database after a verified backup.
  There is no separate sample compatibility manifest or release gate. When an
  older Renku downloads a sample made by a newer Renku, Core checks the
  unpacked database before placing it and stops with
  `SAMPLE_FILM_REQUIRES_NEWER_RENKU`, asking the user to update Renku. The
  Library stays unchanged, so the sample can be opened after the update.
- A killed download can leave a hidden `.sample-project-download-<random>`
  folder in the Project Library for the user to delete.
- ADR 0085's "no onboarding-completion state" remains true: the empty-library
  starts store nothing, and the star note is not onboarding state.
