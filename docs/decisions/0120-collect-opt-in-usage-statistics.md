# 0120 Collect Opt-In Usage Statistics

Date: 2026-10-18

Status: accepted

Extends [ADR 0085](0085-use-platform-config-paths-and-first-run-setup.md):
first-run setup gains a last, optional usage-statistics step, and config
existence remains the only setup marker. Uses the PostHog project from
[ADR 0121](0121-measure-public-websites-in-one-posthog-project.md). No older
ADR is superseded.

## Context

Renku had no way to know whether anyone who installs it actually uses it.
Studio, the CLI, Core and Studio Skills sent nothing. The marketing plan needs a
small, honest signal: how many installs start Studio, create projects, import
screenplays, download and open the sample film and save generated media, which
versions they run, and where people heard about Renku. Renku's audience chose
a local tool, so the signal must not cost their trust.

## Decision

- **Opt-in.** Nothing is sent until the user turns usage statistics on: on the
  last first-run screen (switch off by default), in Studio Settings, or with
  `renku telemetry enable`. Existing installs are not asked.
- **Choice file.** `<Renku config folder>/telemetry.json`
  (`{ "formatVersion": 1, "installId": "<random UUID>" }`) exists exactly
  while statistics are on. Turning on creates it (and keeps an existing ID);
  turning off deletes it before sending one final `telemetry_opted_out` event
  with the previous ID, so recording stops while that request is pending.
- **Environment switches.** `DO_NOT_TRACK`, `RENKU_TELEMETRY_DISABLED` and
  `CI` block every send when set to anything but empty, `0` or `false`.
  `RENKU_TELEMETRY_DEBUG` prints each event to stderr instead of sending it.
  Studio and `renku telemetry status` say which switch blocks sending.
- **Core owns it.** `packages/core/src/server/telemetry/` owns the choice
  file, the switches, the closed event union and payload, and sending. Core
  records events in its service wiring after a command succeeds, never inside
  domain commands. The Studio server records only `studio_started` (its own
  lifecycle). React, Studio routes and CLI handlers never build or send
  events.
- **Closed event list.** `studio_started`, `project_created`, `fdx_imported`,
  `sample_film_download_started`, `sample_film_download_finished`
  (`result`, and `error_code` when failed), `sample_film_opened`,
  `generation_completed` (`media_kind`), `heard_about` (`answer` from a
  closed list) and `telemetry_opted_out`. Every event carries the install ID,
  time, `surface: studio`, version, platform and arch. No event has a field
  that could carry file names, paths, project names, titles, screenplay or
  prompt text, media, API keys, provider or model ids, error messages or free
  text.
- **Sample film opens.** Studio opens a Project through the Core wiring method
  `openProjectInStudio`, which reads the same shell as `readProjectShell` and
  records `sample_film_opened` for the sample project. Core decides which
  Project is the sample.
- **Never in the way.** A send has a 2-second timeout. Network and HTTP
  errors, an unreadable choice file and unreadable release metadata skip the
  event. Recording never fails, delays or changes the operation that
  triggered it. This is a deliberate exception to fail-fast for an optional
  side channel; reading or changing the choice still fails with structured
  `CORE_TELEMETRY_*` errors.
- **Transport.** Plain `fetch` to `POST https://eu.i.posthog.com/i/v0/e/` with
  the website's public project token and `$geoip_disable: true`. No analytics
  dependency.
- **Reading the data.** The Renku growth dashboard script
  (`scripts/growth-dashboard/studio-charts.mjs`) charts the events in a
  "Renku Studio" section.
- **Tests never send.** Every test configuration sets
  `RENKU_TELEMETRY_DISABLED=1`; the onboarding end-to-end run uses debug
  printing instead.

## Rejected Alternatives

- **Opt-out with a first-run notice.** More data, but the ID would be created
  before anyone agreed, EU rules generally need consent for it, and similar
  projects (Go's 2023 proposal, Audacity's 2021 plan) lost trust doing it.
- **`posthog-node`.** A dependency for one POST request.
- **Browser-side events.** React would decide business events, and the CLI
  and agents would be invisible.
- **A local queue or retry store.** More state on the user's computer for an
  optional signal; a missed event is acceptable.

## Consequences

- The Privacy Notice lists every field in `#app-usage-statistics` and must
  change with the payload contract test in
  `packages/core/src/server/telemetry/service.test.ts`.
- Counts cover only opted-in installs and are a small slice, not totals.
- Deleting one install's past events is a manual PostHog action by the
  maintainer, by install ID.
