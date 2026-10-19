# Growth Report

Date: 2026-10-18

Status: current

A daily job on the maintainer's Mac saves GitHub numbers for
`GoRenku/studio` and `GoRenku/studio-skills` and download counts for
downloads.gorenku.com to the **Renku Website** PostHog project (EU). GitHub
deletes traffic numbers after 14 days and Cloudflare keeps request analytics
for a limited time, so nothing else records them. The plan behind this is
`plans/active/0235-github-growth-snapshot.md`.

The code is in `scripts/growth-report/`. It uses only Node built-ins and runs
straight from the working copy, with no install or build.

## Settings

Four names in the repository's `.env` (ignored by Git):

| Name | Value |
| --- | --- |
| `GROWTH_GITHUB_TOKEN` | Fine-grained GitHub token `renku-growth-report`, owner `GoRenku`, repositories `studio` and `studio-skills` only, **Administration: Read-only** (Metadata: Read-only is added automatically). |
| `CLOUDFLARE_ANALYTICS_TOKEN` | Cloudflare custom API token `renku-growth-report`, **Zone → Analytics → Read**, zone `gorenku.com` only. Never the release `CLOUDFLARE_TOKEN`, which can write to the download bucket. |
| `CLOUDFLARE_ZONE_ID` | The gorenku.com zone id (zone Overview page in Cloudflare). |
| `POSTHOG_PROJECT_TOKEN` | The public `phc_…` project token from `packages/website/src/components/WebsiteAnalytics.astro`. |

If the fine-grained GitHub token is refused with `GROWTH003` although its
permissions are right, a classic token with only the `public_repo` scope is the
fallback. It is broader: it can push to every public repository you can push
to.

## Commands

```bash
pnpm growth:report --dry-run
```

Reads everything and prints each event as a JSON line; sends nothing. Needs
the first three settings.

```bash
pnpm growth:report
```

Reads everything and sends one batch to PostHog. Prints one summary line.

```bash
pnpm growth:schedule
```

Installs the daily schedule (macOS only). It writes
`~/Library/LaunchAgents/com.gorenku.growth-report.plist`, which runs the report
at 09:17 local time with `--notify-on-failure`, and appends output to
`~/Library/Logs/renku-growth-report.log`. Running it again replaces the
schedule. Run it again after moving the repository or after the Node program
moves (for example a Homebrew or version-manager upgrade), because the plist
names both by absolute path.

To switch the schedule off:

```bash
launchctl bootout gui/$(id -u)/com.gorenku.growth-report
```

```bash
rm ~/Library/LaunchAgents/com.gorenku.growth-report.plist
```

## When it runs and what it catches up

- macOS runs a missed 09:17 run when the Mac wakes. It does not run while the
  Mac is off.
- Every run re-sends the 13 finished UTC days before today, plus the full star
  history. A gap is filled by the next successful run if it is shorter than 13
  days. Older GitHub traffic is gone, because GitHub deletes it.
- Any failure sends nothing. A scheduled failure shows a macOS notification
  "Renku growth report failed" with the error code; the details are in the log.
- The job runs the scripts as they are in the working copy at that moment, so
  a half-edited `scripts/growth-report/` can fail one day's run.

## What is read

**GitHub**, for each repository: the repository (`stargazers_count`), every
page of `stargazers/history`, `traffic/views`, `traffic/clones`,
`traffic/popular/referrers` and `traffic/popular/paths`, with
`X-GitHub-Api-Version: 2026-03-10`.

**Cloudflare**, once per day in the window: the GraphQL Analytics API dataset
`httpRequestsAdaptiveGroups` for the zone, limited to host
`downloads.gorenku.com`, `requestSource: "eyeball"`, method `GET` and status
`200`, grouped by request path and country, up to 10,000 rows per day.
On the gorenku.com free plan (checked 2026-10-18) the dataset keeps 31 days,
allows 30 days per query and returns up to 10,000 rows. A day with no
matching downloads is a normal empty result. The free plan cannot separate bots from people, so counts include
scripts and crawlers. At high traffic Cloudflare estimates counts from a
sample.

Download paths are matched against the paths the release process publishes:

| Path | `download_kind` | Extra properties |
| --- | --- | --- |
| `/install.sh` | `installer_macos` | — |
| `/install.ps1` | `installer_windows` | — |
| `/studio/channels/beta/release.json` | `release_manifest` | — |
| `/studio/releases/<version>/<target>/<file>` | `release_archive` | `release_version`, `release_target` |
| `/studio/channels/beta/<target>/<file>` | `release_archive` | `release_channel`, `release_target` |

Checksum files (`.sha256`) and any other path are not sent; the summary line
counts them as "other download requests skipped".

What the kinds mean: installer downloads are roughly fresh installs, because
`renku update` runs the installer already on the machine. Archive downloads
are installs and updates together. `release.json` is fetched by every install
and by every running Studio's update check (every 6 hours), so it is a rough
sign of running copies, not people.

## Events

Every event has a fixed `uuid`, a `timestamp`, and the properties
`report_date`, `$process_person_profile: false` and `$geoip_disable: true`.
GitHub events have `distinct_id` `github:<owner>/<repository>` and the
property `repository`. Download events have `distinct_id`
`downloads:downloads.gorenku.com`.

| Event | One per | Timestamp | Properties |
| --- | --- | --- | --- |
| `github_repository_totals` | repository, report date | report date 00:00Z | `stars_total`, `views_14d`, `unique_visitors_14d`, `clones_14d`, `unique_cloners_14d` |
| `github_star_week` | repository, star-history week | start of the week | `week_start`, `new_stars`, `stars_at_week_end` |
| `github_views_day` | repository, finished day | day 00:00Z | `day`, `views`, `unique_visitors` |
| `github_clones_day` | repository, finished day | day 00:00Z | `day`, `clones`, `unique_cloners` |
| `github_top_referrer` | repository, report date, referrer (up to 10) | report date 00:00Z | `referrer`, `views_14d`, `unique_visitors_14d` |
| `github_top_path` | repository, report date, path (up to 10) | report date 00:00Z | `path`, `title`, `views_14d`, `unique_visitors_14d` |
| `download_requests_day` | finished day, published path, country | day 00:00Z | `day`, `path`, `download_kind`, `country`, `requests`, and `release_version`, `release_channel`, `release_target` when present |

The `uuid` is a version 5 UUID of the JSON key
`[event, repository, report date | day | week]`,
`[event, repository, report date, referrer | path]` for the top lists, or
`[event, 'downloads.gorenku.com', day, path, country]` for downloads, under the
namespace `268ee6c6-e0d3-4c92-90b4-aca38b48d0b7`. Changing either breaks
merging with stored events.

## Counting rule for charts

Every run re-sends readings with the same ids. PostHog usually merges repeats,
but does not promise to. So:

- use the **maximum** of a property per day (per week for star weeks);
- never chart the number of these events, and never add raw property values
  across events;
- for totals over longer periods, or for adding downloads across countries,
  paths or kinds, use a PostHog SQL insight that first takes the maximum per
  key (repository and day; or day, path and country), then adds those up.

Clones mostly come from installs and `renku update` fetching plugins, so they
count machines rather than people.

## Dashboard

The **Renku growth** dashboard in the Renku Website PostHog project shows
everything collected so far: website visits and actions (gorenku.com),
downloads, Renku Studio usage statistics, GitHub, and Latent Matinee. The
Renku Studio section counts only installs that turned usage statistics on
(ADR 0120). Its charts are defined in
`scripts/growth-dashboard/`, one file per section, and follow the counting
rule above.

```bash
pnpm growth:dashboard --check
```

Runs every chart query against PostHog and changes nothing.

```bash
pnpm growth:dashboard
```

Runs the same checks, then creates or updates the dashboard. Charts are
matched by name and section headings by their first line, so running it again
updates them in place. Tiles added by hand are kept and moved to the bottom.
Any failing query stops the run before the dashboard changes.

It needs `POSTHOG_PERSONAL_API_KEY` in `.env`: a PostHog personal API key
limited to the Renku Website project with Dashboard: Write, Insight: Write,
Query: Read and Project: Read. Errors use `DASHBOARD001` (key missing),
`DASHBOARD002` (access refused), `DASHBOARD003` (other API failure),
`DASHBOARD004` (chart queries failed, all listed), `DASHBOARD005` (unknown
argument) and `DASHBOARD006` (the key belongs to another project).

## Error codes

| Code | Meaning |
| --- | --- |
| `GROWTH001` | Required settings missing; all missing names are listed. |
| `GROWTH002` | Unknown or conflicting arguments. |
| `GROWTH003` | GitHub refused access (401, 403, 404). Check the token's permissions and expiry. |
| `GROWTH004` | Other GitHub failure (other status or network error). |
| `GROWTH005` | A GitHub or Cloudflare reply had an unexpected shape; field paths are listed, values are not. |
| `GROWTH006` | PostHog did not accept the batch. |
| `GROWTH007` | Cloudflare refused access. Check the token, its zone and the zone id. |
| `GROWTH008` | Other Cloudflare failure, including a day outside the plan's history or the 10,000-row limit. |
| `GROWTH009` | The schedule could not be installed. |

Messages never contain a token.

## Upkeep

- Renew the GitHub token before it expires; an expired token fails with
  `GROWTH003`. The Cloudflare token has no expiry; if it is revoked the run
  fails with `GROWTH007`.
