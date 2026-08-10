# 0176 Self-Contained Beta Distribution And Agent Installation

Status: implemented; cross-platform release acceptance and publication pending
Date: 2026-08-09

## Summary

Ship Renku as one self-contained, versioned product rather than publishing the
workspace packages independently. A small bootstrap installer downloads the
correct archive, reuses a compatible system Node when available, falls back to
a private bundled Node runtime when needed, and exposes one public `renku`
command.

Renku is agent-first. Codex and Claude Code, in either their desktop apps or
terminal harnesses, run the installed CLI through their normal local shell
tools. The bundled plugin supplies the filmmaking skills; the CLI and local
browser Studio supply the runtime.

The first beta targets macOS arm64, macOS x64, and native Windows x64
PowerShell without WSL. Linux remains later work. Releases reuse the existing
Cloudflare R2 bucket and download domain without dashboard reconfiguration.

## Review Attention

- **Added public surfaces:** `renku studio start`, `install.sh`, `install.ps1`,
  the versioned release archive contract, and beta release scripts.
- **Runtime requirement:** reuse Node `^22.12.0 || ^24.0.0`; otherwise install
  an official private Node 24 runtime inside Renku's own version directory.
- **Agent contract:** Codex and Claude Code skills invoke the one installed
  `renku` command using each harness's existing shell execution capability.
- **Cloudflare constraint:** routine releases may write only to the existing
  `renku-downloads` bucket behind `downloads.gorenku.com`; they must not create
  or reconfigure Cloudflare infrastructure.
- **Deliberately unchanged:** Core owns domain behavior and database migration;
  CLI and Studio remain thin adapters; internal packages remain private.
- **Excluded:** Electron/native desktop bundles, Apple signing/notarization,
  Linux archives, FFmpeg/ffprobe prerequisites, and public sample projects.
- **Destructive effects:** installation replaces only the same version inside
  Renku's versioned install root and updates the stable launcher after archive
  verification. Release publication is not part of implementation acceptance.

## Requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| R1 | Install from `downloads.gorenku.com` with a short platform command. | macOS shell and Windows PowerShell bootstrap scripts download, verify, activate, and smoke-test Renku. |
| R2 | Do not publish workspace packages independently. | Release assembly deploys the private CLI workspace and its production dependency graph into one archive. |
| R3 | Make the agent essential to the product. | The product archive includes the Codex and Claude plugin/skills, and installation docs lead users through enabling them. |
| R4 | Support macOS arm64 and x64. | Native release jobs assemble and verify both targets. |
| R5 | Support Windows x64 from PowerShell without WSL. | A Windows runner installs and exercises the CLI and Studio using PowerShell. |
| R6 | Reuse commonly available Node versions. | Installers select system Node 22.12+ or Node 24 when present. |
| R7 | Work without a compatible system Node. | Bundled-runtime artifacts carry an official Node 24 runtime private to Renku. |
| R8 | Avoid native desktop distribution. | Studio runs as a foreground local Node server and browser UI. |
| R9 | Reuse existing Cloudflare configuration. | Publisher checks the bucket/domain contract and uploads objects without infrastructure mutation. |
| R10 | Keep internal material out of releases. | Release verification rejects Git data, environment files, local paths, Urban Basilica, and obsolete sample-project data. |
| R11 | Ship project database migrations. | Installed-tree verification creates a disposable project from the packaged Core migration history. |
| R12 | Support Codex and Claude Code desktop and terminal harnesses. | Plugin instructions use the installed CLI through normal shell tools on each harness. |
| R13 | Make updates recoverable. | Installs are versioned, archive checksums are verified before activation, and channel aliases can be rolled back. |
| R14 | Avoid obsolete runtime dependencies. | Release requirements contain no FFmpeg or ffprobe prerequisite. |

## Context

Current constraints and owners:

- `packages/core` owns durable project behavior, database creation, migration,
  backup, and structured domain diagnostics.
- `packages/cli` owns the public `renku` command and thin argument/result
  adaptation over Core and Studio runtime entrypoints.
- `packages/studio` owns the browser build and foreground local HTTP server.
- `packages/engines` owns provider catalogs and generation adapters only.
- `../studio-skills` owns the Codex and Claude filmmaking skills and plugin
  manifests.
- `docs/architecture/project-database-distribution.md` defines migrations as
  installed runtime contents.
- `docs/decisions/0077-use-self-contained-agent-first-beta-distribution.md`
  records the accepted distribution decision.
- The old Cloudflare setup already serves `downloads.gorenku.com` from the
  `renku-downloads` R2 bucket. The release path must consume that contract, not
  redesign it.
- Urban Basilica is an internal development project and is never a release
  input, test fixture, or public sample.

## Architecture Shape Gate

### Ownership

- `packages/cli/src/commands/studio/` owns CLI parsing and lifecycle adaptation
  for `renku studio start`.
- `packages/cli/src/runtime/` owns resolution of the installed Studio package
  runtime entrypoint. It does not own Studio server behavior.
- `packages/studio/server/index.ts` is the production local-server entrypoint.
  Existing Studio server modules continue to own routes and application
  behavior.
- `scripts/release/` owns target metadata, product assembly, installed-tree
  verification, packaging, bundled Node acquisition, and R2 publication as
  separate focused scripts.
- `distribution/install.sh` and `distribution/install.ps1` own platform
  bootstrap behavior only.
- `../studio-skills` owns harness-specific plugin metadata and agent workflow
  instructions.

### Public entrypoints

- `renku <command>`
- `renku studio start [--host <host>] [--port <port>] [--no-browser]`
- `curl -fsSL https://downloads.gorenku.com/install.sh | sh`
- `irm https://downloads.gorenku.com/install.ps1 | iex`
- root release scripts: `release:assemble`, `release:verify`,
  `release:package`, and `release:publish:beta`

### Intended module shape

```text
packages/cli/src/
  cli.ts                         thin top-level command registration
  commands/studio/
    index.ts                     thin studio subcommand registration
    start-studio-command.ts      parse and invoke one Studio start intent
  runtime/
    studio-runtime.ts            resolve and load installed Studio server

packages/studio/
  server/index.ts                production server entrypoint

scripts/release/
  release-targets.mjs            closed target/runtime matrix
  assemble-product.mjs           assemble one product tree
  verify-product.mjs             smoke one installed tree
  package-product.mjs            archive and checksum one tree
  download-node-runtime.mjs      acquire and verify one official runtime
  publish-r2.mjs                 validate and publish one release matrix

distribution/
  install.sh
  install.ps1
```

### Forbidden shapes and stop conditions

- Do not put Studio server behavior into the CLI.
- Do not put Core business rules, database behavior, or provider logic into
  release scripts, installers, or skills.
- Do not create a second command transport or duplicate the CLI contract for a
  harness that already has local shell execution.
- Do not turn one release script into a build, package, publish, rollback, and
  infrastructure-provisioning god file.
- Do not add package-manager global installs or change the user's system Node.
- Do not add Cloudflare DNS, Worker, Pages, bucket-creation, or dashboard setup
  to the normal release path.
- Stop if product assembly requires source files, workspace symlinks, the
  internal sample project, or an unpublished sibling checkout at runtime.
- Stop if `cli.ts`, a Studio command entrypoint, an installer, or the publisher
  begins combining unrelated domain responsibilities.

## Contracts

### Supported Node range

The product contract is:

```text
^22.12.0 || ^24.0.0
```

Node 23 and other odd-numbered releases are not supported. Development may use
a newer compatible Node 24 patch without raising the distribution minimum.

### Release target matrix

Targets:

- `darwin-arm64`
- `darwin-x64`
- `win32-x64`

Runtime flavors:

- `node22`
- `node24`
- `bundled-node24`

Native dependencies are built on matching operating-system and architecture
runners. Cross-built native modules are not accepted.

### Product archive

Each archive contains one `renku/` root:

```text
renku/
  app/                           deployed private CLI package and dependencies
  plugin/                        Codex and Claude plugin/skills
  runtime/node/                  bundled-runtime flavor only
  LICENSE
  RELEASE.json
```

`app/dist/cli.js` is the single installed executable entrypoint. Studio's
server, static browser bundle, Core migrations, engines, diagnostics, and
production dependencies live in the deployed private dependency graph.

`RELEASE.json` contains product, version, target, runtime flavor, supported
Node range, commit, build time, and workspace version.

### Installation layout

macOS:

```text
~/.local/share/renku/versions/<version>/
~/.local/share/renku/current
~/.local/bin/renku
```

Windows:

```text
%LOCALAPPDATA%\Renku\versions\<version>\
%LOCALAPPDATA%\Renku\current.txt
%LOCALAPPDATA%\Renku\bin\renku.ps1
%LOCALAPPDATA%\Renku\bin\renku.cmd
```

The launcher invokes the selected system Node or the activated version's
private Node runtime with `app/dist/cli.js`.

### Installer failures

Stable installer diagnostics:

- `INSTALL001`: unsupported operating system or architecture
- `INSTALL002`: archive or checksum download failure
- `INSTALL003`: checksum verification failure
- `INSTALL004`: extraction, activation, or installed CLI smoke failure
- `INSTALL005`: PATH was updated for future processes
- `INSTALL006`: no supported system Node; private Node fallback selected
- `INSTALL007`: enable the bundled Renku plugin in Codex or Claude Code

### Cloudflare object layout

Immutable objects:

```text
studio/releases/<version>/<target>/<flavor>/renku.<archive-extension>
studio/releases/<version>/<target>/<flavor>/renku.<archive-extension>.sha256
```

Mutable beta aliases:

```text
studio/channels/beta/<target>/<flavor>/renku.<archive-extension>
studio/channels/beta/<target>/<flavor>/renku.<archive-extension>.sha256
studio/channels/beta/release.json
install.sh
install.ps1
```

The publisher uploads immutable version objects first, beta aliases second,
the beta manifest third, and root installers last. It fails if the configured
account, bucket, object matrix, or public download host does not match the
accepted contract.

## Implementation Slices

### Slice 1: Make Studio an installed CLI capability

- Add the production Studio server entrypoint in `packages/studio/server/`.
- Add focused CLI Studio command modules and installed runtime resolution.
- Keep `cli.ts` as shallow registration and keep route behavior in Studio.
- Verify foreground lifecycle, port/host parsing, browser launch suppression,
  health, shutdown, and structured command failures.

### Slice 2: Correct runtime package contents

- Declare the production dependency graph required by CLI, Core migrations,
  engines, Studio server, and static browser assets.
- Include built runtime and migration files in package manifests.
- Remove FFmpeg/ffprobe assumptions inherited from the previous application.
- Verify an installed deployment without workspace source imports.

### Slice 3: Assemble and verify self-contained products

- Define the closed target/runtime matrix.
- Deploy the private CLI workspace into `app/` with production dependencies.
- Copy and version the agent plugin.
- Copy an official Node runtime only for bundled-runtime artifacts.
- Reject missing CLI, migrations, Studio server, or static assets.
- Smoke the packaged CLI, disposable project creation, and local Studio.
- Reject internal project data, source-control metadata, environment files,
  and developer-local paths.

### Slice 4: Package and install by platform

- Produce `.tar.gz` archives for macOS and `.zip` archives for Windows.
- Emit SHA-256 sidecars.
- Select target and compatible Node flavor in each installer.
- Download, verify, extract, smoke, and activate one version atomically.
- Write only the `renku` launcher and add its bin folder to the user's PATH.
- Print the Studio start command and bundled plugin path.

### Slice 5: Package Codex and Claude skills

- Keep agent-facing skills in `studio-skills` and require the installed
  `renku` runtime.
- Provide valid Codex and Claude plugin manifests with the release version.
- Document marketplace/plugin enablement for both harness families.
- Verify that desktop and terminal coding-agent modes can invoke `renku`
  through their ordinary shell tools.

### Slice 6: Publish through the existing R2 contract

- Add a publisher that verifies the complete artifact matrix before upload.
- Require existing Cloudflare credentials, account, bucket, and public domain.
- Support dry-run output for every intended object key.
- Publish immutable releases before mutable beta aliases and installers.
- Add a manually dispatched GitHub workflow with a protected publish choice.
- Do not publish as part of local implementation acceptance.

## Tests And Guardrails

### CLI and Studio

- Parse valid and invalid `renku studio start` flags.
- Prove the CLI delegates to the installed Studio runtime.
- Start Studio with `--no-browser`, wait for health, then terminate it.
- Confirm the CLI contains no Studio route or Core domain behavior.

### Release assembly

- Assert supported targets and Node flavors are closed unions.
- Assert `app/dist/cli.js`, Core migration journal, Studio server build, and
  Studio browser entry exist in every product tree.
- Run `renku about`, library initialization, project creation, and Studio
  health from the product tree.
- Scan the tree for internal samples, absolute developer paths, Git metadata,
  and environment files.

### Installers

- Verify system Node 22.12+, Node 24, and bundled-runtime selection.
- Verify checksum mismatch and incomplete archives fail before activation.
- Verify stable launchers target the activated version's `app/dist/cli.js`.
- Verify macOS PATH-file and Windows user-PATH behavior.
- Run native Windows PowerShell acceptance without WSL.

### Agent surfaces

- Validate both plugin manifests and every packaged skill.
- Verify skills require the installed CLI and do not assume a source checkout.
- Verify current Codex and Claude Code desktop/terminal modes can execute
  `renku about` using their local shell tool.

### Publication

- Dry-run the complete nine-cell artifact matrix and object ordering.
- Reject incomplete release directories and unknown target/flavor names.
- Confirm routine publication contains no infrastructure-creation command.
- Keep actual upload behind explicit workflow dispatch and protected approval.

Architecture checks protect package imports and stable public boundaries. They
must not freeze private helper names or implementation inventories.

## Documentation

- Keep `docs/operations/distribution-and-release.md` as the operator-facing
  install, build, verification, publication, and rollback guide.
- Keep ADR 0077 as the accepted self-contained distribution decision.
- Update `docs/architecture/project-database-distribution.md` for the private
  installed product boundary.
- Update CLI command documentation for `renku studio start`.
- Update `studio-skills/README.md` with Codex and Claude Code installation and
  direct CLI execution guidance.

## Final Verification

Run:

```bash
pnpm build
pnpm test:cli
pnpm check
pnpm release:assemble -- --version 0.1.0-beta.1 --target darwin-arm64 --flavor node24 --skills-dir ../studio-skills
pnpm release:verify -- release/staging/renku-0.1.0-beta.1-darwin-arm64-node24/renku
pnpm release:package -- release/staging/renku-0.1.0-beta.1-darwin-arm64-node24 release/artifacts
pnpm release:publish:beta -- --version 0.1.0-beta.1 --release-dir <complete-matrix> --dry-run
```

Then:

- perform an isolated macOS installer smoke against the locally packaged
  artifact;
- run Windows x64 assembly, verification, packaging, and PowerShell installer
  acceptance on a Windows runner;
- inspect `git diff --stat` and the full diff in both repositories;
- inspect every new or heavily modified runtime/release file;
- confirm `cli.ts` and `commands/studio/index.ts` remain thin;
- confirm no broad dispatcher, catch-all helper, or god file was introduced;
- scan release inputs and the product tree for internal project data and local
  developer paths; and
- confirm no actual Cloudflare upload occurred during implementation.

## Completion Checklist

### Review Area

- [x] Keep internal workspace packages private and distribute one product.
- [x] Treat Codex and Claude Code as essential product runtimes.
- [x] Support macOS and native Windows without Electron or WSL.
- [x] Reuse existing Cloudflare configuration without dashboard changes.
- [x] Exclude FFmpeg/ffprobe and Urban Basilica from distribution requirements.
- [x] Preserve accepted Core, CLI, Studio, and engines ownership boundaries.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the implemented module shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Set the supported Node contract to `^22.12.0 || ^24.0.0`.
- [x] Keep `renku` as the single public executable contract.
- [x] Add `renku studio start` as a thin CLI adapter over Studio runtime.
- [x] Keep Studio route/server behavior in `packages/studio`.
- [x] Ship Core Drizzle migrations in the installed dependency graph.
- [x] Update current callers directly with no compatibility shims.
- [x] Keep package-boundary failures structured where they cross CLI/Core.
- [x] Keep durable business rules in Core.

### Runtime And Product Assembly

- [x] Add the production Studio server build and package contents.
- [x] Add focused CLI Studio command and runtime-resolution modules.
- [x] Remove obsolete FFmpeg/ffprobe paths from the runtime dependency graph.
- [x] Add target/runtime release metadata.
- [x] Deploy the private CLI workspace and production dependencies into `app/`.
- [x] Copy and version the bundled agent plugin.
- [x] Acquire bundled Node from an official pinned release with checksum verification.
- [x] Verify CLI, migrations, project creation, Studio server, and static UI from the product tree.
- [x] Reject internal sample data and developer-local release contents.

### Installers

- [x] Add the macOS shell installer.
- [x] Add the native Windows PowerShell installer.
- [x] Select Node 22, Node 24, or the bundled Node 24 artifact correctly.
- [x] Verify archive SHA-256 before activation.
- [x] Keep versioned installs and update only the stable `renku` launcher.
- [x] Update PATH and explain desktop-app restart requirements.
- [ ] Complete native Windows x64 installer acceptance on a Windows runner.

### Agent Surfaces

- [x] Package the existing Renku skills for Codex and Claude Code.
- [x] Mark skills as requiring the installed Renku runtime.
- [x] Add current Codex and Claude plugin manifests.
- [x] Document direct CLI use through the harnesses' local shell tools.
- [ ] Perform final host-version acceptance in Codex and Claude Code desktop apps.

### Release Publication

- [x] Add immutable release and mutable beta object layouts.
- [x] Add complete-matrix validation and dry-run output.
- [x] Add the manually dispatched GitHub release workflow.
- [x] Keep Cloudflare infrastructure mutation out of routine publication.
- [ ] Build and verify the complete nine-cell matrix on native runners.
- [ ] Configure protected CI secrets/environment for the first authorized publish.
- [ ] Publish the first beta only after explicit authorization.

### Tests And Guardrails

- [x] Add CLI Studio command tests and architecture checks.
- [x] Add installed-tree CLI, database, and Studio smoke verification.
- [x] Add archive checksum and release-content checks.
- [x] Add publisher matrix and dry-run validation.
- [x] Validate plugin manifests and skill runtime requirements.
- [ ] Run final Windows-native acceptance.
- [ ] Run the complete release matrix on CI runners.

### Documentation

- [x] Add the accepted distribution ADR.
- [x] Add the release and operations guide.
- [x] Update project database distribution documentation.
- [x] Update CLI command documentation.
- [x] Update Codex and Claude Code plugin installation guidance.

### Final Verification

- [x] Run focused builds and CLI tests.
- [x] Assemble, verify, package, and install-smoke a macOS product locally.
- [x] Run release-publisher dry-run validation without uploading.
- [x] Inspect `git diff --stat` and the complete changed-file diff.
- [x] Inspect new and heavily modified files for reviewable structure.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item relies on an unreviewable code structure.
- [ ] Complete native Windows and final harness acceptance.
- [ ] Build all native artifacts and publish only with explicit approval.
