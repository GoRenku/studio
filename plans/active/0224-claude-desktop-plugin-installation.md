# 0224 Claude Desktop Plugin Installation

Status: implemented and verified in native Code; Desktop UI release check pending
Date: 2026-10-07

## Summary

When Renku setup detects a regular native Claude Desktop installation on macOS
or Windows, install the existing Renku Claude plugin at user scope and exclude
Claude from standalone skill installation. Keep the existing Codex plugin flow
and the general skills picker for other harnesses. Apply the same behavior to
initial installation, runtime updates, and skills-only updates.

The ordinary journey remains one installer: install Renku, prepare its existing
Git tooling, install supported Desktop plugins, choose any additional harnesses
in the existing picker, and start a new local Code session.

## Review Attention

Approved revision: Renku owns a stable Git checkout at
`<install-root>/plugins/claude/renku` on both platforms. Claude registers that
directory through its public marketplace command. Installation and both update
paths refresh the checkout before installing/updating the plugin. This replaces
Claude-managed Git downloads, whose Windows cache finalization fails. No new
user settings or manual setup steps are introduced. Removing Renku must account
for this persistent directory after uninstalling the Claude plugin.

Architecture amendment: add `distribution/claude-desktop/checkout.mjs`, exporting
`prepareClaudeMarketplaceCheckout`. It owns Git clone, origin/root/clean-state
checks, and fast-forward updates. `plugin.mjs` remains the command orchestrator,
accepts `marketplaceDirectory`, and its executable entrypoint takes that absolute
directory as its sole positional argument. Both platform scripts pass the path
under their existing installation root. Existing files, local edits, unexpected
origins, and divergent commits are preserved and reported through `INSTALL013`;
no reset, deletion, automatic marketplace replacement, or Claude config edits.
Stop if the change needs Core state or a second host integration framework.

Verification for the revision includes the exact public-repository installation
on both native hosts and a temporary Git fixture that advances the plugin from
one version to another, verifying the new version and commands in a fresh Code
process. All acceptance profiles and checkouts remain temporary.

Implementation approved on 2026-10-07, including the dependency patch. The user
subsequently restricted native validation to temporary profiles. Do not install
the test plugin permanently in either real Claude profile.

- Claude Desktop detection automatically selects plugin installation. With
  Desktop absent, the existing Claude Code choice in the skills picker remains.
- Keeping the picker while reliably excluding Claude requires a small maintained
  patch to the pinned `skills` dependency: it has no agent-exclusion option today.
  This approved extension is maintained by Renku, not an upstream feature.
- Claude's bundled CLI is cached outside its application bundle. Enumerate the
  installed cache and select the newest compatible runtime; do not hard-code a
  version or hash or claim this identifies Desktop's active runtime. This is a
  tested application-layout integration, not a documented discovery API.
- If Desktop is detected but plugin setup fails, report an incomplete Claude
  setup, continue other harnesses, and return failure afterward. Do not silently
  install loose Claude skills as a substitute.
- No new Settings, Renku CLI commands, Core flags, database changes, or config
  moves. Codex installation, reconciliation, and generation-review routing stay.
- Existing loose skill files are not deleted or disabled by this change. Existing
  installations may therefore retain both loose and plugin skills; removing those
  files is a separate explicitly approved maintenance action, not installer logic.
- Supported baseline: native Desktop Code on macOS/Windows. WSL and Cowork are
  outside the requested support scope. Native Desktop loading must pass on both
  platforms before release; discovery and command help alone are not acceptance.

### Implementation verification (2026-10-07)

- Mac: the revised production flow cloned the public repository into a temporary
  installation, installed and updated its directory marketplace, and loaded all
  20 Renku commands through Desktop's cached CLI 2.1.289. A separate Git fixture
  advanced from plugin 0.1.0 to 0.2.0; setup verified the new installed version,
  and a fresh Code process exposed the newly added command.
- KeremPC: final production modules passed all five checkout tests and both
  native tests using cached CLI 2.1.289. Public Renku installed and loaded all 20
  commands. The fixture advanced from 0.1.0 to 0.2.0 and exposed its new command.
  PowerShell parsing and all three setup-result branches passed, including the
  stable installation-root argument, exclusion, continued Codex reconciliation,
  and PATH restoration. No permanent installation was performed.
- Checkout tests cover real Git updates and preservation of existing files,
  dirty worktrees, unexpected origins, and local commits. Installer integration
  covers the stable checkout argument, exclusion, independent harness setup,
  and existing Codex reconciliation.
- Desktop UI interaction and agent-driven `renku about` are separate from native
  Code initialization and remain unverified. No real Claude profile is modified.
- `pnpm check` passed, including the final release suite: 170 passed, five opt-in
  tests skipped. Both Claude opt-in tests were run separately and passed on Mac
  and Windows. Diff review confirmed focused distribution ownership and no Codex
  implementation, Project data, or unrelated formatting changes.

The reason for the local checkout is the Windows Git-marketplace finalization
failure reproduced with Claude Code 2.1.289 and 2.1.288, including outside the
sandbox. A temporary local-directory diagnostic succeeded on KeremPC before this
revision was approved. [Claude Code issue 12174](https://github.com/anthropics/claude-code/issues/12174)
reports the matching `EPERM` rename symptom. Its underlying file-lock cause on
KeremPC remains unproven; no security setting or Claude cache repair is needed
for this implementation.

## Requirements And Context

| Requirement | Source | Owner / acceptance |
| --- | --- | --- |
| Detect native Claude Desktop and install its plugin | User request | Distribution discovery and plugin command runner; native Mac/Windows acceptance |
| Do not also install loose Claude skills when Desktop is detected | User request | Existing skills picker with a bounded exclusion patch |
| Preserve skills for other selected harnesses | User request; ADR 0101 | Picker choices, confirmation and copy installation remain |
| Preserve working Codex behavior | User request; ADR 0106 | Existing modules remain unchanged; regression suite |
| Use public Claude plugin commands and respect existing user choices | Documented host contract; current installer precedent | Claude owns marketplace, plugin and settings mutations |
| All update entrypoints use the same behavior | Existing distribution contract | Shared setup blocks in both platform scripts |

Relevant sources: `docs/operations/distribution-and-release.md`, ADRs 0101 and
0106, `docs/architecture/coding-practices.md`, `AGENTS.md`, and the implemented
plan 0221. Plan 0221 contains older command examples; current code and ADR 0106
are the implementation baseline. Plan 0223's native release-verification
requirements remain applicable. No populated Project data changes are needed.

### Current implementation evidence

- `distribution/install.sh` and `install.ps1` call `install-codex-plugin.mjs`,
  run bundled `skills add GoRenku/studio-skills --global --skill '*' --copy`,
  then call `reconcile-codex-skills.mjs`, even after picker cancellation/failure.
- `codex-cli.mjs` owns executable discovery and invocation. Codex setup uses
  public commands, checks marketplace source and enabled state, and records a
  Core flag because generation-review routing consumes it. Claude needs no such
  flag: this proposal has no runtime consumer for installation state.
- Codex reconciliation uses Codex's own skill inventory/config API; it does not
  delete shared files. Do not copy that protocol or assume Claude has it.
- Bundled `skills@1.5.26` offers explicit `--agent` selection but no exclusion
  option. Its picker and automatic target selection both need to respect an
  exclusion. Passing every other agent explicitly would bypass user selection.
- `studio-skills/.claude-plugin/{plugin,marketplace}.json` already publish
  `renku@renku`, with the plugin sourced from the repository root and its skills
  in `skills/`. No new plugin format is needed.
- KeremPC: registered Desktop 2.26454.0; native cached CLI 2.1.289 supports
  plugin list, marketplace list and update JSON output. Twenty loose Renku
  skills exist on Windows. Real plugin installation/Desktop loading has not
  been verified in this investigation.
- Local Mac: application identity `com.anthropic.claudefordesktop`; cached
  native CLI 2.1.289 exists and its help confirms list/update options.

Official references, checked 2026-10-07:

- [Plugin installation and shared user scope](https://code.claude.com/docs/en/discover-plugins).
- [Plugin command reference](https://code.claude.com/docs/en/plugins/cli-reference).
- [Desktop local skills and plugins](https://code.claude.com/docs/en/desktop).

These document command behavior and shared local configuration, not a stable
Desktop executable-discovery API. User-scope installation is shared with native
CLI sessions using the same Claude profile.

### Smallest implementation choice

Reusing the current command unchanged cannot guarantee exclusion. Replacing the
picker would introduce a second harness catalog and selection UI. Recommend
extending the pinned picker with one exclusion option and adding a focused
Claude distribution module. Do not generalize the existing Codex modules into a
multi-harness framework for this change.

## Behavior And Commands

1. Retain existing runtime/Git preparation and Codex plugin setup.
2. Detect Claude Desktop. If absent, skip its plugin step and run the existing
   picker without a Claude exclusion, preserving CLI-only installations.
3. If present, resolve one compatible native Claude CLI and inspect the existing
   plugin and marketplace inventories in the inherited user profile.
4. Prepare `<install-root>/plugins/claude/renku` from the public Git repository.
   Clone when absent; otherwise verify its origin and clean state, fetch the
   remote default branch, and fast-forward. Preserve/report existing files or
   local commits. Register that directory when `renku` is absent; require the
   same local path when it is already registered. Preserve/report a conflicting
   source or explicitly disabled plugin rather than replacing user choices.
5. Install when missing at user scope; update when already installed there.
   Verify `renku@renku` at user scope, enabled, and at the checkout manifest
   version after the command completes.
6. Run the picker with Claude excluded whenever Desktop was detected, including
   plugin failure. Other harnesses retain their normal choices and confirmation.
7. Run existing Codex reconciliation regardless of the preceding results. Report
   Claude failure after independent setup work, leaving the installed runtime
   usable. A successful rerun retries Claude and updates the plugin.

Use the documented commands with the resolved executable:

```text
claude plugin list --json
claude plugin marketplace list --json
claude plugin marketplace add <install-root>/plugins/claude/renku
claude plugin marketplace update renku
claude plugin install renku@renku --scope user --json
claude plugin update renku@renku --scope user --json
claude plugin list --json
```

Add/update and install/update are alternatives based on observed state, not an
unconditional sequence. Validate exit status; parse mutation JSON from its last
stdout line as documented. Use the CLI's returned inventory shape, not Codex's
JSON shape. No automatic restart or authentication changes. Success copy asks
the user to start a new local Desktop Code session.

## Architecture Shape Gate

All new behavior belongs to `distribution/`; it manages installation of external
applications' plugins, not Studio Project metadata. Public Renku commands,
Core services, Studio server/UI, and provider engines do not change.

```text
distribution/claude-desktop/
  discovery.mjs  # Desktop identity, cached CLI selection, capability checks
  checkout.mjs   # public prepareClaudeMarketplaceCheckout; Git checkout/update
  plugin.mjs     # public installClaudeDesktopPlugin; plugin command orchestration
patches/skills@1.5.26.patch
scripts/release/claude-desktop.test.mjs
scripts/release/claude-checkout.test.mjs
scripts/release/fixtures/claude-marketplace.mjs
scripts/release/skills-agent-exclusion.test.mjs
scripts/release/claude-desktop-native.test.mjs
```

`plugin.mjs` is also the executable setup entrypoint. Its process exit contract:
0 = detected and verified; 2 = Desktop absent; 1 = detected/setup failed. Both
platform scripts interpret these explicitly (not as an unguarded shell failure),
add the picker exclusion for 0 or 1, and retain a failure for final reporting.
No result file or persistent Renku installation flag is added.

`discovery.mjs` exports `findClaudeDesktopCli`, returning absence or a selected
executable; detected-but-unusable is an `INSTALL013` error. A two-platform
dispatch table is sufficient. Keep platform discovery functions separate from
plugin mutations. Pin the selected executable for the whole attempt; command
failure does not trigger another executable or installation mode.

Detection baseline:

- macOS: inspect `/Applications` and `~/Applications` bundles by
  `CFBundleIdentifier`, matching `com.anthropic.claudefordesktop`.
- Windows: current-user uninstall registration
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\AnthropicClaude`,
  observed `DisplayName=Claude`, `Publisher=Anthropic PBC`, and `InstallLocation`.
  Verify its native launcher exists. This is the regular installer baseline
  observed on KeremPC; do not infer Desktop presence from `.claude` alone.
- Select the newest compatible installed native cache candidate by numeric
  version, with a stable path order for equal versions. Enumerate actual paths:
  Mac `~/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude`;
  Windows `%APPDATA%\Claude\claude-code\<version>\<hash>\claude.exe`.
  Verify the executable's version and required command help before mutation.
  This selects a usable plugin-management CLI, not Desktop's active session CLI.
- When the app exists but its Code runtime is unavailable, report opening the
  Code tab/updating Desktop and rerunning setup. Do not install Claude separately.

Keep inherited profile/environment including `CLAUDE_CONFIG_DIR`. Reuse the
established Unicode-safe PowerShell invocation approach without extracting or
rewriting Codex discovery. Emit `INSTALL013` with an actionable operation/path
for Claude setup failures. No generic host registry, broad shell abstraction,
new `index.ts`, source-name architecture tests, or direct Claude settings/cache
writes. Stop and revise if runtime discovery cannot be verified on native hosts.

## Picker Extension

Maintain one normal pnpm dependency patch for pinned `skills@1.5.26`, declared in
`pnpm-workspace.yaml` with the generated lockfile change. Proposed added option:
`--exclude-agent <agents...>`. It is a Renku-maintained patch, not an existing
upstream contract. No dependency version upgrade or replacement picker.

Apply exclusions to available choices, saved preselection, automatic detection,
wildcard/explicit target selection, and the final installation target list. Do
not allow an empty filtered selection to mean “install everywhere.” All-excluded
targets produce a clear no-target result with no copies; unknown exclusion names
fail clearly. With the option absent, preserve existing behavior. Claude is the
only exclusion supplied by Renku, and only when Desktop was detected. Do not
change Codex selection or shared `.agents/skills` handling.

Use the package's own target catalog and prompts; do not duplicate that catalog
in Renku. Preserve interactive confirmation and cancellation. Verify the patched
artifact actually survives `pnpm deploy` on both release layouts. Applying the
dependency patch/lockfile during implementation needs dependency-management
authorization under repository rules; no package-manager operation is performed
as part of this proposal.

## Implementation Slices

1. Add the two Claude modules and focused discovery/command tests. Capture real
   inventory JSON fixtures using read-only commands. Validate the public plugin
   manifests; no skill-content or runtime workflow changes.
2. Add the bounded picker patch and behavior tests. Integrate Claude's result
   and exclusion into existing setup blocks in `install.sh` and `install.ps1`.
   Preserve TTY handling, private Node/Git, and Codex reconciliation ordering.
3. Include the new distribution directory in `assemble-product.mjs`; extend
   `verify-product.mjs` and installer fixtures to require runnable modules and
   the deployed exclusion feature. Both existing update paths reuse these scripts.
4. Run native acceptance and update installation documentation. Leave the old
   loose files untouched; report that fact in this iteration's release notes.

## Tests And Final Verification

Owning distribution tests cover absence, Desktop without initialized Code,
multiple cached versions, incompatible command help, Unicode/space paths,
source conflict, disabled plugin, command/network failure, user-scope install,
repeat update, and failed post-install verification. Avoid duplicating all cases
in shell integration tests. Test the picker against a local fixture repository:
Claude excluded while another selected harness receives files, prior selection,
automatic single-agent selection, cancellation, and option-absent behavior.

Representative platform integration checks cover success and partial Claude
failure while other harnesses and existing Codex reconciliation still run.
Run `pnpm test:release` and `pnpm check`; inspect `git diff --stat`, full diff,
new/heavily modified modules, and the deployed dependency. Keep index entrypoints
thin and do not accept broad dispatch or format-only churn.

Native automated acceptance on macOS and KeremPC must prove public-repository
checkout, directory marketplace installation, repeat update, enabled user scope,
and `/renku:movie-director` in a fresh native Code process. A separate Git fixture
must advance the plugin version and prove a new command loads after update.
Desktop UI interaction and an agent-driven `renku about` remain a separate manual
release check; do not claim these from runtime initialization alone. Test
without a standalone Claude executable on PATH. Installation-list success or
cached SKILL.md presence alone is not Desktop acceptance. Do not modify a real
movie Project or run media generation. Tests that change a real host profile
must use the user's authorized test scope.

## Documentation

Update `docs/operations/distribution-and-release.md`, website download/setup and
uninstall guidance, and sister `studio-skills/README.md` (preserve its unrelated
working-tree edit). After acceptance add ADR
`0109-install-claude-desktop-plugin.md`, with a short supersession notice in ADR
0101 for Claude Desktop only. ADR 0110 records the approved managed-checkout
revision with a notice in ADR 0109. ADR 0106 and its Codex contract stay unchanged.
Document the tested Desktop discovery layouts honestly and the plugin-first
Claude journey. Do not edit historical plans to revise their original examples.

## Completion Checklist

### Review And Architecture

- [x] Approve the picker dependency patch and newest-compatible cached CLI choice.
- [x] Confirm native Desktop baseline, no new Core state or user Settings.
- [x] Keep Codex modules, flags, reconciliation and routing unchanged.
- [x] Preserve existing loose files; obtain separate approval for any cleanup.

### Implementation And Contracts

- [x] Implement Mac/Windows Desktop detection and CLI selection with `INSTALL013`.
- [x] Install/update through Claude commands; preserve disabled/conflicting state.
- [x] Verify user scope and enabled state; surface failed setup without loose fallback.
- [x] Add exclusion patch with unchanged option-absent behavior.
- [x] Exclude Claude for detected Desktop, including plugin failure; preserve all other choices.
- [x] Integrate both scripts, TTY handling, and failure aggregation with Codex reconciliation.
- [x] Cover initial, runtime-update and skills-only-update paths.
- [x] Package the new modules and verify deployed picker patch support.

### Managed Checkout Revision

- [x] Use a stable installation-root checkout on both platforms and all update paths.
- [x] Preserve existing files, local edits/commits, and unexpected origins.
- [x] Use documented directory marketplace commands and verify installed version.
- [x] Package the checkout module and document update/uninstall responsibilities.
- [x] Pass public-repository installation and real version advancement on both hosts.

### Validation

- [x] Run discovery and plugin state/command tests at their owner.
- [x] Run picker fixtures proving exclusions, other-harness copies and cancellation.
- [x] Run representative shell integration and existing Codex regression tests.
- [x] Complete real public-repository directory marketplace install/update acceptance on Mac and Windows.
- [ ] Verify plugin command visibility and `renku about` in native local Desktop sessions.
- [x] Run `pnpm test:release` and `pnpm check`.

### Documentation And Final Shape

- [x] Update operations, website setup/uninstall guidance and sister README.
- [x] Add accepted ADR and narrow notice in ADR 0101 after approval.
- [x] Review complete diff and large modules; retain focused ownership and thin entrypoints.
- [x] Confirm no unrelated formatting, Project changes, or unapproved skill deletions.
- [ ] Mark complete only after native acceptance and all required checks pass.
