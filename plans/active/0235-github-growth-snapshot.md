# 0235 GitHub And Download Growth Report

Status: proposed
Date: 2026-10-15 (revised 2026-10-18 with the maintainer's decisions)

## Review

### What you will get

Once a day, a scheduled job on your Mac saves the numbers that tell you whether
Renku is growing, and sends them to the PostHog account the website already
uses. It saves two kinds of numbers.

**GitHub numbers for `GoRenku/studio` and `GoRenku/studio-skills`.** These are
stars (the total and how many were gained each week), page views and clones
per day, and the top 10 sites and pages people came from. GitHub deletes
traffic numbers after 14 days, so if nobody saves them they are gone.

**Download numbers from downloads.gorenku.com.** Cloudflare serves this site
and keeps a log of every request. The job counts, per day and per country, how
often each file was downloaded:

- the macOS installer (`install.sh`) and the Windows installer (`install.ps1`).
  These are roughly fresh installs, because `renku update` runs the installer
  copy already on the machine and does not download it again;
- the release archives, split by version and platform. These are installs and
  updates together;
- `release.json`. Studio requests this file every 6 hours to check for
  updates, and every install requests it once. It is a rough sign of how many
  copies of Studio are running, not a count of people.

Only totals are sent: "12 downloads of `install.sh` from Germany on 17
October". No network addresses, no usernames, no identifiers.

You can preview a run on your own computer. It prints exactly what it would
send and sends nothing.

### What happens when something goes wrong

- **Missed days fill themselves in.** Every run re-sends the last 13 finished
  days. If the Mac is asleep at the scheduled time, macOS runs the job when it
  wakes. If the Mac is off or the job fails for a few days, the next successful
  run fills the gap. A gap longer than 13 days is lost for good, because GitHub
  deletes its traffic numbers after 14 days.
- **Every chart must take the highest value per day.** Re-sending creates
  repeats. Each reading always carries the same ID, and PostHog usually merges
  repeats into one, but it does not promise to. So charts must show the highest
  value per day (or per week for stars), never count events or add values
  together. Plan 0234's dashboard has to follow this rule.
- **If any part fails, nothing is sent that day.** A failed run shows a macOS
  notification with the error code and writes the details to a log file on
  your Mac. The next run catches up.
- **Sent data effectively cannot be removed from PostHog.** That is why you
  preview first, and the first real send is a run you start by hand before
  turning on the schedule.

### Your decisions (settled 2026-10-18)

- **GitHub key.** Use a narrow "fine-grained" key that works on these two
  repositories only. Fall back to a broader "classic" key only if the preview
  proves the narrow one cannot read traffic.
- **Instant star notifications.** Not now.
- **Download counts.** Yes, included in this plan. They come from Cloudflare's
  request log for downloads.gorenku.com, not from the storage bucket's own log.
  The bucket's log misses downloads that Cloudflare serves from its cache, so it
  would undercount the release archives.
- **Country split for downloads.** Yes. Cloudflare works out the country from
  the visitor's network address. Only per-country totals reach PostHog.
- **Latent Matinee (`GoRenku/ai-films`).** Not tracked. It may become private.
- **Where it runs.** On your Mac, started once a day by macOS's built-in
  scheduler ("launchd"). The keys live in the repository's local `.env` file,
  which Git ignores. No GitHub Actions workflow and no repository settings.

### Things that changed because of your answers

- **No GitHub Actions.** The workflow file and the four repository settings
  are gone. The keys never leave your Mac, and there are no public job logs to
  worry about.
- **One small setup command is added.** `pnpm growth:schedule` writes the
  daily schedule file for macOS and switches it on. It records the exact Node
  program and repository folder on your Mac, so the schedule keeps working
  outside a terminal.
- **Failures show a macOS notification.** Without GitHub's failure email a
  broken run would go unnoticed until the 13-day window ran out. This is added
  beyond your request for that reason. The full message goes to a log file.

- **The job has a broader name.** It now covers downloads as well as GitHub,
  so the folder, commands and error codes are called "growth report" instead
  of "GitHub growth". Nothing has been built yet, so nothing has to be renamed
  afterwards.
- **One sentence is added to the website privacy notice.** It says that
  downloads.gorenku.com is also served by Cloudflare, and that we keep daily
  download counts per file and per country with no addresses or identifiers.
  This is the only website change.
- **You need a second key, from Cloudflare.** It is read-only and limited to
  analytics for gorenku.com. It is never the release key, which can write files
  to the download bucket.

### Unknown until the new Cloudflare key exists

Cloudflare's documentation promises at least 31 days of request history on
every plan. It does not say how wide one question to Cloudflare may be on the
free plan. The job asks for one day at a time, which works either way. The
first build step uses your new key to ask Cloudflare for the plan's real limits
and field names. If Cloudflare keeps fewer than 14 days of history, or does not
allow grouping by file path and country on the free plan, I stop and come back
to you before building the download part.

Two known weaknesses are worth knowing about:

- The free plan cannot tell bots from people, so download counts include
  scripts and crawlers that fetch the installers.
- At high traffic Cloudflare estimates counts from a sample. At Renku's current
  traffic the counts are exact.

### What I need from you

1. **Create the GitHub key.** On GitHub go to Settings → Developer settings →
   Personal access tokens → Fine-grained tokens → Generate new token. Use the
   name `renku-growth-report` and the owner `GoRenku`. Give it access to only
   `studio` and `studio-skills`, and only the permission **Administration:
   Read-only**. (GitHub adds "Metadata: Read-only" by itself.) Pick an expiry
   date and note it. If the GoRenku organisation asks you to approve the key,
   approve it under Organization settings → Personal access tokens.
2. **Create the Cloudflare key.** In the Cloudflare dashboard go to My Profile →
   API Tokens → Create Token → Custom token. Name it `renku-growth-report` and
   give it one permission: **Zone → Analytics → Read**, for the zone
   `gorenku.com` only. Also copy the **Zone ID** of gorenku.com from the right
   side of the zone's Overview page.
3. **Add four lines to the repository's local `.env` file** (the same file the
   release scripts already use):
   - `GROWTH_GITHUB_TOKEN=` the GitHub key;
   - `CLOUDFLARE_ANALYTICS_TOKEN=` the Cloudflare key;
   - `CLOUDFLARE_ZONE_ID=` the gorenku.com Zone ID;
   - `POSTHOG_PROJECT_TOKEN=` the website's public PostHog key (the `phc_…`
     value in `packages/website/src/components/WebsiteAnalytics.astro`).
4. **Run the preview**, `pnpm growth:report --dry-run`, and check that it
   prints GitHub events for both repositories and download events.
5. **Run the first real send by hand**, `pnpm growth:report`, then check in
   PostHog that all seven event names arrived.
6. **Switch on the daily schedule** with `pnpm growth:schedule`.
7. **Later:** renew both keys before they expire. If you move the repository
   folder or upgrade Node to a different location, run `pnpm growth:schedule`
   again.

### Technical changes worth noticing

- New folder `scripts/growth-report/` with plain Node scripts and tests. No new
  dependencies, nothing under `packages/` changes, and no install step is
  needed to run it.
- A macOS schedule file written outside the repository, to
  `~/Library/LaunchAgents/com.gorenku.growth-report.plist`, daily at 09:17
  local time, logging to `~/Library/Logs/renku-growth-report.log`.
- Four new names in the local `.env` (above). Nothing is stored on GitHub.
- Seven new PostHog event names. This is the data 0234's dashboard charts.
- Error codes `GROWTH001` to `GROWTH009`.
- Three root scripts: `pnpm test:growth-report` (also added to
  `pnpm check`), `pnpm growth:report` and `pnpm growth:schedule`.
- One sentence added to `packages/website/src/pages/privacy.astro`.
- Not changed on purpose: `release.yml`, the release keys in `.env`, the
  website's PostHog setup and consent banner, all Studio packages.

## Summary

Nothing records how `GoRenku/studio` and `GoRenku/studio-skills` are doing on
GitHub, or how often Renku is downloaded. GitHub keeps traffic for 14 days and
shows it only to people with push access. Download requests are visible only in
Cloudflare. So the effect of the marketing work cannot be seen over time, or
next to the website numbers in PostHog.

After this plan, a daily macOS scheduled job on the maintainer's Mac reads
GitHub stars, star history,
views, clones, top referrers and top pages for both repositories. It also reads
per-day, per-file, per-country download counts for downloads.gorenku.com from
Cloudflare. It sends all of this to the existing PostHog EU project as anonymous
events. The smallest useful scope is one dependency-free Node script folder with
tests (including a small command that installs the schedule), one operations
document, three root `package.json` scripts and one privacy-notice sentence.
The maintainer runs CI/CD from their own machine and uses no GitHub Actions
today, so this job does too.

Exact traffic numbers are left out of this plan because the plan is committed to
a public repository.

## Requirements Ledger

| Requirement | Source | Where it lands |
| --- | --- | --- |
| Daily scheduled job for both repositories | Request 1 | launchd agent from `pnpm growth:schedule`, repository list in the entry file |
| Runs on the maintainer's Mac, keys in local `.env` | Maintainer answer 2026-10-18 | `install-launch-agent.mjs`, `.env` names under Contracts |
| Failures are noticed without GitHub's email | Consequence of running locally | macOS notification on failure, local log file |
| Star total and weekly star history | Request 1 | `github_repository_totals`, `github_star_week` |
| Daily views and clones, counts and uniques | Request 1 | `github_views_day`, `github_clones_day` |
| Top referrers and top paths | Request 1 | `github_top_referrer`, `github_top_path` |
| Download counts from Cloudflare | D3, approved 2026-10-18 | `download_requests_day` |
| Downloads from the request log, split by country | Maintainer answer 2026-10-18 | zone `httpRequestsAdaptiveGroups`, `country` property |
| Sent without person profiles | Request 1 | `$process_person_profile: false`, one fixed id per source |
| Re-run safe, no double counting | Request 1 | Fixed event ids and times, whole-window re-send, highest-value counting rule |
| Dry run prints instead of sending | Request 2 | `--dry-run` |
| Focused tests and clear structured failures | Request 2 | `node:test` files, `GROWTH00x` codes, nothing sent on any failure |
| Exact keys and permissions as maintainer tasks | Request 3 | Review → What I need from you |
| No star webhook | D2, declined 2026-10-18 | Non-goals |
| `GoRenku/ai-films` not tracked | D4, declined 2026-10-18 | Non-goals |
| No new dependencies or installs | AGENTS.md | Node built-ins only, import guard test |
| Least-privilege keys | Security boundary | Fine-grained GitHub key; Zone Analytics Read Cloudflare key |
| No traffic numbers in the repository | Privacy boundary | Synthetic test fixtures; output only in the local log |
| Country split disclosed | Privacy boundary | One sentence in `privacy.astro` |
| GitHub deletes traffic after 14 days | External constraint | Daily schedule, 13-day self-healing |

## Context And Evidence

### Accepted constraints

- `AGENTS.md`: fail fast with coded errors, no fallbacks or compatibility
  paths, no new dependencies without approval, naming rules, reviewable code
  shape.
- `docs/architecture/coding-practices.md`: small focused functions, entry
  points with little branching, tables instead of long `if` chains.
- `docs/architecture/naming-guidelines.md` discourages `snapshot` as a code
  name; code uses "growth report" and "report date".
- `docs/architecture/reference/structured-diagnostics.md`: stable prefixed
  codes, collect every actionable problem before failing.
- `packages/website/README.md` and `WebsiteAnalytics.astro`: the existing
  PostHog project ("Renku Website", EU host `https://eu.i.posthog.com`, public
  `phc_` token) and snake_case event names such as `download_clicked`.
- Website privacy notice (`packages/website/src/pages/privacy.astro`): already
  says the website is served by Cloudflare. It does not mention
  downloads.gorenku.com or download counts.
- Sibling plans: 0234 owns the PostHog project, UTM rules and the "Renku
  growth" dashboard; 0237 owns Studio usage statistics.

### GitHub API (checked 2026-10-15 with `gh api`)

- `GET /repos/{o}/{r}` → `stargazers_count`.
- `GET /repos/{o}/{r}/stargazers/history` → array of `{ week, total, days[7] }`,
  newest first, 30 weeks per page (`per_page` cannot raise it), next page in
  the `Link` header. `week` is Unix seconds (Sunday 00:00 in the samples);
  GitHub says week and day boundaries are not guaranteed to be UTC. `total` is
  the number of stars given in that week and equals the sum of `days`. Summed
  over all pages it equals the current star count (checked on `cli/cli`: 368
  weeks sum to 46,652, its `stargazers_count`), so unstars are removed from
  past weeks. It answers without a token and is listed under the "Metadata:
  Read" permission.
- `GET /repos/{o}/{r}/traffic/views` and `/traffic/clones` →
  `{ count, uniques, views|clones: [{ timestamp, count, uniques }] }`, 14 days,
  `timestamp` at UTC midnight. Today's partial day may or may not appear.
- `GET /repos/{o}/{r}/traffic/popular/referrers` →
  `[{ referrer, count, uniques }]`; `/popular/paths` →
  `[{ path, title, count, uniques }]`; top 10 over 14 days, no dates. Paths
  can differ only by letter case.
- Traffic answers 401 without a token. GitHub's fine-grained permission table
  lists all four traffic endpoints under "Administration: Read". The built-in
  workflow token cannot be given that permission, so a separate key is
  required.
- All endpoints answered with `X-GitHub-Api-Version: 2026-03-10`.

### Running on the maintainer's Mac (decided 2026-10-18)

- The maintainer runs CI/CD locally; `release.yml` exists but is only started
  by hand. Release scripts already read keys from the repository's `.env`
  (ignored by Git) through `node --env-file-if-exists=.env`.
- macOS `launchd` user agents live in `~/Library/LaunchAgents/`, are switched
  on with `launchctl bootstrap gui/<uid> <plist>` and off with
  `launchctl bootout gui/<uid>/<label>`. A `StartCalendarInterval` job that
  was due while the Mac slept runs once on wake; a job due while the Mac was
  off does not run. `launchd` starts jobs with a minimal `PATH`, so the plist
  names the Node program by absolute path.
- `.env` also holds the release keys (`CLOUDFLARE_TOKEN` and R2 keys). Node
  loads the whole file into the process; the growth report reads only its own
  four names.
- The job runs the scripts in the working copy as they are at run time, so a
  half-edited `scripts/growth-report/` folder can make that day's run fail.
  The next run re-sends the window.

### downloads.gorenku.com (checked 2026-10-18 in this repository)

- Served from the R2 bucket `renku-downloads` through the custom domain
  `downloads.gorenku.com` (`scripts/release/publish-r2.mjs`,
  `docs/operations/distribution-and-release.md`).
- Published paths:
  - `/install.sh`, `/install.ps1` — the website install commands;
  - `/studio/channels/beta/release.json` — release manifest;
  - `/studio/releases/<version>/<target>/<archive>` and `.sha256` — immutable
    archives;
  - `/studio/channels/beta/<target>/<archive>` and `.sha256` — moving beta
    copies.
- `distribution/install.sh` downloads `release.json`, then the archive at the
  manifest's `versionKey` (the immutable path).
- Studio's update check (`packages/core/src/server/installation/renku-release-check.ts`)
  requests `release.json`. `renku update` hands off to the installer already
  on the machine with `RENKU_DOWNLOAD_BASE_URL` set
  (`renku-update-handoff.ts`), so updates fetch `release.json` and an archive
  but not `install.sh` or `install.ps1`.
- The release `CLOUDFLARE_TOKEN` in `.env` and in `release.yml` can write to the
  bucket. It is not used and was not used to check anything for this plan.

### Cloudflare analytics (checked 2026-10-18 in Cloudflare's docs)

- Zone HTTP request analytics are in the GraphQL Analytics API
  (`POST https://api.cloudflare.com/client/v4/graphql`), dataset
  `httpRequestsAdaptiveGroups` under `viewer.zones(filter: { zoneTag })`. It
  reports `count` per group, and the filter `requestSource: "eyeball"` limits it
  to real visitor requests. Adaptive datasets "retain at least 31 days of data
  on every plan" and may sample at high volume.
- Per-plan limits (`maxDuration`, `notOlderThan`, `maxPageSize`,
  `availableFields`) are readable for a zone through
  `viewer.zones { settings { httpRequestsAdaptiveGroups { … } } }`. The docs
  give no free-plan values, so Slice 0 reads them with the new key.
- Some fields in this dataset are paid-only (for example referrer host), so
  the exact names and availability of the path, country, status and method
  fields are confirmed in Slice 0, not assumed.
- Rate limit: 300 GraphQL queries per 5 minutes per user. This job makes 13 a
  day.
- R2's own `r2OperationsAdaptiveGroups` dataset counts reads that reach the
  bucket only, so downloads served from Cloudflare's cache are missing. Not
  used, by the maintainer's choice.

### PostHog (checked 2026-10-15)

- Batch sending: `POST https://eu.i.posthog.com/batch/` with
  `{ api_key, batch: [...] }`, body under 20 MB. PostHog answers 200 even for
  events it later drops, so a successful reply does not prove every event was
  stored.
- `$process_person_profile: false` sends an event without creating a person.
- `$geoip_disable: true` skips PostHog's own location lookup, which would
  otherwise record the GitHub runner's data centre.
- Each event may carry its own `uuid`; PostHog drops events whose `uuid` is not
  a valid UUID. Events with the same id, name, day and `distinct_id` are merged
  eventually, but PostHog says this "is not guaranteed".
- No documented way to delete stored events by event name.

### How repository scripts are built and tested

- `scripts/release/` holds plain Node ES module (`.mjs`) files with no build
  step. Tests sit beside the code, use `node:test` and `node:assert/strict`,
  and pass in fake command, network and clock functions. Root `test:release`
  runs them and is part of `pnpm check`.
- `publish-r2.mjs` already has `--dry-run`. Errors carry a code at the start of
  the message, print with a bracketed prefix to stderr, exit with 1, and tests
  prove secrets never appear in messages.
- There is no root ESLint config; `pnpm lint` lints packages only.
- `@gorenku/studio-diagnostics` is compiled TypeScript meant for package
  boundaries; using it would force `pnpm install` and a build in the daily job.
- `release.yml` uses `actions/checkout@v4`, `actions/setup-node@v4` and Node
  `24.16.0`. Node 24 has `fetch` and `crypto` built in.

**Choice:** a `scripts/growth-report/` folder that follows the release-script
pattern. A workspace package would add a TypeScript build, an ESLint setup and
an install-plus-build step to a daily job, for a small operations script that no
Studio code uses.

## Behavior

### Daily run

1. At 09:17 local time (or on wake, if the Mac slept through it), or when the
   maintainer runs `pnpm growth:report`, Node runs the script from the working
   copy with the repository's `.env`. No `pnpm install`, no build.
2. The **report date** is the current UTC date. The **window** is the 13 UTC
   days before it.
3. For each repository the script reads the repository, every page of star
   history, views, clones, top referrers and top paths.
4. For each day in the window it asks Cloudflare for download counts on
   downloads.gorenku.com, one query per day.
5. Only after every read succeeds does it build the events and send them to
   PostHog in one batch. Any failure sends nothing.
6. It prints one line, for example
   `Sent 412 events: 2 repositories, 13 download days (report date 2026-10-18).`
   Under the schedule this line goes to the log file.

### Schedule setup

`pnpm growth:schedule` (macOS only):

1. Checks that it runs on macOS and that the repository's `.env` exists.
2. Writes `~/Library/LaunchAgents/com.gorenku.growth-report.plist` with the
   label `com.gorenku.growth-report`, the absolute path of the Node program
   running the command, `--env-file=<repository>/.env`, the absolute path of
   `report-growth.mjs`, `--notify-on-failure`, the repository as working
   folder, a daily `StartCalendarInterval` of 09:17, and both output streams
   appended to `~/Library/Logs/renku-growth-report.log`.
3. If the agent is already loaded, unloads it (`launchctl bootout`), then loads
   the new file (`launchctl bootstrap gui/<uid>`). Running it again replaces
   the schedule; it never creates a second one.
4. Prints the plist path, the log path and the time of the daily run. It does
   not start a run.

Switching the schedule off is documented as two commands (`launchctl bootout`
and deleting the plist) in the operations document. No uninstall command.

### Which download requests count

- Only requests to the host `downloads.gorenku.com`, from real visitors
  (`requestSource: "eyeball"`), with method `GET` and response status `200`.
  Cloudflare's own checks, `HEAD` requests from release verification, failed
  requests and "not modified" replies are left out.
- Each path is matched against a fixed table of the paths the release process
  publishes:

  | Path | `download_kind` | Extra properties |
  | --- | --- | --- |
  | `/install.sh` | `installer_macos` | — |
  | `/install.ps1` | `installer_windows` | — |
  | `/studio/channels/beta/release.json` | `release_manifest` | — |
  | `/studio/releases/<version>/<target>/<file>` (not `.sha256`) | `release_archive` | `release_version`, `release_target` |
  | `/studio/channels/beta/<target>/<file>` (not `.sha256`) | `release_archive` | `release_channel: beta`, `release_target` |

- Checksum files (`.sha256`) and every other path are not sent. Other paths
  are mostly bots probing for common files. The summary line counts how many
  requests were skipped, without listing them.
- This matches the folder layout Renku publishes. It reads nothing inside the
  files.

### Dry run

`pnpm growth:report --dry-run` does steps 2–5 but, instead of sending, writes
each event as one JSON line to stdout (without any key) and a summary line to
stderr: `Dry run: built 412 events; nothing was sent.` It needs the GitHub and
Cloudflare settings but not `POSTHOG_PROJECT_TOKEN`.

### Re-runs, missed runs and double counting

- Every run sends every reading still available: views, clones and downloads for
  each finished day in the window (today's partial day is skipped), every
  star-history week (the current week is partial and grows), and the
  report-date readings (totals, top referrers, top paths).
- Each reading has a fixed id and time (see Event identity). A second run on
  the same day sends identical ids. A later run re-sends earlier days with the
  same ids and possibly corrected numbers. PostHog keeps the newest copy when it
  merges.
- Because merging is not guaranteed, charts take the highest value per day or
  week. Counts for a finished day only grow while GitHub and Cloudflare catch
  up, so the highest value is the newest one. The one exception: an unstar
  lowers a past star week, and until PostHog merges, the chart can show the
  older, higher value.
- The first run fills in the past: the last 13 finished days of traffic and
  downloads, and the full star history since each repository's first week.
  Report-date readings (totals, top lists) exist only for days the job ran.

### Failures

- Missing settings, an unknown argument, GitHub or Cloudflare refusing access,
  any other GitHub or Cloudflare error, an unexpected reply shape, or PostHog
  refusing the batch each stop the run with one coded error, exit code 1, and
  nothing sent.
- With `--notify-on-failure` (set only by the schedule), a failed run also
  shows a macOS notification titled "Renku growth report failed" with the
  error code, through `osascript`. The notification never contains a key or a
  traffic number. If showing the notification itself fails, the original
  error is still written and the exit code is still 1.
- No retries. The next daily run re-sends the whole window.
- Messages name the source, the endpoint or day, and the HTTP status. They
  never contain a key. Shape errors list field paths and expected types, not
  values.

### Non-goals

- Website events, UTM rules and the dashboard itself (0234); Studio usage
  statistics (0237); Latent Matinee (0238).
- `GoRenku/ai-films` and any other repository.
- Instant star notifications through a webhook.
- R2 bucket operation counts, bot filtering, and any per-request or per-address
  data.
- GitHub Actions, repository secrets or variables, and any cloud runner.
- Running on Windows or Linux; the schedule command is macOS only.
- Storing readings anywhere but PostHog; alerts beyond the local notification.

## Architecture Shape Gate

- **Owner:** repository operations tooling in `scripts/growth-report/`. It is
  not a workspace package and does not touch `packages/*` (the privacy notice
  sentence is website copy, not code).
- **Module layout:**

  ```text
  scripts/growth-report/
    report-growth.mjs               entry: arguments and environment into one
                                    configuration, read GitHub and Cloudflare,
                                    build events, print or send, main guard
    github-api.mjs                  GitHub requests, star-history pages,
                                    reply shape checks → RepositoryGrowth
    cloudflare-downloads.mjs        one GraphQL query per day, reply shape
                                    check → DownloadDay[]
    download-paths.mjs              pure: the published-path table,
                                    path → download kind and properties
    posthog-events.mjs              pure: RepositoryGrowth[] + DownloadDay[] +
                                    report date → PostHog events
    event-identity.mjs              pure: uuidV5 and growthEventUuid
    posthog-capture.mjs             one POST to the EU /batch/ endpoint
    failure-notification.mjs        one osascript call for a failed scheduled run
    install-launch-agent.mjs        entry: write the plist, reload it with
                                    launchctl, main guard
    launch-agent-plist.mjs          pure: paths and time → plist XML text
    errors.mjs                      GrowthReportError (code, message, suggestion)
    reply-shape.mjs                 pure: collect every wrong field path in a
                                    GitHub or Cloudflare reply
    fixtures/                       synthetic GitHub and Cloudflare replies
    github-api.test.mjs
    cloudflare-downloads.test.mjs
    download-paths.test.mjs
    posthog-events.test.mjs
    event-identity.test.mjs
    posthog-capture.test.mjs
    report-growth.test.mjs
    launch-agent-plist.test.mjs
    install-launch-agent.test.mjs
    imports.test.mjs
  ```

- **Public entry points:** `node scripts/growth-report/report-growth.mjs
  [--dry-run | --notify-on-failure]` and
  `node scripts/growth-report/install-launch-agent.mjs`; for tests,
  `reportGrowth({ argv, env, fetch, now, stdout, stderr, notify })`,
  `installLaunchAgent({ platform, homeDirectory, repositoryRoot, nodePath, uid,
  runCommand, writeFile, stdout })`, `launchAgentPlist`, `readRepositoryGrowth`,
  `readDownloadDay`, `classifyDownloadPath`, `buildGrowthEvents`, `uuidV5`,
  `growthEventUuid` and `sendPostHogBatch`.
- **Where branching lives:**
  - `posthog-events.mjs` holds one focused builder per event family in a fixed
    list of six builders (repository totals, star weeks, day series, top
    referrers, top paths, download days). Views and clones share the day-series
    builder through a two-row table. One small function builds the shared
    envelope (id, time, `distinct_id`, common properties).
  - `download-paths.mjs` is one ordered table of path patterns; the first match
    wins and no match means "not sent". No `if` chain.
  - `github-api.mjs` and `cloudflare-downloads.mjs` each map HTTP status (and
    GraphQL `errors`) to codes in one small function, with one shape check per
    reply that collects every problem.
  - `reportGrowth` only composes and stays at complexity 3 or lower; the
    argument/environment parser is separate.
- **No `index.mjs`.** Files import siblings directly.
- **Forbidden here:** imports from `packages/*` or any npm package; a general
  analytics client; state files, caches or commits made by the job; a
  backfill mode or date flags; retries or polling loops; reading the list of
  stargazers; any person-level or address-level data; reading
  `CLOUDFLARE_TOKEN` or the R2 keys; a GitHub Actions workflow; a config file
  for repositories, paths, events or the schedule time; writing anywhere
  outside `~/Library/LaunchAgents/` and `~/Library/Logs/`; real traffic numbers
  in fixtures.
- **Stop and revise the plan if:** any file passes about 150 lines; a builder
  needs to branch on which repository or file it is handling; the entry
  function starts parsing, fetching and formatting in one body; avoiding
  duplicates seems to need stored state or a PostHog read-back; a new event
  type is needed that is not in the Contracts table; or Slice 0 shows the free
  plan keeps fewer than 14 days, allows less than one day per query, or lacks
  the path, country, status or method fields.

## Contracts

### Local settings in `.env`

The repository's `.env` file (ignored by Git, already used by the release
scripts) holds four names:

| Name | Value | Used for |
| --- | --- | --- |
| `GROWTH_GITHUB_TOKEN` | fine-grained key, owner `GoRenku`, repositories `studio` and `studio-skills`, Administration: Read-only (Metadata: Read-only automatic) | all GitHub reads |
| `CLOUDFLARE_ANALYTICS_TOKEN` | Cloudflare custom API token, Zone → Analytics → Read, zone `gorenku.com` only | the download query |
| `CLOUDFLARE_ZONE_ID` | the gorenku.com zone id | `zoneTag` in the query |
| `POSTHOG_PROJECT_TOKEN` | the public `phc_…` key of the EU PostHog project | the `api_key` of the batch |

The PostHog host is the constant `https://eu.i.posthog.com` in
`posthog-capture.mjs`; the Cloudflare endpoint and the host
`downloads.gorenku.com` are constants in `cloudflare-downloads.mjs`.

### macOS schedule

```bash
node scripts/growth-report/install-launch-agent.mjs
```

- Label `com.gorenku.growth-report`; file
  `~/Library/LaunchAgents/com.gorenku.growth-report.plist`; log
  `~/Library/Logs/renku-growth-report.log` (stdout and stderr, appended).
- `ProgramArguments`: `<absolute node path>`, `--env-file=<repository>/.env`,
  `<repository>/scripts/growth-report/report-growth.mjs`,
  `--notify-on-failure`. `WorkingDirectory`: the repository. The schedule uses
  `--env-file` (not `--env-file-if-exists`), so a missing `.env` fails the run
  loudly.
- `StartCalendarInterval`: `Hour` 9, `Minute` 17 (local time). The time is a
  constant in `install-launch-agent.mjs`.
- Reloads with `launchctl bootout gui/<uid>/com.gorenku.growth-report`
  (ignored when the agent is not loaded) and
  `launchctl bootstrap gui/<uid> <plist>`.
- Not on macOS, `.env` missing, or `launchctl bootstrap` failing →
  `GROWTH009`, and the plist is not left half-written.

### Script command

```bash
node scripts/growth-report/report-growth.mjs [--dry-run | --notify-on-failure]
```

- Arguments: none, `--dry-run`, or `--notify-on-failure`; the two cannot be
  combined.
- Environment: `GROWTH_GITHUB_TOKEN`, `CLOUDFLARE_ANALYTICS_TOKEN` and
  `CLOUDFLARE_ZONE_ID` always required; `POSTHOG_PROJECT_TOKEN` required unless
  `--dry-run`.
- Repositories: the constant list `GoRenku/studio`, `GoRenku/studio-skills` in
  the entry file.
- GitHub request headers: `Authorization: Bearer <key>`,
  `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2026-03-10`,
  `User-Agent: renku-growth-report`.
- Cloudflare request: `POST https://api.cloudflare.com/client/v4/graphql`,
  `Authorization: Bearer <key>`. The query reads `httpRequestsAdaptiveGroups`
  for `zoneTag`, filtered to the host `downloads.gorenku.com`,
  `requestSource: "eyeball"`, method `GET`, status `200` and one UTC day,
  grouped by date, request path and country, with `count`. Exact field names
  are fixed in Slice 0 from the zone's `availableFields` and written into the
  operations document.
- Output: live — one summary line on stdout; dry run — JSON lines on stdout,
  summary on stderr; failure — `[growth-report] <CODE> <message>` and a
  `Suggestion:` line on stderr, exit code 1.

Internal hand-offs (documented with JSDoc, numbers made up):

```js
// github-api.mjs → posthog-events.mjs
{
  repository: 'GoRenku/studio',
  starsTotal: 0,
  starWeeks: [{ week: 1791676800, newStars: 0 }], // every page, any order
  views:  { count: 30, uniques: 12, days: [{ day: '2026-10-14', count: 5, uniques: 2 }] },
  clones: { count: 40, uniques: 15, days: [{ day: '2026-10-14', count: 7, uniques: 3 }] },
  referrers: [{ referrer: 'github.com', count: 6, uniques: 3 }],
  paths: [{ path: '/GoRenku/studio', title: 'Overview', count: 20, uniques: 8 }],
}

// cloudflare-downloads.mjs → posthog-events.mjs (one per day)
{
  day: '2026-10-17',
  requests: [{ path: '/install.sh', country: 'DE', count: 12 }],
}
```

### PostHog events

Every event has `uuid` (see Event identity), `timestamp` (as listed), and the
properties `report_date` (`YYYY-MM-DD`), `$process_person_profile: false` and
`$geoip_disable: true`.

GitHub events have `distinct_id` `github:GoRenku/studio` or
`github:GoRenku/studio-skills` and the property `repository`.

| Event | One per | Timestamp | Own properties |
| --- | --- | --- | --- |
| `github_repository_totals` | repository, report date | report date 00:00Z | `stars_total`, `views_14d`, `unique_visitors_14d`, `clones_14d`, `unique_cloners_14d` |
| `github_star_week` | repository, star-history week | GitHub `week` value | `week_start`, `new_stars` (GitHub `total`), `stars_at_week_end` (sum of `new_stars` from the oldest week up to this one) |
| `github_views_day` | repository, finished day | the day's GitHub timestamp | `day`, `views`, `unique_visitors` |
| `github_clones_day` | repository, finished day | the day's GitHub timestamp | `day`, `clones`, `unique_cloners` |
| `github_top_referrer` | repository, report date, listed referrer (up to 10) | report date 00:00Z | `referrer`, `views_14d`, `unique_visitors_14d` |
| `github_top_path` | repository, report date, listed path (up to 10) | report date 00:00Z | `path`, `title`, `views_14d`, `unique_visitors_14d` |

The download event has `distinct_id` `downloads:downloads.gorenku.com`.

| Event | One per | Timestamp | Own properties |
| --- | --- | --- | --- |
| `download_requests_day` | finished day, published path, country | day 00:00Z | `day`, `path`, `download_kind`, `country` (two-letter code as Cloudflare returns it), `requests`, and when present `release_version`, `release_channel`, `release_target` |

A "finished day" is a UTC day before the report date. Referrer and path text is
kept exactly as the source returns it, including letter case.

### Event identity

`uuid` is a version 5 UUID (SHA-1, RFC 9562) of the JSON text of a key list,
under the fixed namespace `268ee6c6-e0d3-4c92-90b4-aca38b48d0b7`:

- report-date and day events: `[event, repository, bucket]`, where `bucket` is
  the report date, the `day`, or the star `week` number;
- top lists: `[event, repository, report date, referrer|path]`;
- downloads: `[event, 'downloads.gorenku.com', day, path, country]`.

Changing the namespace or a key list would break merging with earlier events,
so both are part of the contract.

### Error codes

All are `GrowthReportError` with `code`, a message that starts with the code,
and a `suggestion`.

| Code | Meaning | Suggestion names |
| --- | --- | --- |
| `GROWTH001` | Required environment missing; lists every missing name at once | the `.env` names to add |
| `GROWTH002` | Unknown or conflicting argument (only `--dry-run` or `--notify-on-failure`) | the accepted usage |
| `GROWTH003` | GitHub refused access (401, 403, 404) for a repository and endpoint | Administration: Read-only on both repositories, key expiry |
| `GROWTH004` | Other GitHub failure: any other HTTP status or a network error | retry tomorrow; the window re-sends |
| `GROWTH005` | GitHub or Cloudflare reply had an unexpected shape; lists every field path and expected type | the endpoint or query to inspect |
| `GROWTH006` | PostHog did not accept the batch (non-2xx or network error); includes status and up to 500 characters of the reply | the `POSTHOG_PROJECT_TOKEN` variable and host |
| `GROWTH007` | Cloudflare refused access (401, 403, or a GraphQL authorization error) | Zone Analytics: Read on gorenku.com, the zone id, key expiry |
| `GROWTH008` | Other Cloudflare failure: any other HTTP status, other GraphQL errors (including a day outside the plan's limits), or a network error | retry tomorrow; the window re-sends |
| `GROWTH009` | The schedule could not be installed: not macOS, the repository `.env` is missing, or `launchctl bootstrap` failed (with its exit code and output) | run on the Mac from the repository; add `.env`; the `launchctl` output |

### Root `package.json` scripts

- `"test:growth-report": "node --test scripts/growth-report/*.test.mjs"`, and
  `pnpm check` gains `&& pnpm test:growth-report` after `pnpm test:release`.
- `"growth:report": "node --env-file-if-exists=.env scripts/growth-report/report-growth.mjs"`,
  matching how the release scripts read a local `.env` (already ignored by Git).
- `"growth:schedule": "node scripts/growth-report/install-launch-agent.mjs"`.

### Privacy notice sentence

Added to the Cloudflare paragraph of `packages/website/src/pages/privacy.astro`:

> Renku downloads at downloads.gorenku.com are also served by Cloudflare. We
> keep daily counts of how often each file is downloaded, split by country,
> which Cloudflare works out from the network address. These counts contain no
> addresses or identifiers.

### What 0234 should chart

All GitHub charts break down by `repository`. The counting rule: **use the
property's maximum per day (or per week for star weeks); never chart the number
of these events and never add raw property values across events.** For totals
over a longer period, or for adding up downloads across countries or files, use
a PostHog SQL insight that first takes the maximum per key (repository and day,
or day, path and country), then adds those up.

| Chart | Event | Property and math | Interval |
| --- | --- | --- | --- |
| Stars over time | `github_star_week` | max `stars_at_week_end` | week |
| Stars gained per week | `github_star_week` | max `new_stars` | week |
| Current stars | `github_repository_totals` | max `stars_total`, latest day | number |
| Views and unique visitors | `github_views_day` | max `views`, max `unique_visitors` | day |
| Clones and unique cloners | `github_clones_day` | max `clones`, max `unique_cloners` | day |
| 14-day headline numbers | `github_repository_totals` | max of each `_14d` property | day |
| Top referrers | `github_top_referrer`, latest `report_date` | max `views_14d` by `referrer` | table |
| Top pages | `github_top_path`, latest `report_date` | max `views_14d` by `path` | table |
| Installer downloads | `download_requests_day`, kind `installer_macos` or `installer_windows` | SQL: max `requests` per day, path, country; sum per day by kind | day |
| Archive downloads by version | `download_requests_day`, kind `release_archive` | same SQL; sum by `release_version` and `release_target` | day |
| Update checks | `download_requests_day`, kind `release_manifest` | same SQL; sum per day | day |
| Downloads by country | `download_requests_day` | same SQL; sum by `country` | table |

Clones mostly come from installs and `renku update` fetching plugins, so they
measure machines rather than people. Download counts include bots. Update checks
measure running copies of Studio (about four a day each) plus installs.

## Implementation Slices

0. **Cloudflare limits check.** Done 2026-10-18 with the maintainer's keys
   (from a side session, no repository changes):
   - `httpRequestsAdaptiveGroups` on the zone: `enabled` true, `maxDuration`
     30 days, `notOlderThan` 31 days, `maxPageSize` 10,000,
     `maxNumberOfFields` 40. No stop condition is hit.
   - Field names confirmed: `date`, `clientRequestPath`,
     `clientCountryName`, `clientRequestHTTPHost`,
     `clientRequestHTTPMethodName`, `edgeResponseStatus`, `requestSource`;
     metric `count`. The query in `cloudflare-downloads.mjs` uses exactly
     these and a real dry run succeeded.
   - Real paths over 14 days match the path table; bot probes are all non-200
     or non-GET and are filtered out. A day with no matching downloads is a
     normal empty result.
   - The Cloudflare key has no expiry; only the GitHub key needs renewing.
   - A rejected Cloudflare key answers HTTP 400 with "Authentication failed";
     the reader maps it to `GROWTH007`.
   - Kept: one query per day. A single 13-day query would also fit the
     30-day limit, but the daily query is already built and tested.
1. **GitHub reading.** `errors.mjs`; `github-api.mjs` with
   `readRepositoryGrowth(repository, { token, fetch })`, the status-to-code
   function, star-history paging through `Link` `rel="next"`, one shape check
   per endpoint; synthetic fixtures; `github-api.test.mjs`.
2. **Download reading.** `download-paths.mjs` with the path table and
   `classifyDownloadPath`; `cloudflare-downloads.mjs` with
   `readDownloadDay(day, { token, zoneId, fetch })`, the status/GraphQL-error
   mapping and shape check; synthetic fixtures; `download-paths.test.mjs`,
   `cloudflare-downloads.test.mjs`.
3. **Event building.** `event-identity.mjs`; `posthog-events.mjs` with
   `buildGrowthEvents`, the six builders, the day-series table and the
   envelope function; `event-identity.test.mjs`, `posthog-events.test.mjs`.
4. **Sending and entry.** `posthog-capture.mjs`; `report-growth.mjs` with the
   argument/environment parser, `reportGrowth` and the main guard;
   `failure-notification.mjs`; their tests and `imports.test.mjs`; the
   `test:growth-report` and `growth:report` root scripts and the `pnpm check`
   addition.
5. **Schedule.** `launch-agent-plist.mjs`, `install-launch-agent.mjs`, their
   tests, and the `growth:schedule` root script. The implementer does not run
   `pnpm growth:schedule`; the maintainer does, after the first manual send.
6. **Documentation and notice.** `docs/operations/growth-report.md`; the privacy
   notice sentence.

## Tests And Guardrails

All tests use `node:test` with fake `fetch` and clock functions; none touch the
network.

- **`posthog-events.test.mjs`:**
  - each of the seven events has the exact name, `distinct_id`, timestamp and
    properties in the Contracts tables, plus the common properties;
  - day events (views, clones, downloads) skip every day on or after the report
    date;
  - `stars_at_week_end` adds up from the oldest week when pages arrive newest
    first and out of order;
  - building twice from the same readings and report date gives identical ids
    and timestamps.
- **`event-identity.test.mjs`:** `uuidV5` returns
  `2ed6657d-e927-568b-95e1-2665a8aea6a2` for the DNS namespace and
  `www.example.com`; every `growthEventUuid` has version 5 and the RFC variant;
  a different repository, day, week, referrer, path (also by letter case) or
  country gives a different id.
- **`download-paths.test.mjs`:** each row of the path table gives its kind and
  properties; `.sha256` files and unknown paths are not sent; version and
  target are read from the path segments.
- **`cloudflare-downloads.test.mjs`:** the query carries the host, eyeball,
  `GET`, `200` and one-day filters and the zone id; 401, 403 and a GraphQL
  authorization error give `GROWTH007`; 500, other GraphQL errors and a network
  error give `GROWTH008`; a reply with two wrong fields gives one `GROWTH005`
  naming both paths and no values; the key never appears in any message.
- **`github-api.test.mjs`:** sends the four headers; follows every star-history
  page; 401, 403 and 404 give `GROWTH003`; 422, 500 and a network error give
  `GROWTH004`; shape errors as above; the key never appears in any message.
- **`posthog-capture.test.mjs`:** posts once to
  `https://eu.i.posthog.com/batch/` with `{ api_key, batch }`; a non-2xx reply
  or network error gives `GROWTH006` with the status and a reply excerpt, never
  the key.
- **`report-growth.test.mjs`:**
  - all settings missing in a live run → one `GROWTH001` naming all four; a dry
    run without `POSTHOG_PROJECT_TOKEN` runs;
  - an unknown argument, or `--dry-run` with `--notify-on-failure` →
    `GROWTH002`;
  - with `--notify-on-failure`, a failure calls the notifier once with the
    error code and no key or number; without the flag it is never called; a
    notifier that throws still leaves the original error and exit code 1;
  - a dry run prints one JSON line per event and makes no PostHog request;
  - a GitHub failure on the second repository, or a Cloudflare failure on any
    day, makes no PostHog request;
  - a live run sends one batch holding GitHub and download events and prints
    the summary line;
  - the exit code is 1 and stderr starts with `[growth-report]` on failure.
- **`launch-agent-plist.test.mjs`:** the XML has the label, the absolute Node
  path, `--env-file=<repository>/.env`, the script path,
  `--notify-on-failure`, the working folder, 09:17 and the log path; paths
  with spaces or `&` are escaped correctly.
- **`install-launch-agent.test.mjs`** (fake platform, file writer and command
  runner): on macOS it writes the plist to the LaunchAgents path, runs
  `bootout` then `bootstrap` for `gui/<uid>`, and ignores a `bootout` failure
  for an agent that was not loaded; a non-macOS platform, a missing `.env`, or
  a failing `bootstrap` gives `GROWTH009`; nothing is written before the
  platform and `.env` checks pass.
- **`imports.test.mjs`** (protects "runs without install"): every non-test
  `.mjs` file in the folder imports only `node:` built-ins or `./` siblings.
- No ESLint is added for `scripts/`, matching the release scripts; code shape is
  held by the gate above and review.

## Documentation

- New `docs/operations/growth-report.md` (Status: current): what the job does
  and when; the four `.env` names and exact key permissions; the confirmed
  Cloudflare free-plan limits and field names from Slice 0; the path table; the
  event tables and the counting rule (the reference 0234 links to); the 13-day
  recovery limit and what happens when the Mac sleeps or is off; how to run a
  dry run and a manual send; installing the schedule, where the log is, and
  the two commands to switch it off; the error codes; key renewal.
- The privacy notice sentence in `privacy.astro`.
- No ADR: this adds operations tooling and changes no Studio architecture
  decision.

## Final Verification

1. `pnpm test:growth-report` passes.
2. `pnpm check` passes and runs the new tests.
3. With the keys in the local `.env`, `pnpm growth:report --dry-run` prints
   events for both repositories and
   `download_requests_day` events; no day event has today's date; running it
   twice gives the same set of `uuid` values; no PostHog request is made. Do
   not save the output in the repository.
4. `pnpm growth:report --dry-run` with the settings unset stops with
   `GROWTH001` naming each missing one.
5. A plist built by `launchAgentPlist` for a scratch folder passes
   `plutil -lint`.
6. The website builds and the privacy page shows the new sentence.
7. After the maintainer's steps: the manual `pnpm growth:report` prints only
   the summary line. In PostHog, an SQL insight
   `select event, count(), count(distinct uuid) from events where event like 'github_%' or event = 'download_requests_day' group by event`
   shows all seven events. A second manual run the same day leaves
   `count(distinct uuid)` unchanged and every per-day maximum unchanged.
8. After `pnpm growth:schedule`: `launchctl print gui/$(id -u)/com.gorenku.growth-report`
   shows the agent loaded, and the next day's log has a summary line.
9. Shape review: `git diff --stat` shows only `scripts/growth-report/`, the
   root `package.json`, the operations document, `privacy.astro` and this
   plan; no `.github/` change; no file in the folder passes about 150 lines;
   nothing else under `packages/` changed; no lockfile change.

The implementer makes no live send and does not install the schedule: the first
send and the schedule are the maintainer's steps 5 and 6.

## Addendum: Renku growth dashboard (2026-10-18)

Requested by the maintainer after the first send: one well-organised PostHog
dashboard with all data collected so far (0234's website events and this
plan's GitHub and download events), kept as code so it can be rebuilt.

- `scripts/growth-dashboard/`: chart definitions per section
  (`overview-charts.mjs`, `website-charts.mjs`, `download-charts.mjs`,
  `github-charts.mjs`), the layout (`dashboard-tiles.mjs`), a small PostHog
  app API client and the entry `publish-growth-dashboard.mjs [--check]`.
- Root scripts `growth:dashboard` and `test:growth-dashboard` (in
  `pnpm check`).
- New `.env` name `POSTHOG_PERSONAL_API_KEY` (project-limited personal key).
- It replaces 0234's three hand-made insights by name and keeps any other
  hand-made tiles.
- Studio statistics (0237) and newsletter charts beyond sign-up counts (0238)
  are added to the chart files when those plans ship.

## Completion Checklist

### Review Area

- [x] Decisions answered by the maintainer (2026-10-18).
- [x] Slice 0 limits recorded; no stop condition hit (or maintainer consulted).
- [x] Final files match the module layout in the Architecture Shape Gate.
- [x] No file in `scripts/growth-report/` passes about 150 lines; the entry
      function only composes.
- [x] No `index.mjs`, no config file, no stored state, no retries.

### Architecture And Contracts

- [x] Plist label, paths, arguments, 09:17 time and log path match Contracts;
      no GitHub Actions workflow added.
- [x] Only the four named `.env` settings are read; the release
      `CLOUDFLARE_TOKEN` and R2 keys are not used.
- [x] Seven event names, timestamps and properties match the Contracts tables.
- [x] Every event has `report_date`, `$process_person_profile: false` and
      `$geoip_disable: true`; GitHub events have `repository`.
- [x] Event ids use the fixed namespace and key lists.
- [x] Download requests are limited to the host, eyeball, `GET` and `200`;
      only paths in the table are sent.
- [x] Errors use `GROWTH001`–`009` with suggestions; keys never printed; shape
      errors list paths, not values.
- [x] Only Node built-ins and sibling files are imported; no dependency added.

### Implementation Slices

- [x] Slice 0: Cloudflare limits and field names confirmed and written into
      Contracts.
- [x] Slice 1: `errors.mjs`, `github-api.mjs`, fixtures, star-history paging,
      shape checks.
- [x] Slice 2: `download-paths.mjs`, `cloudflare-downloads.mjs`, fixtures.
- [x] Slice 3: `event-identity.mjs`, `posthog-events.mjs` with six builders,
      the day-series table and the envelope function.
- [x] Slice 4: `posthog-capture.mjs`, `report-growth.mjs`,
      `failure-notification.mjs`, root scripts, `pnpm check` updated.
- [x] Slice 5: `launch-agent-plist.mjs`, `install-launch-agent.mjs`,
      `growth:schedule`.
- [x] Slice 6: `docs/operations/growth-report.md` and the privacy sentence.

### Behavior

- [x] Nothing is sent unless every GitHub and Cloudflare read succeeded.
- [x] Today's partial day is never sent.
- [x] Every run re-sends the 13-day window and the full star history.
- [x] Dry run prints JSON lines and a summary, sends nothing, needs no PostHog
      key.
- [x] A run prints only the summary line (to the log file under the schedule).
- [ ] A scheduled failure shows one macOS notification with the error code.
- [x] Re-running `pnpm growth:schedule` replaces the agent, never duplicates it.

### Tests And Guardrails

- [x] `posthog-events.test.mjs` covers every event, skipped days, the running
      star total and stable ids.
- [x] `event-identity.test.mjs` covers the UUID test value and distinct ids.
- [x] `download-paths.test.mjs` covers every table row, checksums and unknown
      paths.
- [x] `cloudflare-downloads.test.mjs` covers filters, errors and shape checks.
- [x] `github-api.test.mjs` covers headers, paging, status codes and shape
      checks.
- [x] `posthog-capture.test.mjs` covers the request and its failures.
- [x] `report-growth.test.mjs` covers configuration errors, dry run,
      all-or-nothing sending and the summary.
- [x] `report-growth.test.mjs` covers the failure notification.
- [x] `launch-agent-plist.test.mjs` and `install-launch-agent.test.mjs` cover
      the plist, reload order and `GROWTH009`.
- [x] `imports.test.mjs` guards the no-install boundary.

### Documentation

- [x] `docs/operations/growth-report.md` written with keys, limits, path table,
      events, counting rule, recovery limit, dry run, error codes and upkeep.
- [x] Privacy notice sentence added.

### Final Verification

- [x] Final Verification steps 1–6 pass.
- [ ] Maintainer steps done; steps 7 and 8 confirmed.
- [x] Step 9 shape review done; `git diff --stat` and every new file inspected.
- [x] No checklist item was met by accepting unreviewable code.
