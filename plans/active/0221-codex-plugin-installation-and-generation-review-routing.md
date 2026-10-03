# 0221 Codex Plugin Installation And Generation Review Routing

Status: implemented; publication and native Desktop acceptance pending
Date: 2026-10-03

## Summary

Keep the existing skills installation and add Codex plugin installation alongside
it. The plugin installs the MCP integration needed for the inline and panel
reviews. Claude and other harnesses keep their current installation workflow.

If Codex CLI is missing, skip the plugin and record that it is not installed.
Do not install Codex CLI for the user.

In Codex Desktop, use the panel when the current Renku connection advertises
support, including development connections without installer state. Without a
connection or installation record, use Visualize. Other harnesses use Preview with
conversation.

## Review Attention

- The installer adds one Codex plugin installation step and records its result.
- The existing skills picker, runtime installation and update commands stay.
- Add one installation flag; keep existing review preferences in their current
  config. No config moves, skill deletion, new setup chooser or Settings screen.
- Before shipping, publish the complete plugin from the sister repository.
- Development-machine correction: the current connection's advertised panel
  support takes precedence over a false installation flag. No installer run,
  fabricated flag, new command or Settings control is needed. Explicit Visualize
  and non-Desktop Preview behavior remain unchanged; connection failures stop.

## What Changes For The User

| Situation | Installation | Default generation review |
| --- | --- | --- |
| Codex Desktop and Codex CLI available | Existing skills installation plus Codex plugin | Plugin panel, inline or fullscreen |
| Codex Desktop without Codex CLI | Existing skills installation; plugin skipped | Visualize |
| Claude, Codex CLI or another harness | Existing skills installation | Preview + conversation |

The existing explicit Visualize preference remains available. An existing panel
preference uses Visualize when no probe or installation record exists. Development
connections advertise panel support independently of installer state.
Project Preview and generation-confirmation rules otherwise stay as they are.

## Current Status And Official Installation Method

Both platform installers currently install skills only. The sister repository
already contains the plugin manifest and MCP configuration. The runtime already
contains `renku studio mcp` and the review UI. Reuse that implementation.

Use the documented commands, with the user's existing Codex profile:

```text
codex plugin marketplace add GoRenku/studio-skills --ref beta --json
codex plugin marketplace upgrade renku --json
codex plugin add renku@renku --json
codex plugin list --json
```

Verify that Renku is installed and enabled before recording success. Report real
installation errors clearly. If the CLI is absent or too old to support plugin
commands, record false and continue the existing skills installation. If an
existing Renku marketplace conflicts or the user disabled the plugin, report it
without replacing their source or re-enabling it automatically.
Run the general skills step independently so a plugin failure does not prevent
Claude or other selected harnesses from receiving their skills.

The current published plugin contains skills but lacks the newer MCP declaration.
Publish the complete local plugin before shipping this installer. The sister
repository's two plugin manifest versions must match for its release script to
run; that release also needs to publish the `beta` branch. These are release
preparation tasks, not extra installer behavior.

The official [Extensions documentation](https://developers.openai.com/plugins/build/extensions)
describes the UI integration. The [plugin packaging documentation](https://developers.openai.com/plugins/build/plugins)
and [CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
describe installation. Isolated checks confirmed registration, installation,
marketplace refresh and installation of a newer local plugin version through
these public commands. Native Mac/Windows Desktop acceptance remains to be done.

## Architecture Shape Gate

Keep each responsibility with its existing owner:

- `distribution/install.sh` and `install.ps1` keep runtime setup and the existing
  general skills installation. They invoke one focused new Node script,
  `distribution/install-codex-plugin.mjs`, using bundled Node.
- That script handles only the public Codex commands and reports their result.
  It calls core to record installation state; it does not edit Renku config.
- `packages/core/src/server/installation/codex-plugin.ts` owns reading and writing
  the flag, using the existing platform config-directory resolver. Export its
  focused commands from the existing thin server entrypoint.
- Core adds the flag to the existing generation-context workflow policy. The
  canonical Media Producer routing guide applies the host/current-connection rule.
- Keep the current MCP connection/handshake checks inside the panel workflow.
  Do not add Visualize availability detection or a second routing implementation.

Stop if implementation requires private Codex cache edits, a generic config
mutation API or a broad installer dispatcher. Use the supported command path.

## Contracts

Add `codex-plugin.json` beside the existing Renku config:

```json
{ "codexPluginInstalled": false }
```

This small file can exist before the user chooses a library folder. Missing file
means false. Core validates the boolean and writes atomically through
`recordCodexPluginInstallation(installed, options)`;
`readCodexPluginInstallation(options)` supplies it to generation context.
Invalid state or failed writes use structured `CONFIG017` diagnostics.

Expose `workflowPolicy.codexPluginInstalled`. Keep current review preferences in
`config.yaml`, add `auto` as the default, and retain `panel` and `visualize`.
There are no new user-facing CLI commands.

Automatic routing reads the current host, connection and that flag:

- Codex Desktop + advertised current probe: panel under `auto` or `panel`,
  including when the installation flag is false.
- Codex Desktop + explicit `visualize`: Visualize.
- Codex Desktop + no probe + false installation flag: Visualize.
- Codex Desktop + unavailable/failed probe, or no probe + true installation
  flag: report an integration failure and stop.
- Other harness: Preview with conversation.

The panel keeps its existing connection and handshake checks. If that selected
workflow fails, report the failure; do not open a second review automatically.
Provider choice, spending approval and exact Submit consumption stay unchanged.

## Implementation Slices

1. **Record installation state.** Add the focused core read/write commands and
   expose the flag in generation context. Leave library config in place.
2. **Add the plugin step.** Call the official CLI from the new installer script,
   verify success, and record true or false. Package the script with the runtime.
   Use the same step for `renku update` and `renku update skills`.
3. **Simplify skill routing.** Update the sister repository's canonical
   `skills/media-producer/references/generation-review-routing.md` and existing
   routing evaluator to use the table above. All purpose/provider skills follow
   that one rule. Preserve existing generation and Preview behavior.
   Probe existing development connections independently of installer state;
   advertised support selects the panel and integration failures stop.
4. **Publish and verify.** Release the complete sister plugin, then the compatible
   runtime installer. Update installation documentation and download-page copy.

## Tests And Final Verification

- Core: missing state defaults to false, invalid state fails clearly, recording
  installation works before library setup, and generation context exposes it.
- Installer: CLI present installs/verifies the plugin; absent/unsupported CLI
  skips it; failed installation reports failure. General skills still install.
- Routing: advertised Desktop connections select panel with either installation
  flag; no probe or installation record selects Visualize; other harnesses select
  Preview. Preserve explicit Visualize and existing
  generation confirmation behavior.
- Native Mac/Windows: install with and without CLI, reopen Desktop, exercise
  panel/Visualize review, and verify an existing plugin updates successfully.
- Run focused core/CLI/Codex and installer tests, sister `pnpm test`, then Studio
  `pnpm build`, `pnpm check` and `pnpm test` before shipping.
- Inspect both diffs, preserve formatting and thin entrypoints, and confirm that
  implementation follows the ownership split above.

## Documentation

Update current installation/release documentation, generation-review guidance,
CLI update help and download-page copy. Add ADR 0106 for this installation and
routing decision, with brief notices on ADRs 0101 and 0105. Preserve historical
plans and decision reasoning.

## Completion Checklist

### Contracts And Ownership

- [x] Core owns the installation flag and its structured errors.
- [x] Generation context exposes it; existing config/preferences remain in place.
- [x] Installer records verification; skills use the agreed host/connection rule.
- [x] Public entrypoints stay thin; no private Codex state edits or broad helpers.

### Implementation

- [x] Add and package the focused plugin installation script on Mac and Windows.
- [x] Skip when CLI is absent/unsupported; record verified installation results.
- [x] Preserve general skills installation and include the step in both updates.
- [x] Update canonical skill routing and its existing evaluator.
- [ ] Publish the complete plugin with matching versions and a beta branch.

### Verification And Documentation

- [x] Pass focused tests and the listed build/check/test commands.
- [ ] Verify native Desktop installation, review and plugin update journeys.
- [x] Update current docs, download copy and ADRs.
- [x] Inspect full diffs and large changed files; confirm acceptable architecture
  and formatting before marking complete.

## Implementation Verification (2026-10-03)

- Studio `pnpm build`, `pnpm check` and `pnpm test` passed; website build passed.
- Sister `pnpm test` passed, including the updated routing evaluator.
- Installer tests exercise plugin success, absent/unsupported CLI, installation
  failure, disabled plugins, conflicting marketplace sources and verification
  failure. Mac installer tests cover continued skills setup on plugin failure
  during install and both updates. A packaged-script smoke check verifies core
  loading and false state before library setup; a regression test covers
  macOS temporary-path resolution.
- The public CLI was inspected in isolated temporary Codex profiles. The current
  published repository has no beta branch. Both local plugin manifests now use
  matching strict SemVer, ready for release preparation.
- Publication is explicitly deferred by the user. The sister repository has
  ten existing unpublished commits in addition to this implementation; publishing
  the complete plugin would include those changes.
- Native Mac/Windows Desktop reopen, panel/Visualize and existing-plugin update
  acceptance remains pending. Automated installer tests do not establish those
  live host journeys. Do not ship the runtime until the plugin is published and
  native acceptance is completed.

### Development Connection Correction (2026-10-03)

- The Sintel generation session advertised Codex MCP App support while context
  reported `codexPluginInstalled: false`; this machine does not run the platform
  installer. Skills now probe the active connection independently of that record.
- All five provider Skills defer to the shared panel/Preview confirmation rule.
  Regression cases cover built-in/external images, audio, video, explicit
  Visualize, unavailable/failed probes and rejection of automatic Preview.
- The local `renku@renku-local` plugin was refreshed from the sister source
  through the public CLI. Its installed routing/provider guides match source,
  the active probe advertises support, and no installer state file was created.
- Automated Skill checks verify the routing scorer and package content; a fresh
  native generation review still needs host acceptance after reloading Codex.
