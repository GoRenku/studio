# 0177 Adopt Repository-Owned Releases And Codex Distribution

Status: implementation and local three-target alpha build complete; first-publication acceptance pending
Date: 2026-08-10

## Summary

Adopt the distribution foundation already implemented under plan 0176 into a
proper release and installation process without rewriting that completed plan
or bundling two independently owned repositories into one release.

This is the single follow-up implementation plan. It covers three connected but
separate concerns:

1. `GoRenku/studio` releases the Renku runtime from its own versioned commit,
   tag, and GitHub Release, then mirrors those exact artifacts to R2.
2. `GoRenku/studio-skills` releases the existing Renku plugin from its own
   versioned commit, tag, and GitHub Release. Its current plugin, marketplace,
   and `skills/` structure remain unchanged.
3. Codex distribution installs the released runtime and released plugin as two
   products. The first supported hosts are Codex CLI and Codex in the merged
   ChatGPT desktop app. The IDE extension is permanently unsupported.

The current Studio archive incorrectly copies Studio Skills, rewrites its
version, and calls the copied directory a bundled plugin. Replace that behavior
with Codex's current repository-marketplace installation model. For the beta,
an independently maintained `beta` branch in `studio-skills` acts only as the
mutable released-plugin channel. Immutable `vX.Y.Z` tags and GitHub Releases
remain the release ledger. Users subscribe to the `beta` channel once rather
than pinning their installation to one version tag.

## Review Attention

- **One adoption plan:** plan 0176 is restored unchanged as the record of the
  implemented foundation. All corrective release and Codex installation work
  is owned by this plan; no second release or installation plan is proposed.
- **Studio release changes:** add the prior-Renku-style local
  prepare/publish/ship flow, checked-in synchronized versions, Studio tag and
  GitHub Release, tag-owned native builds, and exact-asset R2 promotion.
- **Initial publication path:** the default `pnpm release` command builds and
  publishes on the maintainer's machine. It cross-packages one self-contained
  bundled-Node 24 artifact for all three supported targets. The native host is
  runtime verified; other targets are structurally verified and explicitly
  identified as such for alpha distribution.
- **Database dependency change:** better-sqlite3 moves from 12.9 to 13.0.2.
  Version 13 ships N-API prebuilds inside the package, removes
  `prebuild-install`, and eliminates the Node 22/24 artifact split. The
  workspace disables its unnecessary implicit `node-gyp` fallback.
- **Future publication path:** keep the exact-tag GitHub Actions workflow and
  three-target native verification matrix behind the separate, explicit `release:dispatch`
  command. The default local publisher never dispatches Actions.
- **Studio Skills release changes requiring explicit approval:** add only local
  release automation and a release-channel branch. Do not move, rename, edit,
  regenerate, or reinterpret `.codex-plugin/`, `.agents/plugins/`,
  `.claude-plugin/`, or `skills/` as part of this work.
- **Exact proposed Studio Skills file additions:** a small root `package.json`
  containing release command aliases and focused `scripts/release/` modules.
  These additions do not change the plugin package shape, but implementation in
  that repository must not begin until the user explicitly approves them.
- **Existing Studio Skills files that change during a release:** only the
  `version` fields in `.codex-plugin/plugin.json` and
  `.claude-plugin/plugin.json`, because both currently describe the same
  repository release. Their schemas, other metadata, marketplace entries, and
  skill contents remain untouched by release automation.
- **Codex hosts:** support Codex CLI and Codex in the ChatGPT desktop app. Do
  not implement, document, test, or preserve an IDE-extension path.
- **Current-source gate:** Codex behavior must be verified from official OpenAI
  pages fetched on the implementation day, the current installed CLI's own
  help, and the current desktop app UI. Training knowledge and stale copied
  documentation are not acceptable evidence.
- **Distribution channel:** use `GoRenku/studio-skills --ref beta`, not an
  individual `vX.Y.Z` tag and not `main`. The release command advances `beta`
  only after the corresponding immutable tag and GitHub Release exist.
- **Deliberately unchanged:** the working Studio runtime, CLI, browser Studio,
  three supported OS/CPU targets, installers, R2 bucket/domain, plugin
  manifest structure, marketplace structure, and every existing Renku skill.
- **No automatic host mutation:** the Studio runtime installer does not edit
  Codex configuration or silently install a plugin. It prints the supported
  Codex installation steps after the runtime smoke succeeds.
- **Destructive effects:** no current tag, release, skill, or plugin file is
  deleted. Published tags and GitHub Release assets are immutable. The `beta`
  branch is a deliberate mutable distribution pointer and is never a release
  identity.
- **Approval required before implementation:** approve the `studio-skills`
  release-tool additions, synchronized manifest version bumps, and `beta`
  distribution branch. No Studio Skills working-tree change is authorized by
  this proposed plan alone.

## Implementation Result

The repository-owned release and Codex installation implementation is complete
in both local worktrees. Studio now owns its version, local cross-target build,
annotated tag, GitHub prerelease assets, and exact-byte R2 promotion. Studio
Skills now owns a separate version/tag/GitHub Release flow whose non-force `beta` update occurs
only after the corresponding release exists. Studio artifacts contain no
plugin-owned paths, and the runtime installers print the separate Codex plugin
installation steps without mutating Codex state.

Local verification on 2026-08-10 completed the release-contract suites, package
typechecks and lint, architecture checks, production builds, the full CLI,
Engines, Diagnostics, and Studio test suites, a real Studio-only product
assembly, installed-tree verification, and a local HTTP installer acceptance.
That acceptance exposed and fixed a macOS aliased-path entrypoint bug; product
verification now rejects a no-op `renku about` response instead of accepting an
exit code alone. A clean temporary Codex profile also added the repository
marketplace from the currently available `main` ref and installed
`renku@renku` with Codex CLI 0.145.0.

The remaining unchecked items are first-publication acceptance, not local
implementation work. The remote `beta` ref does not yet exist, and this plan
explicitly requires separate post-verification authorization before tags,
pushes, GitHub Releases, R2 objects, or that branch are created. ChatGPT desktop
26.803.41515 was recorded, but automated inspection of its Plugins tab was
blocked by the host's Computer Use safety policy. Consequently the plan must
not be marked fully complete until the authorized first releases and clean-host
CLI/desktop checks satisfy the exit criteria.

### 2026-08-11 local-release amendment

The user clarified that initial Studio releases will not use GitHub Actions and
accepted cross-packaged alpha artifacts without release-grade native execution
proof on every target. The default prepare/publish/ship path now releases from
the maintainer's local machine and produces `darwin-arm64`, `darwin-x64`, and
`win32-x64`, each with bundled Node 24.16.0. Apple Silicon receives full
installed-product execution. Intel Mac and Windows receive structural checks
for release metadata, the official Node runtime, better-sqlite3 prebuild,
esbuild package, and release-content boundary. Verification level is preserved
in the release manifest, and Windows runtime acceptance is manual during the
alpha period.

The 2026-08-11 local build produced all three archives. Apple Silicon passed
CLI identity, project creation and migration, and Studio health verification;
Intel Mac and Windows passed structural verification. The full native workflow
remains checked in for future explicit use through
`pnpm release:dispatch -- --tag vX.Y.Z`.

Final verification on 2026-08-11 passed the root production build, the complete
typecheck/lint/architecture/release-contract gate, and the full workspace test
suite. The better-sqlite3-backed Core suite passed 339 tests. GitHub asset
staging and R2 publication also passed in dry-run mode against the real three
archives, without creating a tag, GitHub Release, or R2 object.

## Requirement Ledger

| ID | Source | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| R1 | Implemented plan 0176 | Preserve the working self-contained runtime, CLI, browser Studio, native matrix, installers, and R2 delivery foundation. | Adoption changes pass the existing build, product-tree verification, installer, and publisher tests without redesigning the runtime. |
| R2 | User feedback | Do not revise the already implemented plan to describe later corrective work. | Plan 0176 matches its recovered 495-line implemented form and this is the only follow-up plan. |
| R3 | User feedback | Studio and Studio Skills each own their versions, tags, and GitHub Releases. | Each repository can release independently with its own local command and no workflow writes, tags, or versions the other. |
| R4 | User feedback | Keep repository release mechanics separate from cross-product installation. | Release sections end at each repository's published outputs; Codex installation consumes those outputs without creating a shared version. |
| R5 | User feedback | Use the successful local release workflow from the prior Renku project; do not require pull requests. | Local patch/minor/major commands validate `main`, bump, check, commit, tag, push, publish, and report completion. |
| R6 | User feedback | First installation support is Codex CLI and Codex in the merged ChatGPT desktop app only. | Clean-host acceptance covers both surfaces and contains no IDE-extension path. |
| R7 | User feedback | Do not change the working Studio Skills plugin or skills structure without explicit permission. | The plan enumerates every permitted Studio Skills path change; package and skill-layout diffs are empty. |
| R8 | Current OpenAI documentation and current host behavior | Use Codex's supported plugin marketplace and plugin browser/install mechanisms. | A clean current Codex CLI adds the released marketplace, installs Renku, and a new CLI and desktop task load its skills. |
| R9 | Release integrity | Users must receive released Studio Skills content without becoming stuck on one immutable tag. | A release-only `beta` branch advances after GitHub Release publication; marketplace refresh moves installed users only to released commits. |
| R10 | Accepted review findings | Preserve safe runtime download, pre-activation smoke, and exact-byte R2 resume behavior. | Focused regression tests cover all three behaviors already implemented in the working tree. |
| R11 | Operational safety | Do not publish, tag, push, change GitHub settings, or mutate the dirty Studio Skills checkout during plan implementation without authorization. | Local tests and dry runs finish without external publication; live release actions remain explicit operator steps. |
| R12 | User clarification, 2026-08-11 | Initial Studio releases run from the maintainer's machine without GitHub Actions. | `pnpm release` cross-packages all three targets locally; Actions require the separate `release:dispatch` command. |
| R13 | User clarification, 2026-08-11 | Initial alpha releases contain all three supported targets, with full Apple Silicon verification and manual Windows/Intel acceptance allowed. | Local build produces three bundled-Node 24 archives and records runtime versus structural verification per target. |

## Current Evidence

### Implemented Studio baseline

Plan 0176 implemented the distribution foundation now present in the working
tree:

- `scripts/release/assemble-product.mjs` deploys the private CLI dependency
  graph, adds an optional private Node runtime, copies the plugin, and writes
  `RELEASE.json`;
- `scripts/release/verify-product.mjs` exercises the installed CLI, database
  creation/migrations, Studio server, and release-content scanner;
- `scripts/release/package-product.mjs` creates target-native archives and
  checksums;
- `distribution/install.sh` and `distribution/install.ps1` select, download,
  verify, smoke, and activate an installed version;
- `scripts/release/publish-r2.mjs` validates the complete native matrix and
  publishes immutable objects before beta aliases; and
- `.github/workflows/release-beta.yml` builds the nine native target/flavor
  combinations.

Three accepted review repairs are already in the working tree and remain part
of the baseline:

- runtime acquisition rejects an existing destination instead of deleting it;
- both installers smoke the extracted CLI before replacing the active install;
  and
- R2 publication resumes an immutable key only after verifying matching bytes.

The remaining release defects are architectural rather than reasons to replace
that foundation:

- the workflow accepts an arbitrary version instead of building a Studio tag;
- Studio has no release commit/tag/GitHub Release lifecycle;
- the workflow checks out the moving Studio Skills repository;
- assembly copies Studio Skills and rewrites its plugin versions; and
- installers print a bundled-plugin directory that Codex has not installed.

### Existing Studio Skills package

The separate `GoRenku/studio-skills` repository currently has:

```text
.agents/plugins/marketplace.json
.codex-plugin/plugin.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
skills/
```

This shape works today. The current Codex installation on the maintainer's
machine exposes `renku@renku-local` from that repository in both this desktop
task and Codex CLI. No plan requirement needs a manifest redesign, marketplace
rewrite, new plugin wrapper, skill move, or skill-content change.

The repository currently has no tags, GitHub Releases, `beta` branch, package
scripts, or release automation. Both plugin manifests currently report
`0.1.0`. Its working tree has unrelated changes, including skill and manifest
changes, so this plan must not modify it until those changes are separately
reviewed and the user explicitly authorizes release-process implementation
there.

### Current official Codex evidence

The following official OpenAI pages were fetched on 2026-08-10 and reported as
crawled today:

- <https://learn.chatgpt.com/docs/plugins>
- <https://developers.openai.com/plugins/build/plugins>

They currently state:

- Codex in the ChatGPT desktop app and Codex CLI support plugins;
- the IDE extension does not support plugins;
- the CLI opens its marketplace browser with `/plugins`;
- users start a new task/session after installing a plugin;
- repository marketplaces are added with
  `codex plugin marketplace add owner/repo`;
- `--ref` accepts a Git ref;
- configured Git marketplace snapshots refresh with
  `codex plugin marketplace upgrade`; and
- authors should add marketplace sources with the CLI rather than editing
  `config.toml` by hand.

The installed `codex-cli 0.145.0` independently confirms these current command
contracts:

```text
codex plugin marketplace add <owner/repo[@ref]> [--ref <ref>]
codex plugin marketplace upgrade [marketplace-name]
codex plugin add <plugin@marketplace>
codex plugin list
```

The OpenAI Developers home page fetched on the same date explicitly describes
the current product as the familiar ChatGPT experience and full Codex power in
one app. This plan therefore uses **ChatGPT desktop app** as the current product
name and **Codex in the ChatGPT desktop app** as the supported surface.

## Explicit Non-Goals

- No Codex IDE extension support, documentation, fallback, testing, or
  compatibility path—now or later under this plan.
- No Claude Code installation or acceptance in this first iteration.
- No public universal-plugin-directory submission.
- No Studio Skills manifest-schema, marketplace-schema, skill-folder, skill
  contract, prompt, example, reference, or eval change.
- No shared Studio/Studio Skills version number, combined tag, combined GitHub
  Release, cross-repository release orchestrator, or compatibility service.
- No automatic modification of a user's Codex config from the Renku installer.
- No npm publication of Studio workspace packages or the Studio Skills plugin.
- No actual tag, push, GitHub Release, R2 upload, `beta` branch creation, or
  GitHub setting change during implementation without explicit authorization.

## Options Considered

### Keep bundling Studio Skills in the Studio archive

Rejected. It gives Studio ownership of another repository's bytes and version,
and the copied folder is not registered as a Codex marketplace or installed as
a plugin.

### Make users install one immutable Studio Skills tag

Rejected. This was the earlier `--ref v0.1.0` proposal. A release tag is a good
immutable audit record but a poor long-lived subscription: the user remains on
that tag and must reconfigure the marketplace for every upgrade. The specific
`v0.1.0` did not exist and should never have been presented as the current
installation path.

### Subscribe users directly to `main`

Rejected for release distribution. OpenAI documents it and it is useful for
development, but refreshing the marketplace could expose commits that have not
passed the Studio Skills release process or received a tag/GitHub Release.

### Use a release-owned `beta` branch as the Codex marketplace ref

Recommended for the first iteration. Immutable tags and GitHub Releases record
what was released. The mutable `beta` branch is a distribution-channel pointer,
advanced only by the Studio Skills publish stage after that release exists.
Users configure the marketplace once and can refresh it without consuming
ordinary unreleased `main` commits.

### Submit immediately to the universal plugin directory

Deferred. It is the likely public-discovery destination, but submission review,
publisher identity, listing assets, and directory operations are additional
scope. The repository marketplace is an officially supported first
distribution route and can be verified without changing the working plugin
structure.

## Architecture Shape Gate

### Ownership across the single plan

The plan coordinates two repositories and one installation journey, but no
implementation owner crosses a repository boundary.

`GoRenku/studio` owns:

- Studio product versions, release commits, tags, GitHub Releases, native
  runtime artifacts, installers, R2 objects, and the `renku` executable;
- Studio-only release scripts and native workflow; and
- post-install text that points to the Codex plugin installation steps.

`GoRenku/studio-skills` owns:

- its existing plugin manifests, marketplace catalogs, skills, version, release
  commits, tags, GitHub Releases, and `beta` marketplace channel;
- its own local release commands; and
- the Codex plugin installation and update documentation.

The Codex installation journey owns only the order in which users install the
two released products. It creates no third version or release.

### Intended Studio release shape

```text
package.json                              Studio release command aliases
.github/
  release.yml                             GitHub generated-note categories
  workflows/release.yml                   exact-tag native build and publish
scripts/release/
  release-contract.mjs                    Studio version/tag/ref invariants
  prepare.mjs                             bump, check, release commit, local tag
  build-local-release.mjs                 local cross-target build and verification
  publish.mjs                             local GitHub/R2 publication
  dispatch-release-workflow.mjs           explicit future Actions path
  ship.mjs                                thin prepare then publish sequence
  publish-github-release.mjs              draft assets and final publication
  assemble-product.mjs                    Studio-only product assembly
  verify-product.mjs                      installed-tree verification
  package-product.mjs                     native archive/checksum creation
  download-node-runtime.mjs               official private runtime acquisition
  publish-r2.mjs                          verified mirror and beta promotion
  release-targets.mjs                     closed native target contracts
distribution/
  install.sh
  install.ps1
```

`.github/workflows/release-beta.yml` disappears. `assemble-product.mjs` loses
all Studio Skills inputs, copying, and version mutation. The installed product
tree loses `plugin/`.

### Intended Studio Skills release additions

Subject to explicit user approval, add only:

```text
package.json                              private operator aliases only
scripts/release/
  release-contract.mjs                    manifest version and tag invariants
  prepare.mjs                             bump, validate, commit, local tag
  publish.mjs                             push, GitHub Release, beta promotion
  ship.mjs                                thin prepare then publish sequence
```

`package.json` does not become a third version source and introduces no runtime
dependency. It exists only to preserve the familiar commands:

```text
pnpm release
pnpm release:minor
pnpm release:major
pnpm release:prepare
pnpm release:publish -- --tag vX.Y.Z
```

The following existing Studio Skills paths remain structurally and
semantically unchanged:

```text
.agents/plugins/marketplace.json
.codex-plugin/plugin.json                 version value only during release
.claude-plugin/marketplace.json
.claude-plugin/plugin.json                version value only during release
skills/**
```

### Forbidden shapes and stop conditions

- Do not revise plan 0176 again to describe this follow-up.
- Do not create another active plan for any part of this adoption.
- Do not add a Studio workflow or script that writes, tags, releases, or checks
  out Studio Skills.
- Do not add a Studio Skills script that writes, tags, releases, or checks out
  Studio.
- Do not change any Studio Skills manifest field other than `version` through
  release automation.
- Do not change the marketplace's existing local `./` plugin source. It is the
  correct path when the marketplace repository itself is checked out by Codex.
- Do not edit any skill, reference, prompt, example, or eval in release work.
- Do not pin end users to an individual version tag or expose unreleased `main`
  as the documented distribution channel.
- Do not add IDE-extension handling, host-detection fallbacks, config-file
  writers, plugin-copy shims, a daemon, or a second CLI transport.
- Stop if current official pages, current CLI help, and current desktop behavior
  disagree. Record the exact versions and observed difference, then return for
  a decision before changing the working plugin package.
- Stop if release automation cannot be added without restructuring the existing
  Studio Skills package. Explain the exact blocker and obtain explicit user
  permission before editing that repository.
- Stop if one release module starts combining version mutation, validation,
  Git operations, native building, GitHub publication, R2 publication, and
  cross-repository coordination.

## Contracts

### Independent repository versions

Both repositories use strict SemVer `X.Y.Z` and tag format `vX.Y.Z`, but their
numbers are unrelated. It is valid for both repositories to have a `v0.1.0`
tag because tags are scoped to different Git repositories. Releasing either
repository does nothing to the other.

Studio's root `package.json` is its canonical product version. Runtime package
manifests shipped inside the product match it. Website deployment remains
outside the Studio product release.

Studio Skills' `.codex-plugin/plugin.json` version is its canonical repository
version. `.claude-plugin/plugin.json` must match because both manifests package
the same skills repository release. There is no new `VERSION` file and the
operator-only `package.json` contains no competing version.

### Studio local release contract

Match the prior Renku operator workflow:

1. `pnpm release` defaults to patch; explicit minor and major aliases exist.
2. Prepare requires clean local `main` equal to `origin/main`.
3. Prepare validates synchronized versions, bumps them, runs `pnpm check`,
   creates `release: vX.Y.Z`, and creates the annotated local tag.
4. Publish revalidates tag/version/HEAD agreement, builds one bundled-Node 24
   artifact for all three targets, fully verifies the native host, structurally
   verifies cross-packaged targets, and pushes `main` and the tag.
5. Local publish creates or resumes the exact draft GitHub Release, uploads the
   complete three-target alpha set, downloads and verifies those assets, mirrors
   those bytes to R2, then publishes the GitHub prerelease.
6. `release:publish -- --tag vX.Y.Z` is the recovery path; it never bumps or
   moves a tag.
7. `release:dispatch -- --tag vX.Y.Z` is a separate future path that dispatches
   the retained full-matrix workflow. It is never called by the default release
   command.

### Studio Skills local release contract

The same local operator shape applies without native build machinery:

1. `pnpm release` defaults to patch; minor and major aliases are explicit.
2. Prepare requires clean local `main` equal to `origin/main` and matching
   Codex/Claude manifest versions.
3. Prepare changes only the two manifest `version` values, validates the
   existing JSON package paths, creates `release: vX.Y.Z`, and creates the
   annotated local tag.
4. Publish revalidates the tag and manifests, pushes `main` and the tag, and
   creates the tag's GitHub Release with generated notes.
5. Only after the GitHub Release exists does publish fast-forward the remote
   `beta` branch to that tagged commit without checking it out locally.
6. A publish retry for the same tag reuses the GitHub Release and advances the
   channel if needed; it never bumps, recommits, moves the tag, or edits skills.

### Codex installation contract

Install and verify the Studio runtime first:

```sh
curl -fsSL https://downloads.gorenku.com/install.sh | sh
renku about
```

Windows uses the published `install.ps1` equivalent.

Add the released Studio Skills beta channel once:

```sh
codex plugin marketplace add GoRenku/studio-skills --ref beta
```

This is the target first-beta command, not a command that works today: the
`beta` branch does not exist until the separately authorized Studio Skills
release implementation publishes its first release.

Then install Renku through either supported host:

- Codex CLI: open `/plugins`, select the `renku` marketplace, inspect Renku,
  and install it; or run the current direct command
  `codex plugin add renku@renku`.
- ChatGPT desktop app: open the Plugins tab from Codex, select the personal
  `renku` marketplace, inspect Renku, and install it.

Start a new Codex session/task after installation. The plugin calls the
separately installed `renku` executable through Codex's ordinary local shell
capability.

The exact update behavior is not assumed from documentation. Implementation
acceptance must empirically verify whether
`codex plugin marketplace upgrade renku` updates an installed plugin from the
advanced `beta` snapshot automatically or requires a documented reinstall in
the plugin browser. Record only the observed behavior for the current CLI and
desktop builds.

### Documentation freshness contract

Immediately before implementation and again before first publication:

1. fetch the current official plugin overview and package-your-plugin pages;
2. record their fetch date and relevant current wording;
3. record `codex --version` and the output of the current plugin and marketplace
   help commands;
4. inspect the current ChatGPT desktop Plugins UI from Codex;
5. test the published marketplace in a clean Codex profile or disposable user
   environment; and
6. treat the clean-host result as the release gate.

If the docs and shipping product differ, do not guess which future behavior
OpenAI intends. Use the current product behavior for the current release only
when it remains within the existing plugin package contract; otherwise stop and
request permission before changing Studio Skills.

## Implementation Slices

### Slice 1: preserve the implemented foundation and regression fixes

In `GoRenku/studio`:

- keep the implemented CLI, server, native matrix, runtime selection,
  installers, R2 object layout, and content scanner;
- add focused regression tests for safe runtime destinations, pre-activation
  smoke, and exact-byte R2 resume; and
- do not edit plan 0176 or reimplement completed runtime work.

### Slice 2: make Studio release from repository-owned refs

In `GoRenku/studio`:

- add focused release contract, prepare, publish, and ship modules;
- synchronize the Studio runtime package versions from the root version;
- make `renku about` report the released Studio version;
- remove caller-supplied publish identity from assembly and R2 publication;
- replace the manual arbitrary-version workflow with an exact-tag workflow;
- create checked GitHub Release assets and generated notes before R2 promotion;
  and
- preserve the complete native build and installer acceptance matrix.

### Slice 3: remove Studio Skills from Studio artifacts

In `GoRenku/studio` only:

- remove the sibling checkout from GitHub Actions;
- remove `--skills-dir`, `RENKU_SKILLS_DIR`, plugin copy, and plugin version
  rewrite from assembly;
- remove `plugin/` assertions from product verification;
- remove bundled-plugin copy from installer messages; and
- replace it with the exact Codex CLI/Desktop setup instructions or a stable
  link containing those instructions.

This slice never writes the Studio Skills checkout.

### Slice 4: add independent Studio Skills releases

This slice is blocked from implementation until the user explicitly approves
the exact Studio Skills additions listed in Review Attention.

After approval and from a separately reviewed clean working tree:

- add the operator-only package scripts and focused release modules;
- validate and bump only the existing Codex and Claude manifest version fields;
- implement local patch/minor/major prepare, publish, and retry behavior;
- create independent annotated tags and GitHub Releases; and
- create/advance the `beta` distribution branch only after release publication.

No plugin package or skill structure changes are permitted by this slice.

### Slice 5: publish and verify the Codex-first installation

- update the Studio Skills README with the exact current Codex marketplace,
  CLI browser, direct CLI, and ChatGPT desktop steps after Slice 4 is approved;
- update Studio installer completion copy without installing the plugin
  automatically;
- verify install and update behavior using the documentation freshness contract;
- test one new Codex CLI task and one new Codex desktop task invoking a
  representative read-only Renku skill; and
- omit Claude and the IDE extension completely from first-iteration user
  instructions.

### Slice 6: record the corrected release and distribution decision

- add a new ADR 0078 for independent repository releases and Codex marketplace
  distribution;
- add only a concise supersession notice to ADR 0077 covering its bundled
  plugin and arbitrary release identity; do not rewrite ADR 0077's history;
- update the Studio release operations guide around local release commands,
  GitHub Releases, R2 mirroring, and the separate Codex install journey; and
- keep this plan as the only completion checklist for the adoption.

## Tests And Guardrails

### Studio release ownership

- strict SemVer bump and synchronized runtime manifest tests;
- clean-main, tag/version/commit, and retry tests;
- exact-tag workflow contract tests;
- complete GitHub asset and checksum tests;
- installed product rejection of plugin/marketplace/skills content;
- regression tests for the three accepted safety fixes; and
- a stable capability guard proving Studio workflow and scripts never read or
  write another repository.

### Studio Skills release ownership

- strict SemVer and matching existing manifest version tests;
- tests proving prepare changes only the two version fields;
- clean-main, tag/version/commit, and retry tests;
- GitHub Release reuse tests;
- tests proving `beta` advances only to an existing released tag commit; and
- a tree comparison proving plugin manifests except for version,
  marketplaces, and `skills/**` are unchanged by release automation.

### Codex installation

- clean Codex CLI marketplace add and plugin install;
- marketplace visibility and plugin installation in the current ChatGPT
  desktop app;
- new-session skill discovery in both hosts;
- representative skill invocation of the installed `renku` runtime;
- empirical marketplace update behavior after a second released test version;
- missing-runtime guidance without plugin restructuring; and
- explicit absence of IDE-extension instructions and tests.

Architecture guardrails protect repository boundaries, public command shapes,
and observable release behavior. They must not freeze private helper names or
inventory every release function.

## Documentation And ADR Effects

- Leave `plans/active/0176-self-contained-beta-distribution-and-agent-installation.md`
  unchanged with its implemented status.
- Keep this file as the only new active plan for the adoption.
- Add `docs/decisions/0078-use-independent-releases-and-codex-marketplace.md`
  only after the direction is approved.
- Add a concise supersession notice to
  `docs/decisions/0077-use-self-contained-agent-first-beta-distribution.md`.
- Update `docs/operations/distribution-and-release.md` and
  `docs/architecture/project-database-distribution.md` to remove bundled-plugin
  ownership and document the Studio-only release boundary.
- Update `docs/cli/commands.md` for the released version reported by
  `renku about`.
- Update the Studio Skills README only in its own repository, after explicit
  approval and against its reviewed working tree.
- Link the exact official OpenAI pages and record the current CLI/Desktop build
  used for acceptance; do not copy volatile host behavior into architecture
  claims beyond the supported installation contract.

## Final Verification

### Read-only and local checks

```sh
pnpm build
pnpm test:cli
pnpm check
pnpm release:preflight
```

Then:

- inspect the restored plan 0176 and confirm it has no adoption edits;
- inspect the full Studio diff and confirm no bundled Studio Skills input
  remains;
- inspect the separately authorized Studio Skills diff and confirm only the
  enumerated release-tool additions and version values changed;
- run both release flows in dry-run or local prepare/recovery fixtures without
  pushing or publishing;
- build and verify the complete native Studio matrix;
- verify GitHub and R2 manifest/hash agreement from a candidate artifact set;
- fetch the current official OpenAI pages again;
- record current Codex CLI and ChatGPT desktop versions;
- validate the repository marketplace from the released `beta` ref in a clean
  environment;
- install in Codex CLI and ChatGPT desktop, start new tasks, and run one
  representative read-only Renku skill in each;
- advance a test channel to a second released test version and record actual
  update behavior; and
- inspect all new/heavily modified release files for focused ownership, thin
  entrypoints, and absence of cross-repository orchestration.

Live tags, pushes, GitHub Releases, R2 publication, the remote `beta` branch,
and immutable-release settings require separate explicit authorization after
implementation verification.

## Completion Checklist

### Review Area And Approval

- [x] Confirm plan 0176 is restored unchanged as the implemented foundation.
- [x] Approve this as the single adoption plan.
- [x] Approve independent Studio and Studio Skills versions, tags, and GitHub
      Releases.
- [x] Approve the Studio Skills `beta` branch as a released-plugin distribution
      channel rather than a release identity.
- [x] Approve the exact Studio Skills release-tool file additions.
- [x] Approve synchronized version-only updates to the existing Codex and
      Claude manifests.
- [x] Confirm no Studio Skills package or skill structure change is authorized.
- [x] Confirm Codex CLI and Codex in ChatGPT desktop are the only supported
      first-iteration hosts.
- [x] Confirm the IDE extension is a permanent non-goal.

### Preserve The Implemented Foundation

- [x] Keep the existing CLI, browser Studio, native matrix, Node selection,
      installers, R2 layout, and content scanner.
- [x] Keep the safe runtime destination behavior.
- [x] Keep pre-activation extracted-tree smoke on macOS and Windows.
- [x] Keep exact-byte immutable R2 resume behavior.
- [x] Add focused regression tests for those accepted fixes.
- [x] Do not edit plan 0176 during implementation.

### Studio Version And Release

- [x] Add one canonical Studio version and synchronized runtime manifests.
- [x] Add local patch/minor/major prepare, publish, ship, and preflight commands.
- [x] Require clean `main`, tag/version/commit agreement, and resumable publish.
- [x] Report the Studio product version through `renku about`.
- [x] Replace arbitrary workflow version input with exact-tag native builds.
- [x] Create/reuse a complete draft GitHub Release and exact assets.
- [x] Promote the exact GitHub asset bytes to R2.
- [x] Publish only after native, GitHub, and R2 verification.
- [x] Make local cross-target build and publication the default release path.
- [x] Upgrade to better-sqlite3 13.0.2 through Socket Firewall.
- [x] Remove `prebuild-install` and disable better-sqlite3's unnecessary
      implicit `node-gyp` fallback.
- [x] Build all three bundled-Node 24 targets locally.
- [x] Runtime verify `darwin-arm64` and structurally verify `darwin-x64` and
      `win32-x64`.
- [x] Record each target's verification level in release evidence.
- [x] Publish only declared local targets and their applicable installers.
- [x] Keep the full-matrix Actions workflow behind explicit `release:dispatch`.

### Studio-Only Product Boundary

- [x] Remove the Studio Skills checkout from Studio CI.
- [x] Remove Studio Skills inputs from assembly.
- [x] Remove plugin copying and version rewriting.
- [x] Remove `plugin/` from the Studio archive and verifier.
- [x] Remove bundled-plugin claims from installers and Studio docs.
- [x] Prove Studio release code never writes or triggers Studio Skills.

### Studio Skills Version And Release

- [x] Obtain explicit approval before editing the Studio Skills repository.
- [x] Begin from its separately reviewed clean working tree.
- [x] Add only the approved operator package aliases and release modules.
- [x] Keep `.agents/plugins/marketplace.json` unchanged.
- [x] Keep `.claude-plugin/marketplace.json` unchanged.
- [x] Keep every existing plugin manifest field except `version` unchanged.
- [x] Keep `skills/**` unchanged by release work.
- [x] Add independent patch/minor/major prepare, publish, and retry behavior.
- [x] Create independent annotated tags and GitHub Releases.
- [x] Advance `beta` only after the corresponding release exists.
- [x] Prove Studio Skills release code never writes or triggers Studio.

### Codex CLI And Desktop Installation

- [x] Fetch the current official OpenAI plugin pages on the verification date.
- [x] Record the current Codex CLI and ChatGPT desktop builds.
- [ ] Verify `codex plugin marketplace add GoRenku/studio-skills --ref beta`.
- [x] Verify Renku appears under the `renku` marketplace using the currently
      available `main` ref in an isolated Codex profile.
- [ ] Verify installation through `/plugins` in Codex CLI.
- [x] Verify the current direct `codex plugin add renku@renku` command using the
      currently available `main` ref in an isolated Codex profile.
- [ ] Verify installation through the ChatGPT desktop Plugins tab from Codex.
- [ ] Start a new task/session in both hosts and discover Renku skills.
- [ ] Run one read-only skill that invokes the installed `renku` executable in
      both hosts.
- [ ] Empirically document current marketplace/plugin update behavior.
- [x] Confirm no user installation instruction or acceptance test provides an
      IDE-extension path.
- [x] Confirm the runtime installer does not silently modify Codex state.

### Documentation And Decisions

- [x] Add ADR 0078 only after approval.
- [x] Add only a supersession notice to ADR 0077.
- [x] Update Studio release operations and project-distribution documentation.
- [x] Update `renku about` documentation.
- [x] Update Studio Skills README only after explicit repository approval.
- [x] Keep release-process detail separate from the ordered end-user install
      instructions.
- [x] Keep this file as the only adoption completion checklist.

### Tests And Guardrails

- [x] Run focused Studio release-contract and publisher tests.
- [x] Run focused Studio Skills release tests after approval.
- [x] Run installed-tree and macOS arm64 bundled-Node 24 acceptance.
- [x] Produce structurally verified Intel Mac and Windows alpha archives.
- [ ] Run clean Codex CLI and ChatGPT desktop installation acceptance.
- [x] Prove neither repository release can mutate the other.
- [x] Prove Studio Skills release automation cannot change package structure or
      skill contents.
- [ ] Prove unreleased `main` commits are not served by the documented beta
      channel.

### Final Architecture-Shape Verification

- [x] Inspect `git diff --stat` and the complete diff in both repositories.
- [x] Inspect every new or heavily modified release module and workflow job.
- [x] Confirm `index.ts` files and ship entrypoints remain thin.
- [x] Confirm no release god file, broad dispatcher, compatibility wrapper, or
      cross-repository orchestrator was added.
- [x] Confirm no checklist item was satisfied by changing Studio Skills beyond
      the explicitly approved release metadata/tooling surface.
- [x] Confirm no live tag, release, branch, R2 object, or GitHub setting was
      changed without explicit authorization.
- [ ] Only then mark this adoption plan complete.

## Exit Criteria

The adoption is complete when Studio and Studio Skills can each be released
locally and independently with their own version, tag, and GitHub Release; the
Studio archive contains only the runtime; the Studio Skills beta channel points
only to a released plugin commit; and a clean current Codex CLI and Codex task
in the ChatGPT desktop app can install Renku, start a new session, discover its
existing unchanged skills, and invoke the separately installed `renku` CLI.
