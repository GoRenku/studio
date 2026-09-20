# 0101: Install Agent Skills From Platform Installers

Date: 2026-09-20

Status: accepted

## Decision

The macOS and Windows bootstrap installers install Renku, prepare the tools
needed for agent skills, and launch the cross-agent `skills` installer. Users
choose their agents interactively in a local terminal. The download page has
one setup flow and does not require users to install Node, Git, or Codex CLI
separately.

Reuse the official Node/npm distribution already bundled with Renku. Keep that
runtime private and expose only the existing Renku launcher. Reuse working Git
when present. On Windows, download a pinned, SHA-256-verified official MinGit
archive into Renku's private tools directory when needed. On macOS, initiate
Apple Command Line Tools installation and let the user complete its system
dialog before verifying Git again.

The skills command installs all skills from `GoRenku/studio-skills` at user
scope using copy mode. It reads the default branch and retains interactive
agent selection. Runtime and skills repositories and releases remain
independent; the runtime archive still does not bundle skills. Existing
marketplace distribution remains available separately.

## Consequences

Setup needs a local interactive terminal and network access to the runtime,
npm, and GitHub downloads. A skills failure leaves the activated runtime
available and reports a retry instruction. macOS may require user interaction
with Apple's installer; Windows private Git setup does not require admin access.
Neither platform replaces system Node or changes global Git configuration.

This supersedes ADR 0078's user-installation sequence, not its release ownership
or artifact verification rules. Installer updates use the existing runtime
release process. Publish the new bootstrap scripts before the updated website
instructions.
