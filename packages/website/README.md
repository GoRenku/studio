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
src/
  assets/
    renku-logo.svg     Brand mark (shared with the studio app)
    screens/           Product screenshots captured from Renku Studio
  components/          Page sections (hero, features, audience, CTA, chrome)
  data/site.ts         All page copy and screenshot wiring — edit content here
  layouts/BaseLayout.astro  HTML shell, fonts, global CSS, scroll-reveal script
  pages/index.astro    The landing page
  styles/global.css    Design tokens and shared primitives
```

## Editing content

Copy (headlines, feature bullets, audience cards) lives in
[`src/data/site.ts`](src/data/site.ts), separated from markup. Screenshots are
imported there and flow through Astro's asset pipeline (`astro:assets`), which
generates responsive derivatives at build time.

## Refreshing screenshots

Screenshots in `src/assets/screens/` were captured from a locally running
Renku Studio (`http://localhost:5173`, project `urban-basilica`) at
1440×900 @2x with Playwright. Recapture with any Playwright-driven script
pointing at the same routes if the product UI changes.

Shot Planning uses two tabs with full inline Studio screenshots: the Bombardment
Shot List and the Harbor Blender Previs comparison. Blender Previs is selected
initially. One disclosure reveals the Blender render and generated take together;
both videos pause when it closes or the user switches to Shot List.
The website videos are compressed to 960 pixels wide. The 17-second Blender
render is silent; the generated take retains audio. Their Urban Basilica sources
are `scenes/03/01-shot-plan/previs/renders/previs-gt2m.mp4` and
`scenes/03/01-shot-plan/s03-p01-video-gn6p.mp4`. Project originals are unchanged.

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
