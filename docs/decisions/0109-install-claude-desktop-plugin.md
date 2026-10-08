# 0109: Install the Claude Desktop Plugin

Installer scope updated by [ADR 0111](0111-plugin-only-agent-installation.md): automatic Claude/Codex plugins; other harnesses use separate instructions.

Date: 2026-10-07

Status: accepted

Updated by [ADR 0110](0110-manage-claude-marketplace-checkout.md): Renku manages
the Git checkout and registers it as a local marketplace on both platforms,
avoiding Claude's failing Windows Git-marketplace finalization.

Native macOS and Windows Claude Desktop installations receive `renku@renku`
through Claude's public user-scope plugin commands. The installer discovers a
compatible Code CLI in Desktop's versioned cache; no standalone CLI or PATH
change is required. The newest compatible cache is selected, without claiming
it is the runtime of an already-open Desktop session.

Detection and plugin command orchestration belong to focused distribution
modules. No Core state or new Renku settings are needed. Install and both update
paths share this behavior. Disabled plugins and conflicting marketplace sources
are preserved and reported as `INSTALL013`. Other harness setup and Codex
reconciliation run before returning a Claude setup failure.

When Desktop is detected, exclude `claude-code` from loose skill installation,
including when plugin setup fails. A bounded pnpm patch to `skills@1.5.26` adds
the exclusion option while retaining its existing picker. With Desktop absent,
Claude Code remains an ordinary choice. Existing loose skill files are retained.
Codex's accepted installation and reconciliation contracts are unchanged.

Discovery uses observed Desktop layouts, which may change in future versions.
Missing/incompatible caches fail clearly and advise opening Code or updating
Desktop. This iteration supports native local Code; WSL and Cowork are outside
scope. Verification uses temporary Claude profiles, never permanent test
installations. Fresh cached-Code command loading and Desktop UI acceptance are
reported separately.

References: [Claude plugin CLI](https://code.claude.com/docs/en/plugins/cli-reference),
[shared local plugins](https://code.claude.com/docs/en/discover-plugins),
and [plan 0224](../../plans/active/0224-claude-desktop-plugin-installation.md).
