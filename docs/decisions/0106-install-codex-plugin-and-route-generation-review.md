# Install Codex Plugin And Route Generation Review

Date: 2026-10-03

Status: accepted

Renku platform installation and both update paths retain the general cross-agent
skills picker and additionally install the Codex plugin with the user's existing
Codex CLI profile. The plugin supplies the existing MCP generation review UI.
The installer uses public marketplace add/upgrade, plugin add and plugin list
commands. It verifies installed and enabled state, preserves conflicting
marketplace sources and disabled plugins, and reports failures independently of
general skills installation. The general skills picker runs after the plugin
attempt regardless of its result.

After the general skills installer exits, including a partial failure or
cancellation, `distribution/reconcile-codex-skills.mjs` reconciles Codex skill
enablement. It verifies that `renku@renku` is installed and enabled and that the
`renku` marketplace still uses the official Git source. It then uses Codex's
`skills/list` inventory and the skills installer's source records to identify
standalone Renku skills that duplicate enabled plugin skills. Plugin identity
and the `renku:` namespace distinguish the plugin's copies from standalone
copies; matching is not based on skill descriptions or creative contents.

Reconciliation is limited to installer-recorded `GoRenku/studio-skills` entries
in the global `~/.agents/skills` and configured Codex home `skills` directories.
It respects `CODEX_HOME` and the skills installer's `XDG_STATE_HOME` lock-file
location. Repository-scoped, unrelated, untracked, already-disabled, and
plugin-owned skills are not changed. If there is no usable official plugin,
standalone skill enablement is left unchanged. Reconciliation does not
automatically re-enable skills when a plugin is later removed or disabled.

For each enabled duplicate, the installer calls Codex's `skills/config/write`
with the exact resolved `SKILL.md` path and `enabled: false`, then reloads the
inventory to verify the standalone exclusion and continued plugin enablement.
`distribution/codex-app-server.mjs` owns the bounded stdio protocol session;
Codex owns its configuration writes. Skill files, shared directories, and other
harness configuration are never removed or edited by reconciliation. The
general picker is retained even when Codex is present, so other harnesses keep
receiving their standalone copies. Subsequent installer runs repeat the
reconciliation without duplicating exclusions. Failures report `INSTALL012`
after general skills setup; installed files remain available for retry. The
core plugin-installation flag continues to describe plugin installation only.

The installer first selects a compatible CLI on PATH. If it is absent or lacks
the required plugin commands or flags, it discovers Codex Desktop's bundled CLI:

- macOS: inspect application bundles in `/Applications` and `~/Applications` for
  bundle identity `com.openai.codex`, then use
  `Contents/Resources/codex-cli/bin/codex` within that bundle. Application display
  names are not used for identification.
- Windows: query the current user's registered `OpenAI.Codex` package through
  built-in Windows PowerShell, then use `app\resources\codex.exe` within its
  `InstallLocation`. Do not guess versioned or hashed extraction directories.

Discovery and command invocation belong to `distribution/codex-cli.mjs`; plugin
installation orchestration remains in `distribution/install-codex-plugin.mjs`.
These modules and the reconciliation modules are included and checked in release
packaging. Capability checks use
command help before plugin mutations. The selected executable is retained for
the entire attempt; runtime, network, and configuration failures do not trigger
another executable selection. Windows npm `.cmd` launchers remain supported.
The inherited user environment, including `CODEX_HOME`, is preserved. Renku
does not write Codex's plugin cache directly, modify PATH for Codex, or install
Codex. Missing or unsupported CLI and Desktop installations skip the plugin.
Discovery and execution errors are reported independently of the skills picker.

The bundled executable layouts are verified application implementation details,
not a documented discovery API. Native platform verification is required when
those layouts change. Linux Desktop discovery and Linux platform releases are
outside this iteration.

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
