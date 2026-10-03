# Install Codex Plugin And Route Generation Review

Date: 2026-10-03

Status: accepted

Renku platform installation and both update paths retain the general cross-agent
skills picker and additionally install the Codex plugin with the user's existing
Codex CLI profile. The plugin supplies the existing MCP generation review UI.
The installer uses public marketplace add/upgrade, plugin add and plugin list
commands. It verifies installed and enabled state, preserves conflicting
marketplace sources and disabled plugins, and reports failures independently of
general skills installation. Missing or unsupported Codex CLI skips the plugin;
Renku does not install Codex CLI.

Core owns `codex-plugin.json` beside the platform Renku config, containing the
boolean `codexPluginInstalled`. Missing state means false. Atomic writes and
invalid-state errors use `CONFIG017`. Recording installation requires no Project
Library. Generation context exposes `workflowPolicy.codexPluginInstalled`.

The existing global `codexGenerationReview` preference accepts `auto` (default),
`panel` and `visualize`. In trusted Codex Desktop, `auto` and `panel` probe the
current Renku MCP connection when available. Advertised Codex panel support
selects the panel even when `codexPluginInstalled` is false. The flag records
installer verification, not current connection availability: development and
manual connections do not require an installer run or a fabricated state file.
Without a probe or installation record, Desktop uses Visualize, including for
a saved panel preference. Explicit Visualize remains authoritative. Other
harnesses always use Preview with conversation. The canonical Media Producer
guide owns routing; core projects the flag and preferences without guessing
its caller's host.

An unavailable or failed connection probe, a missing probe with installation
recorded, or a failed panel handshake stops that workflow without automatically
opening another review. Project Preview policy, provider selection, spending
approval and exact Submit
consumption retain their existing behavior. No Settings surface or public CLI
command is added.

Publish the complete sister plugin, with matching manifest versions and its beta
branch, before shipping the compatible runtime installer. Native Mac and Windows
Desktop acceptance remains a release requirement.

This decision updates [ADR 0101](0101-install-agent-skills-from-platform-installers.md)
and [ADR 0105](0105-select-generation-review-by-preference-and-host-capability.md).
