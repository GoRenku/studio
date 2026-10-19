# 0238 Latent Matinee Disclosure And Sharing

Status: implemented and deployed 2026-10-19 (ai-films `96a210f`); maintainer steps remain
Date: 2026-10-15

## Summary

Latent Matinee (https://latentmatinee.com) is the audience side of the approved
marketing plan. Today it never says who makes it, gives readers no way to follow
it except visiting, shows no picture when a page is shared, has no working
sitemap, and says "146 films" in the footer while the Films page counts music
videos separately.

This plan makes four small changes to the site's code, all in the separate
repository `/Users/keremk/Projects/aitinkerbox/ai-films`:

1. **Disclosure.** One plain sentence in the footer and one short section on the
   About page say that Latent Matinee is made by the makers of Renku Studio,
   each with one link to gorenku.com. Nothing about Renku appears anywhere else.
2. **Follow the journal.** An RSS feed of the journal at `/journal/rss.xml`.
3. **Sharing basics.** Film and artist pages get a share picture taken from
   their existing credited artwork; the site gets `/sitemap.xml` and a
   `robots.txt` that points to it; the word "films" means the same thing in every
   count on the site.
4. **Safe delivery.** The work stays out of the daily content refresh and ships
   with the exact check, commit, push and deploy steps the repository requires.

No new packages are installed. Everything is built from the existing Markdown
content at build time.

## Decisions Recorded

- **No newsletter in this plan.** The maintainer will choose a different way to
  reach readers later, as its own plan.
- **No "Submit a film" path in this plan.** None of the options (GitHub issue
  form, hosted form service, email address) was good enough.
- **Disclosure wording:** "Latent Matinee is made by the makers of Renku Studio,
  a free, open-source tool for planning films with AI agents."
- **Counting rule approved:** "films" means shorts, features and series; music
  videos are counted separately; the mixed Films page list says "titles".
- **Site-owned `robots.txt` approved**, replacing Cloudflare's comment-only file.

## Review Attention

- **Added beyond the literal request, and why:**
  - **The existing build check gets four more checks** (sitemap lists every page,
    `robots.txt` names the sitemap, feed links work, share pictures exist).
    Without them a new page could silently miss the sitemap and nobody would
    notice.
  - **The About page link gets its own tag value**, `utm_content=about`,
    following 0234's pattern ("same with `utm_content=…`"). 0234 only lists the
    footer value; reusing it would count About clicks as footer clicks.
  - **`docs/content-refresh.md` gets one sentence about artwork size**, so the
    daily refresh keeps share pictures usable.
  - **The work happens in a separate git worktree.** The daily refresh commits
    and deploys whatever is on `main` in the main checkout, so code work there
    would get published by the next refresh.
- **New public things:** `/journal/rss.xml`, `/sitemap.xml`, `/robots.txt`; the
  footer disclosure line and the About "Who makes Latent Matinee" section; share
  tags (`og:image`, `og:image:alt`, `twitter:card`) on film and artist pages.
- **Hard to undo:** feed readers and search engines keep the feed and sitemap
  URLs once published. Nothing is deleted or migrated.
- **Deliberately unchanged:** no newsletter signup and no film submission path;
  no Renku banner, badge or "Made with Renku" label on film pages or anywhere
  else; the home page still shows a selection of the newest work, not the whole
  collection; journal, home, list and About pages get no share picture; content
  files, `astro.config.mjs`, `package.json`, the lockfile, `_headers`,
  `wrangler.jsonc` and the deploy script are untouched; analytics, consent, the
  privacy page and link-tag rules stay with plan 0234; gorenku.com is not
  changed.
- **Newsletter code left by plan 0234:** removed directly on 2026-10-19, not
  by this plan. ai-films commit `5e93525` (deployed) dropped the unused form
  listener and the footer `data-analytics-placement` marker; the
  newsletter rows left the Studio operations page. Plan 0234 stays as the
  record of what it shipped. Both plans edit `Layout.astro`'s footer; keep
  edits narrow.
- **Assumptions:** plan 0234's Latent Matinee footer tags
  (`utm_source=latentmatinee&utm_medium=referral&utm_campaign=always-on&utm_content=footer`)
  stay as written. Counts are from ai-films commit `07645dc` (2026-10-19);
  other evidence is from commit `9aca07e` (2026-10-15).
- **Decisions still open:** none.

## What Changes For Readers

- **Footer, every page.** Below the existing brand line and links:
  - the count line reads "120 films · 26 music videos · 88 artists · updated
    {date}" (today it reads "146 films · 88 artists · updated {date}");
  - the disclosure line: "Latent Matinee is made by the makers of
    [Renku Studio], a free, open-source tool for planning films with AI agents."
    The link goes to gorenku.com with 0234's footer tags.
- **About page.**
  - In "What makes the collection", after the music-video sentence: "Across the
    site, “films” means shorts, features and series; music videos are counted
    separately. The home page shows a selection of the newest work; the Films
    page lists everything."
  - In "A living journal", a last sentence: "You can also follow the journal by
    [RSS](/journal/rss.xml)."
  - New last section **Who makes Latent Matinee**: "Latent Matinee is made by the
    makers of [Renku Studio], a free, open-source tool for planning films with AI
    agents. Films are chosen by the standard above, whatever tools they were made
    with."
- **Journal page.** The intro line ends with an "RSS feed" link. Every page head
  announces the feed so feed readers find it.
- **Film and artist pages.** When shared on X, LinkedIn, Facebook, Slack or
  iMessage, the preview shows the page's existing artwork: the film's own image,
  or for an artist the same cover image their page already shows (the newest of
  their films with artwork). The file is used exactly as published, never
  cropped, resized or overlaid with text. Artists with no films yet get no share
  picture.
- **Films page.** The result line under the filters says "146 titles".
- **Artist pages and cards.** "In the collection" and the card line say, for
  example, "4 films · 1 music video" instead of "5 films".

New content, such as editorial interviews, is editorial work outside this plan.

## Requirement Ledger

| # | Requirement | Source | Owner in ai-films | Verified by |
| --- | --- | --- | --- | --- |
| R1 | Disclose plainly, in footer and About; each links gorenku.com with 0234 tags | marketing plan, item 1 | `Layout.astro`, `about.astro`, `external-links.ts` | build output grep; desktop check |
| R2 | No Renku banners or ads on film pages | marketing plan, item 1 | forbidden shape | grep of built film pages |
| R3 | RSS feed of the journal, following the dependency policy | marketing plan, item 2; ai-films AGENTS.md "Dependencies" | `src/pages/journal/rss.xml.ts` | feed check; `xmllint`; W3C validator after deploy |
| R4 | Share picture per film and artist page from credited artwork, respecting credits and sizes | marketing plan, item 4 | `Layout.astro`, film and artist pages | share-image check; platform previews |
| R5 | Working sitemap that `robots.txt` names | marketing plan, item 4; audit: `/sitemap-index.xml` 404, `robots.txt` has no rules | `sitemap.xml.ts`, `public/robots.txt` | sitemap and robots checks |
| R6 | One consistent, explained film count | marketing plan, item 4; audit | `catalog.ts` `workTally`, About sentence | desktop check of every count |
| R7 | Code work separate from scheduled refreshes; exact repo verification and deploy steps | marketing plan, item 5; ai-films AGENTS.md | worktree, ship procedure | Final Verification |
| R8 | Credit mismatches and artwork problems fixed as content work | ai-films AGENTS.md scope; `docs/content-refresh.md` | separate content task | content task list |

The marketing plan's newsletter (item 2) and "Submit a film" (item 3) are out of
scope by the maintainer's decision (see Decisions Recorded).

## Current Evidence

Counts checked on 2026-10-19 at ai-films commit `07645dc`; everything else
checked on 2026-10-15 at commit `9aca07e` (clean `main`) and on the live site.

- **Counts.** 146 entries in `content/films` (71 short films, 23 features, 26
  series, 26 music videos), so 120 films and 26 music videos; 88 artists; 37
  journal entries in `content/updates`. The implementer recounts at ship time;
  the content grows daily.
- **Where the counts disagree.** `src/layouts/Layout.astro` footer prints
  `films.length` "films" (music videos included). `src/pages/films/index.astro`
  header and the home "Films" figure subtract music videos; the same page's
  result line prints every entry as "films". `src/pages/artists/[id].astro` and
  `src/components/ArtistCard.astro` count music videos as films for the artists
  who have them.
- **Home page title count.** The home page is the union of five hero slides,
  14 "Just added", up to 16 "Watch now" not already shown, all upcoming, all
  features, all series, all music videos and up to four journal images. Short
  films that are neither new nor in a capped rail do not appear. This is the
  intended design in `src/pages/index.astro` and the README; only the About
  sentence above is added.
- **Sharing.** `Layout.astro` sets `og:site_name`, `og:title`,
  `og:description` and `og:url`, but no image and no `twitter:card`. Every film
  had artwork on 2026-10-15; artists with no films have no cover.
- **Artwork sizes** (`public/media`, 124 files on 2026-10-15: 93 JPEG, 14 PNG,
  17 WebP). Share limits: Facebook needs at least 200 × 200 px and at most 8 MB
  ([Facebook](https://developers.facebook.com/docs/sharing/webmasters/images/));
  X's large card needs at least 300 × 157 px and at most 5 MB, JPEG, PNG, WebP or
  GIF (X's own page refused an automated fetch, figures from
  [The SEO Framework](https://kb.theseoframework.com/kb/twitter-cards-and-x-sharing/);
  confirm with a real share). Outside these limits: `duck.png` 7.2 MB,
  `brainstare.jpg` 142 × 142, `an-honest-days-work.png` 286 × 508. These go to
  the content task; the code does not resize anything.
- **Credits.** The film schema already requires `imageAlt`, `imageCredit` and
  `imageSource` whenever `image` is set (`src/content.config.ts`). The audit
  reported two films with mismatched artwork credits. A metadata comparison
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
  `/sitemap.xml`, `/sitemap-index.xml` and `/rss.xml` return 404.
- **Build check.** `scripts/validate-build.mjs` checks every built HTML page for
  a title, one `h1`, working local links, image alt text, and fails on any
  `<script src="https:…">`. It does not look at XML files or absolute same-site
  URLs.
- **Dependencies.** `astro` 7.2.9 is the only framework dependency; pnpm 11.7.0
  pinned; seven-day release age; only `esbuild` may run build scripts.
  `@astrojs/rss` 4.0.19 would add `fast-xml-parser` 5.x and its six
  dependencies, none in the lockfile today. `@astrojs/sitemap` 3.7.4 would add
  `sitemap` 9.0.1, `arg`, `@types/sax` and `@types/node`, also new. A
  hand-written feed and sitemap need only text escaping.
- **Plan 0234 in ai-films.** Commit `34c9bb1` added the consented PostHog
  analytics, the banner, `src/pages/privacy.astro` and the footer "Privacy" and
  "Analytics choice" links. This plan's footer edits sit next to those and keep
  them unchanged.
- **Refresh boundary.** ai-films `AGENTS.md` and `docs/content-refresh.md`: the
  13:00 Europe/Madrid refresh (and an 11:00 X review feeding a private inbox)
  edits only content, commits on `main`, pushes, and deploys with
  `pnpm deploy:cloudflare`; it stops on unrelated local changes. Code changes
  need a separate, explicitly requested task.
- **Renku facts for the copy.** Renku Studio is AGPLv3 open source
  (`studio/README.md`, `LICENSE`); `TRADEMARKS.md` allows accurate attribution
  to the original project.

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
- Sibling plans: 0234 owns PostHog on Latent Matinee, consent, the privacy page
  and the link-tag convention. 0233 owns gorenku.com's own journal and feed.
  0231 owns the GitHub front door.
- Studio `AGENTS.md` rules applied here in spirit: no compatibility layers,
  deliberate names, small reviewable files, fail clearly.

## Architecture Shape Gate

### Ownership

- `src/lib/catalog.ts` stays the one owner of rules derived from content. It
  gains the counting rule (`workTally`) and exports its existing `toTime`.
- `src/lib/external-links.ts` (new) owns the outbound gorenku.com links and
  nothing else.
- `src/lib/xml.ts` (new) owns `escapeXml` and nothing else.
- Each endpoint builds one document from `catalog()`:
  `src/pages/journal/rss.xml.ts`, `src/pages/sitemap.xml.ts`.
- `src/layouts/Layout.astro` stays a layout: head tags and footer composition.
- `scripts/validate-build.mjs` stays the one build check; each new check is its
  own small function.

### File layout after this plan

```text
ai-films/
  public/robots.txt                          new
  src/lib/catalog.ts                         + workTally, export toTime
  src/lib/external-links.ts                  new
  src/lib/xml.ts                             new
  src/components/ArtistCard.astro            count line uses workTally
  src/layouts/Layout.astro                   shareImage prop, feed link, footer
  src/pages/about.astro                      count sentence, RSS, one section
  src/pages/films/[id].astro                 passes shareImage
  src/pages/artists/[id].astro               passes shareImage, workTally
  src/pages/films/index.astro                "titles" in result line
  src/pages/journal/index.astro              RSS link
  src/pages/journal/rss.xml.ts               new
  src/pages/sitemap.xml.ts                   new
  src/styles/global.css                      disclosure line
  scripts/validate-build.mjs                 + four checks
  docs/content-refresh.md                    + artwork size sentence
  README.md                                  + rules for the new outputs
```

### Forbidden shapes

- No new dependency, Astro integration, `astro.config.mjs` change, lockfile
  change or build-script permission.
- No third-party script or iframe anywhere.
- No generated, cropped, resized or overlaid share images; no image tooling.
- No new frontmatter field, schema change or per-film share opt-out.
- No Renku text, link, label or banner outside the footer line and the About
  section.
- No count computed in client-side script; counts come from `catalog.ts` at
  build time.
- No content files (`content/**`, `public/media/**`) in the code commits.
- No change to `_headers`, `wrangler.jsonc`, `scripts/deploy-cloudflare.mjs`.
- No change to 0234's analytics component, banner, privacy page or footer
  links.

### Stop conditions

- `validate-build.mjs` passes about 150 lines or the new checks start sharing
  parsing code: move the new checks into `scripts/validate-build/` modules first.
- `Layout.astro` needs logic beyond rendering the props and catalog values it
  already uses: move it into `catalog.ts` or a component.
- Any step would edit content or media: stop; that belongs to the content task.

## Contracts

### Outbound links: `src/lib/external-links.ts`

```ts
const RENKU_TAGS = 'utm_source=latentmatinee&utm_medium=referral&utm_campaign=always-on';

/** gorenku.com from the footer disclosure line (plan 0234 tag table). */
export const RENKU_FOOTER_URL = `https://gorenku.com/?${RENKU_TAGS}&utm_content=footer`;

/** gorenku.com from the About "Who makes Latent Matinee" section. */
export const RENKU_ABOUT_URL = `https://gorenku.com/?${RENKU_TAGS}&utm_content=about`;
```

### Counting rule: `src/lib/catalog.ts`

```ts
/** One counting rule: shorts, features and series are films; music videos are counted separately. */
export function workTally(works: Film[]): string
```

Returns `"120 films · 26 music videos"`, `"1 film"`, `"0 films"` or
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
fixed pages (`/`, `/films/`, `/artists/`, `/whats-new/`, `/journal/`,
`/about/`, `/privacy/`), then films, artists and journal entries in catalog
order. No `lastmod`, `changefreq` or `priority`: no field records when a page
last changed, and search engines ignore the other two.

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

## Implementation Slices

All slices are built in a separate worktree (see Final Verification) and
committed separately. Slices 1 and 2 can ship together or one by one; each ship
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

1. Add `src/lib/external-links.ts` with `RENKU_FOOTER_URL` and
   `RENKU_ABOUT_URL`.
2. `Layout.astro`: the disclosure line under the footer count line, styled like
   `.footer-meta` (small, dim); "Renku Studio" is the only link
   (`RENKU_FOOTER_URL`).
3. `about.astro`: the "Who makes Latent Matinee" section, linking
   `RENKU_ABOUT_URL`.
4. `global.css`: footer line spacing only.

### Slice 3: Documentation

1. `README.md`, "Design and credits" list: the counting rule; share pictures
   come from existing artwork unchanged; `/journal/rss.xml`, `/sitemap.xml` and
   `robots.txt` are generated or static and checked by the build; outbound
   gorenku.com links live in `src/lib/external-links.ts`.
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
  existing ones (the feed `<link>` becomes a checked local link);
- `xmllint --noout dist/sitemap.xml dist/journal/rss.xml` for well-formed XML;
- after deploy, the [W3C Feed Validation Service](https://validator.w3.org/feed/)
  on the public feed URL.

The new checks cover the generated outputs once, at the build; desktop checks
cover what readers see.

## Documentation

- ai-films `README.md` and `docs/content-refresh.md` as in slice 3.
- ai-films `AGENTS.md` unchanged: it already points to `docs/content-refresh.md`.
- No Studio documentation or ADR changes; this plan changes no Studio code.

## Final Verification

### Working copy (keeps `main` free for the daily refresh)

```sh
cd /Users/keremk/Projects/aitinkerbox/ai-films
git fetch origin
git worktree add ../ai-films-0238 -b site/0238-disclosure-sharing origin/main
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
4. `xmllint --noout dist/sitemap.xml dist/journal/rss.xml`; the sitemap has one
   `<loc>` per built page except `404.html`, the feed one item per journal
   entry (37 on 2026-10-19).
5. `grep -c gorenku.com dist/films/*/index.html`: 1 on every film page (the
   footer); `dist/about/index.html`: 2.
6. `grep -L 'og:image' dist/films/*/index.html`: none.
   `grep -L 'og:image' dist/artists/*/index.html`: only artists with no films.
7. `pnpm preview`, desktop width: home footer (count line in the "120 films ·
   26 music videos · 88 artists" form, disclosure line, 0234's Privacy and
   Analytics choice links unchanged); a film page head tags; an artist with a
   music video (for example `/artists/extraltodeus/`) count line; `/films/`
   result line; About sections; Journal RSS link. No layout overflow in the
   footer.

### Ship (maintainer approval required)

Outside the 11:00 and 13:00 Europe/Madrid automation runs, with the main
checkout clean and on `main`:

```sh
cd /Users/keremk/Projects/aitinkerbox/ai-films
git status                      # must be clean, on main
git fetch origin && git merge --ff-only origin/main
git merge --ff-only site/0238-disclosure-sharing
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

- Approve each push and deploy, or run them.
- Check share previews with platform tools that need an account (X, LinkedIn
  Post Inspector, Facebook Sharing Debugger).
- Add `https://latentmatinee.com/sitemap.xml` in Google Search Console and Bing
  Webmaster Tools (account and site verification).
- Approve the separate content task and any announcement or posting.

## Completion Checklist

### Review Area

- [x] Final file layout matches the Architecture Shape Gate; no file collects
      unrelated concerns.
- [x] `Layout.astro` only renders props and catalog values; no new logic in it.
- [x] `validate-build.mjs` checks are separate functions; split if the stop
      condition was reached.
- [x] No newsletter or film submission code, copy or link added.

### Architecture And Contracts

- [x] No dependency, integration, lockfile, config, header, wrangler or deploy
      script change.
- [x] No third-party script or iframe added.
- [x] Share pictures use existing files unchanged; no image tooling.
- [x] No schema or frontmatter change.
- [x] `RENKU_FOOTER_URL` matches 0234's footer tags exactly; `RENKU_ABOUT_URL`
      differs only in `utm_content=about`.
- [x] `workTally` is the only counting rule; no client-side counting.
- [x] 0234's analytics component, banner, privacy page and footer links
      unchanged.

### Slice 1: Counts, Sitemap, Robots, Feed, Share Pictures

- [x] `workTally` added and used in footer, artist page and `ArtistCard`;
      `toTime` exported.
- [x] Films page result line says "titles".
- [x] `shareImage` prop renders `og:image`, `og:image:alt`, `twitter:card`; film
      and artist pages pass it.
- [x] Feed `<link rel="alternate">` on every page; RSS link on Journal page.
- [x] `/journal/rss.xml` matches the contract, all entries, newest first.
- [x] `/sitemap.xml` matches the contract, one URL per built page except
      `404.html`.
- [x] `public/robots.txt` matches the contract.
- [x] About: count sentence and RSS sentence.
- [x] Four build checks added and failing on a deliberately broken local build
      (then reverted).

### Slice 2: Disclosure

- [x] Footer disclosure line with the recorded wording ("made by the makers of")
      and one link.
- [x] About "Who makes Latent Matinee" section.
- [x] Every built film page contains gorenku.com exactly once (the footer).

### Slice 3 And Content Task

- [x] README rules updated.
- [x] `docs/content-refresh.md` artwork-size sentence added.
- [x] Content task handed to the maintainer: two credit mismatches, Cully Hill
      Boys licence wording, `duck.png`, `brainstare.jpg`,
      `an-honest-days-work.png`.

### Final Verification

- [x] Work done in the `../ai-films-0238` worktree; main checkout untouched
      until ship.
- [x] `git diff --stat origin/main` and the full diff reviewed; no content or
      formatting churn in unrelated lines.
- [x] `pnpm check`, `pnpm build`, `xmllint` pass.
- [x] Desktop preview checks in "Before each ship" done.
- [x] Each ship: fast-forward, push, `pnpm deploy:cloudflare` from the clean
      main checkout outside refresh times, with maintainer approval.
- [x] After-deploy checks done; W3C feed validator passes.
- [x] Worktree removed with approval after the last slice.
- [x] No checklist item satisfied by accepting a larger or tangled file.
