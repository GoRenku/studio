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
Renku includes its own runtime; it does not require a separate Node.js install.

macOS:

```bash
curl -fsSL https://downloads.gorenku.com/install.sh | sh
```

Windows PowerShell, without WSL:

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
```

### 2. Choose agents in the installer

The platform installer uses Renku's bundled Node/npm to run skills setup. No
system Node, npm, npx, or Codex CLI installation is required. Release verification
checks that the bundled npm entrypoint exists.

Setup checks that Git runs. Windows reuses working Git from PATH or downloads
official MinGit 2.55.0.5 into the install root's `tools/` directory, verifying its
pinned SHA-256 before extraction. Subsequent runs reuse that private copy.
Update the Git version and checksum together from the official release.
Bundled Node and private Git are added only to the setup process PATH.

On macOS, missing Git opens Apple's Command Line Tools installer. Complete the
dialog and press Return in Terminal; setup verifies Git again before continuing.
The installer does not install Homebrew or replace system Node.

The installer runs the equivalent of
`npx --yes skills add GoRenku/studio-skills --global --skill '*' --copy`.
The npm download is automatic; agent selection and skills confirmation remain
interactive. Select Codex, Claude Code, or other supported agents. Copy mode
avoids symlink privileges on Windows. Windows invokes the npm JavaScript
entrypoint directly, avoiding PowerShell's `npx.ps1` execution policy.

Run setup in a visible local terminal. macOS connects prompts to `/dev/tty`
because the bootstrap script arrives through a pipe. Setup reports `INSTALL006`
for missing bundled npm, `INSTALL007` for a missing interactive terminal,
`INSTALL008` for incomplete Git setup, and `INSTALL009` for a failed skills
command. Renku remains installed when skills setup fails; resolve the reported
problem and rerun the installer. Checksum mismatches use `INSTALL003`.

The command reads the skills repository's default branch. Re-run the installer
to refresh the runtime and skills. This installs standalone skills, not a
marketplace plugin; runtime
and skills releases remain separate. Existing plugin distribution is not changed
by this onboarding workflow.

Reference: [skills installer documentation](https://github.com/vercel-labs/skills).

### 3. Start Studio

Reopen terminals and restart agent apps after installation so they discover
`renku` and the skills. Verify the runtime with `renku about`, then run:

```bash
renku studio start
```

The installer does not create user configuration, choose a Project Library, or
save provider credentials. Complete setup in the browser. Studio recommends a
whitespace-free `Renku` directory for the platform. To use a custom Project
Library, run `renku init <storage-root>` before completing that setup. Enter
provider keys directly in Studio, never in an agent conversation.

Keep the terminal session running Studio open; it can be minimized. Stop with
Ctrl+C when finished, and run `renku studio start` again for later sessions.
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
dependency tree. End-user installers do not run a package manager; they
download the exact checksum-verified archive produced by that step.

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
4. fully executes the CLI, database migration, and Studio health checks for the
   native host target, while structurally verifying the bundled Node runtime,
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

Product assembly uses pnpm's modern isolated deploy mode with the workspace
injection setting enabled only for that command. It installs dependencies into
the release staging directory and does not remove or reinstall the development
workspace's `node_modules` directories.

This is an explicit alpha policy. A cross-packaged Intel Mac or Windows
artifact is structurally verified but is not described as runtime verified.
The Windows archive should be exercised manually on the maintainer's Windows
machine before or immediately after alpha distribution. The release manifest
preserves the verification level so the distinction is visible rather than
implied.

If prepare succeeded but publication needs to be resumed:

```bash
pnpm release:publish
```

The recovery command revalidates tag, version, commit, and `origin/main`
ancestry, then safely rebuilds/reuses the release-local private Node runtime
and resumes the draft release. When the draft already has the complete declared
asset set, the command downloads and verifies those existing assets and uses
those exact bytes for R2 recovery instead of replacing them with a rebuild. An
incomplete draft is repaired before R2 publication; a complete draft whose
bytes fail verification stops with an error. The command never bumps,
recommits, or moves the tag.

To exercise the complete local build, GitHub asset staging, and R2 publication
plan without changing refs or remote release state:

```bash
pnpm release:publish -- --dry-run
```

Generated local products and archives stay under the ignored
`release/local/vX.Y.Z` directory for inspection.

## Future GitHub Actions Release

The retained `.github/workflows/release.yml` builds one self-contained Node 24
artifact natively for each of `darwin-arm64`, `darwin-x64`, and `win32-x64`.

After an operator has deliberately chosen to use Actions, prepare the release
normally and dispatch the exact tag with:

```bash
pnpm release:dispatch -- --tag vX.Y.Z
```

Do not run `pnpm release:publish` and `pnpm release:dispatch` for the same tag.
The workflow creates or resumes a draft GitHub prerelease, uploads uniquely
named archives and checksums for all three targets, verifies the complete asset
set, and downloads the release assets again. R2 promotion consumes only that
fresh GitHub Release download. It publishes immutable version keys before beta
aliases, the beta manifest, and the two root installers. An immutable R2 key is
reused only when its public bytes have the same SHA-256 as the released asset.

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
