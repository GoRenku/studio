# 0232 Website Conversion And Discoverability

Status: implemented, awaiting deploy and setup-time measurement
Date: 2026-10-15

## Summary

gorenku.com explains Renku well but loses visitors at the edges. The home page
does not say early that Renku is free, open source and local. GitHub is a bare
icon. Shared links show no picture. Search engines get no sitemap, no
robots.txt and no real "page not found": every unknown address, including
the old `/docs/...` links in the retired `keremk/renku` README, returns the
home page with a success status. The download page says "Three steps" but
shows four, and never says what a visitor needs before installing or what
generation costs.

This plan fixes those edges inside `packages/website` only:

1. one plain line under the home page subhead: free, open source, local, your
   own agent and keys;
2. a labelled "Star on GitHub" control in the header with the star count read
   once when the site is built;
3. footer links to both repositories, GitHub Discussions and Latent Matinee;
4. link-preview tags and a 1200×630 preview picture on every page;
5. `sitemap.xml`, `robots.txt`, a real 404 page and permanent redirects for
   old `/docs/...` links;
6. an honest download page: what you need first, a correct step count, and
   three real, dated example costs from the Basilica film.

Nothing changes in Studio, the CLI, Core, Engines, the installers or Studio
Skills. The site keeps its current look, fonts and colours.

## Review Attention

- **Added beyond the literal request, and why:**
  - **`/install` also redirects to `/download/`.** The old site had an
    `/install` page next to its `/docs/` pages. Same cause, one line. Strike
    it if you only want `/docs/`.
  - **The preview picture tags carry its size and a text description**
    (`og:image:width`, `og:image:height`, `og:image:alt`). Some sites show no
    picture on the first share without the size, and the description is read
    aloud by screen readers.
  - **The "install an AI agent" block moves into a new "What you'll need"
    panel above the steps.** That makes "Three steps to get started" true
    without renumbering. The supported-systems line moves into the same panel
    so it is said once.
  - **While you run the site locally (`astro dev`), the header asks GitHub
    for nothing** and shows "Star on GitHub" without a number. Only real
    builds read the count.
- **New public addresses and files:** `https://gorenku.com/sitemap.xml`,
  `https://gorenku.com/robots.txt`, a 404 page for every unknown address, and
  a redirect table (`public/_redirects`). Layouts gain one optional
  `linkPreview` setting so a page can pick its own preview picture.
- **New build requirement:** building the site now needs to reach
  `api.github.com` once. See decision D1 for what happens when it can't.
- **Hard to reverse:**
  - The redirects are permanent (HTTP 301). Browsers and search engines
    remember them for a long time, so reusing any `/docs/...` address later
    would be unreliable.
  - Social sites (X, LinkedIn, Slack, WhatsApp) cache a preview the first
    time a link is shared. Fixing a bad picture later needs a manual
    re-scrape.
  - Deploying replaces the live site. Cloudflare keeps earlier deployments
    for rollback.
- **Visible behavior change that is not new work:** old `/blog/...`
  addresses from the retired site, and any mistyped address, will show the
  new 404 page instead of the home page.
- **Kept unchanged:** analytics events, the cookie banner and the privacy
  notice (0234); Quick Start, tutorials and new content pages (0233); both
  READMEs and repository settings (0231); the FAQ; install commands,
  platform tabs and plugin steps; the dated terms address used by the
  installers (`/terms/2026-09-23/`); the separate "Sites" build script (its
  output simply includes the new files, and it also reads the star count);
  the site's visual language. The build-time GitHub call involves no visitor
  data, so the privacy notice does not change.
- **Assumptions:**
  - The site is served by the Cloudflare Pages project `renku-web`
    (`wrangler pages deploy`), not a Worker. Pages serves the home page for
    unknown paths only because the build has no top-level `404.html`.
  - GitHub Discussions on `GoRenku/studio` is the one community destination,
    enabled by 0231 before this footer goes live.
  - The prices on the download page are list prices on the day the box is
    written, applied to real past requests. They are not your bills.
- **Needs your approval:** decisions D1–D5 below, plus the exact visible
  copy under Contracts → Visible copy.

## Decisions For The Maintainer

- **D1. GitHub doesn't answer during a build.**
  - *Recommended:* the build stops with a clear message (which repository,
    what GitHub said, try again later). A deploy is a manual command, so a
    later retry costs little, and nothing broken ships quietly.
  - *Alternative:* the build continues, prints a warning and ships the
    button without a number until the next deploy.
- **D2. The count is 0 today.**
  - *Recommended:* show the number only from a count you choose (suggested:
    20). Below it the control reads "Star on GitHub" with no number. A
    visible "0" beside the main download button tells visitors nobody uses
    Renku. The number appears on the first deploy after the count passes your
    threshold.
  - *Alternative:* always show it, as literally requested.
  - Either way the number only updates when the site is rebuilt and deployed.
- **D3. Cost examples that do not exist as real records.**
  - *Storyboard pass:* the only real storyboard records were made with
    Codex's built-in image generation, so the honest figure is "no provider
    charge; uses your ChatGPT plan's Codex usage." *Recommended:* show that,
    and say that other agents need an image provider. *Alternative:* you
    approve one paid storyboard sheet through a provider so the box can show
    a real dollar figure.
  - *Video take:* every real take is 15 seconds; there is no 5-second
    record. *Recommended:* show the real 15-second take. *Alternative:* you
    approve one paid 5-second take.
- **D4. "Codex Desktop" may be an old name.** OpenAI's Codex app page now
  redirects to a "ChatGPT desktop app" page where Codex is a mode inside
  ChatGPT. The site says "Codex Desktop" seven times: twice on the download
  page, once in Quick Start, and four times in the agent-and-Studio picture
  shown on the home page and Quick Start (its caption, enlarge label and
  screen-reader text). *Recommended:* after you confirm the current name in
  the app you use, update all seven in this change. *Alternative:* update
  only the download page here and leave the rest. Whether Renku's installer still
  finds the app is outside this plan; please check it separately.
- **D5. Redirect destinations.** Approve the table in Contracts → Redirects.
  *Decided 2026-10-15:* redirect only old pages with a real current
  replacement; every other old address returns the 404 page. Redirecting
  retired concepts to the home page would be treated as a "soft 404" by
  search engines. Old pages about blueprints and asset producers describe a product that no
  longer exists, so they go to the home page.

Open question, no default: do X or YouTube accounts for Renku exist? The
footer gets them only if you name them. None are invented.

## What Only The Maintainer Can Do

- Make decisions D1–D5 and approve the visible copy.
- Approve the default preview picture once it is rendered.
- Name any X or YouTube handles, or confirm there are none.
- Enable GitHub Discussions (0231) before the footer link is deployed.
- Time two fresh installs, one on a clean macOS user account or virtual
  machine and one on a clean Windows PC, using the timing steps in
  Slice 6. Claude cannot create operating-system accounts or reset a
  machine.
- Approve any paid generation, only if you chose a paid option in D3.
- Optionally, compare the video take's and voice line's list-price figures
  with your Fal.ai and ElevenLabs usage pages. The video take's Fal.ai
  request id is under Context and Evidence; the voice line can be found by
  its date (10 October 2026) in ElevenLabs' usage history.
- Deploy with `pnpm deploy:website`, or explicitly allow Claude to run it on
  this machine's existing Cloudflare sign-in.
- After deploying, optionally add `https://gorenku.com/sitemap.xml` in Google
  Search Console and Bing Webmaster Tools, and re-scrape the home page in
  LinkedIn Post Inspector. These need your accounts.

Real outside constraints: GitHub's API must answer during each build
(60 unauthenticated requests per hour per address; a build uses one), 0231
must enable Discussions first, and the setup-time number waits for your two
timed installs. Everything else is built and verified the same day.

## What Changes For Visitors

### Home page hero

One line between the subhead and the two buttons, in the subhead's muted
colour and a smaller size, revealed with the existing fade-in.

### Header

The bare GitHub icon becomes a pill-shaped link: GitHub mark, "Star on
GitHub" and, per D2, the star count after a thin divider. It opens the Studio
repository in a new tab, like today's icon. No script runs in the browser;
the number is part of the built page. On screens 640px wide and narrower,
where the header already hides its menu, the words collapse to the mark and
number. The words stay available to screen readers.

### Footer

A second row of links under the existing identity and legal row: "Renku
Studio on GitHub", "Studio Skills on GitHub", "GitHub Discussions", and
"Latent Matinee" with the muted note "AI film journal". The legal links and
"Analytics choice" stay as they are.

### Link previews

Every page carries a canonical address on `https://gorenku.com` (so the
`renku-web.pages.dev` copy is not treated as a separate site), `og:url`,
`og:image` with size and description, and `twitter:card` set to
`summary_large_image`. The existing `og:title`, `og:description` and
`og:type` stay.

- **Default picture:** a 1200×630 card built once from the existing Studio
  screenshot `studio-generation-review-clean.jpg` (Blender previs beside its
  generated take), the Renku logo and wordmark, and the hero line "Watch your
  film while you're still writing it." It is a committed image, not
  generated at build time.
- **Tutorial pictures:** each tutorial chapter that already has a picture
  uses it, cut to 1200×630 from the top so the Studio header stays visible.
  The tutorials overview uses its harbor picture. The sample-project and
  uninstall guides have no picture and use the default.

### Search basics

- `/sitemap.xml` lists every built page except the 404 page, with
  `https://gorenku.com/...` addresses ending in `/`. It is written by the
  build from the list of pages Astro actually built, so new pages from 0233
  appear without anyone editing a list.
- `/robots.txt` allows everything and points to the sitemap.
- Unknown addresses show a 404 page with HTTP status 404, using the site's
  header, footer and fonts.
- Old addresses redirect permanently (table under Contracts).

### Download page

Above the install box, a new two-column panel:

- **What you'll need:** a supported computer; an AI agent app, with the plan
  each one needs, checked on a stated date and linked to the vendor's
  pricing page; an API key with credit from at least one supported provider;
  and roughly how long setup takes, measured on fresh machines.
- **What generation costs:** three real requests from making the Basilica
  film, each with its date, model and price, plus a short note that retakes
  cost the same again and prices change.

The install box keeps "Three steps to get started", which is now accurate:
the separate "First, install an AI agent" block is gone because the agent is
listed under "What you'll need". Steps 01–03, platform tabs, commands, copy
buttons, terms paragraph and "Up and running?" handoff are unchanged except
for D4 wording.

### Non-goals

- New pages or content beyond the 404 page (0233).
- Analytics events for the new controls, and privacy-notice text (0234).
- Repository descriptions, topics, social preview uploads (0231). The new
  preview card may be reused there; that is 0231's choice.
- Structured data (JSON-LD) is not part of the approved scope.

## Requirement Ledger

| # | Requirement | Source | Where it is met |
| --- | --- | --- | --- |
| R1 | Hero line: free, open source, local, own agent and keys | Approved scope 1 | Slice 4 |
| R2 | Labelled star control, count read at build, no browser script | Scope 2 | Slice 3 |
| R3 | Clear behavior when GitHub fails during build | Scope 2; AGENTS fail-fast | D1, Slice 3 |
| R4 | Footer: both repos, Latent Matinee, Discussions; no invented accounts | Scope 3 | Slice 4 |
| R5 | Preview tags and canonical on every page via layouts; default 1200×630 picture; tutorial pictures | Scope 4 | Slice 1 |
| R6 | `sitemap.xml`, `robots.txt` | Scope 5 | Slice 2 |
| R7 | Real 404 page and status, root cause found | Scope 5; audit | Slice 2 |
| R8 | Old `/docs/*` links with a real replacement redirect; the rest return 404 | Scope 5 | Slice 2, D5 |
| R9 | Prerequisites stated plainly and verified from primary sources | Scope 6 | Slices 5–6 |
| R10 | Correct step count | Scope 6 | Slice 5 |
| R11 | Three real, dated cost examples from Urban Basilica records; no paid run without approval | Scope 6 | Slices 5–6, D3 |
| R12 | Keep website guide rules and visual language | Scope 7; `docs/product/website-learning-guides.md` | All slices, Documentation |
| R13 | No dependency installs, no formatting churn, manual deploy | AGENTS.md; website README | Architecture Shape Gate, Final Verification |

## Context And Evidence

### Accepted documents and plans

- `docs/product/website-learning-guides.md`: download, agent-skills, Quick
  Start and tutorials roles; editorial checks; verification commands.
- `packages/website/README.md`: Cloudflare Pages project `renku-web`,
  manual `pnpm deploy:website`, screenshots from `urban-basilica`.
- `docs/operations/distribution-and-release.md`: installers print the dated
  terms address `https://gorenku.com/terms/2026-09-23/`; it must keep working.
- Plan 0229 and ADR 0117: Engines owns provider prices; Codex built-in image
  generation shows "Uses your ChatGPT plan's Codex usage" instead of a price.
- Sibling plans: 0231 (repository front door, Discussions), 0233 (new
  pages), 0234 (website analytics and privacy). All edit `packages/website`
  too; shared files are `SiteHeader.astro`, `SiteFooter.astro` and
  `BaseLayout.astro`. Whichever lands second rebases on the first; there is
  no shared logic.

### Current site (observed 2026-10-15)

- Astro 7.0.6, static output, `site: 'https://gorenku.com'`,
  `build.assets: 'assets'`, `sharp` already installed. No integrations.
- `BaseLayout.astro` sets `title`, `description`, `og:title`,
  `og:description`, `og:type`. No `og:image`, `og:url`, `twitter:card` or
  canonical. `LearnLayout.astro` wraps it for Quick Start and tutorials;
  `agent-skills`, `download`, `privacy`, `terms` and the home page use
  `BaseLayout` directly.
- `SiteHeader.astro`: GitHub mark only, `aria-label="Renku Studio on GitHub"`.
- `SiteFooter.astro`: logo, copyright, Terms, Privacy, Analytics choice.
- `download.astro`: heading "Three steps to get started"; an unnumbered "→
  First, install an AI agent" block, then 01–03; systems line in the heading
  row; no plan, key, time or cost information. The FAQ answer "Is Renku
  free?" already says Renku adds no markup and agent fees are separate.
- Live checks: `/does-not-exist`, `/docs/quick-start`, `/robots.txt`,
  `/sitemap.xml`, `/install` all return 200 with the 66 KB home page.
  `/download` returns 308 to `/download/`. `renku-web.pages.dev` serves the
  same site.
- Root cause of the 200s: Cloudflare Pages treats a deployment without a
  top-level `404.html` as a single-page app and serves `/` for every unknown
  path. With `404.html` present, Pages serves the nearest 404 page instead
  (Cloudflare "Serving Pages" docs). `wrangler.jsonc` has no setting for
  this; `not_found_handling` belongs to Workers, not `wrangler pages deploy`.
- Astro's own `redirects` setting would produce HTML pages that refresh to
  the new address with status 200 in a static build. Cloudflare's
  `_redirects` file gives real 301s, supports `*` patterns, runs before
  static files, and allows 2,000 fixed plus 100 pattern rules.
- The website is not part of the root `build`, `test`, `check` or CI, so a
  network call during its build cannot break other packages.
- GitHub API, unauthenticated: `GoRenku/studio` has `stargazers_count: 0`,
  `has_discussions: false`; limit 60 requests per hour.

### Old site addresses

The retired site (same Pages project, from `keremk/renku` `web/`) had
`/docs/` plus ten pages, `/install`, `/blog/` with one post, and an
`/api/docs/...` endpoint. The `keremk/renku` README links `/docs/`,
`/docs/app-quick-start/`, `/docs/quick-start`, `/docs/introduction`,
`/docs/cli-reference`, `/docs/blueprint-authoring` and `/docs/usage-guide`.

### Agent app plans (fetched 2026-10-15; re-check before writing copy)

- OpenAI pricing (`learn.chatgpt.com/docs/pricing`): Codex is included with
  ChatGPT Free, Go, Plus, Pro, Business, Edu and Enterprise; Free and Go list
  the desktop app; limits differ by plan. `developers.openai.com/codex/app/`
  now redirects (308) to `learn.chatgpt.com/docs/app`, titled "ChatGPT
  desktop app", where Codex is a mode (D4).
- Anthropic pricing (`claude.com/pricing`): Claude Code is not in Free; it is
  in Pro ($17/month billed yearly or $20 monthly), Max, Team and Enterprise.
  `code.claude.com/docs/en/desktop`: install Claude, sign in, open the Code
  tab; macOS and Windows supported.

### Generation records in Urban Basilica (read-only)

Each generated file's `asset_file.generation_provenance` stores provider,
model, the exact request, the prompt and sometimes a receipt (`requestId`
plus output metadata). **No billed amount or price is stored.** A search of
every key in all 110 provenance records found no cost, price, credit or
charge field. Prices therefore come from Engines' price lookup or the
provider's published price, applied to the stored request.

Chosen records (not shown on the site; ids are for your cross-check):

| Example | Record | Date | Route and request | Receipt |
| --- | --- | --- | --- | --- |
| Storyboard pass | Scene 03, iteration 02: four Beat images `storyboards/03/02-iteration/s03-b01…b04` from one request | 2026-08-26 | `codex` / `gpt-image-2` (built-in) | none (no provider bill) |
| Video take | `asset_file_exnux9d4`, `scenes/03/01-shot-plan/s03-p01-video-gsb7.mp4` | 2026-10-10 | `fal-ai` / `minimax/h3-max/reference-to-video`, `duration: 15`, `resolution: 768P` | `01a1256a-e327-7c91-8fd6-01ebbfd87101` |
| Voice line | `asset_file_chmraa77`, `scenes/03/01-shot-plan/dialogues/turn-01-gw6d.mp3` | 2026-10-10 | `elevenlabs` / `eleven_v4`, one turn, 54 characters | output size only |

All 18 provider video takes are 15 seconds (480P, 768P or 1080P; the 19th
video is a user-supplied file). All 10 storyboard records with provenance
were made with Codex's built-in generation and have no provider route (D3).

## Architecture Shape Gate

**Owner:** `packages/website` only. No Studio, Core, CLI, Engines,
diagnostics or installer code changes. No new dependency.

**File layout after the change:**

```text
packages/website/
  astro.config.mjs                 registers sitemapIntegration(); nothing else new
  sitemap-integration.mjs          NEW: build-done hook that writes dist/sitemap.xml
  public/
    _redirects                     NEW: permanent redirect table
    robots.txt                     NEW
  src/
    assets/renku-link-preview.jpg  NEW: 1200×630 default preview card
    data/
      site.ts                      + repository/community URLs, LinkPreview type, defaultLinkPreview
      github-stars.ts              NEW: one build-time GitHub read; studioStarCount
    layouts/
      BaseLayout.astro             + canonical, og:url, og:image(+size, alt), twitter:card
      LearnLayout.astro            + passes linkPreview through
    components/
      Hero.astro                   + one line
      SiteHeader.astro             icon link replaced by the star control
      SiteFooter.astro             + project links row
    pages/
      404.astro                    NEW
      download.astro               prerequisites and cost panel; agent block removed
      tutorials/index.astro        passes its hero as linkPreview
      tutorials/[slug].astro       passes the chapter picture as linkPreview
```

**Who owns what:**

- `BaseLayout.astro` is the only place head tags are written. Pages and
  `LearnLayout` pass data (`title`, `description`, `linkPreview`); they never
  write their own `<meta>` or `<link rel="canonical">`.
- `github-stars.ts` owns the GitHub request, response check and error text.
  `SiteHeader.astro` owns only how the count looks and whether it is shown.
- `sitemap-integration.mjs` owns sitemap writing from Astro's built-page list.
- `public/_redirects` is the only redirect owner. `public/robots.txt` is a
  static file.
- `download.astro` keeps its copy inline, as today, with the cost examples
  in one frontmatter array whose comment names each source record and price
  source.

**Forbidden shapes:**

- any browser script or third-party badge for the star count, or any GitHub
  call from a visitor's browser;
- head tags duplicated in pages or a second layout for the 404 page;
- a hand-maintained page list for the sitemap;
- Astro `redirects` config, Pages Functions or a Worker for redirects or 404;
- cost figures without a named record, date and price source;
- invented social accounts or placeholder links;
- formatter runs over touched files (several website files keep long
  single-line markup; edits stay narrow).

**Stop and revise the plan if:**

- `BaseLayout` starts branching on specific pages;
- the star count needs a token, a cache file or a browser script;
- the 404 page or redirects cannot work through `404.html` and `_redirects`
  in local Pages emulation;
- a cost example cannot be traced to a real record and a dated price;
- any change would touch a package outside `packages/website` (except the
  documentation listed below).

## Contracts

### Public addresses

| Address | Result |
| --- | --- |
| `/sitemap.xml` | 200, XML `urlset` of every built page except 404 |
| `/robots.txt` | 200, text (below) |
| any unknown path | 404, the new 404 page |
| `/terms/2026-09-23/` | 200, unchanged |

`public/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://gorenku.com/sitemap.xml
```

### Redirects (`public/_redirects`, all 301)

Each rule is written with and without the trailing slash. There is no
pattern rule: any other old address, including retired concepts such as
blueprints, asset producers and the CLI reference, returns the 404 page.

| Old address | New address | Why |
| --- | --- | --- |
| `/docs`, `/docs/` | `/quick-start/` | old documentation home |
| `/docs/app-quick-start` | `/quick-start/` | same purpose |
| `/docs/app-usage-guide` | `/tutorials/` | how-to guide |
| `/docs/quick-start` | `/download/` | old quick start began with installation |
| `/docs/usage-guide` | `/tutorials/` | how-to guide |
| `/install` | `/download/` | old install page (Review Attention) |

### Data and layout settings

- `src/data/site.ts`:
  - `site.studioSkillsGithubUrl = 'https://github.com/GoRenku/studio-skills'`
  - `site.githubDiscussionsUrl = 'https://github.com/GoRenku/studio/discussions'`
  - `site.latentMatineeUrl = 'https://latentmatinee.com'`
  - `export interface LinkPreview { image: ImageMetadata; alt: string }`
  - `export const defaultLinkPreview: LinkPreview` (the new card; alt: "Renku
    Studio showing a Blender previs beside its generated film take, with the
    line Watch your film while you're still writing it.")
- `src/data/github-stars.ts`:
  - `export const studioStarCountShownFrom = 20` (value from D2; removed if
    D2 chooses "always show");
  - `export const studioStarCount: number | undefined`, read once per build
    with top-level `await` from `https://api.github.com/repos/GoRenku/studio`
    (headers `Accept: application/vnd.github+json`,
    `X-GitHub-Api-Version: 2022-11-28`, a `User-Agent`; 10-second timeout).
    `undefined` only under `import.meta.env.DEV`, where no request is made.
  - The response must have a whole, non-negative `stargazers_count`.
  - Failure (D1 recommended): the build stops with:
    `Website build stopped: could not read the GitHub star count for
    GoRenku/studio (<HTTP status or network error>: <GitHub message>). Try
    the build again later.` The website is a private, manually built package
    with no structured-diagnostics dependency; a clear build error is the
    right boundary here.
- `BaseLayout.astro` props: existing `title?`, `description?`, plus
  `linkPreview?: LinkPreview` (default `defaultLinkPreview`).
  - Preview file: `getImage({ src, width: 1200, height: 630, fit: 'cover',
    position: 'top', format: 'jpg' })` from `astro:assets` (existing sharp
    service), made absolute with `new URL(image.src, Astro.site)`.
  - Canonical and `og:url`: `new URL(pathname, Astro.site)`, where pathname
    is `Astro.url.pathname` with a trailing `/` added when missing. The 404
    page keeps the shared tags; crawlers ignore tags on 404 responses, so
    there is no opt-out setting.
- `LearnLayout.astro` props: adds `linkPreview?: LinkPreview`, passed to
  `BaseLayout`.
- `sitemap-integration.mjs`: `export function sitemapIntegration()` returning
  an Astro integration named `renku-sitemap`. It reads `site` in
  `astro:config:done` and, in `astro:build:done`, writes `sitemap.xml` into
  the output folder: sorted `<loc>` entries from `pages`, excluding the 404
  page, no `lastmod`.

### Visible copy (needs approval)

- **Hero line:** "Free and open source. Runs on your computer with your own AI
  agent and API keys."
- **Header control:** "Star on GitHub" and, when shown, the count in
  `en-US` grouping (for example "1,204"). Accessible name: "Star Renku Studio
  on GitHub" plus ", 1,204 stars" when the count is shown.
- **Footer row (label "Renku project" for screen readers):** "Renku Studio on
  GitHub" · "Studio Skills on GitHub" · "GitHub Discussions" · "Latent
  Matinee" with muted "AI film journal".
- **404 page:** eyebrow "404 · Page not found"; heading "This scene didn't
  make the cut."; line "The link may be old or mistyped. Start from one of
  these instead."; links "Download Renku" (primary button), "Renku home",
  "Quick Start", "Tutorials".
- **Download → What you'll need** (heading eyebrow "Before you start"):
  - *A Mac or Windows PC.* "macOS 13.5 or newer on Apple silicon or Intel, or
    Windows 10 (version 1803 or newer) or Windows 11 on x64."
  - *An AI agent app.* "Renku has no built-in agent. [Codex name per D4] is
    included with ChatGPT plans, including Free; usage limits depend on the
    plan. Claude Desktop's Code tab needs a paid Claude plan (Pro or
    higher). A terminal agent, or another app that can run local commands
    and use Renku's skills, works too. Desktop apps are recommended so you
    can see images beside the conversation." Followed by "Plans checked
    [date]:" with links "OpenAI pricing" and "Claude pricing".
  - *An API key with credit.* "To generate images, video or voices, add an
    API key from at least one provider Renku supports: Fal.ai, Pika,
    Replicate, WaveSpeed, ElevenLabs or World Labs. You pay the provider
    directly; Renku adds no fee. With Codex, some images can use its built-in
    image generation instead."
  - *About [N] minutes.* "From the install command to Studio open with your
    first provider key saved, timed on a fresh Mac and a fresh Windows PC on
    [date]. Creating provider accounts and adding credit takes extra time."
- **Download → What generation costs:** heading "Three real examples"; line
  "Renku is free. Your provider bills each generation. These are real
  requests from making our Basilica film, priced at list prices on [date]."
  - "Storyboard pass" · "Four Beat frames for one scene in a single image,
    made with Codex's built-in image generation (26 Aug 2026)." · "No
    provider charge; uses your ChatGPT plan's Codex usage." Then: "With Claude
    or another agent, storyboards use an image provider's prices." (D3)
  - "Video take" · "15 seconds at 768p with MiniMax H3 Max on Fal.ai (10 Oct
    2026)." · "$[X]"
  - "Voice line" · "One line of dialogue, 54 characters, with ElevenLabs
    Eleven v4 (10 Oct 2026)." · "$[Y]"
  - Note: "A retake costs the same again. Prices change, so check your
    provider. When a provider publishes its prices, Renku shows an estimate
    before you confirm a generation."

Bracketed values are filled from Slice 6 evidence, never estimated by hand.
Final copy uses the site's curly apostrophes and quotes, as the existing
pages do.

## Implementation Slices

### Slice 1: Link previews in the layouts

- Render the default card: a temporary HTML composition in the session
  scratchpad (existing site fonts and colour tokens, the screenshot, the
  logo and the hero line), captured at exactly 1200×630, scale 1, with the
  installed Google Chrome in headless mode. Commit only
  `src/assets/renku-link-preview.jpg`. Show it to the maintainer for approval.
- `src/data/site.ts`: add `LinkPreview`, `defaultLinkPreview`.
- `BaseLayout.astro`: add the prop, `getImage`, canonical, `og:url`,
  `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`,
  `twitter:card`. Keep existing tags.
- `LearnLayout.astro`: add and pass `linkPreview`.
- `tutorials/[slug].astro`: pass `{ image: tutorial.image, alt: tutorial.alt }`
  when both exist. `tutorials/index.astro`: pass its harbor hero and its
  existing alt text.

### Slice 2: Search basics

- `src/pages/404.astro` using `BaseLayout`, `SiteHeader`, `SiteFooter` and
  existing hero and button classes.
- `public/robots.txt`, `public/_redirects` exactly as in Contracts.
- `sitemap-integration.mjs`; register it in `astro.config.mjs`.

### Slice 3: Star on GitHub

- `src/data/github-stars.ts` as in Contracts, with D1 and D2 applied.
- `SiteHeader.astro`: replace the icon link and its `.github-link` styles
  with the star control and its styles (existing tokens, pill radius, focus
  ring, `≤640px` collapse). Keep `target="_blank"` and `rel="noreferrer"`.

### Slice 4: Hero line and footer

- `Hero.astro`: the line and its style, `data-reveal` with a delay between
  the subhead's and the buttons'.
- `site.ts`: the three URLs. `SiteFooter.astro`: the second row as a `nav`
  with its own accessible label, wrapping cleanly at narrow widths. Add X or
  YouTube only if the maintainer names them.

### Slice 5: Honest download page

- Add the "Before you start" panel above `.install-workflow`, two columns,
  stacking at the existing 720px breakpoint, styled like the install box.
- Remove the "→ First, install an AI agent" block and the systems line from
  the heading row; their content now lives in the panel.
- Keep "Three steps to get started".
- Put the cost examples in one frontmatter array next to the existing
  command constants, each with a comment naming its record and price source.
- Apply D4 wording: the download page always; Quick Start and
  `AgentWorkspace.astro` only if D4's recommended option is chosen.

### Slice 6: Evidence for the numbers

Runs before Slice 5's bracketed copy is final. No paid generation unless D3
says so.

- **Agent plans:** re-read the OpenAI pricing and Claude pricing pages on the
  implementation day; write the checked date into the copy. If anything
  differs from Context, use the new facts and tell the maintainer.
- **Video take price:** run `renku generation price show --provider fal-ai
  --model minimax/h3-max/reference-to-video`. It reads Engines' cached or
  provider-published price with the saved key, and may refresh Renku's own
  price cache in `~/.config/renku`; it generates nothing. Apply it to
  `duration: 15`, `resolution: 768P`. Cross-check against the price on
  Fal.ai's model page. Do not write review documents into Urban Basilica;
  the project stays read-only.
- **Voice line price:** count the stored request's characters (54) and apply
  ElevenLabs' published API price for Eleven v4 on the pricing page. If the
  price depends on the plan, use the pay-as-you-go API rate and say so.
- **Storyboard pass:** per D3. Recommended: no price; the Codex usage
  sentence.
- **Setup time:** the maintainer times both installs. Start when the install
  command is pasted. Stop when Studio is open after first-run setup with one
  provider key saved. Exclude installing the agent app and creating provider
  accounts. N is the slower of the two runs, rounded up to the next 5
  minutes.
- Record every figure, source address and date in this plan's verification
  record.

### Slice 7: Documentation

See Documentation.

## Tests And Guardrails

The website has no test runner, and adding one is outside this scope.
Behavior is proven by type checking, the production build, checks on the
built files and local Cloudflare Pages emulation:

- **Build behavior:** an online build reads the count. A temporary local
  edit pointing the repository at `GoRenku/does-not-exist` makes the build
  stop with the planned message. Revert the edit and check it does not
  appear in `git diff`.
- **Head tags (every built HTML file):** exactly one canonical; `og:url`
  equals it; both start with `https://gorenku.com/` and end with `/`;
  `og:image` is an absolute `https://gorenku.com/assets/…jpg` whose file
  exists in `dist/` at 1200×630; `og:image:alt` is not empty; `twitter:card`
  is `summary_large_image`. Tutorial chapters with pictures use their own
  picture; the rest use the default.
- **Sitemap:** its addresses equal the set of built pages minus the 404 page.
- **Static files:** `dist/robots.txt`, `dist/_redirects` and `dist/404.html`
  exist.
- **Links:** every internal link and fragment in `dist/` resolves (the audit
  the site already uses).
- **Local Pages emulation** (`wrangler pages dev dist`): the address table
  in Final Verification.
- These checks are run as commands during verification; no checker script
  is committed.

## Documentation

- `packages/website/README.md`:
  - "Link previews": where the default card comes from, how it was rendered,
    how to re-render it, and that pages pass `linkPreview` to the layouts.
  - "GitHub star count": read once per build, needs `api.github.com`, D1
    behavior, D2 threshold, never fetched by visitors or in `astro dev`, and
    only refreshed by a new deploy.
  - "Search files": sitemap from the built page list, `robots.txt`, 404 page,
    and that redirects live only in `public/_redirects`.
  - Structure section: list the new files.
- `docs/product/website-learning-guides.md`:
  - `/download/` now also covers "What you'll need" and "What generation
    costs".
  - Editorial checks: agent plan requirements are re-checked on vendor pages
    and dated; cost examples come only from real Urban Basilica records priced
    on a stated date, and are refreshed together; system requirements match
    `distribution/install.sh` and `install.ps1`; the provider list matches
    onboarding.
- No ADR: no product architecture, package boundary or Studio contract
  changes. The build rule for the star count is website operations, recorded
  in the README.

## Final Verification

1. `pnpm --filter @gorenku/website check`.
2. `pnpm build:website:cloudflare` online, then the build-failure check from
   Tests And Guardrails.
3. The head-tag, sitemap, static-file and link checks over `dist/`.
4. `pnpm --filter @gorenku/website exec wrangler pages dev dist`, then
   `curl` each address and confirm:
   - `/`, `/download/`, `/terms/2026-09-23/`, `/tutorials/inspiration/`: 200;
   - `/does-not-exist`, `/blog/hello-world`, `/api/docs/x`: 404 with the 404
     page;
   - `/docs` and `/docs/`: 301 to `/quick-start/`;
   - `/docs/quick-start` and `/docs/quick-start/`: 301 to `/download/`;
   - `/docs/blueprint-authoring/`, `/docs/something-new`: 404 with the 404
     page;
   - `/install`: 301 to `/download/`;
   - `/robots.txt`: 200 text; `/sitemap.xml`: 200 XML.
   If local emulation cannot start because of the workspace's blocked
   install scripts, do not change `pnpm-workspace.yaml`; ask the maintainer
   to approve a preview-branch deployment instead.
5. Desktop screenshots at 1440×900 and 1024×768 of the home page header and
   hero, the footer, the download page with both platform tabs, the 404 page
   and one tutorial chapter. Compare with the current site's typography,
   spacing and colours. One check at 640px wide that the existing collapsed
   header still fits without sideways scrolling.
6. View the rendered default card and two tutorial previews at full size.
7. `git diff --stat` and the full diff: only the files in the Architecture
   Shape Gate plus the two documents; no formatting churn; no dead
   `.github-link` styles; `astro.config.mjs` gained only the integration.
8. After the maintainer deploys: repeat step 4's address checks against
   `https://gorenku.com`, fetch one `og:image` address, and confirm
   `https://renku-web.pages.dev/` pages name `https://gorenku.com/` as
   canonical.

## Verification Record (2026-10-15)

Decisions: D1, D2 (threshold 20), D3 and D5 as recommended. D4: "Codex in the
ChatGPT app", applied to all seven mentions. Setup-time item left out until the
two timed installs exist. No X or YouTube accounts.

- **Agent plans**, checked 2026-10-15: `learn.chatgpt.com/docs/pricing` (Codex
  in ChatGPT Free, Go, Plus, Pro, Business, Edu, Enterprise; desktop app named
  "ChatGPT desktop app"); `claude.com/pricing` (Claude Code not in Free; Pro
  $17/month yearly or $20 monthly). Matches Context.
- **Video take** (`asset_file_exnux9d4`, Fal.ai request
  `01a1256a-e327-7c91-8fd6-01ebbfd87101`): **$3.34**.
  - Renku's price lookup (`renku generation price show`) returned only the
    base $0.05/s with a note that resolution can change it.
  - `fal.ai/models/minimax/h3-max/reference-to-video` (2026-10-15): $0.08/s at
    768p → 15 × 0.08 = $1.20; references beyond 4,096 included tokens at
    $0.02 per 1,000.
  - Stored request references: four 16:9 images (1672×941/940, 1344×768) =
    4 × 1,824; one 15 s 24 fps 16:9 video at 768p = 102,816; 14.98 s audio ≈
    1,198. Total 111,310 − 4,096 = 107,214 → $2.14.
- **Voice line** (`asset_file_chmraa77`): 54 characters × $0.08 per 1,000
  (`elevenlabs.io/pricing/api`, Eleven v4, pay as you go, 2026-10-15) =
  $0.0043, shown as **$0.004**.
- **Storyboard pass**: no provider charge (Codex built-in), per D3.
- **Build checks**: `astro check` 0 errors; Cloudflare and Sites builds pass;
  repository switched to `GoRenku/does-not-exist` stopped the build with
  "Website build stopped: could not read the GitHub star count for
  GoRenku/does-not-exist (HTTP 404: Not Found). Try the build again later."
  (edit reverted).
- **dist checks**: every page has one canonical equal to `og:url` on
  `https://gorenku.com/…/`, a 1200×630 `og:image`, alt text and
  `summary_large_image`; sitemap equals built pages minus 404 (19); internal
  links and fragments all resolve. `personal-models` has a 859×551 picture, so
  it uses the default card (the layout stops the build on undersized previews).
- **Local Pages emulation**: every address in Final Verification step 4
  returned the expected status and destination.
- **Screenshots**: 1440×900 and 1024×768 header, hero, download, 404, footer,
  tutorial chapter; 640px header fits without sideways scroll.

## Completion Checklist

### Review Area

- [ ] Only `packages/website`, `docs/product/website-learning-guides.md` and
      this plan changed.
- [ ] Final files match the Architecture Shape Gate layout.
- [ ] Head tags are written only in `BaseLayout.astro`.
- [ ] No new dependency, browser script, Pages Function or Worker.
- [ ] Decisions D1–D5 and the visible copy were approved before Slice 5
      copy was finalized.

### Link Previews

- [ ] Default 1200×630 card rendered from existing assets, approved, and
      committed as `src/assets/renku-link-preview.jpg`.
- [ ] `LinkPreview` and `defaultLinkPreview` added to `site.ts`.
- [ ] `BaseLayout` writes canonical, `og:url`, `og:image` (+ width, height,
      alt) and `twitter:card`; existing tags kept.
- [ ] `LearnLayout` passes `linkPreview` through.
- [ ] Tutorial chapters with pictures and the tutorials overview pass their
      pictures; others use the default.

### Search Basics

- [ ] `404.astro` added with the approved copy; unknown paths return 404.
- [ ] `robots.txt` added exactly as specified.
- [ ] `sitemap-integration.mjs` writes `sitemap.xml` from built pages,
      excluding 404; registered in `astro.config.mjs`.
- [ ] `_redirects` contains the approved table, with and without trailing
      slashes, fixed rules before the pattern rule.
- [ ] `/terms/2026-09-23/` still returns 200.

### Header, Hero And Footer

- [ ] `github-stars.ts` reads the count once per build, validates it, makes
      no request in `astro dev`, and fails per D1.
- [ ] Star control replaces the icon, shows the count per D2, has the
      approved accessible name, and collapses at ≤640px.
- [ ] Hero line added with the approved wording.
- [ ] Footer row links both repositories, Discussions and Latent Matinee; no
      invented accounts.
- [ ] Discussions confirmed enabled by 0231 before deployment.

### Download Page

- [ ] "Before you start" panel with the four needs and the cost box.
- [ ] Agent block and duplicated systems line removed; "Three steps to get
      started" is accurate.
- [ ] Agent plan facts re-checked and dated on the implementation day.
- [ ] Video and voice prices taken from Slice 6 sources, with record, date
      and source in a comment and in the verification record.
- [ ] Storyboard and video examples follow D3; no paid generation without
      approval.
- [ ] Setup time filled from the maintainer's two timed installs.
- [ ] D4 wording applied to the agreed set of mentions.

### Documentation

- [ ] Website README sections for link previews, star count and search files;
      structure list updated.
- [ ] `website-learning-guides.md` updated for the download page and the new
      editorial checks.

### Final Verification

- [ ] `astro check` passes.
- [ ] Online production build passes; the failure check stops with the
      planned message and the temporary edit is reverted.
- [ ] Head-tag, sitemap, static-file and link checks pass on `dist/`.
- [ ] Local Pages emulation returns every expected status and destination.
- [ ] Desktop screenshots reviewed; 640px header check passes.
- [ ] `git diff --stat` and full diff reviewed; no formatting churn; no large
      or tangled new file; `astro.config.mjs` stays small.
- [ ] Deployment left to the maintainer; post-deploy checks run after it.
- [ ] Only then mark the plan complete.
