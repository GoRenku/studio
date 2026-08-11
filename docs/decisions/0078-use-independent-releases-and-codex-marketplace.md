# 0078: Use Independent Releases And Codex Marketplace Distribution

Date: 2026-08-10

Status: accepted

Amended: 2026-08-11 — initial Studio releases run on the maintainer's machine;
the exact-tag GitHub Actions matrix is retained as an explicit future path.

Amended: 2026-08-11 — alpha releases cross-package all three targets locally
with bundled Node 24. The native host receives runtime verification; other
targets receive explicit structural verification pending manual testing.

## Decision

Release the Renku runtime and Renku agent plugin independently from the
repositories that own them.

`GoRenku/studio` owns the Studio product version, `vX.Y.Z` tags, GitHub
Releases, native runtime archives, installers, and R2 beta channel. Its root
`package.json` is the canonical Studio version, and all runtime workspace
package manifests are synchronized to it. Studio release automation never
checks out, modifies, tags, or publishes Studio Skills.

`GoRenku/studio-skills` owns the plugin version, its own `vX.Y.Z` tags and
GitHub Releases, and the mutable `beta` marketplace branch. The version in
`.codex-plugin/plugin.json` is canonical and the Claude manifest version must
match it because both describe one repository release. The `beta` branch may
advance only after the corresponding immutable tag and GitHub Release exist.

Users install the two released products in order:

1. install and verify the Renku runtime;
2. add `GoRenku/studio-skills --ref beta` as a Codex marketplace;
3. install `renku@renku`; and
4. start a new Codex task or CLI session.

The supported plugin hosts for this beta are Codex CLI and Codex in the
ChatGPT desktop app. The runtime installer prints these steps but does not edit
Codex configuration or install the plugin automatically.

## Release Integrity

The default Studio release command builds, verifies, packages, and publishes
from the maintainer's machine. It produces one self-contained bundled-Node 24
artifact for each supported target. The native host target receives full
installed-product execution; cross-packaged targets must contain their
checksum-verified official Node runtime and target-native better-sqlite3 and
esbuild binaries. Each artifact records whether it received `runtime` or
`structural` verification. This is the accepted alpha tradeoff while releases
are distributed only to a small testing group.

The retained future workflow builds the full native matrix only from the exact
annotated tag passed to it. Both local and workflow paths create or resume a
draft GitHub prerelease, upload and verify their complete declared target set,
download those assets again, and mirror those exact bytes to R2. The GitHub
prerelease becomes public only after R2 publication and verification succeed.

The Studio and Studio Skills versions are deliberately unrelated. A tag such
as `v0.2.0` identifies a release only within its own repository.

## Consequences

- The Studio archive contains the CLI, browser Studio, server, private runtime
  packages, and migrations, but no plugin, marketplace, or skills directory.
- better-sqlite3 13 uses N-API and ships its supported platform prebuilds in
  the package, so Node 22/24 release flavors are no longer produced.
- Plugin refreshes consume only commits advanced to the Studio Skills `beta`
  branch after release publication; ordinary `main` commits are not the user
  channel.
- Recovery commands resume one existing tag and release. They do not bump a
  version, move a tag, or create compatibility aliases.
- Codex plugin behavior is rechecked against current official OpenAI
  documentation and shipping hosts before the first live release.
- The Codex IDE extension is not a supported plugin host.

This decision supersedes ADR 0077 only where ADR 0077 bundled the plugin into
the runtime archive or allowed caller-supplied workflow release identity.
