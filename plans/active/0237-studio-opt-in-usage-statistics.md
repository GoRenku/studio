# 0237 Studio Opt-In Usage Statistics

Status: proposed (D1–D4 answered 2026-10-18)
Date: 2026-10-15

## Summary

Renku has no way to know whether anyone who installs it actually uses it.
Studio, the `renku` CLI, the server, Core and Studio Skills send nothing today,
and the Privacy Notice promises that the app collects no usage analytics. The
approved marketing plan needs a small, honest signal: how many installs start
Studio, create projects, import screenplays, download and open the sample film
and save generated media, which versions they run, and where people heard
about Renku. The signal is read on the existing **Renku growth** PostHog
dashboard.

This plan adds **usage statistics that are off until the user turns them on**:

- First-run setup gains a third, last step that asks once, with the switch off.
  Turning it on reveals an optional "Where did you hear about Renku?" choice.
- Studio Settings and a new `renku telemetry` CLI command show and change the
  choice later.
- Saying yes creates a random install ID on this computer. Saying no deletes
  it. `DO_NOT_TRACK`, `RENKU_TELEMETRY_DISABLED` and CI stop all sending.
  `RENKU_TELEMETRY_DEBUG` prints events instead of sending them.
- Core sends nine kinds of event to the PostHog EU project the website already
  uses, as plain HTTPS requests with no new dependency. Every field is listed
  publicly in the Privacy Notice.
- The **Renku growth** dashboard script (`scripts/growth-dashboard/`) gains a
  "Renku Studio" section that charts these events.
- Nothing about the user's work is ever sent: no file names, paths, prompts,
  screenplay text, media, API keys, project names or titles, and no provider
  or model ids.

Code, CLI and environment names use **telemetry**, matching the requested
`RENKU_TELEMETRY_DISABLED` switch and the commands other tools use
(`next telemetry`, `astro telemetry`, `turbo telemetry`). Everything people read
(Studio, Privacy Notice, CLI messages) says **usage statistics**.

## Review Attention

- **What changes for users**
  - New installs see a third first-run screen, "Help improve Renku", with the
    switch off. Continuing without touching it sends nothing and stores
    nothing.
  - Settings gains a "Usage statistics" section under the provider keys.
    While on, it shows the install ID with a Copy button and how to ask for
    deletion, so deletion requests do not need the CLI (added 2026-10-18).
  - Existing installs are not asked, because first-run setup only appears when
    no `config.yaml` exists. They stay off unless the user turns the switch on
    in Settings or runs `renku telemetry enable`.
- **Added beyond the literal request, and why**
  - **Version and system go on every event**, not only `studio_started`. The
    install ID already links all events from one computer, so this reveals
    nothing new, and it lets one sender build every event the same way.
  - **`project_created` has no extra field.** In Renku a project is always
    created empty; an FDX is imported into it later by an agent through
    `renku screenplay import-fdx` (`docs/architecture/frontend.md`, Project
    Library Lifecycle), so FDX use is its own `fdx_imported` event (D2). The
    sample film (plan 0236, shipped) is not created through
    `createMovieProject` either: Core downloads and unpacks a released
    project, so it has its own events below and is never counted as
    `project_created`.
  - **Sample film download and open are three events** (maintainer request,
    2026-10-18): `sample_film_download_started` and
    `sample_film_download_finished` (`result: installed | failed`) from Core's
    two sample installation entry points (Studio's button and
    `renku sample-film install`), and `sample_film_opened` when Studio opens the
    sample project. Asking again when the sample is already in the Library
    records nothing.
  - **A failed sample download carries its Renku error code** (for example a
    disk-space or network code from `sample-film-errors.ts`), never the error
    message. Without it the dashboard could show that downloads fail but not
    why. Error codes are fixed Renku strings and hold no user content.
  - **"Opened" needs a new focused Core wiring method.** Today the Studio route
    `GET /studio-api/projects/:projectName` calls `readProjectShell`, which CLI
    commands and refresh events also call, so recording there would count
    agent activity as opens. A new `openProjectInStudio({ projectName })`
    reads the shell exactly as before and records `sample_film_opened` when
    the project is the sample; only that route calls it. Core, not the route,
    decides which project is the sample. Reloads and reopenings record again;
    the dashboard counts distinct installs, not raw opens.
  - **`generation_completed` counts generated files saved into a project**, not
    provider runs. Renku Core never sees every run (Codex's built-in image
    generator and agent tools run outside it), but every generated image,
    video or audio file that reaches a project passes through Core. Image
    edits count as `image`; discarded or failed generations are not counted.
  - **A one-line note explains when sending is blocked.** If someone turns the
    switch on while `DO_NOT_TRACK` is set, Studio and `renku telemetry status`
    say nothing is sent and why. Without it the switch would look broken.
  - **Test and E2E configurations set `RENKU_TELEMETRY_DISABLED=1`** so a
    developer who opted in on their own machine never sends test events.
  - **The release-metadata reader is pulled out of the update check** so both
    the update check and telemetry read the installed version the same way.
    Source checkouts report the version as `development`.
  - **One sentence on the website Quick Start page** says the last first-run
    screen asks about usage statistics (the page walks through first-run
    screens today).
  - **The Renku growth dashboard gets a "Renku Studio" section** (maintainer
    request, 2026-10-18), added to the existing API-driven dashboard script
    from plan 0235, not a new dashboard. One new chart file and one new
    section; "At a glance" is unchanged.
- **New or changed public contracts**
  - New file `<config folder>/telemetry.json`, present only while statistics
    are on: `{ "formatVersion": 1, "installId": "<random UUID>" }`.
  - New environment variables read by Renku: `DO_NOT_TRACK`,
    `RENKU_TELEMETRY_DISABLED`, `CI`, `RENKU_TELEMETRY_DEBUG`.
  - New CLI command `renku telemetry status|enable|disable [--json]`.
  - New Studio route `GET` and `PUT /studio-api/telemetry`.
  - New diagnostics `CORE_TELEMETRY_CHOICE_INVALID`,
    `CORE_TELEMETRY_FILE_INVALID`, `CORE_TELEMETRY_FILE_IO_FAILED`,
    `STUDIO_SERVER362`, `CLI169`.
  - New outbound request: `POST https://eu.i.posthog.com/i/v0/e/`, only when
    the user said yes and no environment switch blocks it.
  - New ADR 0120 and a Privacy Notice section `#app-usage-statistics`.
  - New Core wiring method `openProjectInStudio`; the Studio project route
    calls it instead of `readProjectShell`.
  - Dashboard: new `scripts/growth-dashboard/studio-charts.mjs`, a `STUDIO`
    filter in `chart-queries.mjs`, a new section in `dashboard-tiles.mjs`,
    and an updated host-filter test.
- **Hard to reverse**
  - Events sent to PostHog stay there until deleted. Deleting one install's
    events needs a PostHog action by the maintainer (see "What only the
    maintainer can do").
  - The Privacy Notice must be published before the first Renku release that
    can send events.
- **Kept unchanged**
  - The update check (`downloads.gorenku.com/.../release.json`) still sends no
    ID and is not affected by the choice.
  - The `config.yaml` format and the rule that `config.yaml` existing is the
    only setup marker (ADR 0085). No onboarding-completed state is added.
  - Core domain commands, project databases, Studio Skills and the Codex
    plugin. React sends no events.
  - The Terms of Use (D4).
- **Assumptions**
  - The shared PostHog project keeps the website's public project token and EU
    host; Studio events carry `surface: "studio"` (plan 0234 owns the project,
    the website-events list and dashboards).
  - PostHog keeps one person record per install ID with no person properties,
    so the maintainer can delete one install's events on request. PostHog
    documents deletion through person records; it does not document deleting
    anonymous events by ID. Expected volume is far inside the free plan.
  - Recording never fails or delays a user action's result. A short `renku`
    command may stay open up to 2 seconds after printing its result while one
    event finishes, and turning statistics off waits up to 2 seconds for the
    opt-out event.
- **Decisions** (answered 2026-10-18; details in "Decisions")
  - D1: opt-in.
  - D2: add `fdx_imported`.
  - D3: the proposed answer list as written.
  - D4: no Terms change.
  - Existing installs are not asked at startup; they can turn statistics on in
    Settings.
  - PostHog project checks (IP setting, test event, deletion test) are handled
    in a separate session.

## Decisions

### D1. Opt-in (proposed) or opt-out

**Answered 2026-10-18: opt-in.** Nothing is sent until the user turns the
switch on.

The alternative is on-by-default with a first-run notice and an off switch.
Consequences of opt-out:

- the Privacy Notice must say statistics are collected by default and the
  "Renku Studio runs locally" paragraph must say so up front;
- the first-run screen becomes a notice ("Renku sends usage statistics; turn
  them off here") and the install ID is created before anyone agrees. In the
  EU, storing and reading an ID on someone's device for statistics generally
  needs consent, so opt-out would need a legal check first;
- recent history is against it: Go's 2023 on-by-default proposal ended as
  local-only collection with opt-in upload, and Audacity reversed its 2021
  analytics plan after backlash. Renku's audience is open-source creators
  who chose a local tool.

Opt-in yields fewer data points but no trust cost.

### D2. FDX signal

**Answered 2026-10-18: add `fdx_imported`** with no extra fields, recorded
when Core finishes `importFdxScreenplay`. It answers whether people bring their
own screenplays.

### D3. "Where did you hear about Renku?" answers

**Answered 2026-10-18: the list below as written.** Closed list (wire value,
visible label). "Other" has no text box, so no free text that could hold
personal information is ever sent:

| Value | Label |
| --- | --- |
| `github` | GitHub |
| `hn` | Hacker News |
| `reddit` | Reddit |
| `youtube` | YouTube |
| `x` | X (Twitter) |
| `linkedin` | LinkedIn |
| `search` | A search engine |
| `ai-assistant` | An AI assistant |
| `friend-or-colleague` | A friend or colleague |
| `latentmatinee` | Latent Matinee |
| `other` | Other |

Where a value overlaps a UTM source from plan 0234, use the same spelling.

### D4. Terms of Use

**Answered 2026-10-18: no Terms change.** The Terms
(`packages/website/src/pages/terms.astro`, dated 23 September 2026) describe the
tools and the limits of what Renku provides; they make no promise about data,
so nothing in them becomes untrue. Data practices belong in the Privacy Notice.

The rejected alternative was one added sentence, which would have needed a new
dated Terms page and a new `TERMS_VERSION` in both installers, and would have
asked every existing user to accept the Terms again.

## What Users See

### First-run setup

`OnboardingScreen` gains a third step after Provider API keys. Its header label
reads "Usage statistics". The card uses the same layout as the two existing
steps (icon tile, large heading, muted body, bordered footer) at the same
`max-w-3xl` width.

- Heading: **Help improve Renku**
- Body: "Renku can send a few usage statistics so we can see which versions
  people run and whether projects and generations work. A random ID for this
  computer links them. Renku never sends your files, file paths, prompts,
  screenplay text, media, API keys or project names."
- Link: "See every field Renku sends" →
  `https://gorenku.com/privacy#app-usage-statistics` (new tab).
- Switch: "Share usage statistics", off unless already on.
- While the switch is on: Select "Where did you hear about Renku? (optional)"
  with the D3 labels and placeholder "Choose an answer".
- When an environment switch blocks sending, one muted line under the switch:
  - `DO_NOT_TRACK`: "Nothing is sent while DO_NOT_TRACK is set on this computer."
  - `RENKU_TELEMETRY_DISABLED`: "Nothing is sent while RENKU_TELEMETRY_DISABLED is set."
  - `CI`: "Nothing is sent while Renku runs in CI."
- Footer: one primary button, **Continue**.
  - Switch unchanged from the loaded state and no answer chosen: no request;
    setup finishes.
  - Otherwise Studio sends `PUT /studio-api/telemetry` with
    `{ enabled, heardAbout? }`, then finishes. A failure shows the existing
    destructive Alert with the structured message and keeps the step open.

If the user closes Studio before this step, it is not shown again (config
exists). Statistics stay off.

### Settings

`AppSettingsDialog` gets two headed sections: "Provider API keys" (existing
fields, unchanged) and "Usage statistics" (the same switch, link and blocked
note; no heard-about question). The switch is part of the dialog's draft:
**Save** applies provider key changes and the statistics change, and is enabled
when either changed. Turning the switch off and saving sends one last
`telemetry_opted_out` event (unless blocked), then deletes the install ID.

While the saved choice is on, the section also shows the install ID so a user
who never opens a terminal can ask for deletion (GDPR erasure):

- a read-only row "Install ID" with the UUID from `TelemetryStatus.installId`
  and a **Copy** `Button` (same `navigator.clipboard` pattern as
  `agent-prompt.tsx`);
- one line under it: "To have statistics already sent deleted, email
  support@codingventures.com with this ID before you turn statistics off.
  Turning off removes the ID from this computer."

The row reflects the saved status, not the draft: it is hidden while off, and
appears after saving a switch from off to on. No new Core or HTTP field:
`GET /studio-api/telemetry` already returns `installId`.

The screen-reader description becomes "Manage provider API keys and usage
statistics."

### CLI

```bash
renku telemetry status [--json]
renku telemetry enable [--json]
renku telemetry disable [--json]
```

Plain `status` output:

```text
Usage statistics: on
Install ID: 0b6f6c1e-8a7d-4f0e-9c55-2f1d1c7a9e10
Sending: no (DO_NOT_TRACK is set)
Debug printing: off
Every field Renku sends: https://gorenku.com/privacy#app-usage-statistics
```

`enable` and `disable` print the same status afterwards. `--json` prints Core's
`TelemetryStatus`. `disable` also works when `telemetry.json` is unreadable: it
deletes the file without sending anything. Studio Skills never run `enable`;
they are not changed.

Why both Settings and the CLI: Settings is where the first-run question was
answered and where most users change it. Renku is also driven by agents, and an
agent asked to "turn off Renku's usage statistics" can run a command but cannot
click Settings. Both Settings and `status` show the install ID, which a user
needs before asking for their events to be deleted.

## Events And Fields

Every event is one `POST https://eu.i.posthog.com/i/v0/e/` request:

```json
{
  "api_key": "phc_rTTOTmP5c7ZzNTKVMbVwEzmyofCP3dio7ZSI1Zavub6",
  "event": "generation_completed",
  "distinct_id": "0b6f6c1e-8a7d-4f0e-9c55-2f1d1c7a9e10",
  "timestamp": "2026-10-15T10:00:00.000Z",
  "properties": {
    "surface": "studio",
    "version": "0.1.35",
    "platform": "darwin",
    "arch": "arm64",
    "media_kind": "video",
    "$geoip_disable": true
  }
}
```

The `api_key` is the website's public PostHog project token
(`packages/website/src/components/WebsiteAnalytics.astro`); it can only write
events. `$geoip_disable: true` tells PostHog not to look up a location from the
request's network address. Renku does not send `$process_person_profile: false`
and never sends person properties, so PostHog keeps one empty person record per
install ID; that record is what lets the maintainer delete one install's events.

Fields on every event:

| Field | Meaning |
| --- | --- |
| `distinct_id` | The random install ID from `telemetry.json`. |
| `timestamp` | When the event happened. |
| `surface` | Always `studio`, to separate Renku events from website events in the shared project. |
| `version` | Installed Renku version from `RELEASE.json`, or `development` for a source checkout. |
| `platform` | Node's `process.platform`: `darwin`, `win32` or `linux`. |
| `arch` | Node's `process.arch`: `arm64` or `x64`. |

Events:

| Event | Sent when | Extra field |
| --- | --- | --- |
| `studio_started` | The Studio server starts (`renku studio start`). | none |
| `project_created` | Core creates a project. | none |
| `fdx_imported` | Core finishes importing an FDX screenplay into a project. | none |
| `sample_film_download_started` | Core starts downloading the sample film (Studio button or `renku sample-film install`). Not sent when the sample is already in the Library. | none |
| `sample_film_download_finished` | That download ends. | `result`: `installed` or `failed`; `error_code`: the Renku error code, only when `failed` |
| `sample_film_opened` | Studio opens the sample project. | none |
| `generation_completed` | Core saves a generated image, video or audio file into a project. | `media_kind`: `image`, `video` or `audio` |
| `heard_about` | The user turns statistics on at first run and picks an answer. | `answer`: one D3 value |
| `telemetry_opted_out` | The user turns statistics off after they were on. | none |

Never sent, by construction (no event type has a field that could carry them):
file names, paths, Project names, titles, loglines, screenplay or prompt text,
media or references, API keys, provider or model ids, Asset ids, generation
purposes, counts of project contents, error messages, free text of any kind.
`sample_film_opened` is recorded only for the sample; other projects' opens are
not recorded.

## Rules

1. **Choice.** `telemetry.json` exists ⇔ statistics are on. Absent means off.
   Turning on creates the file with `crypto.randomUUID()`; turning on again
   keeps the existing ID. Turning off deletes the file.
2. **Environment switches.** Before anything else, Core reads the environment
   of the running Renku process. Each of `DO_NOT_TRACK`,
   `RENKU_TELEMETRY_DISABLED` and `CI` blocks every send (including
   `telemetry_opted_out` and debug printing) when it is set to anything other
   than an empty string, `0` or `false`. Checked in that order; the first match
   is reported as `blockedBy`. The saved choice is not changed.
3. **Debug.** `RENKU_TELEMETRY_DEBUG` set (same truthiness) prints each event
   that would be sent to stderr as
   `renku usage statistics (debug, not sent): <JSON without api_key>` and sends
   nothing. Combined with turning statistics on, it lets anyone preview the
   exact output without anything leaving the computer.
4. **Never in the way.** A send has a 2-second timeout. Network errors, HTTP
   errors, an unreadable `telemetry.json` and an unreadable `RELEASE.json`
   during recording are swallowed: the event is skipped (debug mode prints the
   reason). Recording never throws into, delays the result of, or changes the
   outcome of the operation that triggered it. This is a deliberate, documented
   exception to fail-fast for an optional side channel; reading or changing the
   choice through `status`, `enable`, `disable` or Settings still fails fast
   with structured errors.
5. **Fresh read.** Every event reads the choice and environment again, so a
   change in Settings or the CLI applies to all running Renku processes
   immediately.
6. **heard_about.** Accepted only together with `enabled: true`; sent once,
   right after the choice is saved.
7. **Opt-out event.** On `enabled: false` when the file existed and no switch
   blocks: send `telemetry_opted_out` with the old ID (waiting at most
   2 seconds), then delete the file whether or not the send succeeded.

## Requirement Ledger

| Requirement | Source | Owner and section |
| --- | --- | --- |
| Ask once at first run, default off | User request 1 | Studio onboarding step; What Users See |
| Change later in Settings and CLI | User request 1 | Settings section; `renku telemetry` |
| Install ID only after yes, deleted on no | User request 2 | Core `choice-file.ts`; Rule 1 |
| `DO_NOT_TRACK`, `RENKU_TELEMETRY_DISABLED`, CI | User request 2 | Core `environment.ts`; Rule 2 |
| Debug mode prints instead of sending | User request 2 | Core `capture.ts`; Rule 3 |
| Public list of every field | User request 2 | Privacy Notice `#app-usage-statistics` |
| Never send work content or secrets | User request 2; AGENTS opaque-artifact rule | Closed event union; payload test |
| No provider or model ids | AGENTS "Model knowledge" rule | Closed event union |
| Small event set at its rightful owner | User request 3 | Core wiring, Studio runtime; Events |
| Optional heard-about, closed list, only with consent | User request 4 | Onboarding step; Rule 6; D3 |
| Privacy Notice app paragraph, Terms check, ADR | User request 5 | Documentation; D4 |
| No new dependency; plain HTTP | Maintainer preference | `capture.ts` uses global `fetch` |
| Recording never breaks user work | Operational boundary | Rule 4 |
| Tests never send real events | Data-integrity boundary | Test configuration guards |
| Track sample film download and open | Maintainer, 2026-10-18 | Core sample installation entry points, `openProjectInStudio`; Events |
| See the data in the PostHog dashboard | Maintainer, 2026-10-18 | `scripts/growth-dashboard/studio-charts.mjs`; Dashboard |

## Context And Evidence

- AGENTS.md architecture rules; `docs/architecture/layers-of-responsibility.md`;
  `docs/architecture/frontend.md` (Settings ownership; projects are created
  empty and FDX import is a later agent workflow);
  `docs/architecture/reference/structured-diagnostics.md` (code namespaces,
  HTTP mapping by prefix).
- ADR 0084 (global provider credential storage), ADR 0085 (platform config
  paths and first-run setup: config existence is the only setup marker),
  ADR 0086 (agent-directed generation and Asset provenance).
- Plans 0212 (update check), 0230 (claims ADR 0119), sibling plans 0234 (PostHog
  project, website-events list, UTM convention), 0235 (the Renku growth
  dashboard script) and 0236 (sample film, shipped).
- Sample film code (0236): `packages/core/src/server/sample-film/`.
  `installSampleFilm` (`install-sample-film.ts`, used by
  `renku sample-film install`) and `createStudioSampleFilmInstallation`
  (`studio-installation.ts`, behind `POST /studio-api/sample-film`) are the two
  entry points; both return early when the sample is already in the Library
  and otherwise call `completeSampleFilmInstallation`. The sample project's
  name is `SAMPLE_FILM_PROJECT_NAME` (`sample-film-release.ts`).
- Studio opens a project through `GET /studio-api/projects/:projectName`
  (`packages/studio/server/routes/projects.ts`), which calls
  `readProjectShell`. `readProjectShell` is also called by
  `routes/studio-events.ts`, `renku project info` and
  `renku studio notify-refresh`.
- Dashboard (0235): `scripts/growth-dashboard/` builds every chart in code and
  `pnpm growth:dashboard` publishes it through the PostHog API
  (`docs/operations/growth-report.md`, "Dashboard"). `dashboard-tiles.test.mjs`
  currently requires every trends chart to filter on a website host.
- Current code:
  - `packages/core/src/server/config/paths.ts`: `resolveRenkuConfigDir`.
  - `packages/core/src/server/config/setup.ts`, `packages/studio/src/app/studio-setup-gate.tsx`:
    onboarding shows only while `config.yaml` is absent.
  - `packages/studio/src/features/onboarding/` (two steps) and
    `packages/studio/src/features/settings/` (`AppSettingsDialog`,
    `ProviderCredentialsFields` shared by onboarding and Settings,
    `useProviderCredentialsDraft`).
  - `packages/core/src/server/project-data-service-wiring/`: the Core layer
    every adapter calls. `createMovieProject` is the only project creation path
    (`project-administration.ts`); `importFdxScreenplay` (`screenplay.ts`);
    generated media is saved by `attachGenerationMedia`,
    `attachShotPlanDialogueAudio`, `attachSceneStoryboardImages`
    (`generation.ts`) and `attachCastVoice` (`cast-voices.ts`). Saved files
    carry `origin: 'generated'` when provenance is present.
  - `packages/core/src/server/installation/renku-release-check.ts`: reads and
    validates `RELEASE.json` inline before fetching the manifest.
  - `packages/studio/server/runtime.ts`: `startMovieStudioServer`, the one
    production Studio start (called by `renku studio start` and `server/bin.ts`).
  - The CLI sets `process.exitCode` and never calls `process.exit`, so a pending
    send finishes (or times out) before a short command's process exits.
  - Provider credentials use an atomic temp-file-and-rename write in
    `provider-credentials/store.ts`; the telemetry file follows it.
- Website: `packages/website/src/pages/privacy.astro` ("we do not collect app
  usage analytics ... through the app"), `terms.astro` and
  `terms/2026-09-23.astro`, `quick-start.astro` (lists first-run screens),
  `components/WebsiteAnalytics.astro` (token and EU host).
- External evidence (2026-10-15): PostHog capture API `POST /i/v0/e/` with
  `api_key`, `event`, `distinct_id`, `properties`, `timestamp`
  (posthog.com/docs/api/capture); `$geoip_disable` makes the GeoIP step skip an
  event (PostHog GeoIP plugin README; posthog-node sets it by default); IP
  storage is a per-project setting and EU organizations default to not storing
  IPs (posthog.com/docs/privacy/data-collection); deletion is documented
  through person records (posthog.com/docs/privacy/data-storage). Next.js
  offers `NEXT_TELEMETRY_DISABLED`, `next telemetry status|disable` and a debug
  mode that prints instead of sending; Homebrew uses no user ID and shows a
  notice before the first send; Turborepo and others honour `DO_NOT_TRACK`.
- `urban-basilica` is not needed: no project data is read for statistics, and
  verification uses a throwaway home folder so the real project is never
  touched.

## Architecture Shape Gate

### Ownership

- **Core** owns the whole capability: the choice file, the environment rules,
  the closed event vocabulary, the payload, sending and printing, and the
  observation points inside its own service wiring.
- **Studio server** owns only the `studio_started` call (its own lifecycle) and
  a thin route that parses HTTP and calls Core. The project route calls Core's
  `openProjectInStudio` and never decides whether a project is the sample.
- **Dashboard script** (`scripts/growth-dashboard/`) owns only chart
  definitions over the event names and fields in "Events And Fields".
- **CLI** owns only parsing, delegation and formatting for `renku telemetry`.
- **React** shows the choice and sends the user's intent. It never builds or
  sends an event and never applies the environment or consent rules itself.
- Core domain commands (`createMovieProject`, `attachGenerationMedia`, …) stay
  unaware of telemetry. Recording happens in the wiring after the command
  returns.

### Module layout

```text
packages/core/src/client/telemetry.ts            types, HEARD_ABOUT_RENKU_ANSWERS, labels
packages/core/src/server/telemetry/
  choice-file.ts     read, create, delete telemetry.json (atomic write)
  environment.ts     DO_NOT_TRACK / RENKU_TELEMETRY_DISABLED / CI / debug
  capture.ts         build the PostHog request from one event; send or print
  service.ts         readTelemetryStatus, setTelemetryChoice, recordTelemetryEvent
  errors.ts          TelemetryError (StructuredError)
  index.ts           re-exports only
packages/core/src/server/installation/installed-release.ts   readInstalledRenkuRelease
packages/studio/server/routes/telemetry.ts
packages/studio/server/http/telemetry-choice-request.ts
packages/studio/src/services/studio-telemetry-api.ts
packages/studio/src/features/settings/telemetry-choice-fields.tsx
packages/studio/src/features/settings/use-telemetry-choice-draft.ts
packages/studio/src/features/onboarding/telemetry-step.tsx
packages/cli/src/commands/telemetry-command.ts
scripts/growth-dashboard/studio-charts.mjs
```

Changed files: `packages/core/src/server/index.ts` and
`packages/core/src/client/index.ts` (export the new module),
`installation/renku-release-check.ts` (uses `readInstalledRenkuRelease`),
`project-data-service-wiring/{project-administration,screenplay,generation,cast-voices}.ts`
(record after success; `project-administration.ts` also gains
`openProjectInStudio`), `sample-film/{install-sample-film,studio-installation}.ts`
(record download start and finish), `packages/studio/server/app.ts` (mount
route), `packages/studio/server/routes/projects.ts` (call
`openProjectInStudio`), `packages/studio/server/runtime.ts` (record
`studio_started` after listen), `onboarding-screen.tsx`,
`app-settings-dialog.tsx`, `packages/cli/src/commands/registry.ts` and
top-level help, test configs, `scripts/growth-dashboard/{chart-queries,dashboard-tiles}.mjs`
and `dashboard-tiles.test.mjs`.

### Shapes

- `capture.ts` holds one exhaustive, typed table from event name to its extra
  properties. Adding an event means adding a union member and one table entry;
  the compiler rejects a missing entry. No `if`/`else` chain over event names.
- Each wiring method adds one line after its command succeeds, e.g.
  `void recordTelemetryEvent({ name: 'project_created' }, input)`.
  The two sample installation entry points each add one line before the
  download starts and one in its success and failure handlers; the shared
  download, unpack and placement code (`completeSampleFilmInstallation` and
  below) stays unaware of telemetry.
  For saved media, one small Core-internal function in `service.ts`,
  `generationCompletedEvent(assetFiles)`, returns the event (or `null`) from
  the first returned AssetFile with `origin: 'generated'` and media kind
  `image`, `video` or `audio`, so the four save methods share one rule.
- `index.ts` files stay thin re-exports.

### Forbidden

- Any event, field or code path that reads a Project name, title, path, prompt,
  provenance, provider or model id into a telemetry payload.
- Sending or deciding events in React, in Studio route handlers (other than the
  runtime's `studio_started`), in CLI handlers, or in Core domain commands.
- Any other module in Studio packages contacting the PostHog host.
- Caching the choice in memory across events; a background queue, retry store
  or offline backlog.
- An `npm` dependency for analytics or CI detection.

### Stop conditions

- A wiring method needs more than one line to record, or needs to inspect
  domain content to decide: move the rule into `service.ts` or stop and ask.
- `capture.ts` needs a branch per event outside the typed table.
- A needed event cannot be observed in Core wiring or the Studio runtime
  without reading project content: drop the event and report it.

## Contracts

### Core client (`packages/core/src/client/telemetry.ts`)

```ts
export const HEARD_ABOUT_RENKU_ANSWERS = [
  'github', 'hn', 'reddit', 'youtube', 'x', 'linkedin', 'search',
  'ai-assistant', 'friend-or-colleague', 'latentmatinee', 'other',
] as const;
export type HeardAboutRenkuAnswer = (typeof HEARD_ABOUT_RENKU_ANSWERS)[number];
export const HEARD_ABOUT_RENKU_ANSWER_LABELS: Record<HeardAboutRenkuAnswer, string>; // D3 labels

export type TelemetryBlock = 'DO_NOT_TRACK' | 'RENKU_TELEMETRY_DISABLED' | 'CI';

export interface TelemetryStatus {
  enabled: boolean;               // telemetry.json exists
  installId: string | null;       // only when enabled
  blockedBy: TelemetryBlock | null;
  debug: boolean;                 // RENKU_TELEMETRY_DEBUG is set
}

export interface TelemetryChoice {
  enabled: boolean;
  heardAbout?: HeardAboutRenkuAnswer; // only with enabled: true
}

export type TelemetryEvent =
  | { name: 'studio_started' }
  | { name: 'project_created' }
  | { name: 'fdx_imported' }
  | { name: 'sample_film_download_started' }
  | { name: 'sample_film_download_finished'; result: 'installed' }
  | { name: 'sample_film_download_finished'; result: 'failed'; errorCode: string } // StructuredError.code only
  | { name: 'sample_film_opened' }
  | { name: 'generation_completed'; mediaKind: 'image' | 'video' | 'audio' }
  | { name: 'heard_about'; answer: HeardAboutRenkuAnswer }
  | { name: 'telemetry_opted_out' };

export const TELEMETRY_FIELD_LIST_URL =
  'https://gorenku.com/privacy#app-usage-statistics';
```

`errorCode` is filled only from a `StructuredError`'s `code` (an unexpected
error is first wrapped by the existing `sampleFilmInstallationFailedError`, as
`studio-installation.ts` already does), so it is always a fixed Renku code.

### Core server

Exported from `@gorenku/studio-core/server` (Studio server and CLI use these):

```ts
readTelemetryStatus(options?: RenkuConfigPathOptions): Promise<TelemetryStatus>;
setTelemetryChoice(input: RenkuConfigPathOptions & { choice: TelemetryChoice }): Promise<TelemetryStatus>;
recordTelemetryEvent(event: TelemetryEvent, options?: RenkuConfigPathOptions): Promise<void>; // never rejects
```

New `ProjectDataService` method, used only by the Studio project route:

```ts
openProjectInStudio(input: ReadProjectInput): Promise<ProjectShell>;
// same result and errors as readProjectShell; records sample_film_opened
// for the sample project after the read succeeds
```

Core-internal (used by the wiring and the update check, not exported from the
package):

```ts
generationCompletedEvent(assetFiles: AssetFile[]): TelemetryEvent | null;
readInstalledRenkuRelease(options?: { executable?: string; platform?: NodeJS.Platform }):
  { version: string; target: string } | null;
  // null when not installed (source checkout, Linux); throws UPDATE005 when
  // installed release metadata is broken, exactly as the update check does today
```

Tests reach the sender through internal options of the same functions
(`environment`, `fetcher`, `printDebug`), mirroring `checkRenkuUpdateWithOptions`;
those options are not exported from `index.ts`.

Observation points (each after the command succeeds, never awaited by the
caller):

| Wiring method | Event |
| --- | --- |
| `createMovieProject` | `project_created` |
| `importFdxScreenplay` | `fdx_imported` |
| `installSampleFilmWithOptions` and `createStudioSampleFilmInstallation().start`, after preparation finds no sample in the Library | `sample_film_download_started`; then `sample_film_download_finished` with `result: 'installed'`, or `result: 'failed'` and the structured error code |
| `openProjectInStudio` (new wiring method in `project-administration.ts`), when `projectName` is `SAMPLE_FILM_PROJECT_NAME` | `sample_film_opened` |
| `attachGenerationMedia`, `attachShotPlanDialogueAudio`, `attachSceneStoryboardImages` | `generationCompletedEvent(<returned AssetFiles>)` when not `null` |
| `attachCastVoice` | `generation_completed`, `mediaKind: 'audio'`, when the attached voice has generation provenance |
| `startMovieStudioServer` (Studio server) | `studio_started`, after the server listens |

### Diagnostics

- `CORE_TELEMETRY_CHOICE_INVALID`: `heardAbout` not in the list, or given with
  `enabled: false`.
- `CORE_TELEMETRY_FILE_INVALID`: `telemetry.json` is not exactly
  `{ formatVersion: 1, installId: <UUID> }`. Suggestion: "Run
  `renku telemetry disable` to remove it, or turn usage statistics off in
  Settings."
- `CORE_TELEMETRY_FILE_IO_FAILED`: the file cannot be read, written or deleted.
- `STUDIO_SERVER362`: the HTTP body is not `{ enabled: boolean, heardAbout?: string }`.
- `CLI169`: unknown `renku telemetry` subcommand or extra arguments.

`STUDIO_SERVER362` is the next free server code today, and `CLI169` follows
`CLI168`, which plan 0236 uses.

### Studio HTTP

- `GET /studio-api/telemetry` → `{ status: TelemetryStatus }`
- `PUT /studio-api/telemetry` with `TelemetryChoice` → `{ status: TelemetryStatus }`

Both token-protected and `Cache-Control: no-store`, like
`/studio-api/provider-credentials`.

## Implementation Slices

### Slice 1: Core telemetry module

- `client/telemetry.ts` and exports.
- `installation/installed-release.ts`: move the `RELEASE.json` read and
  validation out of `renku-release-check.ts`; the update check calls it and
  keeps its `UPDATE005` behavior.
- `server/telemetry/` files as laid out; `capture.ts` holds the host
  `https://eu.i.posthog.com` and the public project token.
- `RENKU_TELEMETRY_DISABLED=1` in the `test.env` of
  `packages/core/vitest{,.integration}.config.ts`,
  `packages/cli/vitest{,.integration,.e2e}.config.ts`,
  `packages/codex/vitest.config.ts`,
  `packages/studio/vitest{,.integration}.config.ts`, and in the
  `webServer.env` of `packages/studio/playwright.config.ts`. The onboarding
  config `packages/studio/playwright.onboarding.config.ts` sets
  `RENKU_TELEMETRY_DEBUG=1` instead, so the opt-in path runs without sending.
  Core tests that exercise the switches pass their own environment.

### Slice 2: Observation points

- One line per wiring method in the table above, plus `studio_started` in
  `runtime.ts`.
- Sample film: start and finish lines in the two entry points;
  `openProjectInStudio` in `project-administration.ts`; the Studio project
  route (`routes/projects.ts`, `ProjectsRouteProjectData`) calls it instead of
  `readProjectShell`, and the fake project data service gains it.

### Slice 3: CLI

- `telemetry-command.ts` registered in `registry.ts`; top-level help lists it.
- `docs/cli/commands.md`: new `renku telemetry` section with the environment
  variables.

### Slice 4: Studio server

- `routes/telemetry.ts`, `http/telemetry-choice-request.ts`, mount in `app.ts`.

### Slice 5: Studio UI

- `studio-telemetry-api.ts`; `telemetry-choice-fields.tsx` (switch, link,
  blocked note, optional heard-about Select) used by both surfaces;
  `use-telemetry-choice-draft.ts` (load, draft, dirty, save).
- `telemetry-step.tsx` and the third step in `onboarding-screen.tsx`.
- Settings section and combined Save in `app-settings-dialog.tsx`, with the
  saved install ID row, Copy button and deletion line while on.
- Only `@/ui` controls (`Switch`, `Select`, `Button`, `Alert`); the link uses
  the existing `<a target='_blank' rel='noreferrer'>` pattern.

### Slice 6: Website and decision record

- Privacy Notice changes below; Quick Start sentence; ADR 0120; ADR 0085
  notice; README configuration paragraph.

### Slice 7: Renku growth dashboard

See "Dashboard" below.

## Dashboard

The events are read on the existing **Renku growth** dashboard in the Renku
Website PostHog project, which `pnpm growth:dashboard` builds from
`scripts/growth-dashboard/` (plan 0235). No dashboard is made by hand.

- `chart-queries.mjs`: add `STUDIO = [{ key: 'surface', value: ['studio'], operator: 'exact', type: 'event' }]`.
- New `studio-charts.mjs` exporting `STUDIO_CHARTS`. Every chart filters on
  `STUDIO`. "Installs" means distinct install IDs (`math: 'dau'` in trends,
  `count(DISTINCT distinct_id)` in SQL).

| Chart | Shows | Width |
| --- | --- | --- |
| Studio installs sharing statistics | Distinct installs with any Studio event per week, 90 days | 6 |
| Studio starts per week | `studio_started` total and distinct installs, 90 days | 6 |
| Sample film path | Of installs in the last 30 days: started a sample download, finished with `installed`, opened the sample (table) | 6 |
| Sample download failures | `sample_film_download_finished` with `result = failed`, by `error_code`, 30 days (table) | 6 |
| Projects and screenplays | `project_created` and `fdx_imported` per week, 90 days | 6 |
| Generations by media kind | `generation_completed` per week, broken down by `media_kind`, 90 days | 6 |
| Where people heard about Renku | `heard_about` by `answer`, all time (bar) | 6 |
| Versions in use | Distinct installs by `version` with `studio_started`, 30 days (table) | 3 |
| Systems | Distinct installs by `platform` and `arch`, 30 days (table) | 3 |
| Opt-outs per week | `telemetry_opted_out` per week, 90 days | 6 |

- `dashboard-tiles.mjs`: new section after "## Downloads":
  `## Renku Studio` with the note "Only installs that turned on usage
  statistics. Most installs never do, so treat these as a small slice, not totals."
- The section opens with three number tiles (width 4, height 3): "Active
  Studio installs (7 days)" (distinct installs with `studio_started`, compared
  with the 7 days before), "Sample films downloaded (30 days)" and "Projects
  created (30 days)". "At a glance" keeps its four tiles unchanged.
- `dashboard-tiles.test.mjs`: the host-filter test becomes "every trends chart
  is limited to a website host or to `surface = studio`".
- `docs/operations/growth-report.md` "Dashboard": one sentence listing the
  Renku Studio section and that it counts opted-in installs only.
- Charts with no events yet return zero rows, which `--check` accepts, so the
  dashboard can be published before the Renku release that sends events.

## Tests And Guardrails

Core (owns the full matrix):

- Choice: absent → off; on creates a UUID file; on again keeps the ID; off
  deletes; off when absent is a no-op; invalid file → `CORE_TELEMETRY_FILE_INVALID`
  for status, and `disable` still deletes it; atomic write leaves no temp file.
- `heardAbout`: every listed value accepted with `enabled: true`; unknown value
  and `enabled: false` with a value → `CORE_TELEMETRY_CHOICE_INVALID`;
  `heard_about` sent once after saving.
- Opt-out: `telemetry_opted_out` sent with the old ID before deletion; deletion
  still happens when the send fails or times out; nothing sent when blocked.
- Environment: each switch blocks with values `1`, `true`, `yes`; does not block
  with empty, `0`, `false`; order of `blockedBy`; debug prints the body without
  `api_key` and calls no fetcher; blocked + debug prints nothing.
- Never in the way: fetch rejection, HTTP 500, 2-second timeout, unreadable
  `telemetry.json` and unreadable `RELEASE.json` all resolve without throwing.
- Payload contract: the exact JSON body for each event, including common
  fields and `$geoip_disable` (this is the public field list; the test comment
  points to the Privacy Notice section that must change with it).
- Work content never leaks: run each observation point against a project named
  "Urban Basilica" with title, logline, paths and provenance containing marker
  strings, capture the bodies in debug mode, and assert none of those strings
  and no provider or model id appear.
- Wiring: `createMovieProject` records `project_created`; generated
  `attachGenerationMedia` records `generation_completed` with the right
  `mediaKind`; an attachment without provenance records nothing; a world
  (`model`) file records nothing; storyboard import records one event;
  `importFdxScreenplay` records `fdx_imported`; a failing command records
  nothing.
- Sample film: both entry points record `sample_film_download_started` then
  `sample_film_download_finished` with `installed`; a failed download records
  `failed` with the structured code (an unexpected error records the wrapped
  installation-failed code); a sample already in the Library records nothing;
  a preflight error (for example not enough space) records nothing.
  `openProjectInStudio` returns the same shell as `readProjectShell`, records
  `sample_film_opened` for the sample, and records nothing for any other
  project or when the read fails.
- `readInstalledRenkuRelease`: installed, missing (`null`), invalid; existing
  update-check tests unchanged.

Adapters and UI (their own behavior only):

- Studio server: GET and PUT delegate and serialize; malformed bodies →
  `STUDIO_SERVER362`; Core errors map through `projectErrorResponse`;
  `startMovieStudioServer` with a temporary home, a `telemetry.json` and debug
  on prints one `studio_started` line; `GET /studio-api/projects/:projectName`
  calls `openProjectInStudio`.
- Dashboard (`pnpm test:growth-dashboard`): the grid test passes with the new
  section; every Studio chart filters on `surface = studio`; the updated
  host-or-surface filter test.
- CLI: `status`, `enable`, `disable` plain and `--json` output; `CLI169`.
- React: third onboarding step appears after Provider API keys; switch starts
  off; Select only while on; Continue unchanged makes no request; Continue on
  sends `{ enabled: true, heardAbout }`; blocked note text; error Alert keeps
  the step; Settings loads status, Save enabled by either section, Save sends
  only what changed.
- E2E onboarding (`first-run.onboarding.spec.ts`): pass through the new step
  with the switch on and an answer, and reach the Project Library.

Architecture guardrails:

- Static scan: within `packages/core`, `packages/cli`, `packages/codex` and
  `packages/studio`, only `packages/core/src/server/telemetry/` contains the
  PostHog host string.
- Static scan: `packages/studio/src` imports nothing from Core's server entry
  (existing browser boundary test, extended if it does not cover the new files).

## Documentation

- **Privacy Notice** (`packages/website/src/pages/privacy.astro`), this plan's
  part only (0234 owns "Optional website analytics"):
  - "Renku Studio runs locally": replace the sentence that no app usage
    analytics are collected with: "It never sends us your project files, file
    paths, prompts, screenplay text, media, project names or API keys. If you
    turn on usage statistics, it sends only the events listed below."
  - New section `id="app-usage-statistics"`, "Optional app usage statistics":
    off until you turn it on at first run, in Settings, or with
    `renku telemetry enable`; the random install ID and where it is stored;
    the field and event tables from "Events And Fields" in plain words; what is
    never sent; that requests reach PostHog's EU service from your network
    address, that Renku asks PostHog not to look up a location, and what the
    project stores about IP addresses (wording set after the maintainer's
    check below); how to turn it off (Settings, `renku telemetry disable`,
    `DO_NOT_TRACK=1`, `RENKU_TELEMETRY_DISABLED=1`, nothing sent in CI); the
    one last opt-out event; debug printing.
  - "Sharing and retention": app statistics use the same PostHog EU project and
    retention as website analytics; turning them off deletes the local ID.
  - "Your rights": withdraw app statistics consent any time; to delete past
    events, send the install ID shown in Settings → Usage statistics or by
    `renku telemetry status` (or `telemetry.json`) before turning statistics
    off.
  - Bump "Last updated" (coordinate one date with 0234).
- **Terms**: none (D4).
- **ADR 0120 "Collect opt-in usage statistics"** (`docs/decisions/0120-collect-opt-in-usage-statistics.md`):
  opt-in, ownership (Core), the closed event list, environment switches,
  never-in-the-way rule, PostHog EU via plain HTTP, rejected alternatives
  (opt-out; posthog-node; browser-side events; local queue). ADR 0119 is
  reserved by plan 0230; 0121–0123 already exist.
- **ADR 0085**: one-line notice near the top: "Extended by ADR 0120: first-run
  setup adds an optional usage-statistics step; config existence remains the
  only setup marker."
- `docs/cli/commands.md`: `renku telemetry` section.
- `docs/operations/growth-report.md` "Dashboard": the Renku Studio section.
- `README.md` "Local configuration and project storage": the configuration
  folder also holds `telemetry.json` while usage statistics are on (one
  sentence; coordinate with 0231's README work).
- `packages/website/src/pages/quick-start.astro`: after the Provider API keys
  sentence, "The last screen asks whether to share usage statistics; they stay
  off unless you turn them on." (coordinate with 0233.)

## Final Verification

```bash
pnpm build
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:onboarding
pnpm build:website
```

Manual, on the development machine with a throwaway home folder
(`HOME=$(mktemp -d)`; never the real config):

1. `RENKU_TELEMETRY_DEBUG=1 renku studio start`; complete first-run setup with
   the switch on and an answer. Confirm stderr prints `heard_about`, and a
   restart prints `studio_started`.
2. `renku create demo --title Demo`, `renku screenplay import-fdx` and
   `renku media import` with a generated file: one debug line each, with no
   project name, title or path in any line.
3. In Studio, download the sample film from the empty Project Library: debug
   prints `sample_film_download_started` and `sample_film_download_finished`
   with `installed`; opening it prints `sample_film_opened`; opening `demo`
   prints nothing. `renku sample-film install` again prints nothing (already
   in the Library).
4. `DO_NOT_TRACK=1`: `renku telemetry status` shows "Sending: no
   (DO_NOT_TRACK is set)" and nothing prints. Same for
   `RENKU_TELEMETRY_DISABLED=1` and `CI=true`.
5. Settings: turn off and Save; `telemetry_opted_out` prints; `telemetry.json`
   is gone. Turn on again; a new ID is created.
6. Desktop screenshots at 1440×1000 of the new onboarding step (off, on with
   the Select open, blocked note) and the Settings dialog, compared with the
   two existing onboarding steps for layout and spacing.
7. One real send without debug (after the maintainer's PostHog check):
   the event appears in PostHog with `surface = studio`, no location
   properties, and the IP handling the Privacy Notice describes.
8. `pnpm growth:dashboard --check`, then `pnpm growth:dashboard`; the Renku
   Studio section appears and the test event from step 7 shows in "Active
   Studio installs".
9. Architecture-shape review: `git diff --stat`; inspect `service.ts`,
   `capture.ts`, `app-settings-dialog.tsx`; every `index.ts` thin; no
   telemetry code outside the owners named above.

## What Only The Maintainer Can Do

- D1–D4 decided 2026-10-18.
- In PostHog (EU project shared with the website, owned by 0234; worked
  through in a separate session):
  - check the project's IP data capture setting. If IPs are stored for the
    website's sake, decide with 0234 whether to stop storing them (the website
    notice mentions location from network address) or describe IP storage for
    Studio events in the Privacy Notice;
  - send one test event with `$geoip_disable` and confirm no location fields;
  - delete one test install ID's events to prove a deletion request can be
    honoured, and note the steps;
  - confirm the data retention period the Privacy Notice states.
  - **Done 2026-10-18 (project "Renku Website", EU Cloud, project ID
    143426). Findings:**
    - IP storage: the setting now lives at Settings → Project → **Privacy** →
      "IP data capture configuration" → **Discard client IP data**. It was
      **off**, so every event (website and the test Studio event) kept the
      sender's IP in `$ip`. Decision: the maintainer switched it **on**
      2026-10-18. PostHog can still use the IP for the GeoIP lookup before
      discarding it, so the website notice's "approximate location derived
      from your network address" stays true. Events stored before
      2026-10-18 keep their `$ip` until they expire.
    - Test event: `curl` POST to `https://eu.i.posthog.com/i/v0/e/` with the
      public token, event `telemetry_privacy_check`, a throwaway UUID as
      `distinct_id`, and `{surface: "studio", "$geoip_disable": true}`
      returned HTTP 200. PostHog showed "GeoIP disabled: true", `surface`,
      and **no** `$geoip_*` location fields, but **did** store `$ip` (sent
      before the switch was turned on). `$geoip_disable` alone stops the
      location lookup but not IP storage; the project switch is what stops
      IP storage.
    - Person record: the event created a person record for the install ID,
      as intended (Renku does not send `$process_person_profile: false`).
    - Retention: the organization is on the **free plan**; PostHog keeps
      events for **1 year** on free plans (7 years on paid plans,
      posthog.com/docs/data/events-retention). The notice's "one year" is
      correct while the plan stays free; revisit it if the plan is upgraded.
  - **Deletion steps (tested 2026-10-18 on the test install ID):**
    1. Sign in at https://eu.posthog.com, project "Renku Website".
    2. Open `https://eu.posthog.com/project/143426/person/<install ID>`, or
       left menu **People and groups** → search the install ID → open it.
    3. Click the red **Delete person** button (top right), tick the option
       to also delete the person's events if offered, and confirm.
    4. Reload the page: it shows "Person not found". PostHog removes the
       events later in a batch job that runs off-peak (weekends on PostHog
       Cloud), so they may stay visible for a few days.
    5. Reply to the requester that the data is deleted.
  - **Suggested Privacy Notice wording** (for `#app-usage-statistics` and
    "Sharing and retention"):
    - IP: "Renku sends these events to PostHog's EU service with location
      lookup turned off. PostHog does not store your network address with
      them, and the events contain no location."
    - Retention: "PostHog deletes app usage statistics events after one year
      under our current plan, the same as website analytics."
    - Deletion: "To delete statistics already sent, email us your install ID
      before turning statistics off. It is shown in Renku under Settings →
      Usage statistics, and by `renku telemetry status`. We delete it in
      PostHog; removal from PostHog's storage can take a few days."
- Publish the website with the updated Privacy Notice before releasing the
  Renku version that can send events.
- Run `pnpm growth:dashboard` with the PostHog personal API key to publish
  the Renku Studio section.
- Release that Renku version with the existing release command.
- Answer deletion requests by install ID.

## Completion Checklist

### Review Area

- [x] D1–D4 answered (2026-10-18); plan updated to the answers.
- [x] Sample film tracking added as three events; `project_created` has no
      `source`.
- [ ] Module layout matches the Architecture Shape Gate; no telemetry logic in
      React, route handlers, CLI handlers or Core domain commands.
- [ ] No new npm dependency.

### Architecture And Contracts

- [ ] `client/telemetry.ts` types, answer list, labels and field-list URL.
- [ ] `telemetry.json` format, atomic write, delete on off, ID kept on repeat on.
- [ ] Environment switches and debug rule as written in Rules 2–3.
- [ ] Never-in-the-way rule (Rule 4) with 2-second timeout.
- [ ] Diagnostics `CORE_TELEMETRY_CHOICE_INVALID`, `CORE_TELEMETRY_FILE_INVALID`,
      `CORE_TELEMETRY_FILE_IO_FAILED`, `STUDIO_SERVER362`, `CLI169`.
- [ ] `readInstalledRenkuRelease` extracted; update check uses it unchanged in
      behavior.
- [ ] `capture.ts` exhaustive typed event table; PostHog host only there.

### Implementation Slices

- [ ] Slice 1 Core module and test-config guards.
- [ ] Slice 2 observation points: `createMovieProject`, `importFdxScreenplay`,
      four media save methods, both sample installation entry points,
      `openProjectInStudio` (and the project route using it),
      `startMovieStudioServer`.
- [ ] Slice 3 `renku telemetry status|enable|disable` and help.
- [ ] Slice 4 `GET`/`PUT /studio-api/telemetry`.
- [ ] Slice 5 shared fields, draft hook, onboarding step, Settings section.
- [ ] Slice 6 Privacy Notice, Quick Start, ADR 0120, ADR 0085 notice, README,
      CLI docs.
- [ ] Slice 7 `studio-charts.mjs`, `STUDIO` filter, Renku Studio section,
      updated dashboard test, growth-report doc sentence.

### UI, CLI And Agent Surfaces

- [ ] Onboarding third step: copy as written, switch off, Select only when on,
      blocked note, Continue behavior, error Alert.
- [ ] Settings: two headed sections, combined Save, opt-out on save.
- [ ] Settings: saved install ID row with Copy and the deletion line while on;
      hidden while off; appears after saving off → on.
- [ ] CLI plain and JSON output as written; `disable` works on an invalid file.
- [ ] Studio Skills and the Codex plugin unchanged.

### Tests And Guardrails

- [ ] Core choice, environment, debug, opt-out, failure and payload tests.
- [ ] Leak test with marker strings across every observation point.
- [ ] Wiring tests for each observation point and the no-provenance case.
- [ ] Sample film tests: started/finished, failed code, already in Library,
      preflight error, opened only for the sample.
- [ ] `pnpm test:growth-dashboard` passes.
- [ ] Studio server route and runtime tests; CLI tests; React tests; onboarding
      E2E updated.
- [ ] Static scan for the PostHog host; browser import boundary covered.

### Documentation

- [ ] Privacy Notice sections changed as listed; date coordinated with 0234.
- [ ] No Terms change (D4).
- [ ] ADR 0120 written; ADR 0085 notice added without rewriting its body.
- [ ] `docs/cli/commands.md`, README sentence, Quick Start sentence,
      growth-report Dashboard sentence.

### Final Verification

- [ ] Commands in Final Verification pass.
- [ ] Manual steps 1–8 done in a throwaway home folder; screenshots reviewed.
- [ ] Renku Studio dashboard section published and showing the test event.
- [ ] Maintainer PostHog checks done and Privacy Notice IP wording matches.
- [ ] `git diff --stat` reviewed; large files inspected; `index.ts` files thin;
      no checklist item satisfied by accepting unreviewable structure.
