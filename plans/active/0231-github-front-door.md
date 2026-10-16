# 0231 GitHub Front Door

Status: accepted
Date: 2026-10-15

## Maintainer Decisions (2026-10-16)

- **D1** Yes: full GitHub releases marked "Latest"; the product stays beta.
- **D2** No video in the README. "See it in action" stays a plain link to the
  launch film on gorenku.com. M6 and the re-encoded film are dropped.
- **D3** Yes: Contributor Covenant 3.0, reports to `support@codingventures.com`.
- **D4** Yes: Discussions only in `GoRenku/studio`.
- **D5** GitHub Releases are the only home for release notes.
- The five stale draft releases may be deleted (M8).
- The old npm packages are retired as written (C9).
- Starter issues are dropped for now: C7 and M9 are out of scope.
- The operations document `docs/operations/github-presentation.md` is kept,
  short (about one page).

Where the sections below disagree with this list, this list wins.

## Summary

People who reach Renku on GitHub today find little reason to stay. Both
repositories have no description, no topics, no custom link preview and zero
stars. The Studio README opens with an architecture sentence that names only
Codex, shows one static screenshot, and puts configuration paths, a CLI table
and development commands on the first screen. All 25 public Studio releases
are marked pre-release, so GitHub shows no "Latest" release, and their notes
are empty. The old Renku npm packages and the `keremk/renku` repository still
look alive and point at documentation that no longer exists.

This plan turns the two GitHub repositories into a usable front door:

- a Studio README whose first screen says what Renku is, shows it moving,
  installs it in three lines and asks once for a star;
- a Studio Skills README that leads with its 20-skill crew and a real
  conversation;
- exact repository settings, link-preview images, Discussions, issue forms and
  a Code of Conduct;
- Studio releases that show up as "Latest" with readable notes, produced by
  the maintainer's existing `pnpm release` command;
- a clear public retirement of the old Renku packages and repository.

Most of the work is Markdown, images and settings. The only code change is in
Studio's release scripts. Everything that writes to GitHub or npm is a
maintainer task with exact commands, listed in
[What Only The Maintainer Can Do](#what-only-the-maintainer-can-do).

## Review Attention

**Added beyond the literal request, and why**

- **Release notes come from commit subjects.** GitHub's automatic notes list
  merged pull requests. Studio is built with direct commits, so every release
  page is empty. The release script will instead list the commit subjects
  since the previous release under Features, Fixes and Other changes (the
  categories already in `.github/release.yml`). Commit subjects already follow
  `feat:` / `fix:`, so no new writing step is added to `pnpm release`.
  Internal commits (`chore:`, `plan:`) appear under Other changes, as they
  would have under the old categories.
- **Each release page opens with one line** linking the install page and
  naming `renku update`. Visitors who land on a release otherwise see only
  raw archives.
- **One new operations document,** `docs/operations/github-presentation.md`,
  records the repository settings values and the exact commands that made
  the README images. Without it these exist only in GitHub's web settings
  and in this plan.
- **Contributor material stays in the README** under a "For contributors"
  heading with its section titles unchanged, because `CONTRIBUTING.md` links
  to two of them by anchor.
- **"What people make" is titled "Made with Renku".** The only film so far is
  the maintainer's own Urban Basilica; the heading should not imply a
  community gallery.
- **The Code of Conduct is copied into both repositories** rather than set
  once for the organization, because the organization's `.github` repository
  does not exist yet and a file in each repository works immediately.

**New or changed public things**

- Studio releases: published as full GitHub releases marked "Latest" (if D1
  is approved), with the new notes format. `.github/release.yml` is deleted.
  A new ADR narrows ADR 0078; the release operations document changes.
- New committed files: README images under `docs/readme-media/` (about
  3.5 MB), `CODE_OF_CONDUCT.md` in both repositories, issue forms (Studio:
  bug report, feature request; Studio Skills: skill idea, model request; a
  `config.yml` in each), `studio-skills/docs/plugin-installation-and-review-routing.md`,
  `docs/operations/github-presentation.md`.
- GitHub and npm settings (maintainer): descriptions, homepages, topics,
  link-preview images, Discussions and categories, organization profile,
  npm deprecation notices, archive of `keremk/renku`.

**Destructive or hard to reverse**

- Deleting the 5 draft releases (v0.1.1, v0.1.9, v0.1.12, v0.1.13, v0.1.21)
  removes their uploaded archives. Their tags stay. Drafts are visible only
  to people with write access, so this is housekeeping, not public
  presentation. Maintainer-confirmed task.
- Images committed to Git stay in the repository history permanently.
- `npm deprecate` and archiving `keremk/renku` can both be undone, but users
  see them immediately.

**Kept unchanged**

- The `pnpm release` commands, their order of steps, the draft-first upload,
  and "make public only after the download mirror (R2) is verified".
- The R2 `beta` channel, installers, `renku update` and Studio's update check
  (none of them read GitHub releases).
- Older releases stay marked pre-release; only v0.1.34 is changed now.
- Studio Skills release tooling. Studio Skills has never been released (no
  tags, no releases, no `beta` branch); this plan does not start that.
- Website pages (0232, 0233), analytics and link tracking (0234, 0235),
  the Studio app (0236, 0237), Latent Matinee (0238).
- `LICENSE`, `TRADEMARKS.md`, `NOTICE`, and the unused images already in
  `docs/screenshots/` (offered as a first contributor issue instead).

**Assumptions**

- Animated WebP plays in a GitHub README. GitHub serves committed `.webp`
  files as `image/webp` (checked today); browsers animate those. Confirmed
  after the push in Final Verification.
- Link-tracking parameters on gorenku.com links follow plan 0234's
  convention (also proposed). This plan writes them as `?{utm}` and copies
  0234's ready-to-use values into Contracts. Repository
  homepage fields stay plain `https://gorenku.com`, because GitHub shows the
  raw URL in the sidebar and already sends github.com as the referrer.
- "20 skills" is the current count (20 folders, each with `SKILL.md`).
  skills.sh shows 21 because it still lists the retired `install-renku`.
- The reporting address for the Code of Conduct is `support@codingventures.com`,
  already published on the Terms and Privacy pages.

**Decisions that need the maintainer's approval**

- **D1** Publish Studio releases as full GitHub releases marked "Latest",
  while the download channel and the product stay "beta". Recommended.
- **D2** Put the 2-minute launch film in the Studio README through one web
  upload (GitHub plays videos only when uploaded through its web editor).
  Recommended.
- **D3** Use Contributor Covenant 3.0 with `support@codingventures.com` as the
  reporting address. Recommended.
- **D4** Turn on Discussions only in `GoRenku/studio`; Studio Skills points
  there. Recommended.
- **D5** Where release notes live, shared with plan 0233's D1. Recommended:
  GitHub Releases are the only home, and the website changelog reads them at
  build time. Alternative: a checked-in `release-notes/vX.Y.Z.md` file per
  release, written by the release step.

Details are in [Decisions](#decisions).

## Decisions

**D1: full releases with a "Latest" badge.** Today `/releases/latest`
returns 404 and a "latest release" badge has nothing to show. Marking a
release as full does not change what users install: installers and the update
check read the R2 `beta` channel, never GitHub. The 0.x version number and
the first line of every release page still say beta. If declined, the script
keeps `--prerelease`, the README badge adds `include_prereleases`, and no ADR
is needed; the notes change still applies.

**D2: launch film in the README.** GitHub never plays a video committed to
the repository: it removes `<video>` tags from README files and shows no
player for a linked `.mp4`. It plays a video only when the file was uploaded
through a GitHub web editor, which produces a
`https://github.com/user-attachments/assets/…` address. The organization is
on GitHub's free plan, which limits such uploads to 10 MB. The launch film is
13 MB; a test re-encode at 1280×720 came to 9.4 MB with readable interface
text. If declined, the README links to the film on gorenku.com instead.

**D3: Code of Conduct.** Contributor Covenant 3.0 is the current version. Its
text is licensed CC BY-SA 4.0 and must keep its attribution section; that
licence covers only the conduct document, not the code. It needs one filled-in
item: how to report. `support@codingventures.com` is already public on the
website's Terms and Privacy pages.

**D4: one Discussions space.** Two repositories with separate Discussions
would split a very small community. Studio Skills issue forms and README link
to Studio's Discussions.

**D5: where release notes live (shared with 0233 D1).** Plan 0233's website
changelog needs the same notes.

- *GitHub Releases only (recommended).* Notes are composed from the commit
  history, which Git already keeps and the tag already freezes. The website
  build reads published releases from GitHub (one request per build; 0233
  describes that loader). A correction made on GitHub reaches the website on
  its next build. This plan stays as written.
- *Checked-in files (0233's recommendation).* `prepare.mjs` would compose the
  notes before the release commit and write `release-notes/vX.Y.Z.md` (with
  `version` and `date` front matter, as in 0233's contract) into that commit;
  `publish-github-release.mjs` would send the file's body with `--notes-file`.
  The website build stays offline, but this adds a top-level folder, a file
  format and a change inside `prepare.mjs`, and every later correction needs
  both a commit and `gh release edit`. If chosen, the Architecture Shape Gate
  below gains exactly those two changes and nothing else; `pnpm release`
  itself is unchanged.

## What Changes For Visitors

**Studio repository page.** The first screen shows: the name, one bold line
("An open-source, local-first film studio you direct through Codex or Claude
Code."), licence and latest-release badges, a two-sentence description, and a
silent looping clip of a Blender previs beside the generated take of the
same shot. Next comes Install: which agents work, what else you need, and
three one-line commands. Below that: the launch film (D2), three stills from
Urban Basilica under "Made with Renku", one sentence asking for a star, and
"How it works" with the existing Codex-and-Studio screenshot. Contributor
material and the licence follow lower down.

**Studio Skills repository page.** Opens with "A film crew of 20 skills for
your coding agent", the skill map, a short real conversation, and three ways
to install. The plugin and routing internals move to a named document.

**Sidebar and link previews.** Both repositories show a description, an
https homepage, topics, and a custom image when a link is shared.

**Releases.** The newest Studio release carries GitHub's "Latest" badge (D1).
Its page starts with an install line and lists what changed.

**Community.** Studio has Discussions (Help, Ideas, Show and tell, Model
requests). "New issue" offers forms instead of a blank box. Both repositories
show a Code of Conduct. A few issues are labelled `good first issue`.

**Old Renku.** `npm install @gorenku/cli` (and the other three packages)
warns that the package is retired and where Renku went. `keremk/renku` shows
a notice and is archived. The GoRenku organization page explains Renku and
lists its repositories.

## Requirement Ledger

| Requirement | Source | Where |
| --- | --- | --- |
| Studio README first screen: pitch naming Codex and Claude Code, moving demo, badges, three-line install, "works with Codex and Claude Code", one star ask, Urban Basilica stills, licence lower, contributor material lower without loss, `utm_source=github` links | Approved marketing plan, area 1 | Contracts C1–C3, Slices 2–3 |
| Honest account of committed media versus web-uploaded video; web upload as maintainer task | Area 1 | D2, C1, Maintainer task M6 |
| Studio Skills README: crew framing with verified count, skill map first, one example conversation, three install paths, skills.sh, internals moved to a named doc without loss | Area 2 | C4, Slice 4 |
| Repository descriptions, https homepages, topics, link-preview images with their sources | Area 3 | C5, C1, M4–M5 |
| Discussions and categories, issue forms in the right repositories, Code of Conduct with checked licence, `good first issue` candidates | Area 4 | D3–D4, C6–C7, Slice 5, M2, M9 |
| "Latest" release and readable notes through the existing release command; beta question surfaced; drafts deleted only with confirmation | Area 5; review memory 2026-08-10 (keep the established release command) | D1, D5, C8, Slice 1, M7–M8 |
| npm deprecation, `keremk/renku` pointer and archive, organization description and profile README | Area 6 | C9–C10, Slice 6, M10–M12 |
| New ADR plus notice on ADR 0078 when release behaviour changes | Review memory 2026-07-19 (supersede ADRs without rewriting) | Documentation |
| Fail fast at the release-tool boundary; no compatibility branches | AGENTS.md | Architecture Shape Gate |
| Preserve existing formatting; narrow edits | AGENTS.md | Slices, Final Verification |

## Context And Evidence

All facts below were checked on 2026-10-15.

**Release tooling.** `pnpm release` runs `scripts/release/ship.mjs`
(prepare, then publish). `scripts/release/publish-github-release.mjs` is the
only place that sets the release type and notes:

- `ensureDraftRelease` runs `gh release create <tag> --verify-tag --draft
  --prerelease --generate-notes --title "Renku <tag>"`, and refuses to resume
  a draft that is not also a pre-release (`RELEASE082`);
- `--finalize` runs `gh release edit <tag> --draft=false --prerelease`.

Both the local path (`scripts/release/publish.mjs`) and the optional GitHub
Actions path (`.github/workflows/release.yml`) call this script.
`--generate-notes` reads `.github/release.yml`, which groups merged pull
requests by label. Studio is developed with direct commits, so v0.1.34's notes
contain only the generated comment and a "Full Changelog" link. Commit
subjects between v0.1.1 and v0.1.34 are `fix:` (63), `feat:` (30), `chore:`
(9) and `plan:` (1), plus one `release:` commit per tag. The highest release
error code is `RELEASE095`.

ADR 0078 says both paths "create or resume a draft GitHub prerelease" and
publish it only after R2 verification. `docs/operations/distribution-and-release.md`
repeats this in its publish steps 8 and 11 and the Actions section. No other
ADR mentions pre-release. Studio's update check
(`packages/core/src/server/installation/renku-release-check.ts`) and both
installers read `downloads.gorenku.com/studio/channels/beta/release.json`.
The upgrade verifier downloads v0.1.3, v0.1.4, v0.1.5, v0.1.24 and v0.1.25 by
tag; none of these are drafts.

**GitHub state.** `GoRenku/studio`: 25 published releases, all pre-release;
5 drafts (v0.1.1, v0.1.9, v0.1.12, v0.1.13, v0.1.21), each with 9 assets and a
pushed tag. `/releases/latest` returns 404. Labels in both repositories are
GitHub's defaults (`bug`, `enhancement`, `good first issue`, …). The
organization is on the free plan, has no name, description or URL, and no
`.github` repository. Its public repositories are `studio`, `studio-skills`,
`sample-project`, `cinema-analyze` and `ai-films`. `GoRenku/studio-skills`
has no tags or releases and only a `main` branch; installers use `main`.

**READMEs.** Studio's README (157 lines) links the screenshot
`docs/screenshots/codex-and-renku.png`. `CONTRIBUTING.md` links to
`README.md#local-configuration-and-project-storage` and
`README.md#development-commands`; `studio-skills/docs/bundled-media-models.md`
links to `../README.md#add-a-model-for-your-own-use`. Four files in
`docs/screenshots/` (`cast.jpg`, `lookbook.jpg`, `shot-plan.jpg`,
`story-arc.jpg`) are referenced nowhere. The Studio Skills README's "Relationship
to Studio" section has a long second paragraph about installers,
marketplaces, development connections, generation lanes and the Default
Model List. Plan 0230 (proposed) will later rewrite that paragraph's last
sentence; after this plan it lives in the new docs file.

**Media.** Existing website media in `packages/website/src/assets/media/`:
`renku-launch.mp4` (2:16, 1280×720, sound, 13 MB),
`harbor-blender-previs.mp4` (17 s, 960×540, 0.5 MB),
`harbor-generation.mp4` (15 s, 960×548, sound, 1.9 MB),
`first-patron-shot-plan.mp4` (12 s, 1344×768, 5.6 MB). The launch film has
words burned into most shots; frames at 48 s (pencil storyboard) and 117.5 s
(character sheet) have none. A 10-second side-by-side loop of the two harbor
clips measured 2.2 MB as animated WebP (960 px wide) and 8.7 MB as GIF
(800 px wide). `ffmpeg` and ImageMagick (`magick`) are installed on the
development machine; they are not added as project dependencies.

**GitHub rendering rules.** Committed PNG, JPEG, GIF and WebP images render
in README files. Committed videos do not play. Web-uploaded videos up to 10 MB
(free plan) play from a `user-attachments` address on its own line.
Link-preview images must be PNG, JPG or GIF under 1 MB; 1280×640 is
recommended; they can only be set in the repository's Settings page.

**Legacy.** `/Users/keremk/Projects/aitinkerbox/renku` is a clean checkout of
`keremk/renku` (`main`, in sync with origin, 2 stars, not archived). Its
README links `gorenku.com/docs/…` pages that no longer exist and says
contributions are "coming very soon". npm packages `@gorenku/cli`,
`@gorenku/core`, `@gorenku/providers` and `@gorenku/compositions` are at
0.1.27, not deprecated, maintained by the maintainer's npm account. Nothing in
`studio`, `studio-skills` or `ai-films` depends on them. `@gorenku/cli`
installs a `renku` command, as does the new Studio installer (in
`~/.local/bin`, added to the front of `PATH`).

**Constraints from accepted documents.** AGENTS.md (no compatibility layers,
structured failures, preserve formatting, narrow edits); ADR 0078 and the
release operations document; review-memory lessons on keeping the established
local release command and on recording changed decisions in a new ADR.

**Sibling plans this one depends on or feeds.** 0234 owns the link-tracking
convention (`{utm}` below). 0232 owns the download page wording and the
redirect or 404 for old `gorenku.com/docs/` addresses. 0233 shows these
release notes on the website changelog (D5). 0238 owns whether Latent Matinee is
publicly connected to Renku, so `ai-films` is left out of the organization
profile until then.

## Architecture Shape Gate

Production code changes only in Studio's release tooling. Everything else is
documentation, configuration and images.

**Owner.** `scripts/release/` owns how a Studio GitHub Release is created,
described and published. No package under `packages/` changes.

**Files.**

- `scripts/release/release-notes.mjs` (new): exports
  `composeReleaseNotes({ tag, root = repositoryRoot })`, which returns the
  Markdown notes for an existing annotated tag. It owns finding the previous
  release tag, reading commit subjects, grouping them and writing the fixed
  lines. It reuses `parseReleaseTag` and `commandOutput` from
  `release-contract.mjs`. No command-line entry point.
- `scripts/release/publish-github-release.mjs` (changed): draft creation
  writes the composed notes to a temporary file outside the staging directory
  and passes it with `--notes-file`; it no longer passes `--generate-notes`
  or `--prerelease`. Resuming accepts an existing draft for the tag. Finalize
  publishes as a full release marked Latest. Two small exported functions
  build the exact `gh` argument lists, `githubDraftReleaseArguments({ tag,
  notesFile })` and `githubFinalizeReleaseArguments(tag)`, so tests can check
  them without calling GitHub.
- `scripts/release/release-notes.test.mjs` (new); additions to
  `scripts/release/release-contract.test.mjs`. Both run under the existing
  `pnpm test:release` glob.
- `.github/workflows/release.yml`: the last step's name changes from
  "Publish verified GitHub prerelease" to "Publish verified GitHub release".
- `.github/release.yml`: deleted; nothing reads it after this change.

The Actions workflow already checks out full history and tags
(`fetch-depth: 0`), so it produces the same notes as the local path.

**Unchanged.** `ship.mjs`, `prepare.mjs` (unless D5 chooses checked-in
files), `publish.mjs`, `publish-r2.mjs`, `package.json` scripts, the asset set
and its verification, and the order draft → upload → verify → R2 → publish.

**Forbidden shapes.** No new `package.json` script or flag. No interactive
prompt or editor step in the release. No `CHANGELOG.md`, and no checked-in
notes unless D5 chooses them.
No calls to GitHub other than the existing `gh release` commands. No
rewriting of commit text beyond removing the `type:` prefix and capitalizing
the first letter. No fallback to GitHub-generated notes.

**Failure behaviour.** A tag without an earlier annotated `v*` tag makes
`git describe` fail, which `commandOutput` already reports as `RELEASE055`
with Git's message, before any GitHub change. No new error code is needed.

**Stop and revise the plan if** notes composition needs network access or
user input, if `ship.mjs`, `prepare.mjs` or `publish.mjs` would need changes,
or if the publish script starts handling notes editing or other release
types.

## Contracts

`{utm}` below means the query string plan 0234 defines for that link
location (0234 owns the convention; these are its ready-to-use values):

| Location | `{utm}` |
| --- | --- |
| Studio README | `utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme` |
| Studio Skills README | same with `utm_content=skills-readme` |
| Studio release notes | same with `utm_content=release-notes` |
| Organization profile | same with `utm_content=org-profile` |
| `keremk/renku` README | same with `utm_content=renku-readme` |

Only links to gorenku.com are tagged; links to GitHub or skills.sh are not.

### C1 README images

All files in `GoRenku/studio` under `docs/readme-media/`, made from media
already published on gorenku.com. Exact commands go into
`docs/operations/github-presentation.md`.

| File | Made from | Size limit |
| --- | --- | --- |
| `previs-to-shot.webp` | First 10 s of `harbor-blender-previs.mp4` (left) and `harbor-generation.mp4` (right), each scaled to 480×274, side by side, 15 fps, animated WebP, quality 70, looping | ≤ 3 MB |
| `made-with-renku-storyboard.jpg` | `renku-launch.mp4` at 48 s, 640×360 | ≤ 150 KB |
| `made-with-renku-character-sheet.jpg` | `renku-launch.mp4` at 117.5 s, 640×360 | ≤ 150 KB |
| `made-with-renku-council-chamber.jpg` | `first-patron-shot-plan.mp4` at 9 s, 640×360 | ≤ 150 KB |
| `studio-social-preview.png` | `docs/screenshots/codex-and-renku.png` scaled to fit 1280×640 and centred on its own background colour (`rgb(12,11,9)`) | 1280×640, < 1 MB |
| `studio-skills-social-preview.jpg` | 2×2 grid of 640×320 centre crops: the 48 s storyboard, the 117.5 s character sheet, harbor previs at 8 s, harbor generation at 8 s | 1280×640, < 1 MB |

Each still is checked by eye: no burned-in words, correct subject.

For D2 the launch film is re-encoded, not committed:
`tmp/readme-media/renku-launch-github.mp4` (ignored by Git), H.264
1280×720 at about 480 kbit/s video, AAC 64 kbit/s audio, `faststart`, under
10 MB.

### C2 Studio README, first screen

Exact opening (Markdown):

````markdown
# Renku Studio

**An open-source, local-first film studio you direct through Codex or Claude Code.**

[![License: AGPL-3.0](https://img.shields.io/github/license/GoRenku/studio)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/GoRenku/studio)](https://github.com/GoRenku/studio/releases/latest)

You give direction in your agent's conversation. Renku keeps the screenplay,
visual language, cast, locations, scene Beats, Shot Plans, Blender previs and
generated footage in one project on your computer, and Studio shows it all in
your browser, for live-action, hybrid and fully AI films.

![A Blender previs of a harbor walk beside the AI-generated take of the same shot](docs/readme-media/previs-to-shot.webp)

<sub>A Blender previs and the AI-generated take of the same shot, from Urban
Basilica, the sample film made alongside Renku.</sub>

## Install

Works with **Codex** (desktop app or CLI) and **Claude Code** (Claude
Desktop's Code tab or the terminal). Each needs its own plan or API account.
You also need an API key with credit for at least one media provider, such as
fal.ai; you pay providers directly and Renku adds no markup.
macOS 13.5+ (Apple silicon or Intel) or Windows 10 (1803+) / 11, x64.

macOS:

```sh
curl -fsSL https://downloads.gorenku.com/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
```

Then start Studio (on macOS, in a new Terminal window):

```sh
renku studio start
```

Setup adds the Renku plugin from [Studio Skills](https://github.com/GoRenku/studio-skills)
to Codex and Claude automatically. The [download page](https://gorenku.com/download/?{utm})
has every step, [tutorials](https://gorenku.com/tutorials/?{utm}) take you to a
first scene, and other agents use the [skills guide](https://gorenku.com/agent-skills/?{utm}).
````

If D1 is declined, the release badge URL gains `?include_prereleases`.

### C3 Studio README, rest of the page

In this order, after the Install section:

1. `## See it in action` — the line
   `[Watch the 2-minute launch film](https://gorenku.com/?{utm})`. If D2 is
   approved, this line is replaced by the `user-attachments` video address on
   its own line once the maintainer has uploaded the film (M6).
2. `## Made with Renku` — the three stills in one row
   (`<p>` with three `<img width="32%">`, each with alt text), then:
   "Storyboard, character sheet and a generated shot from Urban Basilica, the
   sample film made alongside Renku. [Explore the project](https://github.com/GoRenku/sample-project)."
3. The star ask, one paragraph: "Renku is free and open source, made by one
   developer. If it helps your work, starring this repository helps other
   filmmakers find it. Questions and finished scenes are welcome in
   [Discussions](https://github.com/GoRenku/studio/discussions)." (The last
   sentence only if D4 is approved.)
4. `## How it works` — the existing screenshot
   `docs/screenshots/codex-and-renku.png` with its current alt text, then:
   "Renku's skills teach your agent filmmaking workflows and use the `renku`
   command line to read and update your project. Studio runs locally and shows
   the screenplay, cast, locations, shot plans and media so you can review the
   work and tell the agent what to change. Creative choices stay with you and
   your agent; Renku keeps the project consistent."
5. `## For contributors` — the current sentence "This repository is the
   technical entrypoint for the Studio runtime, CLI, and shared domain
   implementation.", then: "To work on the code, read
   [CONTRIBUTING.md](CONTRIBUTING.md). Everyone taking part follows the
   [Code of Conduct](CODE_OF_CONDUCT.md)." Then the current sections, moved
   verbatim and demoted from `##` to `###` with their titles unchanged:
   "How the repositories fit together", "Repository organization", "Local
   configuration and project storage", "CLI for technical work",
   "Development commands", "Documentation". Their sub-anchors keep working
   because GitHub builds anchors from the heading text.
6. `## License` — the current copyright, AGPLv3 and trademark paragraph,
   verbatim.

Removed: the current opening paragraph ("Renku Studio is a local-first
context engine … through the CLI.", which says only Codex; replaced by the C2
description) and "For installation, tutorials, and usage, start at
gorenku.com" (covered by the Install links). No other sentence is deleted.

### C4 Studio Skills README and moved document

Exact opening:

```markdown
# Renku Studio Skills

**A film crew of 20 skills for your coding agent.** A director,
screenwriters, a casting director, a production designer, shot planners and a
media producer that work with [Renku Studio](https://github.com/GoRenku/studio)
in Codex, Claude Code or any agent that supports Agent Skills.

[![License: MIT](https://img.shields.io/github/license/GoRenku/studio-skills)](LICENSE)
```

Then, in order:

1. `## Skill map` — the current table and its introduction, unchanged.
2. `## What it looks like` — the real exchange shown in Studio's
   `docs/screenshots/codex-and-renku.png`, introduced as "From a session on
   Urban Basilica, lightly trimmed:"

   > **You:** It repeats the line "A foundry that can breathe without
   > collapsing" twice.
   >
   > **Agent:** Yes—that confirms the duplicate. This take needs a retry. I'd
   > revise the prompt to tie the wide cut directly to the start of "A
   > foundry…", state the dialogue only once, and explicitly prohibit
   > replaying speech across the cut.
   >
   > **You:** Can you just cut out that repeated part without regenerating the
   > whole thing?
   >
   > **Agent:** Done—removed the repeated sentence with its matching picture
   > and sound, without regenerating or replacing audio. Saved as Clip 2.1 —
   > "Duplicate removed."

3. `## Install` — three paths, wording taken from the download page:
   - **Codex**: "[Install Renku](https://gorenku.com/download/?{utm}). Setup
     adds these skills as the Renku plugin; restart Codex afterwards."
   - **Claude Code**: "[Install Renku](https://gorenku.com/download/?{utm}).
     Setup adds the Renku plugin. In Claude Desktop, open the Code tab once
     before setup; then start a new Code conversation and use
     `/renku:movie-director`."
   - **Other agents** (Cursor and others): "Install Renku, then run
     `npx skills add GoRenku/studio-skills --agent cursor --skill '*' --copy`.
     See [Install skills for other agents](#install-skills-for-other-agents)."
   - "Also listed on [skills.sh](https://skills.sh/gorenku/studio-skills)."
4. `## Relationship to Studio` — its first paragraph unchanged, followed by:
   "How the plugins are installed and refreshed, and how generation review is
   routed, is described in
   [Plugin installation and review routing](docs/plugin-installation-and-review-routing.md)."
5. The remaining current sections, unchanged and in their current order:
   "Install skills for other agents", "Models and providers", "Add a model for
   your own use", "Repository layout", "Validation", "Technical references".
   The gorenku.com links in "Install skills for other agents" gain `?{utm}`.

New file `studio-skills/docs/plugin-installation-and-review-routing.md`:
heading `# Plugin Installation And Review Routing`, then the current second
paragraph of "Relationship to Studio" verbatim ("The split is deliberate: …
`renku generation default-models sync`."). Relative links change from
`skills/…` to `../skills/…`; nothing else changes.

### C5 Repository and organization settings

| Setting | `GoRenku/studio` | `GoRenku/studio-skills` |
| --- | --- | --- |
| Description | Open-source, local-first film studio you direct through Codex or Claude Code. Screenplay, cast, locations, shot plans, Blender previs and AI-generated footage in one project on your computer. | A film crew of 20 skills for Codex, Claude Code and other coding agents: screenwriting, casting, lookbooks, shot planning, Blender previs and media generation for Renku Studio. |
| Homepage | `https://gorenku.com` | `https://gorenku.com` |
| Topics (18 each; limit 20) | filmmaking, ai-filmmaking, film-production, pre-production, screenwriting, storyboard, previs, blender, generative-ai, ai-video, video-generation, image-generation, codex, claude-code, ai-agents, local-first, sqlite, typescript | agent-skills, claude-code, claude-code-plugin, codex, codex-plugin, ai-agents, filmmaking, ai-filmmaking, screenwriting, storyboard, previs, blender, generative-ai, ai-video, prompt-engineering, fal-ai, elevenlabs, replicate |
| Link preview | `docs/readme-media/studio-social-preview.png` | `docs/readme-media/studio-skills-social-preview.jpg` (file kept in the Studio repository with its sources) |

Organization `GoRenku`: display name `Renku`; description "Open-source,
local-first film studio you direct through Codex or Claude Code."; URL
`https://gorenku.com`.

Organization profile, `GoRenku/.github` → `profile/README.md`, exact text:

```markdown
# Renku

Renku is an open-source, local-first film studio you direct through Codex or
Claude Code. You give direction in the conversation; Renku keeps the
screenplay, cast, locations, shot plans, Blender previs and generated footage
in one project on your computer, and Studio shows it all.

- **[studio](https://github.com/GoRenku/studio)**: the Renku Studio app, the
  `renku` command line and generation engines (AGPL-3.0)
- **[studio-skills](https://github.com/GoRenku/studio-skills)**: a film crew of
  20 skills for your coding agent (MIT)
- **[sample-project](https://github.com/GoRenku/sample-project)**: Urban
  Basilica, a sample film project to explore
- **[cinema-analyze](https://github.com/GoRenku/cinema-analyze)**: a skill that
  studies a film's visual language from Film Grab stills (MIT)

[Download Renku](https://gorenku.com/download/?{utm}) ·
[Watch the launch film](https://gorenku.com/?{utm})
```

### C6 Community files

- `CODE_OF_CONDUCT.md` at the root of both repositories: Contributor
  Covenant 3.0, copied unchanged from the official site, with its
  attribution section kept, and the reporting placeholder replaced by
  "Report it privately by email to Kerem Karatal at support@codingventures.com."
  Every `[NOTE` placeholder is resolved; the default enforcement steps stay.
- Discussions (`GoRenku/studio` only, D4). Categories: keep
  "Announcements" (maintainer posts only) and "Ideas"; rename "Q&A" to
  "Help" (question-and-answer format); keep "Show and tell"; add "Model
  requests" (open discussion); delete the empty default "General" and
  "Polls".
- Issue forms use only labels that already exist.

`GoRenku/studio/.github/ISSUE_TEMPLATE/`:

- `bug-report.yml`: name "Bug report"; description "Something in Renku
  Studio, the renku command line, the installer or an agent workflow is not
  working"; title prefix `[Bug]: `; label `bug`. Fields: a note to remove API
  keys, tokens and private project media; "What happened?" (required);
  "Steps to reproduce" (required); "What did you expect?"; "Renku version"
  with "Paste the output of `renku about`" (required); operating system
  dropdown (macOS Apple silicon, macOS Intel, Windows 10, Windows 11;
  required); agent dropdown (Codex desktop app, Codex CLI, Claude Desktop Code
  tab, Claude Code in a terminal, another agent, not agent-related); "Provider
  and model, if a generation failed"; "Error output" (rendered as text);
  required checkbox "I removed API keys, tokens and private project content".
- `feature-request.yml`: name "Feature request"; label `enhancement`; title
  prefix `[Feature]: `. Fields: "What are you trying to make or do?"
  (required); "What would help?" (required); "Anything else".
- `config.yml`: blank issues stay allowed. Contact links: "Question or help" →
  `https://github.com/GoRenku/studio/discussions/categories/help`; "Skill idea
  or model request" → `https://github.com/GoRenku/studio-skills/issues/new/choose`.

`GoRenku/studio-skills/.github/ISSUE_TEMPLATE/`:

- `skill-idea.yml`: name "Skill idea"; label `enhancement`; title prefix
  `[Skill idea]: `. Fields: "Which filmmaking task should the agent help with?"
  (required); "How do you do it today?"; "What would a good result look
  like?" (required); agent dropdown as in the bug report.
- `model-request.yml`: name "Model request"; label `enhancement`; title prefix
  `[Model request]: `. A note: "For an open-ended wish, start a discussion in
  Model requests instead." Fields: "Model name" (required); "Provider and
  exact model ID or route" (required); "Link to the provider's model page"
  (required); "What would you use it for?" (required); "Did you try adding it
  to your personal model library with the Model Researcher skill?" (Yes / No /
  I didn't know about it).
- `config.yml`: blank issues stay allowed. Contact links: "Bug in Renku
  Studio, the command line or the installer" →
  `https://github.com/GoRenku/studio/issues/new/choose`; "Question or help" →
  Studio Discussions Help; "Open-ended model wish" →
  `https://github.com/GoRenku/studio/discussions/categories/model-requests`.

If D4 is declined, Studio Skills gets its own Discussions with the same
categories, and its contact links and README point there.

### C7 Good first issue candidates

For the maintainer to file with the `good first issue` label. Each was
checked against the repositories today.

1. Studio Skills — "Add a first evaluation scenario for the Casting Director
   skill". `skills/casting-director/` has no `evals/` folder. Add one scenario
   file following `skills/movie-director/evals/project-settings-workflow-policy.md`
   (a setup paragraph and "Pass criteria"), check every command against
   `renku --help`, run `pnpm test`.
2. Studio Skills — the same for Lookbook Designer (`skills/lookbook-designer/`).
3. Studio Skills — the same for Scene Beat Designer (`skills/scene-beat-designer/`).
4. Studio Skills — the same for Production Designer (`skills/production-designer/`).
5. Studio — "Remove unused images from `docs/screenshots/`": `cast.jpg`,
   `lookbook.jpg`, `shot-plan.jpg` and `story-arc.jpg` are not referenced
   anywhere; confirm with `git grep`, delete them, keep `codex-and-renku.png`.

### C8 Studio release notes and release type

Release title stays `Renku vX.Y.Z`. Notes, for tag `vX.Y.Z` with previous
annotated tag `vP`:

```markdown
Renku Studio beta · [Install](https://gorenku.com/download/?{utm}) · Update an existing installation with `renku update`

### Features
- <subject>

### Fixes
- <subject>

### Other changes
- <subject>

**Full changelog**: https://github.com/GoRenku/studio/compare/vP...vX.Y.Z
```

Rules:

- `vP` = `git describe --abbrev=0 --match 'v[0-9]*' vX.Y.Z^` (annotated tags
  only, matching the annotated-tag rule in `release-contract.mjs`).
- Subjects = `git log --no-merges --reverse --format=%s vP..vX.Y.Z`, minus
  subjects starting `release:`.
- `feat:` → Features, `fix:` → Fixes, anything else (other prefixes or none)
  → Other changes. A scope or `!` after the type is allowed. The prefix is
  removed and the first letter capitalized; the rest is kept as written.
- Empty sections are left out. With no listed subjects the notes contain the
  first line and the changelog line only.

Release type (D1): drafts are created without `--prerelease`; finalize runs
`gh release edit vX.Y.Z --draft=false --prerelease=false --latest`.

### C9 Retiring the old npm packages

Run as the npm owner (npm asks for a one-time code when 2FA is on):

```sh
npm deprecate '@gorenku/cli@*' "Retired. Renku is now Renku Studio: install from https://gorenku.com/download/ and first run: npm uninstall -g @gorenku/cli"
npm deprecate '@gorenku/core@*' "Retired with the original Renku build tool. Renku continues as Renku Studio: https://github.com/GoRenku/studio"
npm deprecate '@gorenku/providers@*' "Retired with the original Renku build tool. Renku continues as Renku Studio: https://github.com/GoRenku/studio"
npm deprecate '@gorenku/compositions@*' "Retired with the original Renku build tool. Renku continues as Renku Studio: https://github.com/GoRenku/studio"
```

The `@gorenku/cli` message tells users to remove the old global package,
because its `renku` command can otherwise shadow the new one in shells that
have not reloaded `PATH`. Messages are plain terminal text without tracking
parameters. Undo, if ever needed: the same command with `""` as the message.

### C10 Retiring `keremk/renku`

README edit in the local checkout:

- Insert at the very top, before the existing centred header:

  ```markdown
  > [!IMPORTANT]
  > **This project is retired.** The original Renku build tool and its npm
  > packages (`@gorenku/cli`, `@gorenku/core`, `@gorenku/providers`,
  > `@gorenku/compositions`) are no longer maintained. Renku continues as
  > **[Renku Studio](https://github.com/GoRenku/studio)**, an open-source,
  > local-first film studio you direct through Codex or Claude Code.
  > [Install it from gorenku.com](https://gorenku.com/download/?{utm}).
  >
  > If you installed the old CLI with npm, remove it first so its `renku`
  > command does not hide the new one: `npm uninstall -g @gorenku/cli`.
  ```

- Remove the links to retired documentation: the "Documentation" and
  "Quick Start" items in the header line, and the "Quick Start" and
  "Documentation" sections, replaced by one sentence: "The original
  documentation site has been retired."
- Replace the "Contributing" section text with "This repository is archived.
  To contribute, see [Renku Studio](https://github.com/GoRenku/studio)."
- Everything else, including the licence section, stays.

Repository settings: description "Retired: the original Renku build tool.
Renku continues as Renku Studio."; homepage `https://github.com/GoRenku/studio`;
then archive.

## Implementation Slices

Each slice is local edits only. Commits are made only when the maintainer asks;
pushes are maintainer tasks.

### Slice 1: Release notes and "Latest" (Studio)

- Add `scripts/release/release-notes.mjs` per C8.
- Change `publish-github-release.mjs`: draft creation uses
  `githubDraftReleaseArguments` with a temporary notes file; resume accepts
  an existing draft (`RELEASE082` message becomes "is not a draft");
  finalize uses `githubFinalizeReleaseArguments`.
- Rename the workflow step; delete `.github/release.yml`.
- Add tests (see Tests And Guardrails).
- Add the ADR and the notice on ADR 0078; update the release operations
  document (see Documentation).
- If D1 is declined: keep `--prerelease` in both argument lists, skip the ADR,
  still update the operations document for notes.
- If D5 chooses checked-in files: `prepare.mjs` writes
  `release-notes/vX.Y.Z.md` (composed for `HEAD` against the latest annotated
  tag) and adds it to the release commit; draft creation sends that file's
  body instead of composing at publish time. The tests move with it.

### Slice 2: README images (Studio)

- Create the six files in C1 with `ffmpeg` and `magick`; record the exact
  commands in `docs/operations/github-presentation.md`.
- Check dimensions and sizes; open each image and confirm content.
- For D2, write `tmp/readme-media/renku-launch-github.mp4` and confirm it is
  under 10 MB and plays.

### Slice 3: Studio README

- Rewrite the opening per C2 and reorder per C3 with narrow edits; moved
  sections keep their wording and formatting.
- Fill `{utm}` from the table in Contracts.
- Check that `CONTRIBUTING.md` anchors still resolve.

### Slice 4: Studio Skills README

- Rewrite the opening and add sections per C4; move the paragraph into
  `docs/plugin-installation-and-review-routing.md` with link paths fixed.
- Check the `bundled-media-models.md` anchor still resolves.

### Slice 5: Community files

- Add `CODE_OF_CONDUCT.md` to both repositories (C6, D3).
- Add the issue forms and `config.yml` files (C6).
- Validate each YAML file parses and uses only existing labels.

### Slice 6: Legacy repository README

- Edit `/Users/keremk/Projects/aitinkerbox/renku/README.md` per C10. No other
  file in that checkout changes.

### Slice 7: Operations document

- Write `docs/operations/github-presentation.md` (see Documentation).

## What Only The Maintainer Can Do

In dependency order. Commands assume `gh` is signed in as an owner of both
the organization and `keremk`.

- **M1 Decide** D1–D5 (D5 together with 0233's D1) and confirm 0234's
  `{utm}` table is accepted.
- **M2 Discussions** (before pushing, so the issue-form links work on
  arrival): `gh repo edit GoRenku/studio --enable-discussions`, then on the
  Discussions page edit the categories as in C6 (web only).
- **M3 Approve the commits and push** `studio` and `studio-skills`
  (Slices 1–5 and 7).
- **M4 Repository details:**

  ```sh
  gh repo edit GoRenku/studio \
    --description "Open-source, local-first film studio you direct through Codex or Claude Code. Screenplay, cast, locations, shot plans, Blender previs and AI-generated footage in one project on your computer." \
    --homepage https://gorenku.com \
    --add-topic filmmaking,ai-filmmaking,film-production,pre-production,screenwriting,storyboard,previs,blender,generative-ai,ai-video,video-generation,image-generation,codex,claude-code,ai-agents,local-first,sqlite,typescript
  gh repo edit GoRenku/studio-skills \
    --description "A film crew of 20 skills for Codex, Claude Code and other coding agents: screenwriting, casting, lookbooks, shot planning, Blender previs and media generation for Renku Studio." \
    --homepage https://gorenku.com \
    --add-topic agent-skills,claude-code,claude-code-plugin,codex,codex-plugin,ai-agents,filmmaking,ai-filmmaking,screenwriting,storyboard,previs,blender,generative-ai,ai-video,prompt-engineering,fal-ai,elevenlabs,replicate
  ```

- **M5 Link-preview images (web only):** each repository → Settings →
  General → Social preview → Edit → Upload an image, using the C5 files.
- **M6 Launch film (D2, web only):** in `GoRenku/studio` on github.com, open a
  web editor that accepts attachments (the `README.md` editor or a new-issue
  comment box), drag in `tmp/readme-media/renku-launch-github.mp4`, copy the
  `https://github.com/user-attachments/assets/…` address it inserts, and leave
  without committing or submitting. Send the address to Claude, who replaces
  the "Watch the 2-minute launch film" line with it; then push.
- **M7 Make v0.1.34 the "Latest" release (D1),** after Slice 1 is pushed, from
  the Studio repository root:

  ```sh
  node --input-type=module -e "import { composeReleaseNotes } from './scripts/release/release-notes.mjs'; process.stdout.write(composeReleaseNotes({ tag: 'v0.1.34' }))" > tmp/v0.1.34-notes.md
  gh release edit v0.1.34 --repo GoRenku/studio --notes-file tmp/v0.1.34-notes.md --prerelease=false --latest
  ```

  Without D1, leave out `--prerelease=false --latest`.
- **M8 Delete the stale drafts (destructive; confirm first):**

  ```sh
  for t in v0.1.1 v0.1.9 v0.1.12 v0.1.13 v0.1.21; do gh release delete "$t" --repo GoRenku/studio --yes; done
  ```

  No `--cleanup-tag`: the tags stay.
- **M9 File the C7 issues,** one command per item, for example:

  ```sh
  gh issue create -R GoRenku/studio-skills --label "good first issue" \
    --title "Add a first evaluation scenario for the Casting Director skill" \
    --body "skills/casting-director/ has no evals/ folder. Add one scenario file following skills/movie-director/evals/project-settings-workflow-policy.md (a setup paragraph and Pass criteria), check every command against renku --help, and run pnpm test."
  ```

- **M10 npm:** `npm login`, then the four C9 commands; check with
  `npm view @gorenku/cli deprecated`.
- **M11 `keremk/renku`:** push the Slice 6 commit, then

  ```sh
  gh repo edit keremk/renku --description "Retired: the original Renku build tool. Renku continues as Renku Studio." --homepage https://github.com/GoRenku/studio
  gh repo archive keremk/renku --yes
  ```

- **M12 Organization:** Organization Settings → Profile: display name
  `Renku`, the C5 description and URL `https://gorenku.com` (or, after
  `gh auth refresh -s admin:org`:
  `gh api -X PATCH orgs/GoRenku -f name=Renku -f description="Open-source, local-first film studio you direct through Codex or Claude Code." -f blog=https://gorenku.com`).
  Create the public repository and add the profile text:

  ```sh
  gh repo create GoRenku/.github --public --description "GoRenku organization profile" --clone
  cd .github && mkdir profile   # then save the C5 text as profile/README.md
  git add profile/README.md && git commit -m "Add organization profile" && git push -u origin HEAD
  ```
- **Future releases:** run `pnpm release` exactly as today.

## Tests And Guardrails

`scripts/release/release-notes.test.mjs`, using a temporary Git repository
like the existing tag test in `release-contract.test.mjs`:

- groups `feat:`, `fix(scope):`, `feat!:`, `chore:` and an unprefixed subject
  into the right sections, in commit order, with prefixes removed and the
  first letter capitalized;
- leaves out the `release:` commit and merge commits;
- finds the previous annotated tag and ignores a lightweight tag in between;
- leaves out empty sections and writes the install line and the exact
  compare link;
- fails with `RELEASE055` when there is no earlier annotated `v*` tag.

Additions to `release-contract.test.mjs`:

- `githubDraftReleaseArguments` contains `--draft`, `--verify-tag`,
  `--notes-file <path>` and the title, and contains neither
  `--generate-notes` nor `--prerelease`;
- `githubFinalizeReleaseArguments` is exactly
  `release edit <tag> --draft=false --prerelease=false --latest`.

The existing tests for staging, resume and local publication stay unchanged
and must pass.

No architecture test is added: the change stays inside one tooling folder and
adds no import boundary.

Content checks (not automated tests): every relative link and image in the
changed Markdown files resolves; the moved Studio README sections and the
moved Studio Skills paragraph match their originals word for word; each
issue-form YAML parses.

## Documentation

- **New ADR** `docs/decisions/0123-publish-studio-releases-as-latest-with-commit-notes.md`
  (0119–0122 are reserved by plans 0230, 0237, 0234 and 0236):
  Studio GitHub Releases are published as full releases marked Latest after R2
  verification; the download channel and product stay beta; notes are built
  from commit subjects as in C8; GitHub-generated notes and
  `.github/release.yml` are removed.
- **ADR 0078:** add one notice line at the top linking the new ADR and saying
  it narrows the release type and notes; the draft-first and R2-before-public
  order is unchanged. The body is not edited.
- **`docs/operations/distribution-and-release.md`:** publish steps 8 and 11
  and the Actions paragraph say "draft GitHub release" / "publishes the GitHub
  release and marks it Latest"; add a short "Release notes" subsection: where
  notes come from, that commit subjects become public notes, and how to
  correct a published page (`gh release edit vX.Y.Z --notes-file <file>`).
- **New `docs/operations/github-presentation.md`:** README image files, their
  sources and exact regeneration commands; link-preview files and the upload
  path; the C5 settings values (noting that "20 skills" must change if the
  skill count changes); Discussions categories; where issue forms and the Code
  of Conduct live; a pointer to the release notes subsection.
- **Studio Skills:** the new `docs/plugin-installation-and-review-routing.md`
  (C4).
- `CONTRIBUTING.md` in both repositories: unchanged.

## Final Verification

Studio repository:

```sh
pnpm test:release
pnpm check
node --input-type=module -e "import { composeReleaseNotes } from './scripts/release/release-notes.mjs'; for (const tag of ['v0.1.33', 'v0.1.34']) process.stdout.write(composeReleaseNotes({ tag }) + '\n---\n')"
for f in docs/readme-media/*; do magick identify -format '%f %wx%h %b\n' "$f[0]"; done
git diff --stat
```

- Read the composed v0.1.33 and v0.1.34 notes against `git log`.
- Open each README image and confirm subject and the absence of burned-in words.
- Link check for changed Markdown (run in each repository with its changed files):

  ```sh
  node -e 'const fs=require("fs"),p=require("path");for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,"utf8");for(const m of t.matchAll(/\]\(([^)\s]+)\)|src="([^"]+)"/g)){const u=(m[1]||m[2]).split("#")[0];if(u&&!/^(https?:|mailto:)/.test(u)&&!fs.existsSync(p.resolve(p.dirname(f),u)))console.log("missing",f,u)}}' README.md CONTRIBUTING.md docs/operations/github-presentation.md
  ```

- Render check (does not change anything on GitHub):
  `gh api -X POST markdown -f mode=gfm -f context=GoRenku/studio -f text="$(cat README.md)"`
  and confirm the hero image, the three `<img>` tags and the badges survive.

Studio Skills repository: `pnpm test`, the link check on `README.md` and
`docs/plugin-installation-and-review-routing.md`, the render check, and
`git diff --stat`.

Legacy checkout: `git diff` shows only the C10 README edits.

After the maintainer pushes (M3): open both repository pages in the browser at
desktop width; take two screenshots a second apart to confirm the hero clip
animates; confirm the stills sit in one row, badges show real values, the
issue chooser lists the forms and contact links, and the Code of Conduct
appears in the sidebar. After M5, check a link preview (for example with a
link-preview inspector or a private chat). After M6, open the README while
signed out and confirm the launch film plays with sound. After M7, confirm
`gh api repos/GoRenku/studio/releases/latest --jq .tag_name` returns `v0.1.34`.

Architecture-shape review: `git diff --stat`; read the full
`publish-github-release.mjs` diff and the new `release-notes.mjs`; confirm no
change to `ship.mjs`, `prepare.mjs`, `publish.mjs` or `package.json`; confirm
no formatting churn in moved README sections.

## Completion Checklist

### Review Area

- [ ] D1, D2, D3, D4 and D5 decided by the maintainer (D5 together with 0233's D1).
- [ ] `{utm}` values still match 0234's accepted table for all five link locations.
- [ ] Changes match the Architecture Shape Gate; only release tooling code changed; no `index.ts` or package code touched.
- [ ] No sibling-plan scope touched (website, analytics, app, Latent Matinee).

### Release Tooling

- [ ] `scripts/release/release-notes.mjs` composes notes exactly as C8.
- [ ] Draft creation passes `--notes-file`; no `--generate-notes`.
- [ ] Draft creation and finalize use the D1 release type.
- [ ] Resume accepts an existing draft; `RELEASE082` wording updated.
- [ ] Workflow step renamed; `.github/release.yml` deleted.
- [ ] D5 outcome implemented exactly as decided (GitHub only, or checked-in files).
- [ ] `ship.mjs`, `prepare.mjs`, `publish.mjs`, `publish-r2.mjs` and `package.json` unchanged.

### README Images

- [ ] Six files in `docs/readme-media/` match C1 dimensions and size limits.
- [ ] Each image checked by eye: right subject, no burned-in words.
- [ ] Regeneration commands recorded in `docs/operations/github-presentation.md`.
- [ ] D2: `tmp/readme-media/renku-launch-github.mp4` under 10 MB and plays.

### Studio README

- [ ] Opening matches C2 (pitch, badges, description, hero, install).
- [ ] Sections follow C3 order; star ask appears once.
- [ ] Moved sections verbatim under "For contributors"; licence section last.
- [ ] `CONTRIBUTING.md` anchors resolve.
- [ ] All gorenku.com links carry `?{utm}`.

### Studio Skills README

- [ ] Opening, skill map, conversation and install paths match C4.
- [ ] Paragraph moved verbatim to `docs/plugin-installation-and-review-routing.md` with fixed relative links.
- [ ] `#add-a-model-for-your-own-use` anchor still resolves.
- [ ] skills.sh link present.

### Community Files

- [ ] `CODE_OF_CONDUCT.md` in both repositories, attribution kept, no `[NOTE` left.
- [ ] Studio: `bug-report.yml`, `feature-request.yml`, `config.yml` per C6.
- [ ] Studio Skills: `skill-idea.yml`, `model-request.yml`, `config.yml` per C6.
- [ ] Every form uses an existing label and parses.

### Legacy Repository

- [ ] `keremk/renku` README has the notice, no retired-docs links, updated Contributing text.
- [ ] No other file in that checkout changed.

### Documentation

- [ ] ADR 0123 written.
- [ ] Notice added at the top of ADR 0078; body untouched.
- [ ] `distribution-and-release.md` steps 8, 11, Actions paragraph and "Release notes" subsection updated.
- [ ] `docs/operations/github-presentation.md` written.

### Tests And Verification

- [ ] `release-notes.test.mjs` covers grouping, exclusions, previous tag, empty sections, failure.
- [ ] Argument-list tests for draft and finalize added.
- [ ] `pnpm test:release` and `pnpm check` pass in Studio; `pnpm test` passes in Studio Skills.
- [ ] v0.1.33 and v0.1.34 notes composed and read.
- [ ] Link checks and render checks pass for every changed Markdown file.
- [ ] `git diff --stat` reviewed in all three repositories; no formatting churn.

### Maintainer Tasks

- [ ] M2 Discussions enabled and categories edited (before the push).
- [ ] M3 commits approved and pushed.
- [ ] M4 descriptions, homepages and topics set.
- [ ] M5 link-preview images uploaded.
- [ ] M6 launch film uploaded into the README (D2).
- [ ] M7 v0.1.34 notes and Latest set; `/releases/latest` returns v0.1.34.
- [ ] M8 five drafts deleted after confirmation; tags kept.
- [ ] M9 good-first issues filed.
- [ ] M10 four npm packages deprecated and checked.
- [ ] M11 `keremk/renku` pushed, described and archived.
- [ ] M12 organization profile, description and `.github` repository done.

### Final Verification

- [ ] Both repository pages checked at desktop width after push; hero animates.
- [ ] D2: launch film plays in the README while signed out.
- [ ] Link preview checked for both repositories.
- [ ] Only then mark this plan implemented.
