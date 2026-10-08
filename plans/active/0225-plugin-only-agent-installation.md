# 0225 Plugin-only agent installation

Status: implemented; native Windows verification pending
Date: 2026-10-08

## Summary and Review Attention

Implement the user's accepted simplification: automatic Claude/Codex plugins,
with separate website instructions for other agents. Remove the bundled skills
dependency, patch, picker, and standalone-skill reconciliation. Existing user
skill files and configuration remain untouched. Keep `renku update skills` and
the installed-release setup handoff. No publication is authorized.

Release prerequisite discovered during implementation: older shipped installers
require the skills executable during archive validation, before the handoff.
Transition using the freshly published website installer; no dummy executable
or compatibility layer is added. Future updates use the corrected validation.

Claude CLI-only support is included in the accepted scope. Prefer a compatible
terminal CLI, otherwise use Desktop's cached runtime; install once into the
inherited user profile. No new flags, Settings, or stored state. Retain INSTALL013
for Claude failures and Codex's current installation behavior. Git preparation
remains necessary for plugin marketplaces, but agent-selection prompts disappear.

## Context and Requirements

- User approval in this chat supersedes the generic installer in ADR 0101 and
  narrows the standalone-skill handling in ADR 0106.
- ADRs 0109/0110 constrain Claude plugin identity and the managed local checkout.
- Distribution scripts own installation; core's update command remains unchanged.
- Website users of other harnesses need explicit project/global installation
  instructions with a link to upstream documentation.

## Architecture Shape Gate and Contracts

Extend existing distribution owners, not Studio/core domain logic. Rename
`distribution/claude-desktop/` to `distribution/claude/`; discovery selects one
CLI, checkout manages Git, plugin orchestrates documented plugin commands.
`command.mjs` owns invocation of native executables and Windows command launchers.
No generic integration registry, new dispatcher, or index module is needed.
Both platform installers retain short plugin-setup functions and release handoff.
Remove `reconcile-codex-skills.mjs`; move app-server test support out of shipped
distribution. Packaging validates only runtime/plugin requirements.
Stop if this requires application-state changes or another agent-selection flow.

## Implementation Slices

1. Remove dependency/patch, picker, reconciliation, and their obsolete tests.
   Update lockfile and release packaging/verification.
2. Extend Claude discovery for native CLI installations and retain Desktop;
   update script callers and progress text, keeping one installation per profile.
3. Add `/agent-skills/` website guide and link from download. Update operational
   documentation and add an ADR; preserve historical decision text.
4. Replace picker tests with plugin-only installer behavior tests, including
   setup handoff, errors, skip states, and CLI/Desktop selection.

## Verification and Completion Checklist

### Architecture and implementation
- [x] No generic skills package or patch remains in runtime dependencies.
- [x] Both installers run only Codex/Claude setup; existing skill files untouched.
- [x] Claude terminal-only, Desktop-only, and combined installations select once.
- [x] Existing update command and new-release handoff remain functional.
- [x] No unrelated domain, Settings, or configuration changes.

### Website and documentation
- [x] Other-harness guide documents explicit target and installation scope.
- [x] Download page describes automatic plugins without a picker.
- [x] Current operations docs and ADR reflect the accepted boundary.

### Final verification
- [x] Release tests, website build, and relevant native temporary-profile checks.
- [ ] Validate Windows scripts through the authorized KeremPC chat. Dispatch failed because the Codex app-server connection was unavailable; no native Windows result is claimed.
- [x] Inspect complete diff/stat, changed modules, and architecture shape.
- [x] Report any unverified platform behavior and do not publish.

## Verification results

- `pnpm check` passed (existing no-console warning only); full build passed.
- Release suite passed, plus a focused no-terminal plugin-refresh regression.
- Three native Claude acceptance tests passed in temporary profiles: standalone
  CLI, plugin version advancement, and Desktop-only cached runtime.
- Website build and 1440px desktop render passed, without horizontal overflow.
- Assembled macOS arm64 product passed structure and runtime verification; its
  production tree has 161 packages instead of 168 and no generic skills package.
- Sister skills repository README updated for the plugin-only boundary.
- Diff and module shape reviewed; no new index entrypoints or domain logic.
- No release, website publication, or permanent agent installation performed.
