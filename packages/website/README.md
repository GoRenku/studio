# @gorenku/website

Marketing website for **Renku** — the filmmaking studio for live action and AI.
Built with [Astro](https://astro.build).

## Website analytics

The website uses the existing **Renku Website** PostHog project in the EU region.
Its public project token is set in `src/components/WebsiteAnalytics.astro`.
The consent banner stores a `yes` or `no` choice in browser `localStorage`.
PostHog is loaded only after `yes`; the local Studio app has no website tracking.

After consent, the site sends pageviews plus these focused events:

| Event | When it is sent |
| --- | --- |
| `download_clicked` | A link to `/download` is clicked. |
| `quick_start_viewed` | Quick Start is opened. |
| `tutorials_viewed` | The tutorial index is opened. |
| `tutorial_viewed` | A tutorial is opened, with its slug in `tutorial`. |

Visitors can change their choice with **Analytics choice** in the footer.
The banner and footer link to the public `/privacy/` notice; update that notice
if website analytics or Studio data handling changes.

## Commands

Run from this directory (or with `pnpm --filter @gorenku/website <cmd>` from the repo root):

| Command                  | Action                                               |
| ------------------------ | ---------------------------------------------------- |
| `pnpm dev`               | Start the dev server at `localhost:4321`             |
| `pnpm build`             | Build the Sites-compatible bundle to `./dist/`       |
| `pnpm build:cloudflare`  | Build the static Cloudflare Pages site to `./dist/`  |
| `pnpm deploy:cloudflare` | Build and publish to the existing `renku-web` project |
| `pnpm preview`           | Preview the most recent build locally                |
| `pnpm check`             | Type-check `.astro` and `.ts` files                  |

## Structure

```
astro.config.mjs       Site config; registers the sitemap integration
sitemap-integration.mjs  Writes dist/sitemap.xml from the built pages
public/
  _redirects           Permanent redirects for old addresses (Cloudflare Pages)
  robots.txt           Allows everything; points to the sitemap
  captions/            WebVTT captions for videos with speech
src/
  assets/
    renku-logo.svg     Brand mark (shared with the studio app)
    renku-link-preview.jpg  Default 1200×630 link-preview card
    screens/           Product screenshots captured from Renku Studio
    films/             Stills, storyboards and references copied from sample films
  components/          Page sections (hero, features, audience, CTA, chrome)
  content.config.ts    Content collections: journal posts and GitHub release notes
  content/journal/     Journal posts in Markdown
  data/site.ts         All page copy and screenshot wiring — edit content here
  data/made-with-renku.ts  Films, scenes and media for the Made with Renku section
  data/tutorials.ts    Chapters, recipes and practical guides
  data/github-stars.ts Build-time GitHub star count for the header
  layouts/BaseLayout.astro  HTML shell, head tags, fonts, global CSS, scroll-reveal script
  pages/index.astro    The landing page
  pages/404.astro      Page shown for every unknown address
  pages/journal/       Journal list, posts and rss.xml feed
  pages/changelog.astro  Release notes from GitHub Releases
  styles/global.css    Design tokens and shared primitives
  styles/article.css   Reading column for the journal, changelog and legal pages
```

## Journal and changelog

Add a journal post as `src/content/journal/<post-id>.md` with `title`,
`description` and a quoted `date: "YYYY-MM-DD"`. The post appears at
`/journal/<post-id>/` and in the RSS feed at `/journal/rss.xml`, which every
page advertises. Bad frontmatter stops the build.

`/changelog/` reads `GoRenku/studio` releases from `api.github.com` during each
build and dev start, like the star count. It lists only published releases with
written notes; GitHub's generator comment and "Full Changelog" link alone do
not count. If GitHub cannot be reached, the build stops with a message naming
the repository. After a release, redeploy the website to show its notes.

## Link previews

`BaseLayout.astro` is the only place head tags are written. Every page gets a
canonical `https://gorenku.com/.../` address, `og:url`, `og:image` (with size
and description) and `twitter:card`. Pages and `LearnLayout.astro` pass an
optional `linkPreview` (`{ image, alt }`); without one the default card is used.
The layout crops the picture to 1200×630 from the top and stops the build if a
picture is smaller than that. Tutorial chapters pass their own picture when it
is large enough.

The default card `src/assets/renku-link-preview.jpg` was rendered once from
`studio-generation-review-clean.jpg`, the Renku logo and wordmark, and the hero
line, using the site's fonts and colours. To re-render it, compose the same
elements in a 1200×630 HTML page and capture it at scale 1 with headless Chrome
(`--headless=new --window-size=1200,630 --force-device-scale-factor=1
--screenshot`), then save it as JPEG over the existing file. Social sites cache
previews, so re-scrape the home page (for example in LinkedIn Post Inspector)
after changing it.

## GitHub star count

The header's "Star on GitHub" control shows the star count of `GoRenku/studio`.
`src/data/github-stars.ts` reads it once per build from `api.github.com`
(unauthenticated; one request per build). Visitors' browsers never call GitHub,
and `astro dev` makes no request and shows the control without a number.

- If GitHub cannot be reached or answers with an error, the build stops with a
  message naming the repository and GitHub's answer. Try again later.
- The number is shown only from `studioStarCountShownFrom` (20) stars; below
  that the control reads "Star on GitHub" alone.
- The number only changes when the site is rebuilt and deployed.

## Search files

- `sitemap.xml` is written by `sitemap-integration.mjs` from the pages Astro
  built, minus the 404 page and non-page files such as `journal/rss.xml`. New
  pages appear without editing a list.
- `public/robots.txt` allows everything and names the sitemap.
- `src/pages/404.astro` builds `404.html`. Its presence makes Cloudflare Pages
  answer unknown addresses with status 404 instead of serving the home page.
- Redirects live only in `public/_redirects` (all 301). Do not add Astro
  `redirects`, Pages Functions or a Worker for them. Check them locally with
  `pnpm exec wrangler pages dev dist` after a Cloudflare build.

## Editing content

Copy (headlines, feature bullets, audience cards) lives in
[`src/data/site.ts`](src/data/site.ts), separated from markup. Screenshots are
imported there and flow through Astro's asset pipeline (`astro:assets`), which
generates responsive derivatives at build time.

## Refreshing screenshots

The hero launch film lives in `src/assets/media/renku-launch.mp4`, with its
opening still in `src/assets/screens/renku-launch-poster.jpg`. It plays only on
request and uses `preload="none"`; the centered play button disappears when
playback starts. Native player controls handle playback, seeking, volume, and
fullscreen. The web copy retains audio and is compressed to 1280×720 (H.264 CRF 26,
AAC 128 kb/s, fast-start MP4). The source render at
`launch-video-gen/renders/renku-launch.mp4` is unchanged.

Screenshots in `src/assets/screens/` were captured from a locally running
Renku Studio (`http://localhost:5173`, project `urban-basilica`) at
1440×900 @2x with Playwright. Recapture with any Playwright-driven script
pointing at the same routes if the product UI changes.

Shot Planning uses two tabs with full inline Studio screenshots: the Bombardment
Shot List and the Harbor Blender Previs comparison. Blender Previs is selected
initially.
The website videos are compressed to 960 pixels wide. The 17-second Blender
render is silent; the generated take retains audio. Their Urban Basilica sources
are `scenes/03/01-shot-plan/previs/renders/previs-gt2m.mp4` and
`scenes/03/01-shot-plan/s03-p01-video-gsb7.mp4` (the second take, made with the
dialogue recording as its audio reference). Project originals are unchanged.
The Blender Previs tab links to the Made with Renku section, which shows both.

## Made with Renku media

The home page's Made with Renku section and the dialogue previs recipe show
only media with a recorded Renku generation, copied from
`~/renku-movies/urban-basilica` and `~/renku-movies/sintel` without changing
either project. Studio screenshots were captured at 1440×900 @2x with
Playwright from a local Studio, viewing only.

| Website file | Source | Transform |
| --- | --- | --- |
| `films/basilica/harbor/beat-01.png` … `beat-04.png` | `storyboards/03/02-iteration/s03-b01-image-g94y.png`, `s03-b02-image-g4xg.png`, `s03-b03-image-g3j7.png`, `s03-b04-image-gvjq.png` (Codex built-in) | copied |
| `films/basilica/harbor/previs-poster.jpg`, `previs-revision-1.jpg` | `scenes/03/01-shot-plan/previs/renders/previs-gt2m.mp4`, `previs-gzbc.mp4` | frame at 6 s, `ffmpeg -q:v 3` |
| `films/basilica/harbor/take-poster.jpg` | `scenes/03/01-shot-plan/s03-p01-video-gsb7.mp4` (MiniMax H3 Max on fal.ai) | frame at 4 s |
| `films/basilica/harbor/reference-urban.jpg`, `reference-imperial-wound.jpg` (journal post, first take) | `cast/urban/urban-character-sheet-2.png` (fal.ai GPT Image 2), `visual-language/lookbooks/production/imperial-wound.png` (fal.ai GPT Image 2) | `sips -Z 1600`, JPEG 85 |
| `films/basilica/harbor/reference-mara-second-take.jpg`, `reference-urban-second-take.jpg`, `reference-harbor-quarter.jpg` | `cast/mara/mara-foundry-continuity-16-sheet-gt3n.png`, `cast/urban/urban-production-character-sheet-g5f3.png`, `locations/harbor-quarter/harbor-quarter-pre-conques-sheet-gsyn.png` (all Codex) | `sips -Z 1600`, JPEG 85 |
| `films/basilica/harbor/reference-first-take-frame.jpg` | `scenes/03/01-shot-plan/harbor-finished-look.png`, a frame of the first take (`gn6p`) | `sips -Z 1600`, JPEG 85 |
| `media/harbor-dialogue.mp3` | `scenes/03/01-shot-plan/dialogue-pauses-shortened.wav` (ElevenLabs v4 text-to-dialogue, one pause shortened) | MP3 128 kb/s |
| `films/basilica/harbor/take-direction.txt` | the `gsb7` take's stored request prompt | copied exactly |
| `films/basilica/first-patron/previs-revision-1.jpg` | `scenes/02/02-shot-plan/previs/renders/previs-g51n.mp4` | frame at 16 s |
| `media/first-patron-previs.mp4` | `scenes/02/02-shot-plan/previs/renders/previs-gkh9.mp4` (revision 6) | remuxed, fast-start |
| `media/first-patron-take.mp4` | `scenes/02/02-shot-plan/s02-p02-video-ghm2.mp4` | 960 wide, H.264 CRF 26, AAC 128 kb/s, fast-start |
| `screens/first-patron-previs-plan.png`, `location-hero-harbor-quarter.png` | Studio: Scene 2 Previs Shot Plan; Harbor Quarter Location | screenshot |
| `screens/harbor-dialogue-direction.png` | Studio: Scene 3 dialogue panel, captured by the maintainer | copied |
| `films/sintel/scene-3/beat-01.png` … `beat-04.png` | Sintel `storyboards/3/00-iteration/s3-b01-image-g403.png` … `s3-b04-image-gqdt.png` (Codex built-in) | copied |
| `public/captions/*.vtt` | the scenes' screenplay lines | written; timing from silence detection, checked with a Whisper transcript |

The second take's Mara sheet has a Codex generation record. The older
`cast/mara/mara.png` is recorded as imported and is not shown. Sintel
appears under the Blender Foundation's CC BY 3.0 credit shown in the section.

## Publishing to gorenku.com

The website is published from this machine through the existing Cloudflare
Pages project named `renku-web`. That project already owns the `gorenku.com`
custom domain. A production deployment replaces the site currently served by
that project; it does not create a second Pages project or change DNS.

Authenticate once through Wrangler if this machine is not already signed in:

```bash
cd packages/website
pnpm exec wrangler login
```

Then publish from the repository root:

```bash
pnpm deploy:website
```

The command deliberately uses a dedicated Cloudflare build lane:

1. `astro build` creates a plain static site in `packages/website/dist/`.
2. Wrangler uploads that directory to `renku-web` as the `main` production
   branch.
3. Cloudflare promotes the deployment to `gorenku.com` while retaining prior
   deployments for rollback in the Pages dashboard.

Do not replace `build:cloudflare` with the package's ordinary `build` command.
The ordinary build rearranges `dist/` for Sites hosting, while Cloudflare Pages
must receive Astro's plain static output.

To inspect the exact production build locally without publishing:

```bash
pnpm build:website:cloudflare
pnpm --filter @gorenku/website preview
```

The deploy command is intentionally manual. Builds, checks, previews, and
ordinary product releases never publish the website automatically.
