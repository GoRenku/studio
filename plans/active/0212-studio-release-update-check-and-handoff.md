# 0212 Studio Release Update Check and Handoff

Status: complete; native Windows verification deferred
Date: 2026-09-27

## Summary

Studio should check the published Renku beta release when its browser application opens and every six hours while it remains open. Only when a newer version exists, a quiet, persistent notice in Studio's top header should tell the user. Clicking the notice opens a dialog asking whether to update. Confirming should start the existing interactive `renku update` command in a visible system terminal. Installation remains the job of the current installer and CLI.

The user accepted the header direction and requested production implementation on 2026-09-27. The code and automated checks are in place. The isolated macOS installed-product rehearsal passed on 2026-09-27: Studio updated from fixture version `0.0.1` to `0.0.2`, restarted as a new process, cleared the update notice, and retained the disposable Project's saved values and media.

## Review Attention

- **Necessary behavior beyond the literal request:** `renku update` currently refuses to run while Studio is open (`UPDATE004`) and its skills step requires an interactive terminal. The notice's confirmation therefore needs a visible Terminal/PowerShell handoff that stops Studio before running the unchanged command. The confirmation must explain that Studio will close and that the user should finish edits first. A successful handoff should start Studio again after the command completes; failure remains visible in the terminal, with a clear manual restart command.
- **Contracts:** Add a read-only update-status core service and Studio GET route, plus a focused core handoff service and token-protected Studio POST route. Add structured update-check/handoff diagnostics. Do not add a CLI command, flag, Settings field, project schema, release channel, or Cloudflare resource.
- **Repeatable test setup:** Reuse the installers' existing `RENKU_DOWNLOAD_BASE_URL` process configuration in the new release checker and preserve it through the terminal handoff. It defaults to the public Cloudflare origin; an explicit localhost origin lets a test offer real archives without publishing a release. Add the developer-only `scripts/release/verify-studio-update.mjs` harness described below. This adds no customer-facing source selector or new environment variable.
- **Verification scope:** Per the user's direction, run the installed-product rehearsal on macOS only. Native Windows verification is deferred because no Windows test environment is available and is not a completion gate for this work. Windows implementation remains in scope, with its end-to-end behavior explicitly unverified.
- **Data effects:** The existing `renku update` installer changes the active application version and may install or refresh selected agent skills. It keeps Projects, configuration, and earlier version folders under the current installer contract. This plan has no migration or cleanup.
- **Existing behavior kept:** The CLI command, checksum verification, immutable archive keys, beta channel, installer prompts, and `UPDATE004` guard remain in force. No archive is downloaded during a check. The Renku logo/name still navigates home; Settings and Theme retain their positions.
- **Visible UI change beyond the update notice:** The Project Library currently stacks “Renku” and “STUDIO.” Change its compact left brand cluster to the same one-line **Renku Studio** title used in the in-project sidebar, as the user requested. Keep both existing headers at 56 px. The update notice is a conditional icon in the utility group immediately before Settings, with its own click target. It adds no second row and never becomes part of the Home control. At very narrow sidebar widths the existing brand ellipsis remains; this plan does not change the sidebar's minimum width.
- **Assumptions:** “At launch” means when the Studio browser application opens, including its first open after `renku studio start`; the six-hour timer runs only while that application is open. “New version” means a higher numeric `major.minor.patch` than the installed runtime, so a deliberate beta rollback does not show an update notice. The notice appears in the Project Library header and in the Movie Studio sidebar's top header, which is the in-project equivalent. It stays visible while the release is newer, including after the user cancels the dialog; it disappears when a later check finds no newer release. There is no always-present Update control and no transient toast or popup announcement.
- **Approval/design selection:** The user accepted the utility notification direction demonstrated by the browser-rendered interactive study and requested implementation of this plan. Earlier treatments, including the expanded header with a second notice row, remain rejected. Shutdown completion, independent execution after server exit, and verification of the restarted version are required for this handoff to work reliably.

## Product Behavior

1. On application mount, request the current release status. Repeat six hours after each check while the tab remains open. A tab reopened before the interval checks immediately. Do not add an operating-system background task or poll when Studio is closed.
2. Core reads the installed runtime version from its `RELEASE.json`, fetches `/studio/channels/beta/release.json` from the configured download origin (normally `https://downloads.gorenku.com`), validates its release envelope and this platform's artifact, and compares numeric version parts. Reuse the installer's `RENKU_DOWNLOAD_BASE_URL` override so a test checker and installer cannot accidentally use different sources. Checking only retrieves the small manifest. A missing/invalid manifest or network failure is a structured check failure, never “up to date.”
3. Both headers show **Renku Studio** on one line and retain their existing 56 px height. The logo and title navigate home. When a newer version is available, show a 28 px unboxed update control immediately before Settings: the existing Lucide `CircleArrowUp` icon in a neutral foreground, with a small amber availability dot. Hover or keyboard focus reveals **Update available**; its accessible name includes the published version and that it opens update details. Only this control opens the dialog. The control is absent when current or before a valid offer is known, and remains after **Not now** and across Project Library/Movie Studio navigation while the release remains newer. No automatic popup or toast announces the update. The dialog presents the installed and offered versions, asks whether to **Download and update**, and explains that Studio will close while the update runs in a visible Terminal/PowerShell window, then reopen on success. **Not now** leaves Studio running and downloads nothing.
4. Confirming makes one authenticated POST. Core rechecks the published release and installed version to avoid acting on a stale offer, then launches a visible platform terminal. Its fixed command sequence stops Studio, runs `renku update`, and restarts Studio. The browser shows a local “Update is continuing in Terminal” state as the server closes. The terminal remains available to show progress, skills prompts, and any failure. An unsuccessful update must not be presented as complete.
5. The handoff opens only for an installed macOS/Windows runtime. A workspace development server has no installable runtime and shows no update notice. If the terminal cannot be opened, Studio stays running and the POST returns a structured error. Repeated clicks or concurrent tabs cannot launch duplicate handoffs.
6. A failed automatic check cannot create a new update offer or replace the current application. If no valid offer was previously known, show no notice. If a newer release was already confirmed, keep that notice through a temporary check failure; the confirmation POST still rechecks before any handoff. Core returns a structured diagnostic and the server records it; the background check does not interrupt editing or show recurring toasts. A later successful current/rollback check clears the notice.

### Reliable UI Handoff

The visible terminal session owns execution independently of the Studio server and browser. Core must confirm that the terminal-side controller has started before allowing it to request shutdown; opening a terminal window alone is not proof that its command started. The HTTP response acknowledges this handoff, never installation success. Closing or losing the browser after the handoff must not cancel the update.

Run the installed launcher with `studio stop`, then wait for the original Studio process to exit and its runtime descriptor to be released before invoking `renku update`. The current stop command can return exit code zero with `stopping: true` after five seconds, so a bare success-code command chain is insufficient. Use a bounded wait and fail visibly if shutdown does not finish; do not force-kill Studio or bypass `UPDATE004`. The current core handoff owner constructs this fixed sequence and its completion checks; React and the HTTP route do not interpret process state.

After a successful update, invoke `studio start` through the same absolute launcher path from `INSTALLATION.json`. The installer rewrites that launcher to the new version; restarting the old process executable would relaunch the old application. Use the existing start command's browser-opening behavior. The reopened application must read its own installed version and perform its normal launch check. A terminal launch, an HTTP success response, or an installer progress message must never be presented as proof that the updated Studio is running.

If the installer fails, leave its output visible with the manual restart command. Skills setup happens after runtime activation, so a skills failure may leave the new runtime installed; do not claim that every failure leaves the previous version active or perform an unrequested rollback. The dialog's instruction to finish edits remains necessary: this flow does not promise to preserve unsaved browser state.

### Explicit Non-Goals

- Automatic installation, silent skills setup, incremental downloads, prerelease-channel selection, update Settings, notification-center work, disk cleanup, a new GUI installer, and changing `renku update` into a non-interactive command.
- Refactoring the release publisher, installers, or Project persistence beyond a defect directly uncovered by this slice.

## Proposed Header Treatment

The current reference is the [interactive study](assets/0212-studio-release-update-check-and-handoff/update-notification.html), with browser captures of the [two headers](assets/0212-studio-release-update-check-and-handoff/update-notification-browser.png), [keyboard focus and tooltip](assets/0212-studio-release-update-check-and-handoff/update-notification-focus.png), and [confirmation dialog](assets/0212-studio-release-update-check-and-handoff/update-dialog-browser.png). These are planning artifacts, not production code. Earlier generated images and `header-study.png` are rejected references.

The design uses [Impeccable's Operate guidance](https://github.com/pbakaus/impeccable/blob/main/skill/reference/operate.md) for familiar controls and restrained status, its [layout guidance](https://github.com/pbakaus/impeccable/blob/main/skill/reference/layout.md) for grouping by meaning and stable density, and [Anthropic's frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) for preserving the brief and removing decoration. Skills were read from their upstream source; no plugin, detector, hooks, or dependencies were installed.

- **Priority and proportion:** Keep the header at 56 px in every state. An optional update must not enlarge the brand landmark by 57% or move the project card and sidebar navigation downward.
- **Grouping:** The brand is the Home destination. Update, Settings, and Theme are application utilities. Render the update control directly before Settings in both screens. In Movie Studio the entire group stays inside the existing sidebar; in the Library the utilities retain their existing right alignment. The brand remains a compact one-line group at the left.
- **Visual treatment:** Use the existing Lucide icon stroke and local ghost `Button`, 28 × 28 px, with a 16–17 px neutral `CircleArrowUp` glyph and a 5 px primary-color dot. No filled button background at rest, animation, count badge, permanent empty slot, or new row. Existing hover and focus treatments establish the interaction; the tooltip provides the visible label.
- **Click meaning:** A click opens update details and does not download or navigate. The dialog contains **Not now** and **Download and update**. Closing it leaves the indicator available. Keep Home navigation and the notice as different controls with separate keyboard focus stops.
- **Dialog hierarchy:** Title **Update Renku Studio**; primary statement **Version {publishedVersion} is available**; supporting installed-version text; concise explanation **Studio will close while the update runs in Terminal, then reopen. Finish your edits before continuing.** Use **PowerShell** on Windows. Explain the consequence, without showing a shell command as decorative UI copy. The real confirmation invokes the planned `renku update` handoff.
- **Measured fit and limit:** The browser study shows a 300 × 56 px project header with a 146.23 px Home control, 28 px Update control, 28 px Settings control, and 44 px Theme switch. It preserves 8 px between Settings and Theme, uses 4 px between Update and Settings, and has no overlapping targets. At the resizable sidebar's 14% minimum, the current title already truncates; retain its one-line ellipsis and keep all utility targets intact. Do not shrink text or change the sidebar minimum to hide this constraint.

The tradeoff is discoverability: an icon is less explicit than a standing text label. The familiar upward update glyph, amber dot, hover/focus tooltip, and direct dialog make that tradeoff deliberate. [Chrome's optional-update indicator](https://support.google.com/chrome/a/answer/7679871?hl=en) provides precedent for this low-interruption level. The notice remains until resolved; the tooltip is supplementary, not the notification itself.

### Alternatives considered

| Treatment | Assessment |
| --- | --- |
| Update label inside or below the logo/name group | Rejected: visually associates an update action with Home navigation. |
| Extra 32 px notice row | Rejected: gives a low-priority status excessive space and shifts the workspace. |
| Amber dot on Settings or the logo | Rejected: the marked control would suggest the wrong destination, or require changing its existing action. |
| Bell / notification center | Adds a broader notification concept that this update flow does not need. |
| Full-width bar, toast, or automatic dialog | Too prominent or temporary for this optional update. |

## Evidence And Constraints

- The installed beta source is already `studio/channels/beta/release.json` on `downloads.gorenku.com`; its selected artifact points to an immutable version key and SHA-256. See `docs/operations/distribution-and-release.md`, `distribution/install.sh`, `distribution/install.ps1`, and `scripts/release/publish-github-release.mjs`.
- Both platform installers already accept `RENKU_DOWNLOAD_BASE_URL`, `RENKU_INSTALL_ROOT`, and `RENKU_BIN_ROOT`. `scripts/release/install.test.mjs` already exercises the macOS installer using temporary products and a controlling terminal, including checksum/download failures, launcher replacement, and skills failure. Those tests use fake executable/download fixtures; they do not prove that a real Studio UI can update and restart itself. The installed-product rehearsal below closes that gap.
- `packages/core/src/server/installation/renku-update.ts` owns the existing update invocation and rejects a running Studio. `packages/cli/src/commands/update.ts` delegates to it. The installer is interactive, including skills setup. Preserve this ownership and guard.
- `renku studio stop` already requests an authorized local shutdown and waits for the runtime descriptor to clear. The Studio server has a shutdown callback. Reuse this command in the handoff rather than bypassing server shutdown.
- `StudioAppHeader` is used by the Project Library and currently splits “Renku” from “STUDIO”; its `subtitle` prop has one production caller. The in-project top band lives in `studio-sidebar.tsx`, already shows “Renku Studio” on one line, and has Settings/Theme actions. `docs/product/design-guidelines.md` defines the current compact visual language.
- Studio's server uses Hono resource routes and token-protected mutations. React uses service functions for API calls. Follow `docs/architecture/reference/studio-server-hono.md` and `docs/architecture/reference/front-end-guidelines.md`.
- Existing installer review in `docs/operations/installer-review.md` records that native Windows verification and a GUI installer remain separate work. Native Windows update-handoff verification is also deferred in this plan at the user's direction; report that limitation without blocking completion of the current scope.

## Architecture Shape Gate

- **Core ownership:** `packages/core/src/server/installation/renku-release-check.ts` owns installed/published version reading, manifest validation, platform artifact selection, numeric comparison, and structured failures. Extend `installation-paths.ts` only for focused installed-path/version resolution. `renku-update-handoff.ts` owns the one-shot terminal handoff and duplicate-launch guard; it constructs platform-specific invocations from validated installed paths. Keep `renku-update.ts` as the CLI's existing installer invocation, with `UPDATE004` intact.
- **Public entrypoints:** Export `checkRenkuUpdate()` and `startRenkuUpdateFromStudio()` from the existing `@gorenku/studio-core/server` `index.ts`. The index remains export-only. `RenkuUpdateStatus` is `{ state: 'current'; installedVersion; publishedVersion } | { state: 'available'; installedVersion; publishedVersion } | { state: 'notInstalled' }`. The handoff returns `{ started: true; publishedVersion }` only after terminal launch succeeds.
- **Studio adapter:** `packages/studio/server/routes/studio-update.ts` owns `GET /studio-api/studio/update` and `POST /studio-api/studio/update`. GET serializes core status; POST requires the existing Studio API token, calls the core handoff, and maps structured errors. `server/app.ts` only mounts the route. No manifest parsing, version comparison, shell construction, or release policy in a route.
- **Frontend:** `src/services/studio-update-api.ts` owns HTTP transport. `src/app/use-studio-update.ts` owns mount/six-hour scheduling and UI state. `src/app/studio-update-notice.tsx` owns the conditional sibling notice and confirmation dialog. Compose one state owner in `App` so the first check also runs before setup/onboarding completes; pass the same status/actions through `StudioSetupGate` and `ConfiguredStudioApp` to `StudioAppHeader` and `StudioSidebarActions`, rather than running independent checks in the two headers. Update `StudioAppHeader` directly to use the one-line brand title and remove its obsolete `subtitle` prop/callers in the same slice. Keep its Home control and the notice as separate sibling controls. Use only local `src/ui` controls; the clickable notice can use a visually unboxed `Button` primitive.
- **Dispatch shape:** Two explicit platform launch paths within the bounded handoff module are sufficient. Do not add a generic command runner or a broad updater registry. Terminal command arguments are fixed by core; no browser-supplied paths, shell fragments, version, or URL are accepted.
- **Files that stay thin:** `packages/core/src/server/index.ts`, `packages/studio/server/app.ts`, the CLI update handler, and header components. Stop and revise before coding if version logic enters React/routes, a generic shell execution route appears, updater responsibilities accumulate in a broad installation file, or the UI requires a new app-wide settings/state system.

## Contracts And Error Policy

- The GET response uses `RenkuUpdateStatus` above; it is `Cache-Control: no-store`. The core fetch requests the current manifest without browser CORS or credentials. Core resolves the download origin from the existing server-process `RENKU_DOWNLOAD_BASE_URL` configuration, defaulting to `https://downloads.gorenku.com`. Require HTTPS except for an explicitly configured loopback HTTP origin used by the local test. The browser cannot choose the origin. Preserve the current beta path and validate `product`, `channel`, `version`, selected `target`, expected immutable `versionKey`, and SHA-256 shape before presenting an offer. The installer remains the final authority for the archive checksum and activation.
- `POST /studio-api/studio/update` has no request body. It may succeed only when a newer release is still offered and a terminal handoff starts. The POST cannot accept an arbitrary command or download URL. Existing same-origin/token protection is required; the terminal launch is user-initiated and never triggered by GET.
- Use domain-prefixed structured diagnostics in core for invalid/unreachable release metadata, unsupported/incomplete installation, no newer release at confirmation, duplicate handoff, and terminal-launch failure. Reuse `UPDATE001`/`UPDATE002` where their existing meanings fit; do not repurpose `UPDATE004` or return success on a failed launch. Studio maps these through the standard structured HTTP error path.
- The terminal handoff uses the installed launcher in `INSTALLATION.json`'s `binRoot`, never a PATH guess or an untrusted manifest URL. It runs the existing `renku studio stop` followed by `renku update`. On command failure, print the structured failure and the exact manual `renku studio start` recovery command. On success, run `renku studio start` in that visible terminal. No user-authored value is interpolated into terminal code.
- Explicitly carry the resolved download-source configuration and the originating profile/configuration context into the terminal session and restarted Studio. A GUI terminal does not necessarily inherit Studio's environment. The isolated test must fail before shutdown if its launch configuration would target the real installation or profile; do not introduce a generic environment or shell-command API for this purpose.

## Implementation Slices

1. **Status owner:** Add the core release check beside the existing installation service, with focused version/manifest tests. Export it through the core server entrypoint. Avoid a release schema change.
2. **Handoff owner:** Add terminal launch support in core for macOS and Windows, using installed paths and one in-process launch guard. Preserve `renku-update.ts` and the CLI contract. Exercise shutdown-before-update and failure behavior with injected process launchers, without actually installing during unit tests.
3. **Studio adapter:** Add the two Hono methods in `studio-update.ts`, mount them in `server/app.ts`, and test token enforcement, delegation, response/error serialization, and an empty POST body.
4. **Browser UI:** Add one app-level check timer/API client/conditional notice; make the Project Library brand one line and render the update icon before Settings in both headers only while an update is available. Use the existing `Button`, `Tooltip`, and `Dialog` primitives. Verify fixed header height, distinct Home/Update actions, keyboard tooltip and dialog focus return, **Not now** retaining the notice, confirmation, navigation persistence, loading, stale offer, failure, and the terminal handoff state. Do not introduce Settings or Project data state.
5. **Documentation:** Update the current beta update instructions and any current UI guidance affected by the chosen treatment. Keep this plan proposed until its choices are accepted; record final accepted direction in current `docs/` at implementation completion. No ADR is required unless implementation changes an accepted update or shutdown decision.

## Tests And Guardrails

- Core: exact six-hour scheduling belongs in the UI hook; core tests cover valid newer/current/rollback versions, malformed or missing current-platform artifact, unreachable manifest, installed metadata failure, and no download during check. Handoff tests cover absent/stale offer, concurrent launch, terminal failure without shutdown, and the fixed stop → update → restart sequence, including paths with spaces and shell-sensitive characters.
- Server: one focused route test per authorization/delegation/error shape; do not repeat the manifest invalidity matrix.
- UI: fake timers prove an immediate check and a check at six hours; tests prove one timer across navigation, one-line brand in both headers, separate Home-versus-notice interactions, notice absent for current/unknown state, notice persistent for an available release after **Not now** or a temporary check failure, confirmation without automatic download, no POST on GET or **Not now**, and failure without a false “current” state.
- Desktop manual: inspect the chosen control in the Project Library and an open Project, in light and dark themes, at the default and minimum desktop sidebar widths. Verify keyboard focus, screen-reader name, dialog text, progress handoff, and no clipped sidebar actions. Do not add mobile verification.
- Installed-product verification uses the repeatable local rehearsal below. It does not depend on waiting for or publishing a newer public beta. Focused handoff tests cover terminal-launch failure, slow shutdown, shutdown timeout, duplicate requests, and failure after runtime activation. Existing installer tests retain checksum/download and skills failure coverage at the installer boundary.

### Repeatable Local Update Rehearsal

Add a macOS-only developer harness at `scripts/release/verify-studio-update.mjs`, invoked as `node scripts/release/verify-studio-update.mjs <assembled-product-directory>`. It accepts an already built macOS product containing the new UI update implementation. It does not build dependencies, change repository version files, publish releases, or stop an existing Studio. If Studio's fixed port 5173 is occupied, it reports that prerequisite and exits.

1. Copy the assembled product into two isolated fixture trees labeled `0.0.1` and `0.0.2`. Both contain the same real implementation, with consistent `RELEASE.json` and CLI package-version metadata in the copies. Use the existing packager to create native archives and calculate their real SHA-256 values. This tests an actual installation change without needing two independently developed releases.
2. Start a loopback HTTP server with the normal channel-manifest and versioned-archive paths. Initially offer `0.0.1`; install it using the real native installer into a temporary installation, launcher, profile/configuration, and Project Library. Use a disposable Project created through current core commands. The complete path/environment setup must remain isolated through the terminal handoff, including agent-skills selection and shell-profile writes.
3. Change only the local server's manifest to offer `0.0.2`, then launch the installed `0.0.1`. Its normal launch check must show the update indicator. In this guided native check, the tester clicks the indicator and confirms, then handles the normal terminal prompts in the isolated profile. The harness performs setup and verification; the tester does not manually construct releases or install paths.
4. Observe a real archive request, successful checksum validation and activation, termination of the original Studio process, and a new Studio process serving `installedVersion: '0.0.2'`. Verify the rewritten launcher resolves to the second fixture, the update status is current, the notice is absent, and the disposable Project's saved domain values and media are intact. Compare Project contents through core rather than requiring byte-identical SQLite files.
5. Keep terminal output and the local server's request log as evidence. Failure remains visible with its stage; a restarted old version cannot pass. Report the result as macOS verification. Native Windows terminal launch and update/restart verification are deferred and are not part of this rehearsal.

The real-terminal rehearsal is a bounded integration check. Fast automated UI tests still use controlled status/POST responses, and fake timers advance six hours immediately. Core handoff tests inject process-launch outcomes; installer tests own their existing failure matrix. This combination keeps routine tests fast while retaining one repeatable proof of the complete native path. The loopback rehearsal proves the update client and installer flow, not public Cloudflare availability; the existing release-publication checks own the latter.

The completed macOS rehearsal recorded old Studio PID `83174`, restarted PID `84964`, a real `0.0.2` archive request, and a `current` status from the restarted application. Its request log and result are retained in `/var/folders/q5/wn2mpw2j7r3dp46mrt6vn_2r0000gn/T/renku-studio-update-rehearsal-LHvnay/`. The original Studio was restarted afterward. Native Windows verification remains deferred.

## Final Verification

Run focused core, server, and UI tests, `pnpm build`, `pnpm lint`, `pnpm check`, and the relevant release installer contract tests. Inspect `git diff --stat` and the complete diff; inspect any newly large or heavily modified file. Confirm `index.ts` files stay thin, no route/React release policy or generic shell API was added, existing update/stop tests still pass, and changes contain no formatting churn. Complete the macOS handoff rehearsal and report native Windows verification as deferred; it is not a completion gate.

## Completion Checklist

### Review Area

- [x] User accepts the utility notification design direction.
- [x] Review the explicit terminal/restart behavior.
- [x] Recheck that no adjacent Settings, channel, installer, or Project workflow was added.
- [x] Confirm the module shape matches the Architecture Shape Gate and no god file, catch-all helper, or broad dispatcher appears.

### Architecture And Contracts

- [x] Core alone validates the installed and beta release envelope and compares numeric versions.
- [x] Reuse `RENKU_DOWNLOAD_BASE_URL` consistently in checks and installation, preserve it through handoff, and keep it inaccessible to browser request input.
- [x] Core alone owns the fixed terminal stop → `renku update` → restart handoff and duplicate guard.
- [x] Preserve the existing CLI command, interactive skills installer, checksum path, and `UPDATE004` running-Studio guard.
- [x] Add the named GET/POST Studio routes with existing token/error handling and no request-controlled command input.
- [x] Keep `packages/core/src/server/index.ts` and `packages/studio/server/app.ts` as thin entrypoints.

### Implementation Slices

- [x] Check on Studio browser launch and every six hours while open, with no archive download or closed-app background task.
- [x] Present only a higher valid beta version; handle current, rollback, offline, invalid manifest, and non-installed development runtime correctly.
- [x] Render **Renku Studio** on one line in both top headers and the conditional update icon before Settings, with a tooltip, accessible name, and shared confirmation dialog; preserve the 56 px header height and show no standing update control or ephemeral announcement.
- [x] Keep logo/name navigation separate from the notice/dialog action, including keyboard activation and focus order.
- [x] Keep the notice after **Not now** and across navigation; ensure **Not now** performs no mutation and **Download and update** performs one protected handoff with a clear failure path.
- [x] Leave Studio running when terminal launch fails; show installer outcome in the terminal and reopen Studio on success.
- [x] Confirm terminal-side readiness before shutdown, survive server/browser closure, wait for actual shutdown completion, and restart through the rewritten installed launcher.

### Tests And Guardrails

- [x] Add focused core release-check and handoff tests at their owning layers.
- [x] Add focused route authorization/delegation/error tests without duplicating core's validation matrix.
- [x] Add UI timer, navigation, available-state, and dialog-interaction tests.
- [x] Add and run the isolated two-version rehearsal harness on macOS; require no public release publication and preserve evidence of the new running version.
- [x] Record native Windows end-to-end verification as deferred, without treating it as a completion blocker.
- [x] Prove the restarted application runs the updated version, the notice clears, and saved Project data remains intact; cover slow shutdown, timeout, and skills failure after runtime activation.

### Documentation

- [x] Update current distribution/CLI instructions to describe the Studio-initiated update path and recovery.
- [x] Update current UI guidance for the selected treatment and record accepted direction in `docs/`.
- [x] Leave historical plans and decisions untouched unless a new ADR genuinely supersedes one.

### Final Verification

- [x] Run focused tests, root build/lint/check, and relevant installer contract tests.
- [x] Inspect the Project Library and Movie Studio desktop headers in both themes, including default and minimum sidebar widths, focus, and dialog state.
- [x] Inspect `git diff --stat`, the complete diff, and large changed files; remove formatting churn.
- [x] Confirm no checklist item was satisfied by accepting unreviewable structure; only then mark the plan complete.
