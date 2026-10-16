# 0123 Publish Studio Releases As Latest With Commit Notes

Date: 2026-10-16

Status: accepted

Narrows [ADR 0078](0078-use-independent-releases-and-codex-marketplace.md).

## Context

Every Studio GitHub Release was published as a pre-release, so GitHub showed no
"Latest" release and `/releases/latest` returned 404. GitHub's generated notes
group merged pull requests, but Studio is built with direct commits, so every
release page was empty apart from a changelog link.

## Decision

- Studio GitHub Releases are drafted without the pre-release flag and, after
  R2 verification, published as full releases marked Latest.
- The product and the download channel stay beta. Installers, `renku update`
  and Studio's update check read the R2 `beta` channel, never GitHub, so the
  release type does not change what users install.
- Release notes are composed from commit subjects since the previous
  annotated `v*` tag: `feat:` under Features, `fix:` under Fixes, everything
  else under Other changes; `release:` and merge commits are left out. Each
  page opens with a beta line linking the install page and naming
  `renku update`.
- GitHub Releases are the only home for release notes. GitHub-generated notes
  and `.github/release.yml` are removed.
- The `pnpm release` commands and the draft, upload, verify, R2, publish order
  are unchanged.

## Consequences

Commit subjects become public release text. Corrections are made with
`gh release edit vX.Y.Z --notes-file <file>`.
