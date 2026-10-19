# 0238 Latent Matinee Disclosure, Newsletter And Sharing

Status: proposed
Date: 2026-10-15

## Summary

Latent Matinee (https://latentmatinee.com) is the audience side of the approved
marketing plan. Today it never says who makes it, gives readers no way to follow
it except visiting, has no way to suggest a film, shows no picture when a page is
shared, has no working sitemap, and says "124 films" in the footer while the
Films page says "109 shorts, features and series, plus 15 music videos".

This plan makes five small changes to the site's code, all in the separate
repository `/Users/keremk/Projects/aitinkerbox/ai-films`:

1. **Disclosure.** One plain sentence in the footer and one short section on the
   About page say that Latent Matinee is made by the maker of Renku Studio, with
   one link to gorenku.com. Nothing about Renku appears anywhere else.
2. **Follow the site.** A "Matinee Picks" weekly email signup in the footer, and
   an RSS feed of the journal at `/journal/rss.xml`.
3. **Submit a film.** A "Submit a film" link that leads to a short form. Every
   submission is a lead the editors verify, never an automatic entry.
4. **Sharing basics.** Film and artist pages get a share picture taken from
   their existing credited artwork; the site gets `/sitemap.xml` and a
   `robots.txt` that points to it; the word "films" means the same thing in every
   count on the site.
5. **Safe delivery.** The work stays out of the daily content refresh and ships
   with the exact check, commit, push and deploy steps the repository requires.

No new packages are installed. Everything is built from the existing Markdown
content at build time.

## Review Attention

- **Added beyond the literal request, and why:**
  - **The existing build check gets four more checks** (sitemap lists every page,
    `robots.txt` names the sitemap, feed links work, share pictures exist).
    Without them a new page could silently miss the sitemap and nobody would
    notice.
  - **"Films" gets one meaning everywhere.** Shorts, features and series are
    films; music videos are counted separately. This changes the footer, the
    artist page fact line and the artist cards, which today count music videos
    as films. The Films page result line ("124 films") becomes "124 titles",
    because that list mixes both.
  - **The site serves its own `robots.txt`.** Today Cloudflare serves a file that
    contains only comments (no rules, no sitemap). Ours allows everything and
    names the sitemap. Cloudflare's text stated no crawler preferences, so what
    crawlers may do does not change; its comment block will no longer appear.
  - **`docs/content-refresh.md` gets a short "Submissions" paragraph** and one
    sentence about artwork size, so the daily refresh treats submissions as
    unverified leads and keeps share pictures usable.
  - **The work happens in a separate git worktree.** The daily refresh commits
    and deploys whatever is on `main` in the main checkout, so code work there
    would get published by the next refresh.
- **New public things:** `/journal/rss.xml`, `/sitemap.xml`, `/robots.txt`; a
  footer signup form that sends the email address to the chosen newsletter
  provider; a footer "Submit a film" link and two new About sections; share
  tags (`og:image`, `og:image:alt`, `twitter:card`) on film and artist pages;
  with decision D2 option A, a public GitHub issue form and a `submission` label
  on `GoRenku/ai-films`.
- **Hard to undo:** feed readers and search engines keep the feed and sitemap
  URLs once published; email addresses collected by the provider are personal
  data (the privacy page from plan 0234 must be live first); public GitHub
  issues stay public. Nothing is deleted or migrated.
- **Deliberately unchanged:** no Renku banner, badge or "Made with Renku" label
  on film pages or anywhere else; the home page still shows a selection of the
  newest work, not the whole collection; journal, home, list and About pages get
  no share picture; content files, `astro.config.mjs`, `package.json`, the
  lockfile, `_headers`, `wrangler.jsonc` and the deploy script are untouched;
  analytics, consent, the privacy page and link-tag rules stay with plan 0234;
  gorenku.com is not changed.
- **Assumptions:** plan 0234 supplies the gorenku.com link tags
  (`utm_source=latentmatinee` plus its other values), the Latent Matinee privacy
  page at `/privacy/`, and the newsletter signup tracking: 0234's listener
  sends `newsletter_signup_submitted` for any form marked
  `data-analytics-form="newsletter"`. Counts are from commit `9aca07e` (today).
- **Decisions you need to make:** D1 newsletter provider (recommended:
  Buttondown); D2 submission path (recommended: GitHub issue form); D3 the exact
  disclosure wording below.

## What Changes For Readers

- **Footer, every page.** Below the existing brand line and links:
  - a signup row: **Matinee Picks** "A weekly email with the films worth
    watching." an email field and a **Subscribe** button, with the small line
    "One email a week. Unsubscribe any time. Privacy" (Privacy links to
    `/privacy/`). Submitting opens the provider's confirmation page in a new
    tab;
  - a **Submit a film** link added to the footer links, going to
    `/about/#submit`;
  - the count line reads "109 films · 15 music videos · 81 artists · updated
    15 Oct";
  - the disclosure line (D3): "Latent Matinee is made by the maker of
    [Renku Studio], a free, open-source tool for planning films with AI agents."
    The link goes to gorenku.com with the 0234 link tags.
- **About page.**
  - In "What makes the collection", after the music-video sentence: "Across the
    site, “films” means shorts, features and series; music videos are counted
    separately. The home page shows a selection of the newest work; the Films
    page lists everything."
  - In "A living journal", a last sentence: "You can also follow the journal by
    [RSS](/journal/rss.xml)."
  - New section **Submit a film** (`id="submit"`): "Made a film, or found one we
    should see? Send us the watch link. Submissions are leads, not entries: we
    check each film against public sources, such as the release itself, the
    maker’s own posts and festival pages, and include only work that meets the
    standard above. Telling us which tools you used is optional; we publish
    production details only when a public source confirms them." Then a button
    **Submit a film ↗**. With D2 option A, one more sentence: "Submissions are
    public GitHub issues and need a free GitHub account."
  - New last section **Who makes Latent Matinee**: "Latent Matinee is made by the
    maker of [Renku Studio], a free, open-source tool for planning films with AI
    agents. Films are chosen by the standard above, whatever tools they were made
    with."
- **Journal page.** The intro line ends with an "RSS feed" link. Every page head
  announces the feed so feed readers find it.
- **Film and artist pages.** When shared on X, LinkedIn, Facebook, Slack or
  iMessage, the preview shows the page's existing artwork: the film's own image,
  or for an artist the same cover image their page already shows (the newest of
  their films with artwork). The file is used exactly as published, never
  cropped, resized or overlaid with text. The three artists with no films yet
  get no share picture.
- **Films page.** The result line under the filters says "124 titles".
- **Artist pages and cards.** "In the collection" and the card line say, for
  example, "4 films · 1 music video" instead of "5 films".

Writing and sending each weekly "Matinee Picks" email, editorial interviews and
other new content are editorial work outside this plan.

## Requirement Ledger

| # | Requirement | Source | Owner in ai-films | Verified by |
| --- | --- | --- | --- | --- |
| R1 | Disclose once, plainly, in footer and About; one gorenku.com link with 0234 tags | marketing plan, item 1 | `Layout.astro`, `about.astro`, `external-links.ts` | build output grep; desktop check |
| R2 | No Renku banners or ads on film pages | marketing plan, item 1 | forbidden shape | grep of built film pages |
| R3 | Weekly "Matinee Picks" signup; provider chosen by maintainer | marketing plan, item 2 | `NewsletterSignup.astro`, `external-links.ts` | desktop check; maintainer live signup |
| R4 | Signup sends nothing to third parties until the reader submits | site rule: remote scripts fail the build (`scripts/validate-build.mjs`); the site loads nothing from third parties until a reader acts (About: players load only on play) | plain HTML form | existing remote-script check |
| R5 | RSS feed of the journal, following the dependency policy | marketing plan, item 2; ai-films AGENTS.md "Dependencies" | `src/pages/journal/rss.xml.ts` | feed check; `xmllint`; W3C validator after deploy |
| R6 | "Submit a film" with optional "tools used"; submissions are leads, never auto-published | marketing plan, item 3; `docs/content-refresh.md` steps 2, 5, 6 | `about.astro`, issue form, `content-refresh.md` | form review; doc review |
| R7 | Share picture per film and artist page from credited artwork, respecting credits and sizes | marketing plan, item 4 | `Layout.astro`, film and artist pages | share-image check; platform previews |
| R8 | Working sitemap that `robots.txt` names | marketing plan, item 4; audit: `/sitemap-index.xml` 404, `robots.txt` has no rules | `sitemap.xml.ts`, `public/robots.txt` | sitemap and robots checks |
| R9 | One consistent, explained film count | marketing plan, item 4; audit | `catalog.ts` `workTally`, About sentence | desktop check of every count |
| R10 | Code work separate from scheduled refreshes; exact repo verification and deploy steps | marketing plan, item 5; ai-films AGENTS.md | worktree, ship procedure | Final Verification |
| R11 | Signup event and privacy page come from 0234, not this plan | sibling plan boundary | Slice 5 | slice 5 checklist |
| R12 | Credit mismatches and artwork problems fixed as content work | ai-films AGENTS.md scope; `docs/content-refresh.md` | separate content task | content task list |

## Current Evidence

Checked today in the ai-films checkout (commit `9aca07e`, clean `main`) and on
the live site.

- **Counts.** 124 entries in `content/films` (64 short films, 23 features, 22
  series, 15 music videos), 81 artists, 33 journal entries. The live site
  matches. The audit's "116 films, 103 on the Films page" was the morning state
  (commit `5c5c827`: 116 entries, 13 of them music videos, 116 − 13 = 103).
- **Where the counts disagree.** `src/layouts/Layout.astro` footer prints
  `films.length` "films" (music videos included). `src/pages/films/index.astro`
  header and the home "Films" figure subtract music videos; the same page's
  result line prints all 124 as "films". `src/pages/artists/[id].astro` and
  `src/components/ArtistCard.astro` count music videos as films for the seven
  artists who have them (anabology, astra-blue-ai, extraltodeus, javiexmachina,
  lita-bosch-pablo-maestres, skyebrows, voxelle).
- **Home page title count.** The home page links 80 distinct films today (77 at
  the audit). It is the union of five hero slides, 14 "Just added", up to 16
  "Watch now" not already shown, all 24 upcoming, all 23 features, all 22 series,
  all 15 music videos and up to four journal images. Short films that are
  neither new nor in a capped rail do not appear. This is the intended design in
  `src/pages/index.astro` and the README; only the About sentence above is added.
- **Sharing.** `Layout.astro` sets `og:site_name`, `og:title`,
  `og:description` and `og:url`, but no image and no `twitter:card`. All 124
  films have artwork; 78 of 81 artists have a cover (3 have no films).
- **Artwork sizes** (`public/media`, 124 files: 93 JPEG, 14 PNG, 17 WebP). Share
  limits: Facebook needs at least 200 × 200 px and at most 8 MB
  ([Facebook](https://developers.facebook.com/docs/sharing/webmasters/images/));
  X's large card needs at least 300 × 157 px and at most 5 MB, JPEG, PNG, WebP or
  GIF (X's own page refused an automated fetch, figures from
  [The SEO Framework](https://kb.theseoframework.com/kb/twitter-cards-and-x-sharing/);
  confirm with a real share). Outside these limits: `duck.png` 7.2 MB,
  `brainstare.jpg` 142 × 142, `an-honest-days-work.png` 286 × 508. These go to
  the content task; the code does not resize anything.
- **Credits.** The film schema already requires `imageAlt`, `imageCredit` and
  `imageSource` whenever `image` is set (`src/content.config.ts`). The audit
  reported two films with mismatched artwork credits. A metadata comparison today
  (credit names against artist names and source sites) did not isolate them:
  the differing credits name real studios or publishers. They must be found by
  comparing each image with its `imageSource`. Separately,
  `the-cully-hill-boys` carries the credit "Licensed for study under HOL-RO-1.0.
  Not licensed for reuse.", which also matters for sharing.
- **robots.txt and sitemap.** `public/` has no `robots.txt`. The live file is
  Cloudflare's 24-line comment-only "Content Signals" text with no rules and no
  `Sitemap:` line; Cloudflare shows it on free plans when the site has none, and
  serves the site's own file when one exists
  ([Cloudflare](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)).
  `/sitemap.xml`, `/sitemap-index.xml` and `/rss.xml` return 404. The build
  produces 245 HTML pages; 244 excluding `404.html`.
- **Build check.** `scripts/validate-build.mjs` checks every built HTML page for
  a title, one `h1`, working local links, image alt text, and fails on any
  `<script src="https:…">`. It does not look at XML files or absolute same-site
  URLs.
- **Dependencies.** `astro` 7.2.9 is the only framework dependency; pnpm 11.7.0
  pinned; seven-day release age; only `esbuild` may run build scripts.
  `@astrojs/rss` 4.0.19 would add `fast-xml-parser` 5.x and its six
  dependencies, none in the lockfile today. `@astrojs/sitemap` 3.7.4 would add
  `sitemap` 9.0.1, `arg`, `@types/sax` and `@types/node`, also new. Neither has
  install scripts (npm registry metadata, fetched today). A hand-written feed and
  sitemap need only text escaping.
- **GitHub.** `GoRenku/ai-films` is public with issues enabled, no issues yet,
  default labels only (`gh api`, `gh label list`). Issue forms live in
  `.github/ISSUE_TEMPLATE/`; a label listed in a form that does not exist in the
  repository is not added
  ([GitHub](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)).
- **Refresh boundary.** ai-films `AGENTS.md` and `docs/content-refresh.md`: the
  13:00 Europe/Madrid refresh (and an 11:00 X review feeding a private inbox)
  edits only content, commits on `main`, pushes, and deploys with
  `pnpm deploy:cloudflare`; it stops on unrelated local changes. Code changes
  need a separate, explicitly requested task.
- **Renku facts for the copy.** Renku Studio is AGPLv3 open source
  (`studio/README.md`, `LICENSE`); `TRADEMARKS.md` allows accurate attribution
  to the original project.

### Newsletter providers (decision D1)

| | Buttondown | Kit | beehiiv | Substack |
| --- | --- | --- | --- | --- |
| Signup on our page | Plain HTML form posting to `https://buttondown.com/api/emails/embed-subscribe/<username>`, documented as the supported way ([docs](https://docs.buttondown.com/building-your-subscriber-base), [example](https://buttondown.com/features/integrations/wordpress)) | "JavaScript" or "HTML" embed; Kit recommends JavaScript, and the copied HTML usually loads a Kit script ([Kit help](https://help.convertkit.com/en/articles/3864502-wix-convertkit)); a script-free form is not documented | iframe from `embeds.beehiiv.com` ([beehiiv](https://www.beehiiv.com/support/article/12977090590487-creating-an-embedded-subscribe-form)) | iframe from `<name>.substack.com/embed` (third-party guides, e.g. [substackapi](https://docs.substackapi.com/add-your-substack-signup-form-to-your-website)) |
| Free limit | first 100 subscribers; analytics and RSS-to-email are paid add-ons ([pricing](https://buttondown.com/pricing)) | up to 10,000 subscribers, Kit branding, no automations or RSS on free ([pricing](https://kit.com/pricing)) | up to 2,500; RSS-to-send is paid ([pricing](https://www.beehiiv.com/pricing)) | no cap for free newsletters (not re-checked today) |
| Your list | CSV export including referrer and UTM fields ([docs](https://docs.buttondown.com/data-exports-subscriber)) | CSV export ([help](https://help.kit.com/en/articles/2502489-how-to-export-subscribers)) | export on free plan ([pricing](https://www.beehiiv.com/pricing)) | CSV export ([guide](https://on.substack.com/p/subscriber-dashboard-guide)) |
| Fits the site's no-third-party-code rule | yes | only if a script-free form is proven | no (iframe on every page) | no (iframe on every page) |

**Recommendation: Buttondown.** It is the only option whose documented method is
a plain form, so nothing from the provider loads until a reader presses
Subscribe, and the export keeps the source of each signup. The trade-off is the
100-subscriber free limit. Second choice: Kit, if a large free list matters more,
and only after a test shows a plain form posts correctly without Kit's script.
An iframe provider would load third-party code on every page, which the site
avoids today and which would fall under 0234's consent rules.

### Submission path (decision D2)

- **A. GitHub issue form on `GoRenku/ai-films` (recommended).** No new service or
  data processor; structured fields; free; dispositions stay private. Downsides:
  needs a GitHub account; the submission is public.
- **B. A hosted form service** (for example Tally), linked, not embedded. No
  account needed, private. Adds a data processor that 0234's privacy page must
  name; the maintainer signs up and copies leads into the private inbox.
- **C. Email** to an address on latentmatinee.com. Needs Cloudflare Email
  Routing, which changes DNS (maintainer only under ai-films `AGENTS.md`);
  unstructured; the maintainer copies leads into the private inbox.

The site change is the same for all three: only `SUBMIT_FILM_URL` and the About
sentence about GitHub differ. Slices below describe A and note B and C.

## Context

- ai-films `AGENTS.md` (content sources, refresh scope, dependencies,
  publishing) and `docs/content-refresh.md` (editorial standard, research and
  publishing steps): binding.
- ai-films `README.md`: catalog rules, deploy, package safety.
- Code: `src/layouts/Layout.astro`, `src/lib/catalog.ts`,
  `src/content.config.ts`, `src/pages/{about,index}.astro`,
  `src/pages/films/{index,[id]}.astro`, `src/pages/artists/[id].astro`,
  `src/pages/journal/index.astro`, `src/components/ArtistCard.astro`,
  `src/styles/global.css`, `scripts/validate-build.mjs`.
- Sibling plans: 0234 owns PostHog on Latent Matinee, consent, the privacy page,
  the link-tag convention and the signup event name. 0233 owns gorenku.com's own
  journal and feed. 0231 owns the GitHub front door.
- Studio `AGENTS.md` rules applied here in spirit: no compatibility layers,
  deliberate names, small reviewable files, fail clearly.

## Architecture Shape Gate

### Ownership

- `src/lib/catalog.ts` stays the one owner of rules derived from content. It
  gains the counting rule (`workTally`) and exports its existing `toTime`.
- `src/lib/external-links.ts` (new) owns the three outbound destinations and
  nothing else.
- `src/lib/xml.ts` (new) owns `escapeXml` and nothing else.
- Each endpoint builds one document from `catalog()`:
  `src/pages/journal/rss.xml.ts`, `src/pages/sitemap.xml.ts`.
- `src/components/NewsletterSignup.astro` (new) owns the signup form and, in
  slice 5, its one event call.
- `src/layouts/Layout.astro` stays a layout: head tags and footer composition.
- `scripts/validate-build.mjs` stays the one build check; each new check is its
  own small function.

### File layout after this plan

```text
ai-films/
  .github/ISSUE_TEMPLATE/submit-a-film.yml   new (D2 option A only)
  public/robots.txt                          new
  src/lib/catalog.ts                         + workTally, export toTime
  src/lib/external-links.ts                  new
  src/lib/xml.ts                             new
  src/components/NewsletterSignup.astro      new
  src/components/ArtistCard.astro            count line uses workTally
  src/layouts/Layout.astro                   shareImage prop, feed link, footer
  src/pages/about.astro                      count sentence, RSS, two sections
  src/pages/films/[id].astro                 passes shareImage
  src/pages/artists/[id].astro               passes shareImage, workTally
  src/pages/films/index.astro                "titles" in result line
  src/pages/journal/index.astro              RSS link
  src/pages/journal/rss.xml.ts               new
  src/pages/sitemap.xml.ts                   new
  src/styles/global.css                      signup, disclosure line
  scripts/validate-build.mjs                 + four checks
  docs/content-refresh.md                    + Submissions, artwork size
  README.md                                  + rules for the new outputs
```

### Forbidden shapes

- No new dependency, Astro integration, `astro.config.mjs` change, lockfile
  change or build-script permission.
- No third-party script or iframe anywhere, including the signup.
- No generated, cropped, resized or overlaid share images; no image tooling.
- No new frontmatter field, schema change or per-film share opt-out.
- No Renku text, link, label or banner outside the footer line and the About
  section.
- No count computed in client-side script; counts come from `catalog.ts` at
  build time.
- No content files (`content/**`, `public/media/**`) in the code commits.
- No change to `_headers`, `wrangler.jsonc`, `scripts/deploy-cloudflare.mjs`.

### Stop conditions

- `validate-build.mjs` passes about 150 lines or the new checks start sharing
  parsing code: move the new checks into `scripts/validate-build/` modules first.
- `Layout.astro` needs logic beyond rendering the props and catalog values it
  already uses: move it into `catalog.ts` or a component.
- A provider needs a script, iframe or `fetch` submission: stop and return to
  D1.
- Any step would edit content or media: stop; that belongs to the content task.

## Contracts

### Outbound links: `src/lib/external-links.ts`

```ts
/** gorenku.com with the Latent Matinee link tags defined by plan 0234. */
export const RENKU_URL = 'https://gorenku.com/?utm_source=latentmatinee&…'; // remaining tags copied from 0234

/** Where "Submit a film" leads (decision D2). Option A: */
export const SUBMIT_FILM_URL = 'https://github.com/GoRenku/ai-films/issues/new?template=submit-a-film.yml';

/** The newsletter provider's plain HTML form (decision D1). Buttondown: */
export const NEWSLETTER_FORM = {
  action: 'https://buttondown.com/api/emails/embed-subscribe/<username>',
  emailField: 'email',
  hiddenFields: { embed: '1' },
} as const;
```

The implementer copies the tag values from accepted plan 0234 and the username
from the maintainer; neither is guessed.

### Counting rule: `src/lib/catalog.ts`

```ts
/** One counting rule: shorts, features and series are films; music videos are counted separately. */
export function workTally(works: Film[]): string
```

Returns `"109 films · 15 music videos"`, `"1 film"`, `"0 films"` or
`"4 music videos"`: films always shown unless there are music videos and no
films; music videos shown only when there are any. Used by the footer, the
artist page and `ArtistCard`. `export` is added to the existing `toTime`.

### Layout prop

`Layout.astro` accepts `shareImage?: { src: string; alt: string }`. When set it
renders, after `og:url`:

```html
<meta property="og:image" content="https://latentmatinee.com/media/<file>" />
<meta property="og:image:alt" content="<imageAlt>" />
<meta name="twitter:card" content="summary_large_image" />
```

The URL is `new URL(src, Astro.site)`. Every page also gets
`<link rel="alternate" type="application/rss+xml" title="Latent Matinee Journal" href="/journal/rss.xml" />`.
Film pages pass the film's `image` and `imageAlt`; artist pages pass the
`coverFor(artist)` film's `image` and `imageAlt`, or nothing.

### Feed: `/journal/rss.xml`

RSS 2.0, every journal entry, newest first (the `catalog().updates` order):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Latent Matinee Journal</title>
    <link>https://latentmatinee.com/journal/</link>
    <description>Field notes: discoveries, release milestones and production craft in AI cinema.</description>
    <language>en</language>
    <atom:link href="https://latentmatinee.com/journal/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>{newest entry date}</lastBuildDate>
    <item>
      <title>{title}</title>
      <link>https://latentmatinee.com/journal/{id}/</link>
      <guid isPermaLink="true">https://latentmatinee.com/journal/{id}/</guid>
      <pubDate>{date}</pubDate>
      <description>{description}</description>
    </item>
  </channel>
</rss>
```

Dates are `new Date(toTime(date)).toUTCString()` (noon UTC, the site's existing
date rule), so the output only changes when content changes. Items carry the
frontmatter `description`, not the note body, so no relative links leak into
feed readers. All text goes through `escapeXml`.

### Sitemap: `/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://latentmatinee.com/</loc></url>
  …
</urlset>
```

One `<loc>` per page, equal to that page's canonical URL (trailing slash): the
six fixed pages (`/`, `/films/`, `/artists/`, `/whats-new/`, `/journal/`,
`/about/`), then films, artists and journal entries in catalog order. No
`lastmod`, `changefreq` or `priority`: no field records when a page last
changed, and search engines ignore the other two.

### `public/robots.txt`

```text
User-agent: *
Allow: /

Sitemap: https://latentmatinee.com/sitemap.xml
```

### Build checks added to `scripts/validate-build.mjs`

- `checkSitemap`: `dist/sitemap.xml` lists every built page except `404.html`
  exactly once, by its canonical URL, and nothing else.
- `checkRobots`: `dist/robots.txt` has exactly one `Sitemap:` line, equal to
  `https://latentmatinee.com/sitemap.xml`.
- `checkFeed`: `dist/journal/rss.xml` has one item per built journal entry page
  and every item link is a built page.
- `checkShareImages`: every `og:image` on `https://latentmatinee.com/…` maps to
  an existing file in `dist/`.

Failures join the existing error list and fail the build like today's checks.

### Submission form: `.github/ISSUE_TEMPLATE/submit-a-film.yml` (option A)

- `name: Submit a film`; `description: Suggest a finished AI film or music
  video for Latent Matinee.`; `title: "[Submission] "`; `labels: [submission]`.
- Intro text: "Thanks for the suggestion. Submissions are leads, not entries: we
  check every film against public sources and include only work that meets the
  standard at https://latentmatinee.com/about/. This issue is public, so please
  leave out private contact details."
- Fields, in order: **Film title** (required); **Watch link**, "Where can people
  watch the complete film?" (required); **Director or studio** (required);
  **Your connection to the film**, dropdown "I made it" / "I worked on it" /
  "I'm suggesting someone else's film" (required); **Tools used (optional)**,
  free text, "Which tools or models did you use, and for what? We publish
  production details only when a public source, such as your own post or a
  festival page, confirms them."; **Making-of or credits link (optional)**;
  checkbox "I understand this issue is public and that the film may not be
  included." (required).
- No list of tools to pick from, so no tool, including Renku, is suggested.

## Implementation Slices

All slices are built in a separate worktree (see Final Verification) and
committed separately. Slices 1 to 4 can ship together or one by one; each ship
follows the same procedure.

### Slice 1: Counting rule, sitemap, robots, feed and share pictures

No outside dependency.

1. `catalog.ts`: add `workTally`; export `toTime`.
2. `Layout.astro`: footer count line uses `workTally(films)`; add the
   `shareImage` prop and its three tags; add the feed `<link>`.
3. `artists/[id].astro`: "In the collection" uses `workTally(films)`; pass
   `shareImage` from `cover`. `ArtistCard.astro`: count line uses `workTally`.
   `films/[id].astro`: pass `shareImage` from `d.image` and `d.imageAlt`.
4. `films/index.astro`: result line noun becomes "titles".
5. Add `src/lib/xml.ts`, `src/pages/journal/rss.xml.ts`,
   `src/pages/sitemap.xml.ts`, `public/robots.txt`.
6. `journal/index.astro`: "RSS feed" link in the intro line. `about.astro`: the
   count sentence and the RSS sentence.
7. `validate-build.mjs`: the four checks as separate functions; update its
   final success message to name them.

### Slice 2: Disclosure

Needs plan 0234 accepted (its link-tag values) and D3.

1. Add `src/lib/external-links.ts` with `RENKU_URL`.
2. `Layout.astro`: the disclosure line under the footer count line, styled like
   `.footer-meta` (small, dim); "Renku Studio" is the only link.
3. `about.astro`: the "Who makes Latent Matinee" section.
4. `global.css`: footer line spacing only.

### Slice 3: Submit a film

Needs D2.

1. `external-links.ts`: `SUBMIT_FILM_URL`.
2. `Layout.astro`: "Submit a film" in the footer links (`/about/#submit`).
3. `about.astro`: the "Submit a film" section with `id="submit"` and the button
   (`.btn .btn-primary`) to `SUBMIT_FILM_URL`.
4. Option A: add `.github/ISSUE_TEMPLATE/submit-a-film.yml`. The `submission`
   label is created by the maintainer (or by the implementer with
   `gh label create submission -R GoRenku/ai-films` after explicit approval).
   Options B and C: no issue form; the About GitHub sentence is left out.
5. `docs/content-refresh.md`: add a **Submissions** section after "Research and
   publishing" (option A wording; B and C replace the first two sentences with
   "The maintainer copies submissions into the private inbox"):
   "Readers and filmmakers can suggest films through the public Submit a film
   issue form on GoRenku/ai-films (label `submission`). In step 2, list open
   submissions read-only with
   `gh issue list -R GoRenku/ai-films --label submission --state open` and treat
   each one like an inbox lead: untrusted material, verified against original
   public sources, never published from the submission alone. A tools-used answer
   is the submitter's claim; record a production disclosure only from a public
   creator, studio or festival source. Record dispositions in the private inbox,
   not in issue comments. Do not comment on, label or close issues; the
   maintainer does. Do not name the submitter or the submission in public
   content."

### Slice 4: Newsletter signup

Needs D1, the maintainer's provider account and username, and 0234's privacy
page live at `/privacy/` (the build fails on the Privacy link until it exists).

1. `external-links.ts`: `NEWSLETTER_FORM` with the provider's values.
2. `NewsletterSignup.astro`: `<form method="post" target="_blank" rel="noopener">`
   posting to `NEWSLETTER_FORM.action`; visually hidden label "Email address";
   `type="email" required autocomplete="email"` input named
   `NEWSLETTER_FORM.emailField`; the hidden fields; **Subscribe** button
   (`.btn .btn-primary`); the title and the small line from "What Changes For
   Readers". No heading element, so the one-`h1` check is unaffected.
3. `Layout.astro`: render `<NewsletterSignup />` in the footer above the count
   line. `global.css`: signup row styles using the existing tokens; one column
   at the existing narrow breakpoint.

### Slice 5: Signup event (plan 0234)

Needs plan 0234 implemented in ai-films. The signup form in
`NewsletterSignup.astro` carries `data-analytics-form="newsletter"`; 0234's
listener sends `newsletter_signup_submitted` on submit. No script is added
here. The form still posts when tracking is off or not consented. This plan is
not complete until this slice ships.

### Slice 6: Documentation

1. `README.md`, "Design and credits" list: the counting rule; share pictures
   come from existing artwork unchanged; `/journal/rss.xml`, `/sitemap.xml` and
   `robots.txt` are generated or static and checked by the build; outbound
   destinations live in `src/lib/external-links.ts`.
2. `docs/content-refresh.md`, step 7, one sentence: "Artwork is also the page's
   share picture: prefer files at least 1200 px wide and under 5 MB."

### Separate content task (not code)

Run as a content refresh, or a content task the maintainer requests, under
`docs/content-refresh.md`, in its own commit:

- find and correct the two artwork-credit mismatches from the audit by comparing
  each film's image with its `imageSource`;
- `the-cully-hill-boys`: decide whether an image credited "Not licensed for
  reuse" may be shown and shared; replace it with reusable official artwork or
  remove it;
- `duck.png` (7.2 MB): re-save the same credited image under 5 MB;
- `brainstare.jpg` (142 × 142) and `an-honest-days-work.png` (286 px wide):
  source larger official artwork if it exists.

## Tests And Guardrails

ai-films has no unit-test framework, and adding one would be a new dependency.
The guardrails are:

- `pnpm check` (Astro and TypeScript, including the endpoints and new props);
- `pnpm build`, which runs `validate-build.mjs`: the four new checks plus the
  existing ones (the feed `<link>`, `/about/#submit` and `/privacy/` become
  checked local links; the remote-script check keeps the signup script-free);
- `xmllint --noout dist/sitemap.xml dist/journal/rss.xml` for well-formed XML;
- after deploy, the [W3C Feed Validation Service](https://validator.w3.org/feed/)
  on the public feed URL.

The new checks cover the generated outputs once, at the build; desktop checks
cover what readers see.

## Documentation

- ai-films `README.md` and `docs/content-refresh.md` as in slices 3 and 6.
- ai-films `AGENTS.md` unchanged: it already points to `docs/content-refresh.md`.
- No Studio documentation or ADR changes; this plan changes no Studio code.

## Final Verification

### Working copy (keeps `main` free for the daily refresh)

```sh
cd /Users/keremk/Projects/aitinkerbox/ai-films
git fetch origin
git worktree add ../ai-films-0238 -b site/0238-disclosure-newsletter-sharing origin/main
cd ../ai-films-0238
pnpm install --frozen-lockfile
```

### Before each ship, in the worktree

1. `git rebase origin/main` (after `git fetch origin`).
2. `git diff --stat origin/main`: only files from the layout above; nothing under
   `content/`, `public/media/`, and no `package.json`, `pnpm-lock.yaml`,
   `pnpm-workspace.yaml`, `astro.config.mjs`, `wrangler.jsonc`,
   `public/_headers` or `scripts/deploy-cloudflare.mjs`. Read the full diff;
   check `Layout.astro`, `validate-build.mjs` and `catalog.ts` against the shape
   gate.
3. `pnpm check` and `pnpm build`; the build message names the new checks.
4. `xmllint --noout dist/sitemap.xml dist/journal/rss.xml`; sitemap has 244
   `<loc>` entries today, the feed 33 items.
5. `grep -c gorenku.com dist/films/*/index.html`: 1 on every film page (the
   footer); `dist/about/index.html`: 2.
6. `grep -L 'og:image' dist/films/*/index.html`: none.
   `grep -L 'og:image' dist/artists/*/index.html`: only `gabriel-olson`,
   `philipp-lenssen`, `verena-puhm`.
7. `pnpm preview`, desktop width: home footer (signup, Submit link, count line
   "109 films · 15 music videos · 81 artists", disclosure); a film page head
   tags; `/artists/extraltodeus/` count line; `/films/` result line; About
   sections and the `#submit` jump; Journal RSS link. No layout overflow in the
   footer.

### Ship (maintainer approval required)

Outside the 11:00 and 13:00 Europe/Madrid automation runs, with the main
checkout clean and on `main`:

```sh
cd /Users/keremk/Projects/aitinkerbox/ai-films
git status                      # must be clean, on main
git fetch origin && git merge --ff-only origin/main
git merge --ff-only site/0238-disclosure-newsletter-sharing
git push origin main
pnpm deploy:cloudflare          # check, build, validation, upload of this exact commit
```

If the fast-forward fails, return to the worktree, rebase and repeat "Before
each ship". If Cloudflare fails, the pushed commit stays and publication is
reported as pending, as `AGENTS.md` requires.

### After deploy

- wrangler reports the deployment, and https://latentmatinee.com serves it;
- `curl -s https://latentmatinee.com/robots.txt` shows our rules and
  `Sitemap:` line (note whether Cloudflare added anything before them);
- `/sitemap.xml` and `/journal/rss.xml` return 200; a film page source shows the
  three share tags;
- W3C feed validator on `https://latentmatinee.com/journal/rss.xml`;
- maintainer: share previews and search-engine submission (below);
- after the last slice ships, remove the worktree with maintainer approval
  (`git worktree remove ../ai-films-0238`, then delete the merged branch).

## What Only The Maintainer Can Do

- Make decisions D1, D2 and D3.
- Confirm plan 0234 is accepted (link tags) before slice 2, and implemented
  (privacy page naming the newsletter provider, signup event) before slices 4
  and 5.
- D1: create the newsletter account, turn on double opt-in, give the form
  username, test a real signup after deploy, and write and send each weekly
  issue (do not launch the form before the first issue is planned).
- D2: create the `submission` label (or approve the implementer doing it);
  close and answer submissions. Option B: sign up for the form service. Option
  C: set up Cloudflare Email Routing (DNS change).
- Approve each push and deploy, or run them.
- Check share previews with platform tools that need an account (X, LinkedIn
  Post Inspector, Facebook Sharing Debugger).
- Add `https://latentmatinee.com/sitemap.xml` in Google Search Console and Bing
  Webmaster Tools (account and site verification).
- Approve the separate content task and any announcement or posting.

## Completion Checklist

### Review Area

- [ ] Decisions D1, D2 and D3 recorded in this plan before slices 2 to 4 start.
- [ ] Plan 0234 accepted before slice 2; implemented before slices 4 and 5.
- [ ] Final file layout matches the Architecture Shape Gate; no file collects
      unrelated concerns.
- [ ] `Layout.astro` only renders props and catalog values; no new logic in it.
- [ ] `validate-build.mjs` checks are separate functions; split if the stop
      condition was reached.

### Architecture And Contracts

- [ ] No dependency, integration, lockfile, config, header, wrangler or deploy
      script change.
- [ ] No third-party script or iframe added; signup is a plain form.
- [ ] Share pictures use existing files unchanged; no image tooling.
- [ ] No schema or frontmatter change.
- [ ] `RENKU_URL` matches 0234's tags exactly; `SUBMIT_FILM_URL` and
      `NEWSLETTER_FORM` match D2 and D1.
- [ ] `workTally` is the only counting rule; no client-side counting.

### Slice 1: Counts, Sitemap, Robots, Feed, Share Pictures

- [ ] `workTally` added and used in footer, artist page and `ArtistCard`;
      `toTime` exported.
- [ ] Films page result line says "titles".
- [ ] `shareImage` prop renders `og:image`, `og:image:alt`, `twitter:card`; film
      and artist pages pass it.
- [ ] Feed `<link rel="alternate">` on every page; RSS link on Journal page.
- [ ] `/journal/rss.xml` matches the contract, all entries, newest first.
- [ ] `/sitemap.xml` matches the contract, 244 URLs today.
- [ ] `public/robots.txt` matches the contract.
- [ ] About: count sentence and RSS sentence.
- [ ] Four build checks added and failing on a deliberately broken local build
      (then reverted).

### Slice 2: Disclosure

- [ ] Footer disclosure line with the approved D3 wording and one link.
- [ ] About "Who makes Latent Matinee" section.
- [ ] Every built film page contains gorenku.com exactly once (the footer).

### Slice 3: Submit A Film

- [ ] Footer "Submit a film" link to `/about/#submit`.
- [ ] About "Submit a film" section with button to `SUBMIT_FILM_URL`.
- [ ] Option A: issue form file matches the contract; `submission` label exists.
- [ ] `docs/content-refresh.md` Submissions section added with the chosen
      option's wording.

### Slice 4: Newsletter Signup

- [ ] `NewsletterSignup.astro` matches the contract and posts in a new tab.
- [ ] Privacy link resolves (0234's page is live).
- [ ] Footer layout checked at desktop width.
- [ ] Maintainer completed a real signup and received the confirmation email.

### Slice 5: Signup Event

- [ ] The form carries `data-analytics-form="newsletter"`, and a consented
      submit records `newsletter_signup_submitted` through 0234's listener.
- [ ] Form still posts with tracking off.

### Slice 6 And Content Task

- [ ] README rules updated.
- [ ] `docs/content-refresh.md` artwork-size sentence added.
- [ ] Content task handed to the maintainer: two credit mismatches, Cully Hill
      Boys licence wording, `duck.png`, `brainstare.jpg`,
      `an-honest-days-work.png`.

### Final Verification

- [ ] Work done in the `../ai-films-0238` worktree; main checkout untouched
      until ship.
- [ ] `git diff --stat origin/main` and the full diff reviewed; no content or
      formatting churn in unrelated lines.
- [ ] `pnpm check`, `pnpm build`, `xmllint` pass.
- [ ] Desktop preview checks in "Before each ship" done.
- [ ] Each ship: fast-forward, push, `pnpm deploy:cloudflare` from the clean
      main checkout outside refresh times, with maintainer approval.
- [ ] After-deploy checks done; W3C feed validator passes.
- [ ] Worktree removed with approval after the last slice.
- [ ] No checklist item satisfied by accepting a larger or tangled file.
