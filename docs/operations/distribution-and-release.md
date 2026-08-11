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

## User Installation

Install and verify the runtime first.

macOS:

```bash
curl -fsSL https://downloads.gorenku.com/install.sh | sh
renku about
```

Windows PowerShell, without WSL:

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
renku about
```

Add the released Studio Skills channel once:

```bash
codex plugin marketplace add GoRenku/studio-skills --ref beta
```

Install Renku in either supported Codex host:

- Codex CLI: enter `/plugins`, select the `renku` marketplace, inspect Renku,
  and install it; or run `codex plugin add renku@renku`.
- Codex in the ChatGPT desktop app: open the Plugins tab, select the personal
  `renku` marketplace, inspect Renku, and install it.

Start a new task or CLI session after installation. The plugin invokes the
separately installed `renku` executable through the host's normal local shell
capability.

Refresh the released marketplace snapshot with:

```bash
codex plugin marketplace upgrade renku
```

Inspect the installed Renku version after refreshing. If the installed copy did
not advance, reinstall it from the plugin browser, then start a new task or CLI
session. Record the observed automatic-update behavior at each publication;
do not assume it across Codex releases.

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
- `CLOUDFLARE_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the existing R2 bucket;
  and
- a native host matching one accepted release target. The current maintainer
  machine executes the full installed-product verification for `darwin-arm64`
  and cross-packages the other declared targets.

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

This is an explicit alpha policy. A cross-packaged Intel Mac or Windows
artifact is structurally verified but is not described as runtime verified.
The Windows archive should be exercised manually on the maintainer's Windows
machine before or immediately after alpha distribution. The release manifest
preserves the verification level so the distinction is visible rather than
implied.

If prepare succeeded but publication needs to be resumed:

```bash
pnpm release:publish -- --tag vX.Y.Z
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
pnpm release:publish -- --tag vX.Y.Z --dry-run
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
pnpm release:publish -- --tag vX.Y.Z
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
