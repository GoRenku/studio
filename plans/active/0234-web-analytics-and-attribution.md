# 0234 Web Analytics And Attribution

Status: in progress (Slices 1–3 implemented 2026-10-17)
Date: 2026-10-15

## Summary

gorenku.com already sends page views and four small events to PostHog, but
only for visitors who click **Yes** on the analytics banner. It cannot tell us
how many people click through to GitHub, copy an install command, or watch a
video. Visitors who click **No** are not counted at all, and nothing records
which post, README or site sent a visitor. Latent Matinee has no analytics,
no consent banner and no privacy page.

This plan makes four changes and hands the maintainer a fifth:

1. **gorenku.com events.** Four new events (GitHub link clicks, install
   command copies, skills command copies, video plays), page-leave times so
   PostHog can show time on page and bounce rate, and a `surface` property on
   every event.
2. **Counting visitors who say No.** PostHog's "cookieless on reject" mode
   counts their page visits without storing anything in their browser. The
   banner and the Privacy Notice change so that "No" is described truthfully.
3. **One written link-tagging convention** (UTM tags) in a new operations page,
   `docs/operations/web-analytics-and-attribution.md`, which plans 0231 and
   0238 point to instead of copying.
4. **Latent Matinee analytics** in the same PostHog project, with its own
   banner and a short privacy page, as a separate code task in the `ai-films`
   repository.
5. **PostHog setup steps for the maintainer**: authorized domains, the
   cookieless project setting, one "Community" channel rule, a one-question
   survey on `/download`, and a "Renku growth" dashboard.

Nothing here adds an npm dependency, a server, a build step, or code in any
Studio package.

## Review Attention

- **What visitors will notice**
  - The banner on gorenku.com asks a slightly different question and says what
    happens on No: *"May we store an analytics identifier in your browser to
    learn which Renku guides and downloads are useful? If you choose No, we
    still count your page visits, without storing anything in your browser."*
  - Latent Matinee gains the same kind of banner, a `/privacy/` page, and
    **Privacy** and **Analytics choice** in its footer.
  - Nothing else on either site looks different.
- **Added beyond the literal request, and why**
  - **New banner wording on both sites.** Today "No" means nothing is sent.
    After this plan visitors who click No are still counted, so the old question would
    mislead them.
  - **One PostHog "Community" channel rule** (`utm_medium` equals
    `community`). PostHog does not recognise that medium. Without the rule,
    Hacker News, Reddit and Discord links would show up as "Referral" or
    "Unknown" in the channel chart.
  - **The website event list moves** from `packages/website/README.md` into
    the new operations page, so both sites, the dashboard and the sibling
    plans read one list. The README keeps a short pointer.
  - **Stop sending PostHog's `$opt_in` event on every page.** Today each page
    load by a Yes visitor sends it, which doubles the events per page for no
    information. After this plan it is sent only when someone actually clicks
    Yes. This keeps the free-plan event allowance in view.
  - **A short ADR** recording the one-project setup and the decision to count
    visitors who click No, because siblings 0235 and 0237 build on it.
  - **A `gorenku` link source and a table of ready-made tags** for the
    permanent links that 0231, 0232 and 0238 place, so none of them invents
    its own values. 0232 adds a gorenku.com footer link to Latent Matinee,
    which needs the `gorenku` source.
  - **The newsletter paragraph of the Latent Matinee privacy page.** 0238
    collects email addresses and expects this plan's page to cover them.
- **New or changed public things**
  - Events: `github_link_clicked {repo, placement}`,
    `install_command_copied {os}`, `skills_install_copied`,
    `video_played {video}`, `$pageleave`, and on Latent Matinee
    `newsletter_signup_submitted {placement}` (fires once plan 0238 adds its
    form). Every website event carries `surface` (`website` or `matinee`).
  - Page markup attributes that the analytics script reads:
    `data-analytics-placement`, `data-analytics-copy`,
    `data-analytics-video`, `data-analytics-form`.
  - Latent Matinee: browser storage key `latent_matinee_analytics_consent`,
    page `/privacy/`.
  - gorenku.com Privacy Notice: the "Optional website analytics" section
    becomes "Website analytics" (same `id`), plus edits to "Your analytics
    choice" and one sentence in "Sharing and retention".
  - New page `docs/operations/web-analytics-and-attribution.md`; new ADR.
- **Hard to reverse**
  - Once visitors who click No are counted, those events stay in PostHog for its
    retention period (one year on the free plan). Switching the mode off later
    is easy; removing past events is not.
  - Publishing either site and the new privacy wording is public.
  - Nothing is deleted from either repository except the README event table,
    which moves.
- **Kept unchanged on purpose**
  - Visitors who have not answered the banner: PostHog is not loaded and
    nothing is sent, exactly as today.
  - Automatic click capture stays off and session recording stays off, unless
    the maintainer chooses otherwise in D3 and D4.
  - Same PostHog project ("Renku Website"), same public token, EU host, same
    gorenku.com consent key, same four existing events, no `identify` calls,
    no person profiles for anonymous visitors.
  - The Studio app paragraph of the Privacy Notice (plan 0237 owns it), the
    Terms, and the project's IP setting (plan 0237 raises it).
- **Assumptions**
  - "Renku Website" is the only PostHog project and stays on the free plan
    with no card.
  - Latent Matinee's privacy contact is the same as gorenku.com's
    (Kerem Karatal, support@codingventures.com).
  - PostHog's docs say location and bot detection are removed "when cookieless
    server hash mode is enabled". We read this as applying only to the No
    visitors' events; a check after launch confirms it (see Final
    Verification).
  - This plan is not legal advice. Whether counting visitors who click No needs their
    consent is not settled law (see D2).
- **Needs the maintainer's approval**: D1–D4 below, the exact banner and
  privacy wording for both sites, the ADR, the Latent Matinee code task, and
  publishing both sites.

## Decisions

Decided by the maintainer on 2026-10-17: **D1-A, D2-A, D3-A, D4-A**. The
maintainer wants every visit counted, including visitors who click No, and
nothing beyond page views and page-leave times recorded for them.

### D1. What is sent for visitors who choose No

- **A (recommended): page views and page-leave times only.** "No" then means:
  nothing is stored in the browser except the choice, and only page visits are
  counted. GitHub clicks, command copies, video plays, the existing download
  and tutorial events, and newsletter submissions come only from Yes visitors.
  Visit and channel counts include everyone who answered; the install path
  chart describes Yes visitors only (a sample).
- **B: send the same events for visitors who click No**, without an identifier. Fuller
  numbers, but the banner and notice must say clicks and copies are counted
  too, and the existing download-click marker, which uses the browser's
  session storage, must switch to an immediate send for visitors who click No.

### D2. Counting visitors who click No at all, and its wording

The EDPB's Guidelines 2/2023 on the technical scope of the ePrivacy rule
(final version adopted October 2024) list "tracking based on IP only" among
cases that may need consent. PostHog's cookieless counting computes a daily
code from the visitor's network address on PostHog's servers, so some
regulators may treat it as needing consent. The proposed notice names our
legitimate interest as the legal basis.

- **A (recommended): accept the wording in Contracts as written**, optionally
  after legal advice, and ship cookieless counting.
- **B: do not count visitors who click No.** Skip the cookieless setting and the No
  paragraphs; keep "No = nothing sent". Every other part of this plan ships
  unchanged.

### D3. Session recording

- **A (recommended): stays off.** The install path chart and the `/download`
  survey answer the first questions; recording needs broader banner and notice wording,
  which may lower the Yes rate.
- **B: record Yes visitors on `/download` and `/quick-start` only.** Code sets
  `disable_session_recording: false`; PostHog replay gets a URL trigger for
  those two paths and `gorenku.com` as its only recording domain; inputs stay
  masked; the banner adds "and record how you use the Download and Quick
  Start pages" and the notice gains a recording paragraph. Free plan: 5,000
  recordings a month.

### D4. Automatic click capture (autocapture)

- **A (recommended): stays off.** The explicit events answer the questions.
  Consequences: PostHog's "Outbound clicks" tile stays empty
  (`github_link_clicked` covers GitHub), heatmaps are unavailable, and bounce
  rate means "one page, under 10 seconds".
- **B: turn it on** for Yes visitors. More events, every clicked element's
  text sent to PostHog, and the notice must drop "capture every click
  automatically".

## What Visitors Experience

| Banner answer | gorenku.com | Latent Matinee |
| --- | --- | --- |
| Not answered | Banner shows. PostHog is not loaded. Nothing is sent or stored. | Same. |
| Yes | PostHog stores a browser identifier and receives page views, page-leave times, the four existing events, and the four new events. A one-question survey may appear on `/download`. | Page views, page-leave times, and newsletter submissions once 0238 ships its form. |
| No (D1-A, D2-A) | Only the choice is stored. Page views and page-leave times are counted with PostHog's daily server-side code. No location. | Same. |
| Yes changed to No | PostHog deletes its browser identifier and switches to counting only. | Same. |

**Footer → Analytics choice** reopens the banner on both sites.

Known limits, recorded in the operations page:

- Visitors who never answer are not counted.
- A visitor who answers on a later page is attributed to that page, not to the
  link they arrived from. Storing their landing link before they answer would
  itself need consent.
- Visitors who click No count as a new visitor each day, so the charts use sessions,
  not unique visitors.
- Surveys and recordings never reach visitors who click No (PostHog disables both).
- `skills_install_copied` counts only copies made by selecting the text,
  because `/agent-skills/` has no Copy button. Adding one is a visual change
  outside this plan.

## Requirement Ledger

"Request N" is item N of this area's approved scope.

| Requirement | Source | Where it is met |
| --- | --- | --- |
| `github_link_clicked {repo, placement}` | Request 1 | Slice 1, Contracts |
| `install_command_copied {os}` | Request 1 | Slice 1 |
| `skills_install_copied` | Request 1 | Slice 1 |
| `video_played {video}` | Request 1 | Slice 1 |
| Page-leave capture | Request 1 | Slices 1 and 4 |
| `surface` on every event | Request 1, 4 | Slices 1 and 4 |
| Autocapture and recording kept explicit | Request 1 | D3, D4 |
| Count visitors who click No with `cookieless_mode: 'on_reject'` | Request 2 | Slices 1, 4, 5 |
| Honest privacy wording for website events | Request 2 | Slice 2 |
| Banner wording that matches "No" | Consent honesty, from request 2 | Slice 2, Slice 4 |
| One UTM convention in one accepted docs place | Request 3 | Slice 3 |
| Latent Matinee in the same project, `surface: 'matinee'` | Request 4 | Slice 4 |
| LM banner and privacy page | Request 4 | Slice 4 |
| LM tag values for links to gorenku.com | Request 4 | Slice 3 (links placed by 0238) |
| No new LM dependency; mirror gorenku loading | Request 4; `ai-films/AGENTS.md` | Slice 4 |
| LM code task separate from content refreshes | Request 4; `ai-films/AGENTS.md` | Slice 4 |
| PostHog maintainer steps (domains, cookieless, survey, dashboard) | Request 5 | Slice 5 |
| Free-plan limits in view | Request 5 | Slice 5; `$opt_in` change |
| Newsletter event name for 0238 | Sibling brief | Contracts |
| Newsletter paragraph on the LM privacy page | 0238 relies on this plan's page before collecting emails | Contracts, Slice 4 |
| Ready-to-use tags for 0231, 0232, 0238 links | Request 3 (siblings reference, not copy) | Contracts |
| "Community" channel rule | PostHog does not know `utm_medium=community` | Slice 5 |
| One event list, ADR | `docs/README.md` documentation roles | Slice 3 |

## Context And Evidence

### gorenku.com today (`packages/website`)

- `src/components/WebsiteAnalytics.astro`: inline PostHog snippet (no npm
  package; it loads `array.js` from the EU host at runtime). Starts only when
  `localStorage.renku_website_analytics_consent === 'yes'`. Init:
  `capture_pageview: false` with a manual `$pageview`, `autocapture: false`,
  `disable_session_recording: true`, `persistence: 'localStorage'`,
  `person_profiles: 'identified_only'`. Calls `opt_in_capturing()` on every
  start, which sends `$opt_in` on every page. Sends `download_clicked` (via a
  `sessionStorage` marker), `quick_start_viewed`, `tutorials_viewed`,
  `tutorial_viewed {tutorial}`. One delegated `click` listener.
- `src/components/CookieConsent.astro`: banner, key
  `renku_website_analytics_consent`, dispatches `renku:analytics-consent`;
  footer button `[data-cookie-settings]` reopens it.
- `src/layouts/BaseLayout.astro` includes both on every page.
- GitHub links: `SiteHeader.astro` (`site.githubUrl`,
  `https://github.com/GoRenku/studio`), `download.astro:171`,
  `terms.astro` license links, `data/tutorials.ts` (sample project, skills
  folders). No GitHub link in the footer today; plan 0232 adds header and
  footer links.
- Copy controls: `download.astro` has four `data-copy` buttons (macOS install,
  Windows install, two launch commands) handled by its own script.
  `agent-skills.astro` shows two `npx skills add` commands in plain
  `<pre><code>` with no Copy button.
- Videos: `LaunchFilm.astro` (`renku-launch.mp4`, play button),
  `MadeWithRenkuSection.astro` and `tutorials/[slug].astro`
  (`harbor-blender-previs.mp4`, `harbor-generation.mp4`,
  `first-patron-previs.mp4`, `first-patron-take.mp4`; the Shot Planning
  section no longer has videos),
  `VideoFeatureSection.astro` (`first-patron-shot-plan.mp4`, autoplays muted).
- `src/pages/privacy.astro`: line 23 is the Studio paragraph (0237's);
  lines 37–46 are the analytics and choice sections (this plan's); line 50
  mentions "consented website analytics".
- `packages/website/README.md` documents the event table; there is no ADR or
  `docs/` page about website analytics.
- No Content-Security-Policy in `public/_headers`, so the PostHog script needs
  no header change.

### Latent Matinee today (`../ai-films`)

- Astro static site, Cloudflare Pages project `latent-matinee`, apex domain
  `latentmatinee.com` (www redirects to it), `trailingSlash: "always"`.
- `src/layouts/Layout.astro` holds the header, footer and site scripts; no
  analytics, banner or privacy page. Its links never point to gorenku.com.
- `public/_headers` sets `Referrer-Policy: strict-origin-when-cross-origin`,
  so gorenku.com sees `latentmatinee.com` as the referring domain. No CSP.
- `scripts/validate-build.mjs` fails on a static `<script src="https:…">`,
  missing titles, more than one `<h1>`, and broken local links. A runtime-added
  script, like the PostHog snippet, passes. Loading PostHog after consent is a
  deliberate exception to the site's "no remote scripts" posture.
- `AGENTS.md`: scheduled refreshes (11:00 and 13:00 Europe/Madrid, via Codex)
  are content-only and must not touch `src/`, CSS, scripts or packages; code
  changes are separate explicit tasks; seven-day release-age dependency
  policy; deploy only committed, pushed work from a clean tree with
  `pnpm deploy:cloudflare`.

### PostHog facts used here

- `cookieless_mode: 'on_reject'`: nothing is stored and nothing is captured
  until the visitor opts in or out; after `opt_out_capturing()` events are
  sent with a server-side code `hash(team_id, daily_salt, ip, user_agent,
  hostname)`. The project setting **Cookieless server hash mode** (Project
  settings → Web analytics) must be on, or those events are discarded.
  Location and bot detection do not apply to them. Surveys and session replay
  are disabled for them. (posthog.com/docs/data/cookieless-tracking; posthog-js
  `posthog-core.ts`.)
- posthog-js `opt_out_capturing()` in this mode resets the stored identity and
  disables storage; PostHog keeps its own copy of the choice in
  `localStorage.__ph_opt_in_out_<token>`. `opt_in_capturing({
  captureEventName: false })` opts in without sending `$opt_in`.
- `capture_pageleave` defaults to `'if_capture_pageview'`; with the manual
  page view it must be set to `true`.
- `before_send` runs on every event in every consent state; it is the stable
  place to add `surface` (a `register`ed property would be cleared by the
  identity reset at each consent change).
- Bounce rate needs `$pageleave`; the "Outbound clicks" tile needs
  autocapture.
- Channel type uses PostHog's source and medium lists. `social`, `email`,
  `referral` and `video` are known mediums; `community` is not. `reddit`,
  `youtube` are known sources; `hn`, `x`, `github`, `discord`,
  `latentmatinee`, `newsletter` are not, so their medium decides the channel.
  Custom channel rules take priority.
- Authorized URLs (Project settings) feed the web analytics domain filter and
  the toolbar.
- Free plan: 1M events, 5,000 recordings, 1,500 survey responses a month, one
  project, one-year retention. No card means no charges.

### Sibling ownership

| Area | Owner |
| --- | --- |
| GitHub header control, footer links, download page wording | 0232. This plan's events attach to those controls (see Dependencies). |
| README links to gorenku.com | 0231, using this plan's tags. |
| New showcase or journal videos | 0233, using the `data-analytics-video` rule. |
| GitHub numbers in PostHog and their charts | 0235 ("What 0234 should chart"). |
| Studio statistics, the Privacy Notice's Studio paragraph and `#app-usage-statistics` section, the PostHog IP setting question | 0237. |
| Links from Latent Matinee to gorenku.com and the LM newsletter form | 0238, using this plan's tags and form attribute. |
| PostHog project, website events, UTM convention, "Renku growth" dashboard, both sites' analytics wording, the whole LM privacy page | This plan. |

### Dependencies

- **0232**: GitHub controls must be plain links (`<a href="https://github.com/GoRenku/…">`),
  not a third-party star-button frame, whose clicks cannot be seen. Header and
  footer roots keep `data-analytics-placement`. If 0232 restructures the
  `/download` command blocks, the install blocks keep `data-analytics-copy`.
  Whichever plan lands second keeps the other's attributes.
- **0237**: "Last updated" in `privacy.astro` gets one shared date when both
  land together; otherwise the later plan sets it. 0237's draft "heard about"
  list spells `hacker-news` and `latent-matinee`; it says it follows this
  plan's spelling, so it switches to `hn` and `latentmatinee`.
- **0238**: its LM → gorenku.com link uses the footer tags in Contracts. Its
  Slice 5 expects "0234's send function"; under this plan there is no such
  function (it would let any page send any event). Instead its `<form>` gets
  `data-analytics-form="newsletter"` and needs no script; this plan's
  listener sends the event. The newsletter paragraph of the LM privacy page is
  written by this plan from 0238's provider choice (Contracts), so the page
  is ready before 0238 collects any email address. Both plans edit
  `Layout.astro`'s footer; keep edits narrow.
- **0231 and 0232**: fill their gorenku.com and Latent Matinee links from the
  ready-to-use tag table in Contracts.
- **Cookieless server hash mode must be on before either site ships this
  code.**

## Architecture Shape Gate

This is static marketing-site code in `packages/website` and `ai-films`. No
Studio, Core, CLI or Engines code changes.

- **Ownership**
  - Each site's `src/components/WebsiteAnalytics.astro` is the only file that
    talks to PostHog: it loads the snippet, syncs consent, sends page views
    and every event.
  - Each site's `src/components/CookieConsent.astro` owns the stored Yes/No
    choice and the banner, and announces changes with a window event.
  - Pages and components only declare what they are, through the four
    `data-analytics-*` attributes. They never call `posthog`.
  - The privacy pages own the visitor-facing wording.
  - `docs/operations/web-analytics-and-attribution.md` owns the event list,
    attribute rules, surfaces, UTM convention and PostHog configuration
    record.
- **Shape of `WebsiteAnalytics.astro` (gorenku.com)**: one inline script with
  small named functions: `storedChoice`, `start`, `syncConsent`, `trackPage`,
  `captureConsented`, `placementOf`, `onClick`, `onCopy`, `onPlay`. One
  three-entry lookup table maps `data-analytics-copy` values to events. No new
  path branches: the existing `trackPage` path checks stay as they are.
- **Latent Matinee** gets copies of the two components, adapted: different
  storage key, window event name, `surface`, banner copy and styles; its
  analytics script keeps the consent functions and adds only an `onSubmit`
  listener, with no click, copy or play listeners. The
  duplication is deliberate: two repositories with no shared package, and LM
  must not gain a dependency.
- **Forbidden**
  - `posthog` calls outside `WebsiteAnalytics.astro` (including in 0238's
    form code or `download.astro`'s copy handler);
  - loading PostHog before the visitor answers;
  - storing anything (including `sessionStorage` markers) for visitors who click No;
  - an npm PostHog package, a shared cross-repo module, or a new build step;
  - turning on autocapture or recording without D3/D4;
  - per-page `if (path === …)` branches for the new events.
- **Stop and revise if**
  - the gorenku script passes about 200 lines or needs a second lookup
    table: move it to a bundled `<script>` with `src/analytics/` modules
    first;
  - a page needs to send an event the attributes cannot express: extend the
    attribute contract in the operations page instead of calling PostHog;
  - 0232's header or footer cannot carry `data-analytics-placement` on its
    root element.

## Contracts

### PostHog initialisation (both sites)

```js
posthog.init(token, {
  api_host: 'https://eu.i.posthog.com',
  capture_pageview: false,
  capture_pageleave: true,
  autocapture: false,               // D4-A
  enable_heatmaps: false,           // the project had these switched on
  capture_dead_clicks: false,       // remotely; the notice promises no
  capture_performance: false,       // automatic click capture
  disable_session_recording: true,  // D3-A
  persistence: 'localStorage',
  person_profiles: 'identified_only',
  cookieless_mode: 'on_reject',     // omitted under D2-B
  before_send: function (event) {
    if (event) event.properties.surface = 'website'; // 'matinee' on LM
    return event;
  },
});
```

Same public token on both sites (`phc_rTTOT…` in today's component).

### Consent flow (both sites)

1. Page load, no stored answer: do nothing. The banner shows.
2. Page load, stored `yes`: `start()`, then
   `opt_in_capturing({ captureEventName: false })`, then `trackPage()`.
3. Page load, stored `no`: `start()`, `opt_out_capturing()`, `trackPage()`.
4. Visitor clicks Yes: start if needed, `opt_in_capturing()` (sends `$opt_in`
   once), `trackPage()`.
5. Visitor clicks No: start if needed, `opt_out_capturing()`, `trackPage()`.

`trackPage()` sends `$pageview`. On gorenku.com it then sends the existing
path events only for `yes` (D1-A). It runs again after each change of answer
because PostHog switches to a different visitor code at each change.

| | gorenku.com | Latent Matinee |
| --- | --- | --- |
| Storage key | `renku_website_analytics_consent` (unchanged) | `latent_matinee_analytics_consent` |
| Window event | `renku:analytics-consent` (unchanged) | `matinee:analytics-consent` |
| `surface` | `website` | `matinee` |

### Events

| Event | Site | When | Properties | Sent for |
| --- | --- | --- | --- | --- |
| `$pageview` | both | page load or answer change | `surface` | Yes, No |
| `$pageleave` | both | leaving the page (automatic) | `surface` | Yes, No |
| `$opt_in` | both | clicking Yes only | `surface` | Yes |
| `download_clicked`, `quick_start_viewed`, `tutorials_viewed`, `tutorial_viewed {tutorial}` | gorenku | unchanged | `surface` | Yes |
| `github_link_clicked` | gorenku | click on a link to `github.com/GoRenku/<repo>…` | `repo`, `placement` | Yes |
| `install_command_copied` | gorenku | Copy button or manual copy inside an install block | `os` | Yes |
| `skills_install_copied` | gorenku | manual copy inside a skills command block | — | Yes |
| `video_played` | gorenku | first `play` of a marked video per page load | `video` | Yes |
| `newsletter_signup_submitted` | LM | `submit` of a marked form | `placement` | Yes |

Under D1-B every row except `$opt_in` also goes to visitors who click No. Under D2-B
nothing is sent for them.

Property values:

- `repo`: the GitHub repository name, lowercased (`studio`, `studio-skills`,
  `sample-project`). Links to other owners, or to the organisation page
  without a repository, send nothing.
- `placement`: the `data-analytics-placement` value of the nearest ancestor
  (`header` on the site header root, `footer` on the site footer root), else
  `page`. `$pathname` tells which page.
- `os`: `macos` or `windows`.
- `video`: the media file's base name: `renku-launch`,
  `harbor-blender-previs`, `harbor-generation`. New videos follow the same
  rule. The autoplaying `first-patron-shot-plan` video is not marked.

`github_link_clicked` and `newsletter_signup_submitted` use
`{ transport: 'sendBeacon' }` because the page may navigate away.

### Page attributes

| Attribute | Where | Values |
| --- | --- | --- |
| `data-analytics-placement` | `SiteHeader.astro` `<header>`, `SiteFooter.astro` `<footer>`; LM `Layout.astro` `<footer>` | `header`, `footer` |
| `data-analytics-copy` | `download.astro` macOS and Windows install `.command-block`; `agent-skills.astro` both `<pre>` | `install-macos`, `install-windows`, `skills` |
| `data-analytics-video` | `LaunchFilm.astro`, `MadeWithRenkuSection.astro` (two), `tutorials/[slug].astro` (every tutorial video) `<video>` | file base name, from `src/data/analytics-video.ts` |
| `data-analytics-form` | 0238's LM newsletter `<form>` | `newsletter` |

The launch-command blocks on `/download` carry no attribute and send nothing.
An unknown `data-analytics-copy` value sends nothing; Final Verification
checks every value.

### UTM convention (full text goes in the operations page)

Tag only links that lead to **gorenku.com or latentmatinee.com** from places
outside that site. Never tag links to GitHub or other sites (they ignore the
tags) or links between pages of the same site (a tag would replace the
visitor's real source for that visit).

Values are lowercase letters, digits and hyphens.

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
| `newsletter` | The Latent Matinee newsletter | `email` | Email |

- `utm_campaign` (required): `always-on` for permanent links (READMEs,
  repository About, Latent Matinee pages, profile bios); `YYYY-MM-<topic>` for
  a dated push (`2026-10-show-hn`); the issue date `YYYY-MM-DD` for a
  newsletter issue.
- `utm_content` (optional): which link, when one place has several
  (`studio-readme`, `skills-readme`, `footer`, `film-page`).
- `utm_term`: not used.
- A new source is added to this table first, with one medium from the list. A
  new medium also needs a PostHog custom channel rule.
- GitHub's repository "Website" field stays an untagged `https://gorenku.com`
  (0231's choice): GitHub shows the raw address and already sends github.com
  as the referrer.

Ready-to-use tags for the permanent links sibling plans place (`{utm}` in
0231):

| Link location | Placed by | Query string |
| --- | --- | --- |
| Studio README | 0231 | `utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme` |
| Studio Skills README | 0231 | same with `utm_content=skills-readme` |
| Studio release notes | 0231 | same with `utm_content=release-notes` |
| GoRenku organisation profile | 0231 | same with `utm_content=org-profile` |
| `keremk/renku` README | 0231 | same with `utm_content=renku-readme` |
| Latent Matinee footer disclosure | 0238 | `utm_source=latentmatinee&utm_medium=referral&utm_campaign=always-on&utm_content=footer` |
| gorenku.com footer link to Latent Matinee | 0232 | `utm_source=gorenku&utm_medium=referral&utm_campaign=always-on&utm_content=footer` |

Examples:

- `https://gorenku.com/?utm_source=hn&utm_medium=community&utm_campaign=2026-10-show-hn`
- `https://gorenku.com/download/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme`
- `https://gorenku.com/?utm_source=latentmatinee&utm_medium=referral&utm_campaign=always-on&utm_content=footer`

### Visitor-facing wording

Shown here under D1-A, D2-A, D3-A and D4-A. Other choices change only the
marked sentences.

**gorenku.com banner** (`CookieConsent.astro`): "May we store an analytics
identifier in your browser to learn which Renku guides and downloads are
useful? If you choose No, we still count your page visits, without storing
anything in your browser. Read our [Privacy Notice]." Buttons unchanged.

**gorenku.com `privacy.astro`**

- Meta description: "How Renku handles local project data, provider requests,
  website hosting, and website analytics."
- `#privacy-analytics` heading: **Website analytics**. Paragraphs:
  1. "We use PostHog’s EU service to learn how people find gorenku.com and
     which pages, guides, and downloads are useful. The analytics banner asks
     whether we may store an analytics identifier in your browser. Until you
     answer, the website does not load PostHog and sends it nothing."
  2. "If you choose **Yes**, PostHog stores a browser identifier in your
     browser’s local storage and receives page views and when you leave a
     page; the website or tagged link that brought you here; clicks to the
     download page and to Renku’s GitHub repositories; copies of the
     installation commands; and when you start one of the website’s videos.
     This can include the page address, event time, the browser identifier,
     browser and device information, and approximate location derived from
     your network address. We may show a one-question survey on the Download
     page; if you answer, PostHog stores your answer with these events."
  3. (D2-A only) "If you choose **No**, we store nothing in your browser
     except your choice. We still count page views and when you leave a page,
     without a browser identifier. To tell visits apart within one day,
     PostHog calculates a code on its servers from your network address,
     browser details, and the website’s name, combined with a random value it
     replaces every day. PostHog does not keep your network address or a
     location with these events, and the daily change means a returning
     visitor is counted again on another day. They are not linked to any visit
     in which you chose Yes. Our legal basis for this counting is our
     legitimate interest in knowing how many people visit the website and
     where they come from."
  4. "We do not use website analytics to record your screen, capture every
     click automatically, identify you by name, or collect your Renku project
     data. We do not use it for advertising or automated decisions. See
     PostHog’s privacy policy for information about its service."
- `#privacy-choice`: "We save your **Yes** or **No** choice in your browser’s
  local storage so you are not asked on every visit, and PostHog keeps its own
  copy of that choice there. If you choose Yes, PostHog also stores a browser
  identifier there. You can change your choice at any time with **Analytics
  choice** in the website footer. Changing from Yes to No removes PostHog’s
  browser identifier; after that your visits are only counted as described
  above. Your choice does not affect the technical information Cloudflare
  needs to serve the website. You can also clear your browser’s site data to
  remove stored choices and identifiers."
- `#privacy-sharing`: "consented website analytics is handled through
  PostHog’s EU endpoint" becomes "website analytics is handled through
  PostHog’s EU endpoint"; after "…then delete or aggregate it." add "PostHog
  deletes analytics events after one year under our current plan."
- "Last updated": the landing date (see Dependencies).

**Latent Matinee banner**: "May we store an analytics identifier in your
browser to learn which films and pages readers find useful? If you choose No,
we still count your page visits, without storing anything in your browser.
Read our [Privacy Notice]."

**Latent Matinee `/privacy/`** (title "Privacy Notice", one `<h1>`, the
About page's `page-hero` and `prose` classes):

- Intro: "This notice explains how latentmatinee.com handles information.
  Kerem Karatal runs Latent Matinee and is responsible for the website and its
  analytics. Contact: support@codingventures.com."
- **Website hosting**: the gorenku.com Cloudflare paragraph, naming
  latentmatinee.com.
- **Films from other sites**: "Films are not hosted here. When you press play
  on a YouTube or Vimeo film, its player loads from that service, using
  YouTube’s privacy-enhanced mode or Vimeo’s Do Not Track setting; nothing
  loads from them before you press play. Other watch links open the
  filmmaker’s, festival’s or distributor’s site under its own privacy policy."
- **Website analytics**: paragraphs 1, 3 and 4 above with "latentmatinee.com"
  and "which films and pages readers find useful", and without the Renku
  project data phrase; paragraph 2 reduced to page views, page-leave times and
  the tagged link that brought you, with no survey sentence. One added
  sentence: "Latent Matinee uses the same PostHog account as gorenku.com;
  visits to the two websites are not linked to each other."
- **Newsletter** (included once 0238's provider decision D1 is made; the
  provider name below is 0238's recommended Buttondown): "If you sign up for
  Matinee Picks, Buttondown stores your email address and sends the
  newsletter for us. We use your address only to send it, based on your
  consent, and every email has an unsubscribe link. See Buttondown’s privacy
  policy." When this paragraph is added, the Yes list in "Website analytics"
  gains "and when you submit the newsletter form". If 0238 chooses a hosted
  form service for film submissions (its D2-B), one sentence names that
  service the same way.
- **Your analytics choice**, **Sharing and retention**, **Your rights**,
  **Changes to this notice**: the gorenku.com sections adapted, without the
  Renku Studio and model-provider sentences.

## Implementation Slices

### Slice 1: gorenku.com events and consent states

Files: `src/components/WebsiteAnalytics.astro` (init, consent flow,
`trackPage`, `captureConsented`, click/copy/play listeners, copy lookup
table), `SiteHeader.astro` and `SiteFooter.astro` (placement attribute on the
root), `pages/download.astro` (two install blocks), `pages/agent-skills.astro`
(two `<pre>`), `LaunchFilm.astro`, `MadeWithRenkuSection.astro`,
`pages/tutorials/[slug].astro` (video attributes). `download.astro`'s copy
script is unchanged. The `play` listener is registered on `document` in the
capture phase, because media events do not bubble.

### Slice 2: gorenku.com wording

`CookieConsent.astro` banner text; `privacy.astro` meta description,
`#privacy-analytics`, `#privacy-choice`, the `#privacy-sharing` sentences and
the date. Nothing else in either file changes.

### Slice 3: Documentation

- New `docs/operations/web-analytics-and-attribution.md` (Date, Status:
  current): scope and PostHog project; consent states; surfaces (`website`,
  `matinee`; 0237 adds `studio`; 0235's GitHub events are told apart by name);
  the events table; page attributes; the UTM convention with the ready-to-use
  tag table; PostHog configuration record (what is switched on); known
  limits. Factual wording only, because the repository is public.
- `packages/website/README.md` "Website analytics": replace the table and
  "loaded only after yes" sentence with two sentences on the consent states
  and a link to the operations page.
- New ADR "Measure the public websites in one PostHog project"
  (`docs/decisions/0121-measure-public-websites-in-one-posthog-project.md`;
  0119, 0120, 0122 and 0123 are reserved by plans 0230, 0237, 0236 and 0231): one
  project with `surface`; `on_reject` counting and its legal uncertainty;
  PostHog never loaded before an answer; explicit events instead of
  autocapture; event list and UTM rules live in the operations page.

### Slice 4: Latent Matinee (separate `ai-films` code task)

Run as its own explicitly requested task, not inside a scheduled refresh, at a
time when neither the 11:00 nor the 13:00 Europe/Madrid refresh is running,
from a clean working tree, and committed on its own. Push the commit only
after cookieless server hash mode is on, because the next scheduled refresh
deploys whatever is on `main`.

- New `src/components/CookieConsent.astro` and
  `src/components/WebsiteAnalytics.astro` (Contracts; styles from LM tokens
  `--panel`, `--line-strong`, `--soft`, `--accent`, `--ink`).
- `src/layouts/Layout.astro`: include both before `</body>`; footer root gets
  `data-analytics-placement="footer"`; footer nav gains
  `<a href="/privacy/">Privacy</a>` and
  `<button type="button" class="analytics-choice" data-cookie-settings>Analytics choice</button>`.
- `src/styles/global.css`: one rule styling `.site-footer nav .analytics-choice`
  like the footer links.
- New `src/pages/privacy.astro`, with the newsletter paragraph when 0238's
  provider is decided (otherwise added in the change that ships 0238's form).
- `README.md`: short "Analytics and privacy" section linking to the studio
  operations page on GitHub.
- No package, lockfile, header or script change.

### Slice 5: PostHog setup (maintainer)

In the EU project "Renku Website":

1. **Plan**: stay on the free plan with no card.
2. **Authorized URLs** (Project settings → Authorized URLs): add
   `https://gorenku.com` and `https://latentmatinee.com`.
3. **Cookieless server hash mode** (Project settings → Web analytics): on,
   before either site ships (D2-A only).
4. **Custom channel type** (Project settings → Web analytics → Custom channel
   types): name "Community", rule `utm_medium` equals `community`.
5. **Survey** (Surveys → New survey): popover; one open-text question "What
   is stopping you from installing today?", optional, placeholder "A sentence
   is plenty", button "Send", thank-you "Thank you. This helps us improve the
   download page."; display condition URL contains `gorenku.com/download`;
   delay 45 seconds; shown once per visitor (the default); colours background
   `#171512`, border `#3a352e`, button `#fda02d` with text `#0c0b09`. It
   reaches Yes visitors only.
6. **Dashboard "Renku growth"** with three insights, each filtered to
   `$host` = `gorenku.com` and `surface` = `website` (local test traffic is
   excluded by the host filter):
   - **Website visits by channel**: Trends, `$pageview`, math "Unique
     sessions", breakdown session property "Channel type", weekly, last 90
     days, stacked bars.
   - **Website install path**: Trends, three series, math "Unique sessions":
     any `$pageview`; `$pageview` with `$pathname` matching `^/download/?$`;
     `install_command_copied`. Add filter `$cookieless_mode` is not set
     (D1-A). Table display, last 30 days, optional breakdown by channel type.
     A strict PostHog funnel is not used: a visitor who lands directly on
     `/download` would need to view it twice to pass its steps.
   - **Latent Matinee referrals**: Trends, `$pageview`, "Unique sessions",
     filter group `utm_source` = `latentmatinee` OR `$referring_domain` =
     `latentmatinee.com`, weekly, last 90 days.
   - GitHub charts are added from 0235's "What 0234 should chart" once its
     first run has sent data, and Studio charts from 0237 when it ships. This
     plan does not restate them.
7. **Usage check**: look at Billing → usage once a month after launch. Each
   page view sends about two events, so 1M events covers roughly 400,000 page
   views a month across both sites.
8. (D3-B only) Session replay on; URL trigger `/download` and `/quick-start`;
   recording domain `https://gorenku.com`.

### Slice 6: Publication (maintainer, or Claude when explicitly authorised)

After Slice 5 step 3: `pnpm deploy:website` from the studio repository;
for Latent Matinee, push the Slice 4 commit and run `pnpm deploy:cloudflare`
from a clean tree.

## What Only The Maintainer Can Do

- Decide D1–D4; approve the banner and privacy wording for both sites and the
  ADR, optionally after legal advice.
- Do every PostHog step in Slice 5 (they need a PostHog login), including
  switching on cookieless server hash mode before either site ships.
- Choose when the Latent Matinee code task runs (outside the 11:00 and 13:00
  Europe/Madrid refreshes, or with them paused).
- Publish both sites, or explicitly authorise Claude to run
  `pnpm deploy:website` and the LM push and `pnpm deploy:cloudflare`.
- After publishing, check in PostHog that Yes events still have a country,
  that No events have neither a country nor `$ip`, and that the survey appears
  on the live `/download` after answering Yes.
- Post the tagged links on Hacker News, Reddit, X, YouTube and Discord; that
  posting is outside this plan.

## Tests And Guardrails

Neither site has an automated test suite: gorenku.com runs `astro check` and a
build; Latent Matinee runs `astro check` and `scripts/validate-build.mjs`.
This plan adds no test machinery. Behaviour is verified in a desktop browser
against the local preview with `posthog.debug(true)` (which logs every
captured event to the console) and the network panel. Events sent during
local checks reach the production project from `localhost`; the dashboard's
host filter excludes them.

Guardrails at review time:

- `rg -n "posthog" packages/website/src -g '!**/privacy.astro'` and the same
  search over `src` in `ai-films` list only the two `WebsiteAnalytics.astro`
  files (the privacy pages only link to posthog.com).
- `rg -n "data-analytics-" packages/website/src` shows only the values in the
  attribute table.
- `git diff --stat` in both repositories shows only the planned files.

## Documentation

- New `docs/operations/web-analytics-and-attribution.md` (Slice 3).
- New ADR (Slice 3).
- `packages/website/README.md` analytics section (Slice 3).
- `packages/website/src/pages/privacy.astro` (Slice 2) and LM
  `src/pages/privacy.astro` and `README.md` (Slice 4).
- No change to `docs/product/website-learning-guides.md`, the Terms, or
  historical plans.

## Final Verification

**gorenku.com**

1. `pnpm --filter @gorenku/website check`
2. `pnpm build:website:cloudflare`, then `pnpm --filter @gorenku/website preview`.
3. At 1440×900, clear site data, then check:
   - not answered: no request to `eu.i.posthog.com` or `eu-assets.i.posthog.com`;
   - Yes: `$opt_in` once; `$pageview` with `surface: website`; `$pageleave`
     with `$prev_pageview_duration` on navigation; reloading sends no
     `$opt_in`;
   - header GitHub icon → `github_link_clicked {repo: studio, placement:
     header}`; `/download` GitHub link → `placement: page`; a Terms license
     link → `repo: studio`;
   - macOS and Windows Copy buttons → `install_command_copied` with `macos`
     and `windows`; selecting and copying the macOS command by hand → the same
     event; launch-command Copy → no event;
   - `/agent-skills/` copying either command → `skills_install_copied`;
   - launch film play button → `video_played {video: renku-launch}` once,
     not again after pause and play; both harbor videos on `/` and on
     `/tutorials/blender-previs/`; the autoplaying First Patron video → no
     event;
   - existing `download_clicked`, `quick_start_viewed`, `tutorial_viewed`
     still arrive;
   - Analytics choice → No: PostHog's `ph_…_posthog` storage key disappears,
     `__ph_opt_in_out_…` is `0`, the next `$pageview` carries
     `$cookieless_mode: true`, and no custom event is sent (D1-A);
   - fresh visitor choosing No: no `sessionStorage` entry and no identifier
     in `localStorage`.
4. Banner and Privacy Notice read as in Contracts; screenshot the banner at
   desktop width.
5. `rg` guardrails above; `git diff --stat` and the full diff: no formatting
   churn, no unplanned files, `WebsiteAnalytics.astro` within the stop
   condition.

**Latent Matinee**

1. `pnpm check` and `pnpm build` (includes the build validator); no
   `pnpm install`.
2. `pnpm preview`, then the three consent states and the Yes → No change as
   above, with `surface: matinee`; footer Privacy link and Analytics choice
   work; `/privacy/` renders one `<h1>`.
3. `git status` shows only Slice 4 files; one commit.

**After publishing (maintainer)**: the checks in "What Only The Maintainer
Can Do". If Yes events lose their country once server hash mode is on, stop
and report before keeping the setting.

## Completion Checklist

### Review Area

- [x] D1–D4 decided and recorded in the plan.
- [ ] Banner and privacy wording for both sites approved.
- [ ] ADR approved.
- [ ] Final shape matches the Architecture Shape Gate: PostHog calls only in
      the two `WebsiteAnalytics.astro` files; pages use attributes only.
- [ ] No npm dependency, build step, or Studio package change in either
      repository.

### Architecture And Contracts

- [ ] Init options match Contracts on both sites (with D2–D4 outcomes).
- [ ] `surface` added through `before_send`: `website` and `matinee`.
- [ ] Consent flow steps 1–5 implemented on both sites; nothing loads before
      an answer.
- [ ] `$opt_in` sent only on a Yes click.
- [ ] Event names, properties and value rules match the Events table.
- [ ] Attribute names and values match the Page attributes table.

### Implementation Slices

- [x] Slice 1: `WebsiteAnalytics.astro` listeners, copy lookup table and
      consent-gated capture.
- [x] Slice 1: placement attributes on `SiteHeader.astro` and
      `SiteFooter.astro`.
- [x] Slice 1: install blocks in `download.astro`, both commands in
      `agent-skills.astro`, and five videos marked.
- [x] Slice 2: banner text, `privacy.astro` description, analytics, choice,
      sharing sentences and date.
- [x] Slice 3: operations page with events, attributes, surfaces, UTM
      convention, PostHog configuration record and known limits.
- [x] Slice 3: website README section replaced by a pointer.
- [x] Slice 3: ADR 0121 written.
- [ ] Slice 4: LM components, Layout footer and includes, footer button
      style, privacy page, README section; run outside scheduled refreshes
      and committed alone.

### PostHog Setup

- [ ] Free plan, no card.
- [ ] Authorized URLs for both domains.
- [ ] Cookieless server hash mode on before shipping (D2-A).
- [ ] "Community" custom channel rule.
- [ ] `/download` survey configured as specified.
- [ ] "Renku growth" dashboard with the three insights and host filters.
- [ ] D3-B replay settings, only if chosen.

### Tests And Guardrails

- [x] gorenku.com browser checks in Final Verification all pass.
- [ ] Latent Matinee browser checks pass.
- [ ] `rg` guardrails show PostHog only in the analytics components and only
      the documented attribute values.

### Documentation

- [ ] 0231 and 0238 can link to the operations page's UTM section by its
      published GitHub URL.
- [ ] Privacy pages on both sites match the approved wording.
- [ ] LM privacy page carries the newsletter paragraph before 0238's form
      collects any email address.
- [ ] Operations page contains the ready-to-use tag table for 0231, 0232
      and 0238.
- [ ] No historical plan edited.

### Final Verification

- [x] `pnpm --filter @gorenku/website check` and
      `pnpm build:website:cloudflare` pass.
- [ ] LM `pnpm check` and `pnpm build` pass.
- [ ] `git diff --stat` and full diffs reviewed in both repositories; no
      formatting churn; `WebsiteAnalytics.astro` within the stop condition.
- [ ] Both sites published by the maintainer or with explicit authorisation.
- [ ] Post-publication PostHog checks done (country on Yes events; none and no
      `$ip` on No events; survey shows).
- [ ] Only then mark the plan complete.
