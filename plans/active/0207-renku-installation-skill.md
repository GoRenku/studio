# 0207 Renku Installation Skill

Status: implemented; native installation and released-plugin acceptance pending
Date: 2026-09-18

## Summary

Add `install-renku` to the existing Renku plugin in `studio-skills`. A user
installs the plugin, starts a new agent task, and asks “Install Renku.” The skill
detects the local platform, installs the released runtime, launches Studio in
a dedicated visible terminal window,
and guides Project Library and optional provider-key setup through existing UI.

The smallest useful implementation is skill guidance, behavioral evaluation
scenarios, and focused website/documentation corrections. Existing installers,
Core setup commands, and credential UI already supply the required machinery.

## Review Attention

- **Companion changes beyond the skill:** adjust one project-workspace test
  that currently assumes every skill runs inside an existing movie; update the
  website to make plugin-first installation discoverable; correct stale server
  policy documentation. These changes make the requested journey usable.
- **Public surface:** new `$install-renku` skill and its plugin display metadata.
  No new CLI command, flag, HTTP route, schema, Settings control, diagnostic
  policy, provider, or onboarding state.
- **Accepted launch experience:** open a dedicated visible terminal window,
  preferring native programmatic launch and using Computer Use when needed and
  available. The terminal owns the foreground server independently of the
  agent's tool session. Explain that it can be minimized but must stay open.
- **Installation documentation order:** skill-assisted installation comes first;
  the existing manual installation follows as the second path. Apply this order
  to the website installation guide and current installation documentation.
- **Effects:** running the future skill installs the existing released runtime,
  including its normal launcher/PATH changes. Project Library and key writes
  remain existing Studio operations. This plan makes no installations,
  migrations, deletions, data moves, or releases.
- **Preserved behavior:** independent runtime/plugin releases; checksum
  verification; foreground server; optional keys; existing configuration;
  custom pre-setup `renku init <storage-root>`; manual installation instructions.
- **Assumptions:** the installed skill has local shell access on the user's
  actual computer. Browser control is helpful but optional. macOS arm64/x64
  and native Windows x64 are the release targets; Linux/WSL and native Windows
  ARM64 support are not added or promised.
- **Scope decisions:** setup ends at a usable Project Library, with optional
  guided first-project creation and agent-folder alignment. Screenplay import
  and paid generation are handoffs, not installation acceptance requirements.
  Broader OS support, unattended secret entry, background services, or runtime
  fixes uncovered by native testing require a separately visible plan amendment.

## Requirement Ledger

| Requirement | Source | Owner and verification |
| --- | --- | --- |
| Install by asking after installing skills | User request | `install-renku`, plugin discovery, website journey; fresh-task evaluation |
| Choose installation for the user's OS | User request | Skill preflight invokes existing platform installer; native host matrix |
| Launch Renku in a dedicated visible terminal window | User-approved follow-up | Native terminal launch or Computer Use; independent process lifetime and browser readiness checks |
| Document skill-assisted installation first, manual installation second | User-approved follow-up | Website download page and operations installation guide; ordered journey inspection |
| Help with keys and onboarding | User request | Existing Studio UI, agent guidance; save/skip/resume evaluations |
| Keep domain writes and secrets in existing owners | Repository rules and ADRs 0084/0085 | No direct config, credential, or database writes by the skill |
| Keep releases independent | Accepted distribution contract | Existing plugin directory discovery and beta runtime installers |

## Context And Evidence

Reviewed both website source and live `/download/` and `/quick-start/` pages on
2026-09-18. The web reader failed to fetch them; direct HTTPS retrieval succeeded
and confirmed the relevant live instructions match the source. No installer was
executed and no real keys or local movie data were read.

| Evidence | Current behavior and implication |
| --- | --- |
| `packages/website/src/pages/download.astro` | Runtime-first manual commands, then plugin installation, then `renku studio start`. No plugin-first “ask the agent” path. |
| `packages/website/src/pages/quick-start.astro` | Already explains optional keys, six provider rows, Settings, masked saved state, project creation and agent-folder alignment. Saved keys are explicitly not proof of working provider access. |
| `distribution/install.sh` | Selects Darwin arm64/x64; verifies SHA-256; smoke-checks bundled CLI; installs launcher under `$HOME/.local/bin`; PATH edits affect later processes. |
| `distribution/install.ps1` | Downloads `win32-x64`; verifies SHA-256; creates `.cmd`/`.ps1` launchers beneath `%LOCALAPPDATA%\Renku\bin`; updates future user PATH. The OS check is only “64-bit,” not proof of ARM64 support. |
| `packages/cli/src/commands/studio/start-command.ts` | Reuses a usable running descriptor, otherwise launches a foreground server. Occupied port is `CLI162`; browser-open failure is warning `CLI163`; incomplete runtime is `CLI161`. |
| `packages/cli/src/commands/studio/server-status-command.ts` | Existing sanitized status command supplies running/canonical state and `agent.serverPolicy: foreground`. |
| `docs/cli/commands.md`, Studio server status section | Stale attach-only policy and `agent.browserAccess` wording conflict with current implementation. Correct this section without changing the status contract. |
| `packages/core/src/server/config/setup.ts` | Missing config permits setup; valid config preserves the library; invalid config blocks instead of being overwritten. |
| `packages/studio/src/features/onboarding/` | Project Library initialization followed by optional keys. Provider step is session state; reopening after initialization can land in the library, so resume through Settings. |
| `packages/core/src/server/provider-credentials/catalog.ts` | Current six providers: Fal.ai, Pika, Replicate, WaveSpeed, ElevenLabs, World Labs. Older plan/ADR text naming three providers is historical, not the current catalog. |
| `../studio-skills/.codex-plugin/plugin.json` | `skills: ./skills/` already discovers a new folder; no package restructuring or runtime bundle needed. |
| `../studio-skills/scripts/release/release-contract.test.mjs` | Static wording assertions require every skill to mention a Project root and movie temporary folders; they do not open or require an actual project. Scope these assertions to project-working skills. |

Accepted constraints: `docs/operations/distribution-and-release.md`, decisions
0077, 0084 and its later notices, and 0085; repository architecture rules;
the sister repository's contributor guidance. Plans 0176/0177 supply the
distribution baseline; 0177 still records public-install acceptance as pending.
Plan 0187 implements onboarding but still records native installed-runtime
verification as pending. Do not equate source tests with native release proof.

Existing uncommitted sister-repository README and CONTRIBUTING work must be
preserved. Urban Basilica is unnecessary for fresh-install validation and must
not be used as a disposable setup fixture.

## Options And Scope

1. **Reuse unchanged contracts — selected.** Existing official installers plus
   start/status commands and Studio onboarding satisfy the request.
2. **Extend runtime setup APIs — unnecessary.** Browser-guided setup can use
   existing controls; no credential CLI or new readiness endpoint is required.
3. **Ship a new installer/helper runtime in the plugin — rejected.** That would
   duplicate distribution ownership and add bootstrap dependencies before Renku
   is installed. The new skill ships no executable installer scripts.

The website presents skill-assisted installation first and retains manual
commands as the second documented path. Other agent
hosts may execute the same local-shell guidance when available, but this plan
does not add new host plugins or certify their installation mechanisms.

## Intended User Journey And Contracts

### 1. Discover and inspect the host

The skill triggers for installing Renku, starting it after installation, or
finishing initial setup. Its description must distinguish runtime installation
from installing the already-present skills plugin and from creative movie work.
No Renku command, movie folder, Node.js, pnpm, or source checkout is a prerequisite.

Inspect OS, architecture, shell, and local-versus-remote execution context with
built-in facilities: `uname -s`/`uname -m` on macOS and native PowerShell system
information on Windows. Detect WSL/remote/container contexts; do not mistake
that environment for the user's desktop. If local access is unavailable, give
the appropriate local action and report the limitation instead of claiming an
installation. Ask for the target OS only when it cannot be observed reliably.

Locate an existing `renku` with shell-native command discovery and inspect
`renku about`. Reuse a working installation; do not reinstall merely because
PATH is stale or the user is resuming onboarding. Check the documented launcher
location when command lookup fails. Report broken installations before choosing
a targeted reinstall; do not overwrite unrelated command collisions.

### 2. Install the released runtime

Use only the published installer for the detected supported platform:

```sh
curl -fsSL https://downloads.gorenku.com/install.sh | sh
```

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
```

Preserve installer verification and report its failures accurately. Do not
replace a failed download/checksum with a source build or unchecked archive.
Install permission is part of the user's request; honor actual harness approval
requirements without adding a second universal confirmation step.

After installation, use the actual installed launcher, quoted for its shell:
`$HOME/.local/bin/renku` on default macOS installs and
`%LOCALAPPDATA%\Renku\bin\renku.cmd` on default Windows installs. Respect
explicit installer-root overrides and reported paths rather than guessing.
Verify `about` succeeds before launch. Explain that future terminals/agent apps
may need a restart to pick up PATH; the current session can use the full path.
Do not install Node, npm packages, Homebrew, WSL, or developer tooling.

### 3. Launch and verify Studio

Call `renku studio server status --json`. Reuse a live canonical server;
otherwise run `renku studio start` in a dedicated visible terminal window on
the user's desktop. That window must remain usable after the agent's launch
tool returns and the installation task ends.

Prefer native programmatic launch: macOS Terminal on macOS, and an available
Windows Terminal window with an explicit native shell, or a native PowerShell
window when Windows Terminal is unavailable. Use the installed executable's
full path with correct shell quoting; do not depend on a default terminal
profile that could start WSL or on an already-running app having refreshed PATH.
Verify platform launch commands on native hosts before shipping their reference
instructions. Do not modify the user's default terminal or shell preferences.

When programmatic launch is unavailable and desktop Computer Use is available,
open the terminal app, create a fresh window, verify the prompt, and enter the
same command. Do not type into an arbitrary existing terminal session that may
be running another program. Observe actual capabilities and permissions instead
of assuming every agent host supports desktop control. If neither route is
available, guide the user through opening a visible terminal and starting the
command, then continue once readiness is verified.

The terminal keeps the existing foreground-server contract. Do not substitute
an agent-managed hidden session, daemon, login item, or background service.
Clickable launchers and native app packaging are outside this accepted change.

Verify server status and browser readiness at the reported canonical URL
(`http://localhost:5173`). Do not treat spawning the process as success. On
`CLI163`, open the URL using available browser tools or provide it to the user.
On `CLI162`, report the conflict without killing an unrelated process or choosing
an undocumented port. Explain: “This window runs Renku. You can minimize it;
keep it open while using Studio.” Explain that stopping the command or closing
its terminal session stops Studio, while closing a browser tab does not. For
later use, the user can ask the skill to start Renku again, or run
`renku studio start` in a terminal. Read status output rather than raw
token-bearing runtime descriptor files.

### 4. Guide onboarding and API keys

Guide **Use this Project Library**, showing Studio's actual recommended location
(`~/Movies/Renku` or `%USERPROFILE%\Videos\Renku`). A requested custom library
uses existing `renku init <storage-root>` before initialization, not config-file
editing. Existing libraries remain intact; invalid configuration is reported,
not reset. Do not reopen a configured installation by deleting setup files.

Offer provider setup or **Skip for now**. Help the user find the official account
API-key page for providers they intend to use, using the current website links
as entrypoints and checking current official provider instructions when needed.
Account creation, sign-in, and billing remain user actions. Do not require all
six accounts or choose paid services on the user's behalf.

The user enters keys directly into the matching Studio fields and chooses
**Save and continue**. The agent must not request keys in chat, read `.env`, put
keys in shell arguments, or capture secret-filled form values in tool output.
Verify only the masked saved/Replace state after save, or accept the user's
confirmation when browser interaction is unavailable. Existing installations,
skipped setup, and interrupted provider onboarding resume through **Open
Settings** and **Save**. Saving proves storage, not authentication or credits;
do not run paid generation to validate installation.

### 5. Finish with a useful handoff

Required completion: identified platform; working installed CLI; reachable
Studio with its dedicated visible terminal identified (or an existing running
server reused with its lifetime explained); Project Library configured; provider
setup either saved, explicitly skipped, or clearly reported as pending.
Distinguish observed verification from user-reported verification.

Offer to guide **Create Project** and align the agent project with that same
folder. Obtain a title from the user rather than creating a sample film by
default. If accepted, use the existing Studio flow and verify the opened folder.
Offer existing screenplay/movie-director skills for the next creative task;
do not import scripts or generate media as a hidden installation step.

## Architecture Shape Gate

The new entrypoint is
`../studio-skills/skills/install-renku/SKILL.md`, with:

- `agents/openai.yaml`: display name **Install Renku**, short description and
  default invocation; retain normal automatic discovery.
- `references/platform-installation.md`: platform-specific commands, launcher
  paths, visible terminal launch and Computer Use guidance, and focused failure
  recovery.
- `evals/installation-and-onboarding.md`: observable journey scenarios and
  evidence requirements; not an executable provisioning framework.

Keep the main workflow and setup boundaries in `SKILL.md`; load the platform
reference only for installation/launch details. No `scripts/`, `index.ts`, new
registry, runtime package, server adapter, or config persistence wrapper.
OS branches stay in the reference; installation mechanics remain in the
existing distribution scripts. Core continues to own configuration and keys.

Adjust the existing workspace test to exclude `install-renku` from the
project-scoped assertions, preserving checks for the existing movie skills.
This is a bounded test-scope correction, not a new skill classification system
and not a reason to add irrelevant movie-folder boilerplate to the new skill.

Website edits use the existing Astro layout and prompt components. Stop and
amend the plan if implementation needs a new domain/API contract, secret-reading
automation, background service, broad dispatcher, or copied installer logic.

## Implementation Slices

1. **Skill and evidence:** add the four files above; author the full bootstrap,
   resume, launch, and onboarding workflow. Add a setup row to the sister README
   skill map without replacing its pending edits. No manifest restructuring is
   needed because discovery already includes `skills/`.
2. **Validation boundary:** narrow the workspace assertion in
   `../studio-skills/scripts/release/release-contract.test.mjs`; retain existing
   creative-workspace coverage. Validate frontmatter and referenced files.
3. **User-facing entrypoint:** update `download.astro` to present **Install with
   your agent** first: install the plugin, open a new task, and ask “Install
   Renku and help me complete setup.” Explain that the agent detects the OS,
   opens a visible terminal to run Studio, and guides onboarding. Present
   **Manual installation** second, preserving the existing OS installer,
   plugin, and launch steps. Document PATH refresh, keeping the visible
   terminal open, and how to start Renku again. Update the
   quick-start introduction to link the skill-assisted setup path while keeping
   its existing key guidance and later creative tutorial.
4. **Current documentation:** update User Installation in
   `docs/operations/distribution-and-release.md` with the same skill-first,
   manual-second ordering and terminal guidance, and correct
   the status section in `docs/cli/commands.md`. Do not rewrite historical plans
   or ADRs: no architecture decision changes.
5. **Release readiness:** verify the installed plugin includes the new skill,
   then exercise native installs. Publish the skills beta before publishing a
   website that advertises this capability. Publishing remains a separate
   maintainer action, not part of implementing or reviewing this plan.

## Tests And Guardrails

Behavior scenarios belong in the new skill eval document:

- Clean Apple silicon and Intel Macs; clean native Windows x64 with a user
  profile path containing spaces; no developer runtime dependencies.
- Already-installed CLI, stale PATH in an already-open agent app, running
  Studio, and interrupted onboarding: reuse current state without reinstall.
- Linux/WSL, remote-only agent, and Windows ARM64: honest support/access
  boundary without executing the wrong installer or promising unverified support.
- Download/checksum failure, incomplete runtime, occupied port, browser-open
  warning, and unavailable terminal automation: meaningful next action and no
  false completion. Use controlled fixtures for destructive/error simulations.
- Native programmatic launch and Computer Use launch into a fresh visible
  window; no typing into unrelated sessions or accidental WSL profile use.
  Verify the server survives the launching tool's return and the agent task
  ending, remains reachable while the window is minimized, and can be relaunched
  after the dedicated session is stopped. Exercise user-guided launch when
  native automation and Computer Use are unavailable.
- New default library, requested custom library, valid existing configuration,
  invalid configuration, key save, key skip, and resume through Settings.
- No browser automation: guided user actions with explicit verification limits.
- Optional first-project handoff; no automatic project, import, or paid run.

Use isolated OS users or disposable native test machines, fake credentials for
save/masking checks, and no Urban Basilica data. Existing Core/UI tests already
cover setup validation and credential persistence; do not copy their complete
invalid-input matrix into new runtime tests. Frontmatter validation and the
repository suite do not prove agent behavior or actual cross-platform installs.

## Final Verification

- In `studio-skills`, run `pnpm test` and skill-creator's `quick_validate.py`
  against `skills/install-renku`; inspect links and installed discovery metadata.
- In Studio, run `pnpm --filter @gorenku/website check` and
  `pnpm build:website:cloudflare`; inspect the revised pages at desktop size.
- Run the authored behavioral scenarios in supported agent sessions; record
  platform, installed runtime/plugin versions, outcome, and limitations.
- Native macOS arm64/x64 and Windows x64 acceptance is required before claiming
  all-platform verification. Unavailable hosts remain explicit pending items.
- Inspect `git diff --stat` and the complete changes in both repositories;
  preserve unrelated edits and local formatting. Confirm no runtime/domain
  implementation, broad helper, or non-thin entrypoint was introduced.

## Completion Checklist

### Review Area And Contracts

- [x] Confirm skill-only orchestration and the listed companion edits.
- [x] Confirm existing installer, config, credential, and launch ownership.
- [x] Keep independent releases and the existing supported platform targets.
- [x] Preserve prior plans/ADRs and unrelated sister-repository changes.

### Skill Implementation

- [x] Add discoverable `install-renku` instructions and agent metadata.
- [x] Add platform reference with host detection, installer commands, paths,
      overrides, quoting, stale-PATH handling, and existing-install reuse.
- [x] Cover foreground process lifetime, status/browser verification and
      concrete installation/launch failures.
- [x] Prefer native launch into a dedicated visible terminal; cover Computer
      Use and user-guided launch without disturbing existing terminal sessions.
- [x] Explain minimize/keep-open behavior, stopping Studio, and later relaunch.
- [x] Cover default/custom/existing/invalid library and interrupted setup.
- [x] Guide provider account/key pages and direct Studio entry; support save,
      skip, Settings resume, and honest saved-versus-validated reporting.
- [x] Include user-guided mode without browser control and optional first-film
      handoff; avoid automatic paid or creative work.
- [x] Narrow the project-workspace test and add the README skill-map entry.

### Website And Documentation

- [x] Put skill-assisted installation first and existing manual installation
      second in the download page and operations installation guide.
- [x] Preserve manual installation, explain PATH refresh and terminal lifetime.
- [x] Connect quick start to assisted setup while retaining current key guidance.
- [x] Align operations documentation and correct stale CLI server-status prose.
- [x] Gate website publication on the new skill being released and discoverable.

### Validation And Final Verification

- [x] Validate skill frontmatter and references; run sister-repository tests.
- [x] Check/build website and inspect desktop rendering and copy controls.
- [ ] Exercise fresh-task discovery and the skill's behavioral scenarios.
- [ ] Record native Apple silicon, Intel Mac, and Windows x64 results separately.
- [ ] Verify visible terminal ownership survives tool return and task completion;
      check minimize, stop, and relaunch behavior on native hosts.
- [x] Verify no real keys enter chat/logs and no user project/config is reset.
- [x] Inspect full diffs and large changed files; confirm no god file, registry,
      copied installer, new persistence owner, or inflated `index.ts`.
- [ ] Report unavailable verification honestly; mark complete only when the
      agreed acceptance is met without sacrificing reviewable structure.

## Implementation Evidence — 2026-09-18

- Added the four planned skill files, README entry, and bounded workspace-test
  exclusion in `studio-skills`. Updated both website pages and current CLI and
  installation documentation. No runtime, installer, schema, or credential
  persistence code changed.
- `pnpm test` in `studio-skills`: passed all guide/eval validators and 10 tests.
  Skill-creator `quick_validate.py`: passed.
- Website `check`: 23 files, zero errors/warnings/hints. Cloudflare static build:
  passed. Existing out-of-sync dependency warning was reported; no dependencies
  were installed or changed.
- Desktop browser inspection at 1440 × 1000 confirmed assisted-first/manual-second
  layout, prompt-copy feedback, Windows platform switching, and manual-command
  copy feedback.
- Existing local `renku about` returned 0.1.8; sanitized server status confirmed
  a running canonical Studio. Its process and existing configuration were left
  unchanged.
- The documented macOS AppleScript launch ran a harmless temporary executable
  with a space and apostrophe in its path in a fresh Terminal window; it returned
  a window id and recorded exactly `studio` and `start` after the launch tool
  returned. This verifies launch and quoting, not a clean runtime installation
  or long-lived server behavior. Sandbox execution could not access Terminal;
  the approved native test ran outside the sandbox.
- Computer Use refused access to Terminal, so that path and minimize/close
  verification remain untested. The harmless test window can be closed by the
  user. No terminal restriction was bypassed after that refusal.
- Clean native installation, Windows/Intel Mac execution, complete fresh-task
  skill evaluation, provider save/skip/resume, and server survival after task
  completion remain pending. No runtime/plugin release or website deployment
  was performed. Release the skill before deploying the new website guide.

No automatic plan review was run.
