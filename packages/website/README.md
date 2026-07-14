# @gorenku/website

Marketing website for **Renku** — the previsualization studio for filmmakers.
Built with [Astro](https://astro.build).

## Commands

Run from this directory (or with `pnpm --filter @gorenku/website <cmd>` from the repo root):

| Command        | Action                                       |
| -------------- | -------------------------------------------- |
| `pnpm dev`     | Start the dev server at `localhost:4321`     |
| `pnpm build`   | Build the production site to `./dist/`      |
| `pnpm preview` | Preview the production build locally         |
| `pnpm check`   | Type-check `.astro` and `.ts` files          |

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
