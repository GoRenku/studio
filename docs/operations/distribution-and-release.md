# Renku Beta Distribution And Release

Date: 2026-08-09

Status: current

## User Installation

macOS:

```bash
curl -fsSL https://downloads.gorenku.com/install.sh | sh
```

Windows PowerShell, without WSL:

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
```

The installer selects macOS arm64, macOS x64, or Windows x64 and then selects a
Node 22, Node 24, or private bundled-Node-24 archive. Compatible existing Node
installations are reused. The private fallback does not replace system Node.

After runtime installation, enable the bundled Renku plugin in Codex or Claude
Code.
The Codex and Claude Code desktop apps use the same coding-agent engines and
skills as their CLI counterparts. Those agents invoke the installed `renku`
command through their normal local shell tools. Restart desktop apps after
installation so they inherit the updated PATH.

## Build And Verification

Every release is a nine-cell matrix:

- `darwin-arm64`, `darwin-x64`, and `win32-x64`;
- `node22`, `node24`, and `bundled-node24`.

Build native dependencies on the matching OS/architecture runner. Then run:

```bash
pnpm build
pnpm release:assemble -- --version <version> --target <target> --flavor <flavor> --skills-dir ../studio-skills
pnpm release:verify -- <product-root>/renku
pnpm release:package -- <product-root> <artifact-output>
```

For `bundled-node24`, first run `download-node-runtime.mjs` and pass the
extracted directory with `--bundled-node-dir`. The helper pins official Node
24.16.0 and verifies its official SHA-256 manifest.

Verification rejects Git data, environment files, internal sample-project
paths, and Urban Basilica. It also creates a disposable project database,
starts Studio, and exercises the CLI from the installed tree.

## Existing Cloudflare Contract

Release publication uses:

- account credentials supplied as `CLOUDFLARE_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`;
- existing bucket `renku-downloads`; and
- existing public domain `https://downloads.gorenku.com`.

The publisher checks that both already exist. It never creates or reconfigures
Cloudflare infrastructure, so a routine release requires no dashboard work.

Dry-run the complete object matrix:

```bash
pnpm release:publish:beta -- --version <version> --release-dir <artifact-root> --dry-run
```

The GitHub workflow requires an explicit `publish` choice and the
`beta-release` protected environment. Publication order is immutable version
objects, beta aliases, beta manifest, then root installers.

Rollback is a channel operation: republish the previously verified release's
beta aliases and `release.json`. Immutable version objects are never replaced.

## Deliberate Non-Requirements

- No Electron, native desktop app, code signing, or Apple notarization.
- No FFmpeg or ffprobe prerequisite.
- No independent npm publication for Core, CLI, engines, Studio, or diagnostics
  packages.
- No Linux archive in the first beta.
- No Urban Basilica or other internal project data in any archive.
