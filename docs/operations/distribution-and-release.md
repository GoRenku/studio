# Renku Distribution And Release

Date: 2026-08-10

Status: current

## Product Boundaries

Renku is installed as two independently released products:

- `GoRenku/studio` publishes the `renku` CLI, browser Studio, local server,
  private Node runtime, migrations, and native archives.
- `GoRenku/studio-skills` publishes the existing Renku plugin and skills
  through its own repository marketplace.

The repositories do not share versions, tags, release commits, or publication
commands. Studio artifacts never contain plugin, marketplace, or skills paths.

The Studio runtime bundles CLI, Engines, and provider runtime dependencies. The
separate Skills release delivers Media Producer routing plus provider-native
request and prompting instructions. Provider Skills invoke the installed
`renku generation` commands; they do not ship provider clients, SDKs, or extra
executables on `PATH`.

Pika ships as another provider module inside the existing Engines/runtime
bundle. It adds no SDK package, standalone executable, installer step, or PATH
entry; the separate Skills release supplies only its request-authoring guides.

## Fast Track (TL;DR)

Run these commands from a clean local `main` checkout. This patch-release path
loads Cloudflare credentials from the repository-root `.env` file when present.

```bash
gh auth status
pnpm release -- --dry-run
pnpm release
```

`pnpm release` creates and publishes the next patch release. For a minor or
major release, replace both `release` commands with the matching pair:

```bash
pnpm release:minor -- --dry-run
pnpm release:minor
```

or:

```bash
pnpm release:major -- --dry-run
pnpm release:major
```

If publication stops after the release has been prepared, resume with:

```bash
pnpm release:publish
```

The command uses the current checked-in Studio version to resolve the expected
`vX.Y.Z` tag and still verifies that the annotated tag exists and points at
`HEAD`. Pass `-- --tag vX.Y.Z` only when intentionally publishing a specific
prepared tag.

## User Installation

### 1. Install Renku

Run the platform installer yourself in Terminal or native Windows PowerShell.
Before downloading the runtime, the installer asks a yes/no question for the
dated Terms of Use at `https://gorenku.com/terms/2026-09-23/`. It saves the
accepted Terms version in `TERMS_ACCEPTANCE.txt` under the installation root.
Later installer runs, including updates, skip the question while that version
matches. Keep the dated page unchanged after publication; future terms need a
new dated page and an updated installer prompt and version. Publish the dated
page before releasing an installer that points to it. Declining or running
without an interactive terminal before acceptance stops before installation
changes are made. The Terms do not change the AGPLv3 license for Studio or the
MIT license for Skills.
The bundled Node runtime requires macOS 13.5 or newer. Windows requires x64
Windows 10 version 1803 or newer (including Windows 11), with its built-in
`tar.exe`. Unsupported systems are rejected before the runtime download.
Renku includes its own runtime; it does not require a separate Node.js install.

macOS:

```bash
(set -o pipefail; curl -fsSL https://downloads.gorenku.com/install.sh | sh) && export PATH="$HOME/.local/bin:$PATH"
```

Windows PowerShell, without WSL:

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
```

### 2. Choose agents in the installer

The platform installer uses Renku's bundled Node and skills installer to run setup. No
system Node, npm, npx, or Codex CLI installation is required. Release verification
checks that the bundled skills entrypoint exists.

Setup checks that Git runs. Windows reuses working Git from PATH or downloads
official MinGit 2.55.0.5 into the install root's `tools/` directory, verifying its
pinned SHA-256 before extraction. Subsequent runs reuse that private copy.
Update the Git version and checksum together from the official release.
Bundled Node and private Git are added only to the setup process PATH.

On macOS, missing Git opens Apple's Command Line Tools installer. Complete the
dialog and press Return in Terminal; setup verifies Git again before continuing.
The installer does not install Homebrew or replace system Node.

The installer runs the bundled `skills` executable with
`add GoRenku/studio-skills --global --skill '*' --copy`.
No npm package is downloaded on the user's machine. Agent selection and skills
confirmation remain interactive. Select Codex or other supported agents; Claude
Code remains a choice when native Claude Desktop is absent. Copy mode avoids
symlink privileges on Windows. Both platforms invoke
the bundled JavaScript entrypoint directly with the private Node runtime.

Run setup in a visible local terminal. macOS connects prompts to `/dev/tty`
because the bootstrap script arrives through a pipe. Setup reports `INSTALL006`
for a missing bundled skills installer, `INSTALL007` for a missing interactive terminal,
`INSTALL008` for incomplete Git setup, and `INSTALL009` for a failed skills
command. Renku remains installed when skills setup fails; resolve the reported
problem and rerun the installer. Checksum mismatches use `INSTALL003`.
The bundled skills tool can exit successfully when the user declines its final
confirmation. Installer completion therefore does not claim that skills were
installed: it explains cancellation and only asks users who confirmed to restart
their agents. The runtime launch command is printed before skills setup so a
skills or Git failure does not hide how to start the installed application.

The focused bundled `distribution/install-codex-plugin.mjs` also installs the
Codex plugin using the user's existing CLI profile and the public commands:

```text
codex plugin marketplace add GoRenku/studio-skills --ref beta --json
codex plugin marketplace upgrade renku --json
codex plugin add renku@renku --json
codex plugin list --json
```

It checks installed/enabled state before Core records `codex-plugin.json` beside
the platform config. CLI absence or unsupported plugin commands records false
and skips this step. Conflicting sources, disabled plugins, network errors and
failed verification are reported with `INSTALL011`; general skills setup still
runs. Core state failures use `CONFIG017`. Codex CLI is never installed by Renku.
Both `renku update` and `renku update skills` repeat the plugin step.

Before shipping the runtime, publish the sister plugin with matching strict
SemVer manifest versions, its `codex.mcp.json` declaration and the beta branch.
Run native Mac/Windows Desktop acceptance with and without Codex CLI, reopen
Desktop, exercise panel/Visualize reviews and update an installed plugin.

The command reads the skills repository's default branch. Re-run the installer
to refresh the runtime and skills. General skills installation remains independent
of the Codex plugin step; runtime and skills releases remain separate.

Reference: [skills installer documentation](https://github.com/vercel-labs/skills).

### Claude Desktop plugin setup

Native Claude Desktop detection selects user-scope `renku@renku` plugin setup
instead of loose Claude skills. `distribution/claude-desktop/discovery.mjs`
checks the macOS application bundle identity or Windows current-user
`AnthropicClaude` uninstall registration and its launcher. It selects the newest
compatible cached Code CLI by numeric version, checking command support first.
No standalone Claude executable on PATH is required. These cache layouts are
observed application details, not a documented stable discovery API:

- Mac: `~/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude`.
- Windows: `%APPDATA%\Claude\claude-code\<version>\<hash>\claude.exe`.

`checkout.mjs` clones `https://github.com/GoRenku/studio-skills.git` into
`<install-root>/plugins/claude/renku`. On subsequent setup/update runs it checks
the origin and clean working tree, fetches the remote default branch, and
fast-forwards without overwriting local work. The checkout survives runtime
version changes. Both platforms use this same flow.

`plugin.mjs` registers that directory using public marketplace add/update and
plugin install/update commands, then verifies enabled user scope and the
checked-out plugin version. Plugin releases must bump the manifest version;
`renku update` and `renku update skills` refresh the local marketplace source.
It inherits `CLAUDE_CONFIG_DIR`, preserves disabled plugins and conflicting
marketplace sources, and reports `INSTALL013` when setup cannot complete.
Opening Desktop's Code tab or updating Desktop may be necessary to initialize
a compatible runtime. Start a new local Code session after successful setup.

Both installation and update paths exclude `claude-code` from the normal picker
whenever Desktop is detected, including plugin failure. Independent harness
setup and Codex reconciliation still run before Claude failure is returned.
The pinned `skills@1.5.26` dependency has a maintained pnpm patch providing
`--exclude-agent`; this is a Renku extension, not an upstream option. Release
verification checks the deployed picker supports it. Other choices remain
interactive. Existing loose files are retained, so existing users may see both
loose and plugin commands. WSL and Cowork are outside this installation scope.

Run `RENKU_TEST_CLAUDE_DESKTOP=1 node --test scripts/release/claude-desktop-native.test.mjs`
on native hosts for temporary-profile public-repository installation, repeat
update, and a fixture version advancement verified through fresh Code command
discovery. The test does not change the real
Claude profile, send a model request, or prove Desktop UI behavior.
See [ADR 0109](../decisions/0109-install-claude-desktop-plugin.md) and
[ADR 0110](../decisions/0110-manage-claude-marketplace-checkout.md).

Renku owns the Git checkout to avoid Claude's Windows Git-marketplace
finalization `EPERM` error, reproduced with cached CLI 2.1.289 and 2.1.288.
The installer does not repair Claude's cache or change security settings.
See plan 0224 for native verification evidence and Desktop UI acceptance limits.

### 3. Start Studio

The macOS install command refreshes PATH in the invoking terminal after setup;
the Windows installer updates the current PowerShell PATH directly. Both
installers print a quoted full-path launch command that also works immediately,
including for custom installation folders. Restart agent apps to load the skills.
Verify the runtime with `renku about`, then run:

```bash
renku studio start
```

The installer does not create user configuration, choose a Project Library, or
save provider credentials. Complete setup in the browser. Studio recommends a
whitespace-free `Renku` directory for the platform. To use a custom Project
Library, run `renku init <storage-root>` before completing that setup. Enter
provider keys directly in Studio, never in an agent conversation.

Keep the terminal session running Studio open; it can be minimized. Stop with
`renku studio stop` or Ctrl+C when finished, and run `renku studio start` again
for later sessions.
Closing a browser tab does not stop Studio. Start a new agent conversation to
load the installed skills; they invoke the separately installed `renku` command
through the agent's local shell capability.

Website publishing remains separate from runtime and skills releases.

## Studio Release

Studio's root `package.json` is the canonical product version. The diagnostics,
engines, core, Studio, and CLI runtime manifests must match it. The website is
outside this product release.

Initial Studio releases run completely from the maintainer's machine. The
GitHub Actions workflow remains available for a future full-platform release,
but the default release commands do not dispatch it.

The local machine must have:

- `fnm` with Node 24;
- pnpm 11, `gh` authenticated for the Studio repository, and `tar`;
- `CLOUDFLARE_ACCOUNT_ID` and an R2 API token's S3 credentials for the existing
  R2 bucket;
  and
- a native host matching one accepted release target. The current maintainer
  machine executes the full installed-product verification for `darwin-arm64`
  and cross-packages the other declared targets.

The local release pnpm commands load the repository-root `.env` file when it is
present. Keep that file gitignored and add:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
```

The release publisher uses the R2 S3-compatible API. Create the S3 credentials
from Cloudflare Dashboard → R2 → Manage R2 API Tokens, grant Object Read &
Write access to `renku-downloads`, and copy both values when the token is
created. The publisher uses multipart upload for large archives, so the R2
access key and secret are required in addition to the account ID.

The repository configures pnpm's dependency-status check to warn instead of
automatically running `pnpm install` before a script. This prevents a stale
workspace install from deleting development modules during a release command;
it does not modify or repair the workspace. Run `pnpm install` deliberately
only when you want to refresh dependencies.

Dependency installation is also protected by the repository's supply-chain
policy: package versions must be at least 10,080 minutes (7 days) old,
versions that do not satisfy that age fail resolution, missing registry publish
times fail resolution, and lockfiles are rechecked rather than trusted
blindly. The product assembler applies this policy while creating the bundled
dependency tree on all three release targets. The third-party `skills` tool is
pinned to `1.5.26` in the CLI production dependencies; its transitive dependencies
are locked and pass the same policy during release assembly. End-user install
and update commands invoke that packaged copy directly, without npm resolution.
The `GoRenku/studio-skills` repository supplies skill files, not npm dependencies.
Skills updates still fetch those files from the repository's default branch.
This closes the unguarded npm-download path; the dependency policy is not a
guarantee that every accepted package or skill is free of malicious content.

Explicitly exported environment variables and CI-provided secrets remain
available when `.env` is absent.

From a clean local `main` that exactly matches `origin/main`:

```bash
pnpm release:preflight
pnpm release
```

`pnpm release` performs a patch release. Use `pnpm release:minor` or
`pnpm release:major` for those bumps. Prepare synchronizes runtime versions,
runs `pnpm check`, creates `release: vX.Y.Z`, and creates an annotated local
tag. Publish then:

1. builds the shared application once with Node 24;
2. downloads and checksum-verifies the official Node 24 runtime for
   `darwin-arm64`, `darwin-x64`, and `win32-x64`;
3. assembles one self-contained product per target under
   `release/local/vX.Y.Z`;
4. executes the packaged CLI and database migration checks, and imports the
   packaged Studio server module for the native host target, while structurally
   verifying the bundled Node runtime,
   better-sqlite3 prebuild, esbuild package, release metadata, and content
   boundary for cross-packaged targets;
5. records `runtime` or `structural` verification evidence for every artifact;
6. packages all three target products;
7. pushes `main` and the annotated tag;
8. creates or resumes a draft GitHub prerelease and uploads all three declared
   targets;
9. downloads the GitHub assets into a fresh temporary directory and verifies
   their complete manifest, names, hashes, and bytes;
10. promotes those exact downloaded bytes to immutable and beta R2 keys; and
11. publishes the GitHub prerelease only after R2 verification succeeds.

Product assembly uses pnpm's modern deploy mode with the workspace injection
setting enabled only for that command. Windows additionally uses
`node-linker=hoisted` to create real dependency directories without requiring
Windows symlink permissions. The installer uses the system `tar.exe` for ZIP
extraction, avoiding PowerShell Archive's long-path limitations and progress
overlay. ZIP packaging rejects
directory symlinks and broken file links with `RELEASE011`, and materializes
valid file links (such as `.bin` entries) into ordinary files. Merely
dereferencing an isolated pnpm tree is insufficient because transitive package
resolution depends on that tree's real paths. macOS retains the isolated layout
in its tar archive. Assembly installs dependencies into
the release staging directory and does not remove or reinstall the development
workspace's `node_modules` directories.

Installer regression coverage and remaining native validation are recorded in
[the installer review](installer-review.md).

Local releases retain the alpha verification policy: the host target receives
CLI/database and Studio module checks; other targets receive structural checks.
Reports preserve those levels and explicitly record untested HTTP startup.
Native verification on the maintainer's other Windows and Linux machines is
follow-up work for a separate session, not a prerequisite for local publication.
This does not add Linux as a release target.

The optional GitHub Actions workflow runs the full native upgrade matrix before
its publication job. Its upgrade reports must include every fixture/process
check, actual HTTP serving, and matching archive checksums. If an upgrade report
is supplied to either publication path, incomplete or stale evidence is rejected
with `RELEASE077`; ordinary local smoke reports do not claim upgrade coverage.

`pnpm release:build:local -- --tag vX.Y.Z` assembles all current targets locally.
The fuller native archive verifier is also available explicitly:

```bash
node scripts/release/verify-release-upgrades.mjs --archive <candidate-archive> --report <verification.json>
```

The verifier downloads source archives declared in
`scripts/release/upgrades/fixtures.json`, checks their immutable digests and
compares shipped SQL/journals/snapshots. Required source releases are v0.1.3,
v0.1.4, v0.1.5, v0.1.24 and v0.1.25. Source runtimes create synthetic populated
Projects. Native fixture results, before/after observations, database evidence
and independently readable backups are retained under `upgrade-evidence`.
Urban Basilica data, screenplay and media are never release or CI inputs.

If prepare succeeded but publication needs to be resumed:

```bash
pnpm release:publish
```

The recovery command revalidates tag, version, commit, and `origin/main`
ancestry, then rebuilds locally using the release-local private Node runtime
and resumes the draft release. When the draft already has the complete declared
asset set, the command downloads and verifies those existing assets and uses
those exact bytes for R2 recovery instead of replacing them with a rebuild. An
incomplete draft is repaired before R2 publication; a complete draft whose
bytes fail verification stops with an error. The command never bumps,
recommits, or moves the tag.

To exercise the local build and publication staging without changing refs or
remote release state:

```bash
pnpm release:publish -- --dry-run
```

Dry-run builds locally and validates GitHub/R2 staging without pushing refs,
uploading or promoting releases. Products remain under `release/local/vX.Y.Z`.
Local publication requires network access and `gh` authentication, but no GitHub
Actions runners. Neither retry nor dry-run bumps a version or moves the tag.

R2 publication logs object probes, uploads, completed multipart parts, and
verification downloads separately. Public probes have a 60-second deadline.
Verification downloads time out after 10 minutes per attempt or after 30 seconds
below 1 KiB/s, with up to three retries started within a 10-minute retry window.
A stalled verification fails with `RELEASE045` and leaves GitHub as a draft;
resume publication after resolving the connection problem. Existing immutable
objects are reused only after their downloaded bytes pass checksum verification.

## Optional GitHub Actions Release

The retained `.github/workflows/release.yml` builds one self-contained Node 24
artifact natively for each of `darwin-arm64`, `darwin-x64`, and `win32-x64`.

This is an optional future release path; `release:publish` does not invoke it.
Explicit dispatch waits for completion and supports immutable-tag retry:

```bash
pnpm release:dispatch -- --tag vX.Y.Z
```

Use one invocation to drive a release; another invocation finds the same
commit/tag run and resumes it.
Do not run local publication and Actions dispatch for the same tag.
The workflow creates or resumes a draft GitHub prerelease, uploads uniquely
named archives and checksums for all three targets, verifies the complete asset
set, and downloads the release assets again. R2 promotion consumes only that
fresh GitHub Release download. It publishes immutable version keys before beta
aliases, the beta manifest, and the two root installers. An immutable R2 key is
reused only when its public bytes have the same SHA-256 as the released asset.

Both installers read the beta `release.json` once, select their target artifact,
and download its immutable `versionKey`. The archive is verified against the
SHA-256 in that same manifest. Installers must not pair a mutable beta archive
alias with a separately downloaded checksum: CDN caches or an in-progress
promotion can serve those two objects from different releases. A cached manifest
may select an older release, but its versioned archive and checksum stay paired.

Before downloading an archive, both installers check the selected version's
installation folder, its release version and target, and whether the bundled
CLI and skills installer run successfully. A healthy matching runtime is reused;
the installer proceeds to interactive skills setup without downloading or
extracting the runtime again. This also applies after declining or cancelling
skills setup, and to full updates when the runtime is already current. Missing
or damaged installations are downloaded and validated before activation. An
incomplete runtime executing its own update must instead be repaired by rerunning
the installer from a terminal, so Windows does not replace its running Node binary.

## Studio Skills Release

Studio Skills uses the version in `.codex-plugin/plugin.json`; the version in
`.claude-plugin/plugin.json` must match. Its operator-only `package.json` has no
version and adds no runtime dependency.

From a clean local `main` that exactly matches `origin/main`:

```bash
pnpm release
```

Patch is the default; `pnpm release:minor` and `pnpm release:major` are also
available. Prepare changes only the two manifest version fields, runs the
focused release tests, commits `release: vX.Y.Z`, and creates an annotated tag.
Publish pushes `main` and the tag, creates or reuses the tag's generated-notes
GitHub Release, verifies that release exists, and then fast-forwards remote
`beta` to the released commit without checking the branch out locally.

Resume publication with:

```bash
pnpm release:publish
```

The release tooling does not change the marketplace catalogs, plugin manifest
shape, hooks, skills, references, prompts, examples, or evals.

## Current Codex Evidence

Implementation was checked on 2026-08-10 against:

- [OpenAI Plugins overview](https://learn.chatgpt.com/docs/plugins), fetched
  that day;
- [OpenAI plugin packaging and marketplace documentation](https://developers.openai.com/plugins/build/plugins),
  fetched that day;
- `codex-cli 0.145.0`; and
- ChatGPT desktop app `26.803.41515` (build `6321`).

The official pages and installed CLI agree that repository marketplaces use
`codex plugin marketplace add`, accept `--ref`, refresh through
`codex plugin marketplace upgrade`, expose `/plugins` in Codex CLI, and load
newly installed skills in a new task/session. An isolated temporary Codex
profile successfully added `GoRenku/studio-skills --ref main`, exposed the
marketplace as `renku`, and directly installed enabled version
`0.1.0+codex.20260716161911` with `codex plugin add renku@renku`. The released
`beta` ref does not exist yet, so that result verifies the current marketplace
and direct-install contract without satisfying the first-publication gate.

The installed ChatGPT desktop build was recorded, but automated inspection of
its Plugins tab was blocked by the host's Computer Use safety policy. Desktop
installation and skill invocation therefore remain manual first-publication
acceptance steps rather than claimed implementation evidence.

The first live release still requires a clean-profile acceptance run from the
published `beta` ref in both supported hosts. That gate must record the exact
installed version before and after a second released test version. Do not
publish the first beta based only on the local marketplace baseline.

## Existing Cloudflare Contract

Routine releases use the existing `renku-downloads` bucket and
`https://downloads.gorenku.com`. They do not create or reconfigure buckets,
DNS, Workers, Pages, custom domains, or dashboard settings.

Rollback is a channel operation using a previously verified release. Immutable
version objects, tags, and GitHub Release assets are never replaced.


## Package size and interface assets

Studio's browser dependencies belong in `packages/studio` devDependencies:
Vite bundles them into `dist`. Only the server's runtime imports belong in
production dependencies. Release deployment selects the target OS and CPU,
disables lifecycle scripts and the side-effects cache, and uses locked native
prebuilds. This avoids host binaries and script-triggered downloads during cross
packaging. SQLite's additional platform prebuilds are removed from the staged
product. Target verification must still find the required SQLite and esbuild
binaries; native smoke verification exercises database creation and Studio.

Shot Design illustrations are built-in camera/framing/rig examples, not movie
Project media. The interface imports `generated/images/*.webp`. Final tile
artwork is stored as lossless WebP; redundant PNG copies are removed after
pixel-equality verification. Original reference sheets remain separate source
assets. The generation helper writes WebP tiles and uploads them with the correct
MIME type. For a manually prepared tile, convert it losslessly:

```sh
cwebp -lossless -m 6 source.png -o source.webp
```

The product packages built application files and dependencies. Project databases,
Project media, and source illustration sheets are not release inputs.

## Updating and uninstalling the current beta

An installed Studio checks the beta release when its browser application opens
and every six hours while it stays open. When a newer version is available,
an update icon appears before Settings in the Project Library and Movie Studio
headers. Open it, finish any edits, and choose **Download and update**. Studio
closes, then the interactive `renku update` runs in a visible Terminal or
PowerShell window. Complete any skills prompts there. A successful update
reopens Studio through the installed launcher. If the update or restart fails,
the terminal displays the failure and the full manual `renku studio start`
command. A failed skills step can happen after the new runtime is active.
The terminal handoff preserves Studio's agent-profile directory overrides and
clears overrides that were absent, so skills setup uses the originating profiles.

To update from the CLI, stop Studio with `renku studio stop` or Ctrl+C in its
terminal, then run `renku update`.
It downloads the complete current beta, activates that version, and runs skills
setup again. `renku update skills` uses the installed runtime to update only
Renku skills, without downloading the application. Restart agent apps afterward.
The installer records absolute installation and launcher directories in
`INSTALLATION.json` inside the installed version; updates preserve those paths.
Release archives include both platform installer scripts in `distribution`.
The CLI calls the core installation service, which checks Studio state and
invokes the bundled installer. An update of the already active version skips
runtime replacement, including the running Windows `node.exe`.
The browser check downloads only the release manifest. There is no background
check while Studio is closed, incremental download, or automatic cleanup of
earlier version folders. The optional native desktop update rehearsal accepts
genuinely distinct extracted source and candidate archives, each with its
checksum receipt from `extractVerifiedArchive`:

```bash
node scripts/release/verify-studio-update.mjs --source-product <source-renku> --target-product <candidate-renku> --report <desktop-report.json>
```

It preserves genuine versions and archive bytes, isolates installation and agent
profiles, and guides the existing Terminal or PowerShell installer/browser flow.
It verifies shutdown, launcher replacement, the new process/version, a structured
backup failure followed by repaired retry, full Project preservation, HTTP media
and repeat opens. Browser visibility, two-tab behavior and closing/reopening the
browser during handoff require operator acceptance. An unrun rehearsal is
**not verified**, never an automatic pass. Verification on the maintainer's other
machines and supported OS baselines is deferred to a separate session. These
reports are not prerequisites for the current local release workflow. Newer CI
runners alone do not establish older OS support. Do not stop a real Studio to
run the isolated rehearsal without the user's authorization.

Node/npm and Windows MinGit are private installation tools. Only `renku` is added
to the public PATH; installing Renku does not make `npx` available in a fresh
terminal. People with their own Node/npm and Git can also use `npx skills update`
or rerun `npx skills add GoRenku/studio-skills --global --skill '*' --copy`.
The update command can include other installed skills; select the intended scope.

There is no built-in uninstaller yet. For default installation locations:

First uninstall the Renku plugin through Claude's plugin interface, or use
`claude plugin uninstall renku@renku --scope user` when a Claude CLI is available.
Remove its marketplace registration through Claude as well before deleting the
Renku-managed checkout. That checkout is under `plugins/claude/renku` in the
installation root; it is not inside a versioned runtime directory.

- macOS: stop Studio; remove `~/.local/share/renku` and the
  `~/.local/bin/renku` launcher. Remove the marked Renku PATH block from the shell
  profile only if that PATH entry is no longer needed by other programs.
  `~/.config/renku` holds settings and credentials; retain it unless intentionally
  resetting those too.
- Windows: stop Studio; remove `versions`, `bin`, `tools`, and `current.txt` from
  `%LOCALAPPDATA%\Renku`. Remove `%LOCALAPPDATA%\Renku\bin` from the user's PATH.
  Preserve `%LOCALAPPDATA%\Renku\Studio` to retain settings and credentials.
  Deleting the entire Renku folder also deletes those settings.
- Agent skills are separate copies. Remove only Renku skills through the skills
  tool (`npx skills remove --global` with system Node/npm and Git available), or
  remove their individual folders from the selected agents' skill directories.
  Do not delete the agents' entire shared skills folders.
- On Windows, also remove `%LOCALAPPDATA%\Renku\plugins\claude\renku` after
  unregistering the Claude marketplace. Keep other agents' directories intact.
- Preserve the Project Library, including the default `~/Movies/Renku` on macOS
  or `%USERPROFILE%\Videos\Renku` on Windows, and any custom Project locations.
  Renku's private tools can be removed with the runtime; system Node, Git, and
  Apple developer tools are shared installations and should be left alone.

Apply custom `RENKU_INSTALL_ROOT` and `RENKU_BIN_ROOT` locations when used.
