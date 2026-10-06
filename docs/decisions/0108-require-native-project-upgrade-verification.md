# Local Releases And Optional Native Project Upgrade Verification

Date: 2026-10-06

Status: accepted — amended by explicit user direction

Local build and publication remain the default, as established in ADR 0078.
`pnpm release` and `pnpm release:publish` build on the maintainer's machine,
package all three current targets with private Node 24 runtimes, and publish
through the existing GitHub Release and R2 flow. GitHub Releases as artifact
storage does not imply GitHub Actions as the build or publication executor.

The host target receives runtime smoke checks; other targets receive structural
checks. Reports state the checks actually performed. Full native upgrade reports,
when supplied, must match the archive checksum and pass their complete fixture
inventory. They are not a universal local-publication requirement.

The initial Plan 0223 proposal made GitHub Actions mandatory for publication.
The user explicitly rejected that workflow change. The optional
`pnpm release:dispatch` path remains maintained and runs the native upgrade
matrix before its own publication job. Its evidence upload includes the synthetic
`.renku` databases, backups and sidecars; no real movie data enters CI artifacts.

Verification using the maintainer's other Windows and Linux machines will be
addressed in a separate session. No remote-machine orchestration, new release
platform, desktop acceptance gate or supported-OS gate is introduced here.
Unrun checks remain unverified and are never reported as passing.

The database repair and recovery rules remain unchanged: Core owns backup and
readiness behavior, Drizzle Kit applies SQL, and adapters consume structured
errors. The backup uses a writable non-truncating flush handle. Verified backups
and recovery diagnostics are retained on failure. No Project schema, Settings,
automatic restore or historical runtime reader is introduced.

See [ADR 0078](0078-use-independent-releases-and-codex-marketplace.md) and
[distribution and release](../operations/distribution-and-release.md).
