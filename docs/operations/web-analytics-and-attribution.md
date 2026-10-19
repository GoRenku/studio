# Web Analytics And Attribution

Date: 2026-10-17

Status: current

How gorenku.com and latentmatinee.com measure visits, which events they send,
and how links to them are tagged. The decision behind this setup is
[ADR 0121](../decisions/0121-measure-public-websites-in-one-posthog-project.md).

## PostHog project

Both websites send to one PostHog project, **Renku Website**, in the EU
region (`https://eu.i.posthog.com`), on the free plan with no card. The public
project token is in each site's `src/components/WebsiteAnalytics.astro`. That
component is the only file on each site that talks to PostHog. Pages only mark
elements with the `data-analytics-*` attributes below.

Every event carries a `surface` property, added in PostHog's `before_send`:

| `surface` | Sent by |
| --- | --- |
| `website` | gorenku.com (`packages/website`) |
| `matinee` | latentmatinee.com (`ai-films` repository) |

Plan 0237 adds `studio` for Renku Studio statistics. GitHub and download
numbers from the [growth report](growth-report.md) are told apart by their
event names.

## Consent states

| Banner answer | What happens |
| --- | --- |
| Not answered | The banner shows. PostHog is not loaded. Nothing is sent or stored. |
| Yes | PostHog stores a browser identifier in `localStorage` and receives page views, page-leave times and every event below. |
| No | Only the choice is stored. PostHog receives page views and page-leave times, identified by a code it computes on its servers from the network address, browser, host and a salt it replaces daily (`cookieless_mode: 'on_reject'`). No location. |
| Yes changed to No | PostHog deletes its browser identifier and switches to the No behaviour. |

**Analytics choice** in each site's footer reopens the banner. The stored
choice keys are `renku_website_analytics_consent` (gorenku.com) and
`latent_matinee_analytics_consent` (Latent Matinee). PostHog keeps its own copy
in `__ph_opt_in_out_<token>`.

`$opt_in` is sent only when a visitor clicks Yes, not on later page loads.

## Events

| Event | Site | When | Properties | Sent for |
| --- | --- | --- | --- | --- |
| `$pageview` | both | page load, and again after a change of answer | `surface` | Yes, No |
| `$pageleave` | both | leaving the page (automatic) | `surface` | Yes, No |
| `$opt_in` | both | clicking Yes | `surface` | Yes |
| `download_clicked` | gorenku | a link to `/download` is followed | — | Yes |
| `quick_start_viewed` | gorenku | Quick Start is opened | — | Yes |
| `tutorials_viewed` | gorenku | the tutorial index is opened | — | Yes |
| `tutorial_viewed` | gorenku | a tutorial is opened | `tutorial` (slug) | Yes |
| `github_link_clicked` | gorenku | a link to `github.com/GoRenku/<repo>…` is clicked | `repo`, `placement` | Yes |
| `install_command_copied` | gorenku | Copy button, or a manual copy, in an install command block | `os` | Yes |
| `skills_install_copied` | gorenku | a manual copy in a skills command block | — | Yes |
| `video_played` | gorenku | first `play` of a marked video per page load | `video` | Yes |

Property values:

- `repo`: the GitHub repository name, lowercased (`studio`, `studio-skills`).
  Links to other owners, or to the organisation page without a repository,
  send nothing.
- `placement`: the `data-analytics-placement` value of the nearest ancestor,
  else `page`. `$pathname` tells which page.
- `os`: `macos` or `windows`.
- `video`: the media file's base name without the build hash
  (`renku-launch`, `harbor-blender-previs`, `harbor-generation`,
  `first-patron-previs`, `first-patron-take`).

`github_link_clicked` is sent with the `sendBeacon` transport because the page
may navigate away.

## Page attributes

| Attribute | Where | Values |
| --- | --- | --- |
| `data-analytics-placement` | gorenku.com `SiteHeader.astro` `<header>` and `SiteFooter.astro` `<footer>` | `header`, `footer` |
| `data-analytics-copy` | `download.astro` macOS and Windows install `.command-block`; both `<pre>` blocks in `agent-skills.astro` | `install-macos`, `install-windows`, `skills` |
| `data-analytics-video` | user-started `<video>` elements: `LaunchFilm.astro`, `MadeWithRenkuSection.astro`, `tutorials/[slug].astro` | file base name, from `src/data/analytics-video.ts` |

The launch-command blocks on `/download` and the autoplaying
`first-patron-shot-plan` video carry no attribute and send nothing. An unknown
`data-analytics-copy` value sends nothing. A page that needs an event these
attributes cannot express extends this table; it never calls PostHog itself.

## Link tags (UTM convention)

Tag only links that lead to **gorenku.com or latentmatinee.com** from places
outside that site. Never tag links to GitHub or other sites, which ignore the
tags, or links between pages of the same site, where a tag would replace the
visitor's real source for that visit.

Values use lowercase letters, digits and hyphens.

| `utm_source` | Where the link is posted | `utm_medium` | PostHog channel |
| --- | --- | --- | --- |
| `hn` | Hacker News | `community` | Community (custom rule) |
| `reddit` | Reddit | `community` | Community |
| `discord` | Discord servers | `community` | Community |
| `x` | X | `social` | Organic Social |
| `youtube` | YouTube descriptions and comments | `video` | Organic Video |
| `github` | READMEs, organisation profile, release notes | `referral` | Referral |
| `latentmatinee` | Latent Matinee pages | `referral` | Referral |
| `gorenku` | gorenku.com pages linking to Latent Matinee | `referral` | Referral |

- `utm_campaign` (required): `always-on` for permanent links (READMEs,
  repository About, Latent Matinee pages, profile bios); `YYYY-MM-<topic>` for
  a dated push (`2026-10-show-hn`).
- `utm_content` (optional): which link, when one place has several
  (`studio-readme`, `skills-readme`, `footer`, `film-page`).
- `utm_term`: not used.
- A new source is added to this table first, with one medium from the list. A
  new medium also needs a PostHog custom channel rule.
- GitHub's repository "Website" field stays an untagged `https://gorenku.com`.
  GitHub shows the raw address and already sends github.com as the referrer.

Ready-to-use tags for permanent links:

| Link location | Query string |
| --- | --- |
| Studio README | `utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme` |
| Studio Skills README | same with `utm_content=skills-readme` |
| Studio release notes | same with `utm_content=release-notes` |
| GoRenku organisation profile | same with `utm_content=org-profile` |
| `keremk/renku` README | same with `utm_content=renku-readme` |
| Latent Matinee footer disclosure | `utm_source=latentmatinee&utm_medium=referral&utm_campaign=always-on&utm_content=footer` |
| gorenku.com footer link to Latent Matinee | `utm_source=gorenku&utm_medium=referral&utm_campaign=always-on&utm_content=footer` |

Examples:

- `https://gorenku.com/?utm_source=hn&utm_medium=community&utm_campaign=2026-10-show-hn`
- `https://gorenku.com/download/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme`
- `https://gorenku.com/?utm_source=latentmatinee&utm_medium=referral&utm_campaign=always-on&utm_content=footer`

## PostHog configuration

Settings the maintainer makes in the **Renku Website** project. Cookieless
server hash mode must be on before either site ships its analytics code.

| Setting | Value |
| --- | --- |
| Plan | Free, no card |
| Authorized URLs | `https://gorenku.com`, `https://latentmatinee.com` |
| Cookieless server hash mode (Project settings → Web analytics) | On. Without it, events from visitors who chose No are discarded. |
| Custom channel type | "Community": `utm_medium` equals `community` |
| Autocapture, heatmaps, dead clicks, web vitals | Off in code (`autocapture`, `enable_heatmaps`, `capture_dead_clicks`, `capture_performance` set to `false`), because project settings can switch them on remotely |
| Session recording | Off (`disable_session_recording: true` in code) |
| Survey | One open-text question on `gorenku.com/download`, shown once, after 45 seconds, to Yes visitors |
| Dashboard | "Renku growth", published by `pnpm growth:dashboard` (see [growth report](growth-report.md#dashboard)); website charts are filtered to `$host` and `surface` so local test traffic is excluded |
| Retention | One year (free plan) |

Each page view sends about two events (`$pageview` and `$pageleave`), so the
free plan's 1M events a month covers roughly 400,000 page views across both
sites.

## Known limits

- Visitors who never answer the banner are not counted.
- A visitor who answers on a later page is attributed to that page, not to the
  link they arrived from. Storing the landing link before they answer would
  itself need consent.
- Visitors who chose No count as a new visitor each day, so charts use
  sessions, not unique visitors.
- Surveys and recordings never reach visitors who chose No.
- Clicks, copies and video plays describe Yes visitors only.
- `skills_install_copied` counts only copies made by selecting the text,
  because `/agent-skills/` has no Copy button.
- Events sent while testing on `localhost` reach the same project; dashboards
  filter them out by host.
