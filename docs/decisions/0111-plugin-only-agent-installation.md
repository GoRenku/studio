# 0111 Plugin-only agent installation

Date: 2026-10-08
Status: accepted

Renku installers and `renku update skills` install only the Claude and Codex
plugins. Other harnesses use the separate website guide at `/agent-skills/`.
Users of those harnesses choose an explicit agent and project/global scope using
the upstream skills tool independently of Renku.

Remove the bundled skills dependency, its maintained patch, the agent picker,
and standalone-skill reconciliation. Existing user files and enabled/disabled
settings remain unchanged. This reduces installer dependencies and prevents
unrelated harness-selection failures from obscuring successful plugin setup.

Claude discovery selects one compatible terminal CLI from PATH or the native
user launcher, otherwise Desktop's cached CLI. Both install once into the
inherited user profile using ADR 0110's managed directory marketplace. Preserve
conflicting sources and disabled-plugin choices. Renku does not install Claude
or Codex themselves. Codex's plugin installation and core installation record
remain unchanged. The release handoff continues to run the activated release's
plugin setup. Terms and required Git setup retain their existing behavior.

This supersedes ADR 0101's bundled generic installer and ADR 0106's standalone
skill reconciliation, and extends ADR 0109 to standalone Claude Code.

Release transition: shipped installers that require the generic skills executable
during archive validation cannot update to this package through Studio. Use the
fresh website installer for that transition. Subsequent updates use the new
validation and handoff; no compatibility executable is retained.

References: [Claude setup](https://code.claude.com/docs/en/setup),
[upstream skills tool](https://github.com/vercel-labs/skills), and
[implementation plan](../../plans/active/0225-plugin-only-agent-installation.md).
