# 0110: Manage the Claude Marketplace Checkout

Date: 2026-10-07

Status: accepted

Renku clones `https://github.com/GoRenku/studio-skills.git` into
`<install-root>/plugins/claude/renku` and registers that directory through Claude's
documented local-marketplace command. Use this flow on both macOS and Windows.
The stable checkout survives Renku runtime version changes. Claude continues
to own plugin installation, caching, settings, and enabled state.

This replaces Claude-managed Git marketplace downloads, which failed on KeremPC
with `EPERM` during directory finalization. The local-directory route passed
the initial native diagnostic and was explicitly approved for implementation.
It is the normal installation route, not a retry branch or cache repair.

Initial installation, `renku update`, and `renku update skills` prepare the same
checkout. Existing checkouts must have the expected origin and no local changes
or commits outside the remote default-branch history. Fetch and fast-forward;
never reset or delete existing work. Fail through `INSTALL013` if these checks
or the Git commands fail. Do not replace a differently configured Claude
marketplace automatically.

`distribution/claude-desktop/checkout.mjs` owns checkout preparation. The plugin
orchestrator registers/refreshes that directory and installs/updates the plugin,
then verifies enabled user scope and the checked-out manifest version. The
platform installers supply the path under their existing installation roots.
No Core state, user flags, dependency installation, or additional UI is needed.

Plugin releases must update the plugin manifest version when content changes.
Renku refreshes the local source during its setup/update commands; Claude cannot
independently fetch new GitHub content from a directory marketplace. Uninstall
the Claude plugin before removing its Renku-managed checkout. Existing loose
skills, other harness selection, and Codex behavior retain ADR 0109's contract.

Validate in temporary profiles on Mac and Windows, including the real public
repository and an actual fixture version advancement with new command loading.
Do not equate native Code initialization with Desktop UI interaction.

References: [local marketplace commands](https://code.claude.com/docs/en/plugins/cli-reference#plugin-marketplace-add),
[upstream Windows issue](https://github.com/anthropics/claude-code/issues/12174),
and [plan 0224](../../plans/active/0224-claude-desktop-plugin-installation.md).
